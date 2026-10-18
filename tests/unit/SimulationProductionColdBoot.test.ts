// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { db } from '../../src/persistence/db';
import { loadSlotEngine, loadSlotSnapshot, saveSlot } from '../../src/persistence/slots';
import { conversationArchivePageKey, type ConversationArchiveManifest } from '../../src/persistence/conversationArchive';

beforeEach(async () => {
  await db.transaction('rw', db.saves, db.conversation_pages, async () => {
    await db.saves.clear();
    await db.conversation_pages.clear();
  });
});

describe('#173 production cold boot, player-safe paging, and autosave continuity', () => {
  it('uses the production loader without eager historical message reads and preserves full playable continuity', async () => {
    const initial = new SimulationEngine();
    const buddy = initial.social.getBuddies()[0]!;
    for (let i = 0; i < 260; i++) {
      initial.social.sendMessage(buddy.id, buddy.id, 'player', `old-${i}`, 5000 + i);
    }
    initial.social.learnHandle(buddy.id, buddy.handle);
    const transcript = initial.social.getMessages(buddy.id);
    await saveSlot(initial, 'live');
    const pageRead = vi.spyOn(db.conversation_pages, 'toArray');
    const engine = (await loadSlotEngine('live'))!;
    expect(engine).toBeInstanceOf(SimulationEngine);
    expect(pageRead).not.toHaveBeenCalled();
    pageRead.mockRestore();
    expect(engine.social.hasColdConversations()).toBe(true);
    expect(() => engine.exportSnapshot()).toThrow(/async export/);
    expect(engine.social.getConversationUnreadCounts()[buddy.id]).toBe(260);
    expect(engine.getMessengerRead().unreadCounts[buddy.id]).toBe(260);
    const fullRead = vi.spyOn(engine, 'getState');
    // No guessed ID may see old messages or force a private archive fetch.
    expect((await engine.getConversationReadAsync('unknown', 180, 50)).messages).toEqual([]);
    const older = await engine.getConversationReadAsync(buddy.id, 170, 50);
    expect(older.messages).toEqual(transcript.slice(40, 90));
    expect(older.total).toBe(260);
    expect(older.hasOlder).toBe(true);
    expect((await engine.getConversationLogAsync(buddy.id))).toEqual(transcript);
    expect(await engine.getConversationLogAsync('unknown')).toEqual([]);
    expect(fullRead).not.toHaveBeenCalled();
    engine.social.sendMessage(buddy.id, 'player', buddy.id, 'new-turn', 5300);
    engine.markConversationAsRead(buddy.id);
    const after = await engine.getConversationLogAsync(buddy.id);
    expect(after).toHaveLength(261);
    expect(after.at(-1)?.text).toBe('new-turn');
    await saveSlot(engine, 'live');
    expect((await engine.getConversationReadAsync(buddy.id, 170, 50)).messages)
      .toEqual(after.slice(41, 91));
    const reload = (await loadSlotEngine('live'))!;
    expect(reload.social.hasColdConversations()).toBe(true);
    expect(reload.social.getUnreadTraySummary(4).unreadCount).toBe(0);
    expect((await reload.getConversationLogAsync(buddy.id))).toEqual(after);
    expect((await loadSlotSnapshot('live'))?.social.conversations[buddy.id]).toEqual(after);
  });

  it('falls back to a complete eager load for index-free older archives, not truncated cold boot', async () => {
    const source = new SimulationEngine();
    const actor = source.social.getBuddies()[0]!;
    for (let i = 0; i < 110; i++) {
      source.social.sendMessage(actor.id, actor.id, 'player', `archive-${i}`, 3000 + i);
    }
    await saveSlot(source, 'older');
    const record = (await db.saves.get('older'))!;
    delete (record.meta!.conversationArchive as ConversationArchiveManifest).indexes;
    await db.saves.put(record);
    const game = (await loadSlotEngine('older'))!;
    expect(game.social.hasColdConversations()).toBe(false);
    expect(game.social.getMessages(actor.id)).toEqual(source.social.getMessages(actor.id));
  });

  it('rejects broken slot archives rather than starting a partial game', async () => {
    const source = new SimulationEngine();
    const actor = source.social.getBuddies()[0]!;
    for (let i = 0; i < 100; i++) {
      source.social.sendMessage(actor.id, actor.id, 'player', `old-${i}`, 2000 + i);
    }
    await saveSlot(source, 'broken');
    await db.conversation_pages.delete(conversationArchivePageKey('broken', actor.id, 0));
    expect(await loadSlotEngine('broken')).toBeNull();
  });
});
