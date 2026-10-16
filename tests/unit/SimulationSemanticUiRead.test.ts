import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 player-safe semantic and Situation projections', () => {
  it('scopes player-learned facts and claims to the selected actor only', () => {
    const game = new SimulationEngine();
    const actors = game.social.getBuddies().slice(0, 2);
    const chosen = actors[0]!;
    const other = actors[1]!;
    expect(game.getPlayerActorRead(chosen.id)).toBeNull();
    expect(game.social.learnHandle(chosen.id, chosen.handle)).toBe(true);

    const provenance = { kind: 'direct_observation' as const, sourceId: 'test:visit', atMinute: 480 };
    for (const [id, actorId] of [['fact:chosen', chosen.id], ['fact:hidden_other', other.id]] as const) {
      expect(game.world.establishSemanticFact({
        id, subjectId: actorId, predicate: 'favorite_place',
        value: actorId === chosen.id ? 'library' : 'PRIVATE_OTHER_LOCATION',
        established: provenance,
      })).toBe(true);
      expect(game.world.learnSemanticReference('player', {
        kind: 'fact', refId: id, learned: provenance,
      })).toBe(true);
    }
    expect(game.world.publishSemanticClaim({
      id: 'claim:chosen', factId: 'fact:chosen', assertedValue: 'campus',
      published: { kind: 'friend', sourceId: 'test:friend', atMinute: 481 },
    })).toBe(true);
    expect(game.world.learnSemanticReference('player', {
      kind: 'claim', refId: 'claim:chosen', learned: provenance,
    })).toBe(true);
    expect(game.world.establishSemanticFact({
      id: 'fact:unlearned_truth', subjectId: chosen.id, predicate: 'rumored_activity',
      value: 'PRIVATE_UNLEARNED_TRUTH', established: provenance,
    })).toBe(true);
    expect(game.world.publishSemanticClaim({
      id: 'claim:heard_only', factId: 'fact:unlearned_truth',
      assertedValue: 'HEARD_ONLY_RUMOR',
      published: { kind: 'friend', sourceId: 'test:friend', atMinute: 483 },
    })).toBe(true);
    expect(game.world.learnSemanticReference('player', {
      kind: 'claim', refId: 'claim:heard_only', learned: provenance,
    })).toBe(true);
    const giant = vi.spyOn(game, 'getState');
    const ledger = vi.spyOn(game.world, 'getState');
    const read = game.getPlayerActorRead(chosen.id)!;
    expect(read.actor.actorId).toBe(chosen.id);
    expect(read.playerKnowledge.facts.map(x => x.id)).toEqual(['fact:chosen']);
    expect(read.playerKnowledge.claims.map(x => x.id)).toEqual(['claim:chosen', 'claim:heard_only']);
    expect(JSON.stringify(read)).toContain('HEARD_ONLY_RUMOR');
    expect(JSON.stringify(read)).not.toContain('PRIVATE_UNLEARNED_TRUTH');
    expect(read.actor.canChatNow).toMatchObject({ allowed: expect.any(Boolean), reasons: expect.any(Array) });
    expect(JSON.stringify(read)).not.toContain('PRIVATE_OTHER_LOCATION');
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(giant).not.toHaveBeenCalled();
    expect(ledger).not.toHaveBeenCalled();
  });

  it('does not expose owner-private Pulse profile information for unknown actors', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    expect(game.social.isKnown(actor.id)).toBe(false);
    const knowledge = vi.spyOn(game.world, 'getBuddyKnowledge');
    const memories = vi.spyOn(game.social, 'getCoreMemories');
    const snapshot = vi.spyOn(game, 'getState');

    const hidden = game.getPulseProfileRead(actor.id);
    expect(hidden).toEqual({
      revision: game.getRevision(),
      buddyKnowledge: [],
      worldEvents: [],
      photoMemories: [],
      semantics: null,
      influences: [],
    });
    expect(knowledge).not.toHaveBeenCalled();
    expect(memories).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(hidden))).toEqual(hidden);

    expect(game.social.learnHandle(actor.id, actor.handle)).toBe(true);
    const visible = game.getPulseProfileRead(actor.id);
    expect(visible.semantics?.actorId).toBe(actor.id);
    expect(knowledge).toHaveBeenCalledWith(actor.id);
    expect(memories).toHaveBeenCalledWith(actor.id);
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('returns bounded source-backed situation and focused Pulse semantics without full snapshots', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    game.social.learnHandle(actor.id, actor.handle);
    const giant = vi.spyOn(game, 'getState');
    const world = vi.spyOn(game.world, 'getState');
    const situation = game.getSituationRead();
    const profile = game.getPulseProfileRead(actor.id);
    expect(situation.revision).toBe(game.getRevision());
    expect(situation.atMinute).toBe(game.clock.getTotalMinutes());
    expect(situation.influences.length).toBeLessThanOrEqual(32);
    expect(situation.activeEventIds.length).toBeLessThanOrEqual(16);
    for (const item of situation.influences) {
      expect(item.sourceEventId).toBeTruthy();
      expect(item.startsAtMinute).toBeLessThanOrEqual(situation.atMinute);
    }
    expect(profile.semantics?.actorId).toBe(actor.id);
    expect(profile.semantics?.canMeetInPerson.reasons).toEqual(expect.any(Array));
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile);
    expect(JSON.parse(JSON.stringify(situation))).toEqual(situation);
    expect(giant).not.toHaveBeenCalled();
    expect(world).not.toHaveBeenCalled();
  });
});
