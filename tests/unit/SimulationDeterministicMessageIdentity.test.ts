// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { ConversationHistory } from '../../src/engine/social/ConversationHistory';
import { db } from '../../src/persistence/db';
import { loadSlotEngine, loadSlotSnapshot, saveSlot } from '../../src/persistence/slots';

afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await db.transaction('rw', db.saves, db.conversation_pages, async () => {
    await db.saves.clear();
    await db.conversation_pages.clear();
  });
});

describe('#174 simulation-owned deterministic Social message identity', () => {
  it('replays identical IDs across isolated worlds while same-minute duplicates remain distinct', () => {
    const run = () => {
      const game = new SimulationEngine();
      const [first, second] = game.social.getBuddies();
      const ids = [
        game.social.sendMessage(first!.id, first!.id, 'player', 'hello', 2880).id,
        game.social.sendMessage(first!.id, first!.id, 'player', 'hello', 2880).id,
        game.social.sendMessage(second!.id, second!.id, 'player', 'hello', 2880).id,
        game.social.sendMessage(first!.id, 'player', first!.id, 'hello', 1000).id,
        game.social.sendMessage(second!.id, second!.id, 'player', 'hello', 2880).id,
      ];
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[2]).not.toBe(ids[4]);
      expect(ids[0]).toContain(encodeURIComponent(first!.id));
      return ids;
    };
    expect(run()).toEqual(run());
  });

  it('does not consult Date.now or Math.random for canonical chat identity', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const wall = vi.spyOn(Date, 'now');
    const random = vi.spyOn(Math, 'random');
    const first = game.social.sendMessage(actor.id, actor.id, 'player', 'same', 3000);
    const second = game.social.sendMessage(actor.id, actor.id, 'player', 'same', 3000);
    expect(first.id).not.toBe(second.id);
    expect(wall).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('uses unambiguous canonical per-conversation keys without another mutable counter', () => {
    const history = new ConversationHistory(id => id);
    expect(history.nextMessageId('a/b')).not.toBe(history.nextMessageId('a%2Fb'));
    const id = history.nextMessageId('a/b');
    expect(id).toMatch(/^msg_a%2Fb_0+1$/);
    // Identity derives from the actual persisted conversation length, even
    // when older bodies have already been serialized out of the hot tail.
    const game = new SimulationEngine();
    const buddy = game.social.getBuddies()[0]!;
    for (let n = 0; n < 165; n++)
      game.social.sendMessage(buddy.id, buddy.id, 'player', `msg-${n}`, 2500 + n);
    expect(game.social.sendMessage(buddy.id, buddy.id, 'player', 'final', 2500).id)
      .toMatch(/_0*166$/);
  });

  it('resumes identity allocation after IndexedDB cold boot, same-slot re-save and full legacy loads', async () => {
    const original = new SimulationEngine();
    const actor = original.social.getBuddies()[0]!;
    original.social.learnHandle(actor.id, actor.handle);
    for (let n = 0; n < 145; n++) {
      original.social.sendMessage(actor.id, actor.id, 'player', `history-${n}`, 3000 + n);
    }
    const before = original.social.getMessages(actor.id);
    expect(before.at(-1)!.id).toMatch(/_0*145$/);
    await saveSlot(original, 'run');
    const cold = (await loadSlotEngine('run'))!;
    expect(cold.social.hasColdConversations()).toBe(true);
    const firstNext = cold.social.sendMessage(actor.id, 'player', actor.id, 'next', 3000);
    expect(firstNext.id).toMatch(/_0*146$/);
    await saveSlot(cold, 'run');
    const reloaded = (await loadSlotEngine('run'))!;
    const secondNext = reloaded.social.sendMessage(actor.id, actor.id, 'player', 'after reload', 5000);
    expect(secondNext.id).toMatch(/_0*147$/);
    const all = await reloaded.getConversationLogAsync(actor.id);
    expect(all.map(m => m.id)).toEqual([...before.map(m => m.id), firstNext.id, secondNext.id]);
    expect(new Set(all.map(m => m.id)).size).toBe(all.length);
    const complete = (await loadSlotSnapshot('run'))!;
    const eager = new SimulationEngine(complete);
    expect(eager.social.sendMessage(actor.id, actor.id, 'player', 'eager', 5000).id)
      .toMatch(/_0*147$/);
  });
});
