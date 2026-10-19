// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { db } from '../../src/persistence/db';
import { saveSlot, loadSlotSnapshot, deleteSlot } from '../../src/persistence/slots';
import {
  splitConversationArchive, hydrateConversationArchive, readSavedConversationPage,
  CONVERSATION_ARCHIVE_PAGE_SIZE, RECENT_CONVERSATION_MESSAGES,
} from '../../src/persistence/conversationArchive';
import type { MessageRecord } from '../../src/engine/types';

describe('#173 atomic, slot-scoped cold conversation history', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.saves, db.conversation_pages, async () => {
      await db.saves.clear();
      await db.conversation_pages.clear();
    });
  });

  it('splits cold 64-message pages and detaches a 32-message snapshot tail without reordering', () => {
    const sim = new SimulationEngine();
    const actor = sim.social.getBuddies()[0]!;
    for (let index = 0; index < 193; index++) {
      sim.social.sendMessage(actor.id, actor.id, 'player', `message-${index}`,
        index % 9 === 0 ? 480 : 6000 + index,
        false, index % 7 === 0 ? ['offline-message'] : undefined);
    }
    const original = sim.social.getMessages(actor.id);
    const split = splitConversationArchive('slot_1', { [actor.id]: original, empty: [] });
    expect(split.recent[actor.id]).toHaveLength(RECENT_CONVERSATION_MESSAGES);
    expect(split.manifest.counts[actor.id]).toBe(161);
    expect(split.pages.map(page => page.messages.length)).toEqual([64, 64, 33]);
    expect(split.pages.every(page => page.messages.length <= CONVERSATION_ARCHIVE_PAGE_SIZE)).toBe(true);
    const restored = hydrateConversationArchive('slot_1', split.recent, split.manifest, split.pages);
    expect(restored?.[actor.id]).toEqual(original);
    expect(restored?.empty).toEqual([]);
    const mutable = restored![actor.id]![0]!;
    mutable.text = 'tampered';
    mutable.tags?.push('tampered');
    expect(original[0]!.text).toBe('message-0');
    expect(split.pages[0]!.messages[0]!.text).toBe('message-0');
    expect(hydrateConversationArchive('slot_1', split.recent, split.manifest,
      split.pages.slice(1))).toBeNull();
    expect(hydrateConversationArchive('slot_2', split.recent, split.manifest, split.pages)).toBeNull();
  });

  it('atomically saves cold pages separate from recent state and restores exact source history', async () => {
    const sim = new SimulationEngine();
    const [a, b] = sim.social.getBuddies();
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    for (let i = 0; i < 181; i++) {
      const id = i % 3 === 0 ? b!.id : a!.id;
      sim.social.sendMessage(id, id, 'player', `a-${i}`,
        800 + (i % 3 === 0 ? 1 : i), false, i % 11 === 0 ? ['offline-message'] : undefined);
    }
    const original = sim.social.getState().conversations;
    await saveSlot(sim, 'slot_1');
    const saved = await db.saves.get('slot_1');
    expect(saved?.meta?.conversationArchive).toBeTruthy();
    expect(saved?.snapshot?.social.conversations[a!.id]).toHaveLength(32);
    expect(saved?.snapshot?.social.conversations[b!.id]).toHaveLength(32);
    const allPages = await db.conversation_pages.where('slotId').equals('slot_1').toArray();
    expect(allPages.length).toBeGreaterThan(1);
    expect(allPages.every(page => page.slotId === 'slot_1')).toBe(true);

    const loaded = await loadSlotSnapshot('slot_1');
    expect(loaded?.social.conversations).toEqual(original);
    const loadedEngine = new SimulationEngine(loaded!);
    expect(loadedEngine.social.getState().conversations).toEqual(original);
    expect(loadedEngine.social.getConversationUnreadCounts())
      .toEqual(sim.social.getConversationUnreadCounts());

    const sortedIds = [a!.id, b!.id];
    for (const id of sortedIds) {
      const expected: MessageRecord[] = original[id]!;
      for (const offset of [0, 1, 20, 28, 31, 32, 50, 70, 100, 199]) {
        const page = await readSavedConversationPage('slot_1', id, offset, 30);
        const end = Math.max(0, expected.length - offset);
        const start = Math.max(0, end - 30);
        expect(page?.messages).toEqual(expected.slice(start, end));
        expect(page?.total).toBe(expected.length);
        expect(page?.hasOlder).toBe(start > 0);
      }
    }
    const prev = await readSavedConversationPage('slot_1', a!.id, 100, 50);
    prev!.messages[0]!.text = 'forged';
    expect((await readSavedConversationPage('slot_1', a!.id, 100, 50))?.messages[0]?.text)
      .not.toBe('forged');
  });

  it('replaces only one slot archive, cleans up on deletion, and fails closed on missing pages', async () => {
    const sim = new SimulationEngine();
    const actor = sim.social.getBuddies()[0]!;
    for (let i = 0; i < 143; i++) {
      sim.social.sendMessage(actor.id, actor.id, 'player', `first-${i}`, 400 + i);
    }
    await saveSlot(sim, 'slot_1');
    await saveSlot(sim, 'slot_2');
    const independent = await loadSlotSnapshot('slot_2');
    expect(independent?.social.conversations[actor.id]).toHaveLength(143);
    sim.social.markAsRead(actor.id);
    for (let i = 0; i < 32; i++) {
      sim.social.sendMessage(actor.id, 'player', actor.id, `second-${i}`, 2000 + i);
    }
    await saveSlot(sim, 'slot_1');
    expect((await loadSlotSnapshot('slot_1'))?.social.conversations[actor.id]).toHaveLength(175);
    expect((await loadSlotSnapshot('slot_2'))?.social.conversations[actor.id]).toEqual(
      independent?.social.conversations[actor.id],
    );
    const beforeDeletion = await db.conversation_pages.where('slotId').equals('slot_2').toArray();
    expect(beforeDeletion.length).toBeGreaterThan(0);
    await deleteSlot('slot_1');
    expect(await db.conversation_pages.where('slotId').equals('slot_1').count()).toBe(0);
    expect(await loadSlotSnapshot('slot_1')).toBeNull();
    expect(await loadSlotSnapshot('slot_2')).not.toBeNull();
    await db.conversation_pages.delete(beforeDeletion[0]!.key);
    expect(await loadSlotSnapshot('slot_2')).toBeNull();
    expect(await readSavedConversationPage('slot_2', actor.id, 100, 30)).toBeNull();
  });

  it('accepts an earlier full-snapshot slot without an archive marker', async () => {
    const sim = new SimulationEngine();
    const actor = sim.social.getBuddies()[0]!;
    for (let i = 0; i < 69; i++) {
      sim.social.sendMessage(actor.id, actor.id, 'player', `legacy-${i}`, 800 + i);
    }
    await saveSlot(sim, 'slot_1');
    const record = (await db.saves.get('slot_1'))!;
    const whole = sim.exportSnapshot();
    record.snapshot = whole;
    delete record.meta!.conversationArchive;
    await db.saves.put(record);
    const loaded = await loadSlotSnapshot('slot_1');
    expect(loaded?.social.conversations).toEqual(whole.social.conversations);
  });
});
