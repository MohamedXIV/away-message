// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { db } from '../../src/persistence/db';
import { loadSlotColdBootstrap, loadSlotSnapshot, saveSlot } from '../../src/persistence/slots';
import { readSavedColdConversationChunk } from '../../src/persistence/conversationArchive';

beforeEach(async () => {
  await db.transaction('rw', db.saves, db.conversation_pages, async () => {
    await db.saves.clear();
    await db.conversation_pages.clear();
  });
});

describe('#173 complete async snapshot saves', () => {
  it('saves all cold and appended messages atomically and rebinds same-slot readers', async () => {
    const source = new SimulationEngine();
    const buddy = source.social.getBuddies()[0]!;
    for (let i = 0; i < 180; i++) {
      source.social.sendMessage(buddy.id, buddy.id, 'player', `original-${i}`, 1800 + i);
    }
    await saveSlot(source, 'one');
    const boot = (await loadSlotColdBootstrap('one'))!;
    const engine = new SimulationEngine(boot.snapshot);
    engine.social.attachColdConversations(
      boot.snapshot.social.conversations, boot.archive.counts, boot.archive.indexes,
      (id, index) => readSavedColdConversationChunk('one', id, index, boot.archive.updatedAt),
      'one',
    );
    engine.social.learnHandle(buddy.id, buddy.handle);
    const initial = await engine.social.getMessagesAsync(buddy.id);
    engine.social.sendMessage(buddy.id, buddy.id, 'player', 'new-after-boot', 2001);
    engine.markConversationAsRead(buddy.id);
    const before = await engine.social.getMessagesAsync(buddy.id);
    const saved = await saveSlot(engine, 'one');
    expect(saved.updatedAt).toBeGreaterThan(boot.archive.updatedAt);
    expect((await loadSlotSnapshot('one'))?.social.conversations[buddy.id]).toEqual(before);
    expect((await engine.social.getMessagesAsync(buddy.id))).toEqual(before);
    expect((await engine.getConversationReadAsync(buddy.id, 160, 20)).messages)
      .toEqual(before.slice(1, 21));
    expect(initial).toHaveLength(180);
    expect(before).toHaveLength(181);
    const laterBoot = await loadSlotColdBootstrap('one');
    expect(laterBoot?.archive.counts[buddy.id]).toBe(149);
  });

  it('does not persist a partial or stale export when a cold page disappears', async () => {
    const source = new SimulationEngine();
    const buddy = source.social.getBuddies()[0]!;
    for (let i = 0; i < 100; i++) {
      source.social.sendMessage(buddy.id, buddy.id, 'player', `message-${i}`, 3000 + i);
    }
    await saveSlot(source, 'source');
    const boot = (await loadSlotColdBootstrap('source'))!;
    const engine = new SimulationEngine(boot.snapshot);
    engine.social.attachColdConversations(
      boot.snapshot.social.conversations, boot.archive.counts, boot.archive.indexes,
      (id, index) => readSavedColdConversationChunk('source', id, index, boot.archive.updatedAt),
      'source',
    );
    await db.conversation_pages.where('slotId').equals('source').delete();
    await expect(saveSlot(engine, 'destination')).rejects.toThrow(/cold conversation page/);
    expect(await db.saves.get('destination')).toBeUndefined();
  });
});
