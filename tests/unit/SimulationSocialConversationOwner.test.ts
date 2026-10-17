import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { ConversationHistory } from '../../src/engine/social/ConversationHistory';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';
import type { MessageRecord } from '../../src/engine/types';

function incoming(index: number, id = 'contact'): MessageRecord {
  const timestampMinute = index % 5 === 0 ? 100 : 2000 + index;
  return {
    id: `msg_fixed_${index}`, conversationId: id,
    senderId: id, recipientId: 'player', text: `voice-${index}`,
    timestampMinute, day: Math.floor(timestampMinute / 1440) + 1,
    isRead: index % 3 === 0,
    tags: index % 4 === 0 ? ['offline-message'] : undefined,
  };
}

describe('#173 single-owner Social conversation history', () => {
  it('preserves message order, detached pagination, unread indices and restore with unordered timestamps', () => {
    const history = new ConversationHistory(id => id === 'old' ? 'contact' : id);
    history.ensure('old');
    const records = Array.from({ length: 151 }, (_, index) => incoming(index));
    for (const record of records) history.append(record);
    const out: MessageRecord = {
      ...incoming(777), id: 'msg_player', conversationId: 'contact',
      senderId: 'player', recipientId: 'contact', isRead: true,
      timestampMinute: 4200, day: 3,
    };
    history.append(out);
    expect(history.summary('contact')).toEqual({
      lastMessageMinute: 4200,
      unread: records.filter(m => !m.isRead).length,
    });
    expect(history.lastActivity('old')).toBe(4200);
    expect(history.lastPlayerMessageMinute()).toBe(4200);
    expect(history.playerWroteOnDay(3)).toBe(true);
    expect(history.playerWroteOnDay(2)).toBe(false);
    expect(history.hasMessageOnDay('old', 1)).toBe(true);

    for (const [offset, limit] of [[0, 30], [30, 30], [149, 50], [900, 20], [0, 100]] as const) {
      const page = history.page('old', offset, limit);
      const boundedLimit = Math.min(50, limit);
      const end = Math.max(0, records.length + 1 - offset);
      const start = Math.max(0, end - boundedLimit);
      expect(page.conversationId).toBe('contact');
      expect(page.total).toBe(152);
      expect(page.messages).toEqual([...records, out].slice(start, end));
      expect(page.hasOlder).toBe(start > 0);
      expect(page.messages.length).toBeLessThanOrEqual(50);
    }
    const before = history.page('old', 0, 30);
    before.messages[0]!.text = 'FORGED';
    const tagged = before.messages.find(message => message.tags?.length)!;
    tagged.tags!.push('invented');
    const after = history.page('contact', 0, 30);
    expect(after.messages[0]!.text).not.toBe('FORGED');
    expect(after.messages.find(message => message.id === tagged.id)?.tags).not.toContain('invented');
    const state = history.exportAll();
    expect(state.contact).toHaveLength(152);
    const restored = new ConversationHistory(id => id);
    restored.restore(state);
    expect(restored.page('contact', 30, 30)).toEqual(history.page('old', 30, 30));
    expect(restored.unreadCounts()).toEqual(history.unreadCounts());
    expect(restored.lastPlayerMessageMinute()).toBe(4200);
    expect(restored.unreadTray(4)).toEqual(history.unreadTray(4));

    expect(history.markRead('contact')).toBe(true);
    expect(history.markRead('contact')).toBe(false);
    expect(history.summary('contact').unread).toBe(0);
    expect(history.unreadTray()).toEqual({ unreadCount: 0, previews: [] });
    history.delete('old');
    expect(history.lastPlayerMessageMinute()).toBe(0);
    expect(history.playerWroteOnDay(3)).toBe(false);
  });

  it('keeps Social and Kernel contract parity on save/restore, including offline markers and read receipts', () => {
    const social = new SocialEngine(new EventBus());
    const [a, b] = social.getBuddies().slice(0, 2);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    social.learnHandle(a!.id, a!.handle);
    social.learnHandle(b!.id, b!.handle);
    for (let i = 0; i < 110; i++) {
      const id = i % 2 === 0 ? a!.id : b!.id;
      social.sendMessage(id, id, 'player', `hello-${i}`, i % 11 === 0 ? 510 : 2200 + i,
        false, i % 13 === 0 ? ['offline-message'] : undefined);
    }
    social.sendMessage(a!.id, 'player', a!.id, 'outbound', 4800);
    const snapshot = social.getState();
    const legacyCounts = Object.fromEntries(Object.entries(snapshot.conversations)
      .map(([id, messages]) => [id, messages.filter(m => m.senderId !== 'player' && !m.isRead).length])
      .filter(([, count]) => count > 0));
    expect(social.getConversationUnreadCounts()).toEqual(legacyCounts);
    const previews = Object.entries(snapshot.conversations).flatMap(([id, msgs]) => msgs
      .filter(m => m.senderId !== 'player' && !m.isRead)
      .map(m => ({ id: m.id, buddyId: id,
        buddyName: social.getBuddy(id)?.displayName ?? id,
        text: m.text, minute: m.timestampMinute })))
      .sort((x, y) => y.minute - x.minute || y.id.localeCompare(x.id))
      .slice(0, 4)
      .map(({ id, buddyId, buddyName, text }) => ({ id, buddyId, buddyName, text }));
    expect(social.getUnreadTraySummary(4).previews).toEqual(previews);
    expect(social.getLastOfflineMessageText(a!.id)).toBeTruthy();
    expect(social.getLastPlayerMessageMinute()).toBe(4800);
    expect(social.didPlayerWriteOnDay(4)).toBe(true);
    const restored = new SocialEngine(new EventBus(), snapshot);
    expect(restored.getState()).toEqual(snapshot);
    expect(restored.getUnreadTraySummary(4)).toEqual(social.getUnreadTraySummary(4));
    expect(restored.getMessengerSummary()).toEqual(social.getMessengerSummary());
    expect(restored.getConversationPage(a!.id, 10, 40)).toEqual(social.getConversationPage(a!.id, 10, 40));
    expect(restored.markAsRead(a!.id)).toBe(true);
    expect(restored.markAsRead(a!.id)).toBe(false);
    expect(restored.getConversationUnreadCounts()[a!.id]).toBeUndefined();
    expect(restored.getState().conversations[a!.id].every(m => m.isRead)).toBe(true);
  });

  it('scales 500-actor visible summaries without full historical state assembly', () => {
    const { engine, actorIds } = createSimulationBenchmarkFixture(500);
    const all = vi.spyOn(engine.social, 'getState');
    const broad = vi.spyOn(engine, 'getState');
    for (let index = 0; index < 500; index++) {
      const id = actorIds[index]!;
      const buddy = engine.social.getBuddy(id)!;
      engine.social.learnHandle(id, buddy.handle);
      for (let turn = 0; turn < 8; turn++) {
        engine.social.sendMessage(id, id, 'player', `talk-${index}-${turn}`, 1000 + turn);
      }
    }
    expect(engine.social.getMessengerSummary(50)).toHaveLength(50);
    expect(Object.keys(engine.social.getConversationUnreadCounts(500, true)).length).toBeGreaterThan(50);
    expect(engine.social.getUnreadTraySummary(4, true).previews).toHaveLength(4);
    const page = engine.getConversationRead(actorIds[0]!, 0, 30);
    expect(page.messages).toHaveLength(8);
    expect(page.hasOlder).toBe(false);
    expect(JSON.parse(JSON.stringify(page))).toEqual(page);
    expect(all).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
  }, 30_000);
});
