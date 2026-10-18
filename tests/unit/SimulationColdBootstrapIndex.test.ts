// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { ConversationHistory } from '../../src/engine/social/ConversationHistory';
import { db } from '../../src/persistence/db';
import { saveSlot, loadSlotSnapshot, loadSlotColdBootstrap } from '../../src/persistence/slots';
import { readSavedConversationPage, conversationArchivePageKey } from '../../src/persistence/conversationArchive';

describe('#173 cold slot bootstrapping without eager transcript bodies', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.saves, db.conversation_pages, async () => {
      await db.saves.clear();
      await db.conversation_pages.clear();
    });
  });

  it('derives compact Social-authoritative indices and inventories keys without reading bodies', async () => {
    const game = new SimulationEngine();
    const buddies = game.social.getBuddies().slice(0, 2);
    const a = buddies[0]!, b = buddies[1]!;
    for (let i = 0; i < 276; i++) {
      const buddy = i % 2 ? b : a;
      const sender = i % 5 ? buddy.id : 'player';
      game.social.sendMessage(buddy.id, sender, sender === 'player' ? buddy.id : 'player',
        `message-${i}`, i % 11 === 0 ? 100 : 3000 + i, false,
        i % 13 === 0 ? ['offline-message'] : undefined);
    }
    const baseline = game.social.getState().conversations;
    await saveSlot(game, 'slot_1');
    const spy = vi.spyOn(db.conversation_pages, 'toArray');
    const bootstrap = await loadSlotColdBootstrap('slot_1');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(bootstrap).not.toBeNull();
    expect(bootstrap!.snapshot.social.conversations[a.id]).toHaveLength(32);
    expect(bootstrap!.snapshot.social.conversations[b.id]).toHaveLength(32);
    for (const buddy of [a, b]) {
      const messages = baseline[buddy.id]!;
      const index = bootstrap!.archive.indexes[buddy.id]!;
      expect(index).toEqual(ConversationHistory.summarizeForColdBootstrap(buddy.id, messages));
      expect(index.unread).toBe(messages.filter(m => m.senderId !== 'player' && !m.isRead).length);
      expect(bootstrap!.archive.counts[buddy.id]).toBe(messages.length - 32);
      const page = await readSavedConversationPage('slot_1', buddy.id, 91, 40);
      expect(page?.messages).toEqual(messages.slice(messages.length - 131, messages.length - 91));
    }
    // Explicit full snapshot compatibility remains unchanged.
    expect((await loadSlotSnapshot('slot_1'))?.social.conversations).toEqual(baseline);
  });

  it('fails closed on missing, extraneous, stale and malformed archive metadata', async () => {
    const game = new SimulationEngine();
    const buddy = game.social.getBuddies()[0]!;
    for (let i = 0; i < 120; i++) game.social.sendMessage(buddy.id, buddy.id, 'player', `m-${i}`, 1000 + i);
    await saveSlot(game, 'slot_1');
    expect(await loadSlotColdBootstrap('slot_1')).not.toBeNull();
    await db.conversation_pages.delete(conversationArchivePageKey('slot_1', buddy.id, 0));
    expect(await loadSlotColdBootstrap('slot_1')).toBeNull();
    await saveSlot(game, 'slot_1');
    const slot = (await db.saves.get('slot_1'))!;
    delete slot.meta!.conversationArchive?.indexes;
    await db.saves.put(slot);
    expect(await loadSlotColdBootstrap('slot_1')).toBeNull();
    // Existing full-history loading is still supported with old metadata.
    expect((await loadSlotSnapshot('slot_1'))?.social.conversations[buddy.id]).toHaveLength(120);
    await saveSlot(game, 'slot_1');
    const tampered = (await db.saves.get('slot_1'))!;
    const manifest = tampered.meta!.conversationArchive!;
    manifest.indexes![buddy.id]!.unread = -1;
    await db.saves.put(tampered);
    expect(await loadSlotColdBootstrap('slot_1')).toBeNull();
    expect(await loadSlotSnapshot('slot_1')).toBeNull();
  });

  it('keeps different slots independent and does not expose decoded old messages in bootstrap snapshots', async () => {
    const game = new SimulationEngine();
    const buddy = game.social.getBuddies()[0]!;
    for (let i = 0; i < 200; i++)
      game.social.sendMessage(buddy.id, buddy.id, 'player', `COLD_SECRET_${i}`, 900 + i);
    await saveSlot(game, 'slot_1');
    await saveSlot(game, 'slot_2');
    const a = await loadSlotColdBootstrap('slot_1');
    const b = await loadSlotColdBootstrap('slot_2');
    expect(JSON.stringify(a?.snapshot)).not.toContain('COLD_SECRET_0');
    expect(JSON.stringify(b?.snapshot)).not.toContain('COLD_SECRET_0');
    expect(a?.archive.counts).toEqual(b?.archive.counts);
    expect(a?.archive.slotId).toBe('slot_1');
    expect(b?.archive.slotId).toBe('slot_2');
  });
});
