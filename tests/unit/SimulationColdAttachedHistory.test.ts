// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationHistory } from '../../src/engine/social/ConversationHistory';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { db } from '../../src/persistence/db';
import { loadSlotColdBootstrap, saveSlot } from '../../src/persistence/slots';
import { readSavedColdConversationChunk } from '../../src/persistence/conversationArchive';
import type { MessageRecord } from '../../src/engine/types';

function message(i: number): MessageRecord {
  const minute = i % 7 ? 3000 + i : 350;
  return {
    id: `m${i}`, conversationId: 'test', senderId: i % 4 === 0 ? 'player' : 'test',
    recipientId: i % 4 === 0 ? 'test' : 'player',
    text: `text-${i}`, timestampMinute: minute, day: Math.floor(minute / 1440) + 1,
    isRead: i % 5 === 0, deliveredAway: false,
    tags: i % 11 === 0 ? ['offline-message'] : undefined,
  };
}

describe('#173 cold runtime conversation authority and async page seam', () => {
  it('attaches immutable history, reads at most selected chunks, merges new messages and read receipts', async () => {
    const all = Array.from({ length: 250 }, (_, i) => message(i));
    const saved = ConversationHistory.summarizeForColdBootstrap('test', all);
    const coldCount = all.length - 32;
    const cold = all.slice(0, coldCount);
    const read = vi.fn(async (id: string, chunk: number) => id === 'test'
      ? cold.slice(chunk * 64, (chunk + 1) * 64) : null);
    const owner = new ConversationHistory(id => id);
    owner.restoreCold({ test: all.slice(coldCount) }, { test: coldCount },
      { test: saved }, read);
    expect(owner.getStorageFootprint('test')).toEqual({ total: 250, materialized: 32, serializedPages: 0 });
    expect(owner.unreadCounts()).toEqual({ test: all.filter(m => m.senderId !== 'player' && !m.isRead).length });
    expect(owner.unreadTray(4).previews).toEqual(
      new ConversationHistory(id => id) && (() => {
        const full = new ConversationHistory(id => id); full.restore({ test: all });
        return full.unreadTray(4).previews;
      })(),
    );
    expect(() => owner.exportAll()).toThrow(/async export/);
    expect(() => owner.allMessages('test')).toThrow(/async export/);
    expect(() => owner.page('test', 80, 50)).toThrow(/async read/);
    const newMsg = { ...message(250), id: 'new-msg', text: 'new-only' };
    owner.append(newMsg);
    const beforeRead = read.mock.calls.length;
    expect((await owner.pageAsync('test', 50, 50)).messages)
      .toEqual([...all, newMsg].slice(151, 201));
    expect(read.mock.calls.length - beforeRead).toBeLessThanOrEqual(2);
    const latest = owner.page('test', 0, 30);
    expect(latest.messages.at(-1)?.id).toBe('new-msg');
    expect(latest.total).toBe(251);
    const page = await owner.pageAsync('test', 220, 30);
    page.messages[0]!.text = 'forged';
    page.messages[0]!.tags?.push('forged');
    expect((await owner.pageAsync('test', 220, 30)).messages[0]!.text).not.toBe('forged');
    expect(owner.markRead('test')).toBe(true);
    expect(owner.markRead('test')).toBe(false);
    expect(owner.unreadTray(10).unreadCount).toBe(0);
    expect((await owner.pageAsync('test', 200, 30)).messages.every(m => m.isRead)).toBe(true);
    expect((await owner.exportAllAsync()).test)
      .toEqual([...all, newMsg].map(m => ({ ...m, isRead: true })));
    owner.append({ ...message(251), id: 'new-unread', isRead: false });
    expect(owner.unreadCounts()).toEqual({ test: 1 });
    expect((await owner.allMessagesAsync('test')).at(-1)?.id).toBe('new-unread');
    owner.delete('test');
    expect(await owner.pageAsync('test', 0, 50)).toEqual({
      conversationId: 'test', messages: [], total: 0, hasOlder: false,
    });
  });

  it('fails closed on missing pages and rejects concurrent deletion during async reads', async () => {
    const all = Array.from({ length: 120 }, (_, i) => message(i));
    const recent = { test: all.slice(-32) };
    const owner = new ConversationHistory(id => id);
    owner.restoreCold(recent, { test: 88 },
      { test: ConversationHistory.summarizeForColdBootstrap('test', all) },
      async () => null);
    await expect(owner.pageAsync('test', 90, 30)).rejects.toThrow(/cold conversation page/);
    await expect(owner.exportAllAsync()).rejects.toThrow(/cold conversation page/);
    let resolve!: (page: MessageRecord[]) => void;
    const delayed = new ConversationHistory(id => id);
    delayed.restoreCold(recent, { test: 88 },
      { test: ConversationHistory.summarizeForColdBootstrap('test', all) },
      () => new Promise(done => { resolve = done; }));
    const inFlight = delayed.pageAsync('test', 90, 20);
    delayed.delete('test');
    resolve(all.slice(64, 88));
    await expect(inFlight).rejects.toThrow(/changed during async/);
  });

  beforeEach(async () => {
    await db.transaction('rw', db.saves, db.conversation_pages, async () => {
      await db.saves.clear();
      await db.conversation_pages.clear();
    });
  });

  it('uses the actual slot reader with generation guard and preserves player-knowledge privacy', async () => {
    const source = new SimulationEngine();
    const buddy = source.social.getBuddies()[0]!;
    for (let i = 0; i < 200; i++) {
      source.social.sendMessage(buddy.id, buddy.id, 'player', `cold-${i}`, 1800 + i);
    }
    const messages = source.social.getMessages(buddy.id);
    await saveSlot(source, 'source');
    const boot = (await loadSlotColdBootstrap('source'))!;
    const engine = new SimulationEngine(boot.snapshot);
    const reader = (id: string, page: number) =>
      readSavedColdConversationChunk(boot.archive.slotId, id, page, boot.archive.updatedAt);
    engine.social.attachColdConversations(boot.snapshot.social.conversations,
      boot.archive.counts, boot.archive.indexes, reader);
    expect(engine.social.hasColdConversations()).toBe(true);
    expect(engine.social.getConversationUnreadCounts()[buddy.id]).toBe(200);
    expect(engine.getConversationRead(buddy.id).messages).toEqual([]);
    expect((await engine.getConversationReadAsync(buddy.id, 170, 20)).messages).toEqual([]);
    engine.social.learnHandle(buddy.id, buddy.handle);
    const selected = await engine.getConversationReadAsync(buddy.id, 105, 30);
    expect(selected.messages).toEqual(messages.slice(65, 95));
    expect((await engine.social.getMessagesAsync(buddy.id))).toEqual(messages);
    // Synchronous save is rejected, never writes a silently truncated slot.
    await expect(saveSlot(engine, 'new')).rejects.toThrow(/async export/);
    engine.markConversationAsRead(buddy.id);
    expect((await engine.getConversationReadAsync(buddy.id, 105, 30)).messages.every(m => m.isRead)).toBe(true);
    expect(engine.social.getUnreadTraySummary(4).unreadCount).toBe(0);
    // Overwrite of originating slot invalidates the generation-bound source.
    await saveSlot(source, 'source');
    const changed = await engine.getConversationReadAsync(buddy.id, 105, 30);
    expect(changed.messages).toHaveLength(30);
    const record = (await db.saves.get('source'))!;
    record.updatedAt += 1;
    await db.saves.put(record);
    await expect(engine.getConversationReadAsync(buddy.id, 105, 30))
      .rejects.toThrow(/cold conversation page/);
  });
});
