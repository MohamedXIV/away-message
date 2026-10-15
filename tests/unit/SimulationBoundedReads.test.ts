import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 bounded owned-source reads and messenger paging', () => {
  it('reads world/HUD/selected actor, messages and summary without full WorldState', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const full = vi.spyOn(game, 'getState');
    const snapshot = vi.spyOn(game, 'exportSnapshot');

    const hud = game.getHudProjection();
    const world = game.getWorldRead();
    expect(world.time.totalMinutes).toBe(hud.time.totalMinutes);
    expect(world.activeView).toBe(hud.activeView);
    expect(world.environment.atMinute).toBe(world.time.totalMinutes);
    expect(world.residencePlaceId).toBe(game.getCurrentResidencePlaceId());
    expect(world.pcBootState).toBe(game.getPcBootState());
    expect(world.metInPerson).toBe(Boolean(game.world.getFlag('met_in_person')));

    expect(game.getPlayerActorRead(actor.id)).toBeNull(); // unknown handle
    expect(game.social.learnHandle(actor.id, actor.handle)).toBe(true);
    const safeActor = game.getPlayerActorRead(actor.id)!;
    expect(safeActor.actor.actorId).toBe(actor.id);
    expect(safeActor.playerKnowledge).toEqual(game.world.getActorSemanticKnowledge('player'));

    for (let minute = 480; minute < 553; minute++) {
      game.social.sendMessage(actor.id, 'player', actor.id, `Message ${minute}`, minute);
    }
    const latest = game.getConversationRead(actor.id, 0, 20);
    expect(latest.messages).toHaveLength(20);
    expect(latest.total).toBe(73);
    expect(latest.hasOlder).toBe(true);
    expect(latest.messages[0]?.text).toBe('Message 533');
    expect(latest.messages.at(-1)?.text).toBe('Message 552');
    expect(game.getConversationRead(actor.id, 20, 20).messages[0]?.text).toBe('Message 513');
    expect(game.getConversationRead(actor.id, 0, 500).messages).toHaveLength(50);
    expect(game.getConversationRead(actor.id, 0, 0).messages).toHaveLength(0);

    const contacts = game.getMessengerRead(3);
    expect(contacts.contacts.some(c => c.actorId === actor.id)).toBe(true);
    expect(contacts.contacts.length).toBeLessThanOrEqual(3);
    expect(full).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();

    const detached = game.getConversationRead(actor.id, 0, 2);
    detached.messages[0]!.text = 'tampered';
    expect(game.getConversationRead(actor.id, 0, 2).messages[0]?.text).not.toBe('tampered');
    full.mockRestore();
    snapshot.mockRestore();
  });

  it('never exposes unlearned world facts through the player actor projection', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    game.social.learnHandle(actor.id, actor.handle);
    game.world.establishSemanticFact({
      id: 'secret:scholarship', subjectId: actor.id,
      predicate: 'got_scholarship', value: true,
      established: { kind: 'system', sourceId: 'exam_notice', atMinute: 480 },
    });
    const actorRead = game.getPlayerActorRead(actor.id)!;
    expect(actorRead.playerKnowledge.facts).toEqual([]);
    expect(actorRead.actor.connection).toBe('known');
    const before = game.exportSnapshot();
    const world = game.getWorldRead();
    const safe = game.getPlayerActorRead(actor.id);
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
    expect(JSON.parse(JSON.stringify(safe))).toEqual(safe);
    expect(game.exportSnapshot()).toEqual(before);
  });

  it('publishes serializable bounded views on a real minute boundary without giant snapshot subscribers', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    const views: Array<{ minute: number; revision: number }> = [];
    const off = game.subscribeChanges(change => {
      const read = game.getWorldRead();
      expect(read.revision).toBe(change.revision);
      views.push({ minute: read.time.totalMinutes, revision: read.revision });
    });
    game.advanceGameMinutes(3, 'viewport event');
    off();
    expect(views.length).toBeGreaterThan(1);
    expect(views.at(-1)?.minute).toBe(game.clock.getTotalMinutes());
    expect(views.at(-1)!.revision).toBeGreaterThan(0);
    expect(full).not.toHaveBeenCalled();
    full.mockRestore();
  });
});
