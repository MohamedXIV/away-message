import { describe, expect, it, vi } from 'vitest';
import { ConversationHistory, LIVE_RECENT_CONVERSATION_MESSAGES,
  LIVE_COLD_CONVERSATION_PAGE_SIZE } from '../../src/engine/social/ConversationHistory';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import type { MessageRecord } from '../../src/engine/types';

const record = (id: string, index: number, senderId = id): MessageRecord => ({
  id: `m_${index}`, conversationId: id, senderId,
  recipientId: senderId === 'player' ? id : 'player',
  timestampMinute: index % 9 === 0 ? 40 : index * 43,
  day: index % 9 === 0 ? 1 : Math.floor(index * 43 / 1440) + 1,
  isRead: index % 4 === 0,
  deliveredAway: index % 6 === 0, text: `chat ${index} ${'heavy'.repeat(80)}`,
  tags: index % 7 === 0 ? ['offline-message'] : undefined,
});

describe('#173 bounded live canonical conversation storage', () => {
  it('seals historical bodies into serialized pages and retains only bounded hot objects', () => {
    const history = new ConversationHistory(id => id);
    const all = Array.from({ length: 400 }, (_, i) => record('a', i));
    history.restore({ a: all });
    const first = history.getStorageFootprint('a');
    expect(first.total).toBe(400);
    expect(first.serializedPages).toBeGreaterThan(4);
    expect(first.materialized).toBeLessThanOrEqual(
      LIVE_RECENT_CONVERSATION_MESSAGES + LIVE_COLD_CONVERSATION_PAGE_SIZE - 1);
    for (let i = 400; i < 800; i++) {
      history.append(record('a', i));
      const footprint = history.getStorageFootprint('a');
      expect(footprint.materialized).toBeLessThanOrEqual(
        LIVE_RECENT_CONVERSATION_MESSAGES + LIVE_COLD_CONVERSATION_PAGE_SIZE - 1);
    }
    expect(history.exportAll().a).toEqual(Array.from({ length: 800 }, (_, i) => record('a', i)));
    expect(history.getStorageFootprint('a').total).toBe(800);
    history.delete('a');
    expect(history.getStorageFootprint('a')).toEqual({ total: 0, materialized: 0, serializedPages: 0 });
  });

  it('pages across cold chunk, pending chunk, and hot tail boundaries without decoding all pages', () => {
    const history = new ConversationHistory(id => id);
    const all = Array.from({ length: 303 }, (_, i) => record('a', i));
    history.restore({ a: all });
    const spy = vi.spyOn(JSON, 'parse');
    for (const [offset, limit] of [[0, 50], [30, 50], [82, 50], [173, 50], [299, 50], [550, 30], [0, 0]] as const) {
      const end = Math.max(0, all.length - offset);
      const start = Math.max(0, end - Math.min(50, limit));
      const before = spy.mock.calls.length;
      const page = history.page('a', offset, limit);
      expect(page.messages).toEqual(all.slice(start, end));
      expect(page.total).toBe(all.length);
      expect(page.hasOlder).toBe(start > 0);
      expect(spy.mock.calls.length - before).toBeLessThanOrEqual(2);
    }
    spy.mockRestore();
    const page = history.page('a', 190, 50);
    page.messages[0]!.text = 'forged';
    page.messages[0]!.tags?.push('forged');
    expect(history.page('a', 190, 50).messages[0]).toEqual(all.at(-190 - 50));
  });

  it('maintains exact unread counts, bounded newest previews, offline context and day indices', () => {
    const history = new ConversationHistory(id => id);
    const a = Array.from({ length: 900 }, (_, i) => record('a', i));
    const b = Array.from({ length: 240 }, (_, i) => record('b', i, i % 2 ? 'player' : 'b'));
    history.restore({ a, b });
    const expected = { a: a.filter(m => !m.isRead).length,
      b: b.filter(m => m.senderId !== 'player' && !m.isRead).length };
    expect(history.unreadCounts()).toEqual(expected);
    expect(history.unreadTray(10).unreadCount).toBe(expected.a + expected.b);
    const top = [...a, ...b].filter(m => m.senderId !== 'player' && !m.isRead)
      .sort((x,y) => y.timestampMinute - x.timestampMinute || y.id.localeCompare(x.id))
      .slice(0, 10).map(m => ({ id: m.id, buddyId: m.conversationId, buddyName: m.conversationId, text: m.text }));
    expect(history.unreadTray(10).previews).toEqual(top);
    expect(history.lastOfflineMessage('a')).toBe(a.filter(m => m.tags?.includes('offline-message')).at(-1)!.text);
    expect(history.hasMessageOnDay('a', 1)).toBe(true);
    expect(history.lastActivity('a')).toBe(Math.max(...a.map(m => m.timestampMinute)));
    expect(history.markRead('a')).toBe(true);
    expect(history.markRead('a')).toBe(false);
    expect(history.exportAll().a!.every(m => m.isRead)).toBe(true);
    expect(history.unreadCounts()).toEqual({ b: expected.b });
    history.append(record('a', 901, 'player'));
    expect(history.playerWroteOnDay(Math.floor(901 * 43 / 1440) + 1)).toBe(true);
    history.delete('a');
    expect(history.playerWroteOnDay(Math.floor(901 * 43 / 1440) + 1)).toBe(false);
  });

  it('preserves Social public APIs, source ownership and snapshot roundtrip after large history', () => {
    const social = new SocialEngine(new EventBus());
    const buddy = social.getBuddies()[0]!;
    social.learnHandle(buddy.id, buddy.handle);
    for (let i = 0; i < 290; i++) {
      social.sendMessage(buddy.id, i % 2 ? 'player' : buddy.id,
        i % 2 ? buddy.id : 'player', `text-${i}`, 1800 + i);
    }
    const state = social.getState();
    expect(state.conversations[buddy.id]).toHaveLength(290);
    const loaded = new SocialEngine(new EventBus(), state);
    expect(loaded.getState()).toEqual(state);
    expect(loaded.getConversationPage(buddy.id, 170, 50))
      .toEqual(social.getConversationPage(buddy.id, 170, 50));
    expect(loaded.getConversationUnreadCounts()).toEqual(social.getConversationUnreadCounts());
    expect(loaded.markAsRead(buddy.id)).toBe(true);
    expect(loaded.getState().conversations[buddy.id]!.every(m => m.isRead)).toBe(true);
  });
});
