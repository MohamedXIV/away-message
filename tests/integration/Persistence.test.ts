// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { db } from '../../src/persistence/db';
import {
  deleteSlot, listSlots, loadSlotEngine, loadSlotSnapshot,
  saveSlot, slotCompatibility,
} from '../../src/persistence/slots';
import { conversationArchivePageKey } from '../../src/persistence/conversationArchive';

/**
 * #174 replaces the retired multi-table SaveManager integration tests.
 * This is the actual shipping save document + per-slot cold archive writer.
 */
beforeEach(async () => {
  await db.transaction('rw', db.saves, db.conversation_pages, db.messages, async () => {
    await db.saves.clear();
    await db.conversation_pages.clear();
    await db.messages.clear();
  });
});
afterEach(() => vi.restoreAllMocks());

describe('#174 current-format persistence integration (one slot writer)', () => {
  it('boots complete playable Social state using only the saved document and its cold pages', async () => {
    const source = new SimulationEngine();
    const actor = source.social.getBuddies()[0]!;
    source.social.learnHandle(actor.id, actor.handle);
    for (let i = 0; i < 195; i++) {
      source.social.sendMessage(actor.id, actor.id, 'player', `conversation-${i}`, 1200 + i);
    }
    source.advanceGameMinutes(20, 'integration test');
    const before = source.social.getMessages(actor.id);
    const summary = await saveSlot(source, 'slot_1', 'First run');
    expect(summary.name).toBe('First run');
    const record = (await db.saves.get('slot_1'))!;
    expect(record.version).toBe(6);
    expect(record.snapshot?.social.conversations[actor.id]).toHaveLength(32);
    expect(await db.conversation_pages.where('slotId').equals('slot_1').count()).toBeGreaterThan(0);
    // The old global message table is never another writable Social source.
    expect(await db.messages.count()).toBe(0);

    const engine = (await loadSlotEngine('slot_1'))!;
    expect(engine.social.hasColdConversations()).toBe(true);
    expect(engine.clock.getTotalMinutes()).toBe(source.clock.getTotalMinutes());
    expect((await engine.getConversationLogAsync(actor.id))).toEqual(before);
    const whole = (await loadSlotSnapshot('slot_1'))!;
    expect(whole.social.conversations[actor.id]).toEqual(before);
    expect((await listSlots()).some(slot => slot.id === 'slot_1')).toBe(true);
    expect((await slotCompatibility('slot_1')).status).toBe('ok');
  });

  it('keeps two independent game timelines and their historical pages isolated', async () => {
    const one = new SimulationEngine();
    const two = new SimulationEngine();
    const actor = one.social.getBuddies()[0]!;
    one.social.learnHandle(actor.id, actor.handle);
    two.social.learnHandle(actor.id, actor.handle);
    for (let i = 0; i < 140; i++)
      one.social.sendMessage(actor.id, actor.id, 'player', `ONE-${i}`, 1000 + i);
    for (let i = 0; i < 97; i++)
      two.social.sendMessage(actor.id, actor.id, 'player', `TWO-${i}`, 1300 + i);
    await saveSlot(one, 'slot_1');
    await saveSlot(two, 'slot_2');
    const a = (await loadSlotEngine('slot_1'))!;
    const b = (await loadSlotEngine('slot_2'))!;
    expect((await a.getConversationLogAsync(actor.id))).toHaveLength(140);
    expect((await b.getConversationLogAsync(actor.id))).toHaveLength(97);
    expect((await a.getConversationLogAsync(actor.id))[0]!.text).toBe('ONE-0');
    expect((await b.getConversationLogAsync(actor.id))[0]!.text).toBe('TWO-0');
    await deleteSlot('slot_1');
    expect(await loadSlotEngine('slot_1')).toBeNull();
    expect(await db.conversation_pages.where('slotId').equals('slot_1').count()).toBe(0);
    expect((await loadSlotEngine('slot_2'))).not.toBeNull();
    expect(await db.conversation_pages.where('slotId').equals('slot_2').count()).toBeGreaterThan(0);
  });

  it('rolls back both the document and old page inventory if an overwrite fails', async () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    for (let i = 0; i < 180; i++)
      game.social.sendMessage(actor.id, actor.id, 'player', `earlier-${i}`, 1400 + i);
    await saveSlot(game, 'slot_1');
    const before = await db.saves.get('slot_1');
    const pagesBefore = await db.conversation_pages.where('slotId').equals('slot_1').toArray();
    game.social.sendMessage(actor.id, actor.id, 'player', 'should-not-commit', 1600);
    const put = vi.spyOn(db.saves, 'put').mockImplementation(() => {
      throw new Error('simulated slot write failure');
    });
    await expect(saveSlot(game, 'slot_1')).rejects.toThrow('simulated slot write failure');
    put.mockRestore();
    expect(await db.saves.get('slot_1')).toEqual(before);
    expect(await db.conversation_pages.where('slotId').equals('slot_1').toArray()).toEqual(pagesBefore);
    expect((await loadSlotSnapshot('slot_1'))?.social.conversations[actor.id]).toHaveLength(180);
  });

  it('refuses a broken current archive without returning partial conversation truth', async () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    for (let i = 0; i < 100; i++)
      game.social.sendMessage(actor.id, actor.id, 'player', `old-${i}`, 1500 + i);
    await saveSlot(game, 'slot_3');
    await db.conversation_pages.delete(conversationArchivePageKey('slot_3', actor.id, 0));
    expect(await loadSlotEngine('slot_3')).toBeNull();
    expect(await loadSlotSnapshot('slot_3')).toBeNull();
  });
});
