import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine, normalizeBuddyId, normalizeRelationshipDims } from '../../src/engine/SocialEngine';
import { SocialRoster } from '../../src/engine/social/SocialRoster';
import { SEED_CHARACTERS } from '../../src/engine/seedCharacters';
import type { SocialEngineState } from '../../src/engine/types';

function procedural(social: SocialEngine, id: string, status: 'stranger' | 'blocked' = 'stranger') {
  return { ...social.getBuddies()[0]!, id, handle: `h_${id}`, displayName: `Name ${id}`,
    metVia: 'work' as const, status, isProcedural: true, createdDay: 6 };
}

/**
 * Pre-existing NpcRelationshipGraph.restoreState always fills missing authored
 * seed affinities, including pairs whose actor is removed from the current roster.
 * That behavior is unrelated to identity restoration: guard all other fields
 * byte-for-byte, and ensure every persisted affinity stays unchanged.
 */
function expectRosterAndOwnersParity(actual: SocialEngineState, expected: SocialEngineState): void {
  const { affinities: gotAffinities, ...got } = actual;
  const { affinities: savedAffinities, ...saved } = expected;
  expect(got).toEqual(saved);
  for (const [key, value] of Object.entries(savedAffinities ?? {})) {
    expect(gotAffinities?.[key]).toBe(value);
  }
}

describe('#173 canonical SocialRoster', () => {
  it('owns seeded identities without copying authored contact status into their definitions', () => {
    const roster = new SocialRoster(normalizeBuddyId, normalizeRelationshipDims);
    const authored = new Map<string, string | undefined>();
    roster.initializeSeeds((id, status) => authored.set(id, status));
    expect(roster.size).toBe(SEED_CHARACTERS.length);
    expect([...roster.keys()]).toEqual(SEED_CHARACTERS.map(b => b.id));
    for (const buddy of SEED_CHARACTERS) {
      expect(roster.has(buddy.id)).toBe(true);
      expect(roster.has(buddy.handle)).toBe(true);
      expect(roster.get(buddy.id)?.status).toBeUndefined();
      expect(authored.has(buddy.id)).toBe(true);
    }
    expect(roster.exportState()).toEqual({ buddies: {}, removedSeedActorIds: [] });
  });

  it('normalizes runtime metadata once, copies schedules and rejects aliases/duplicate ids', () => {
    const social = new SocialEngine(new EventBus());
    const roster = new SocialRoster(normalizeBuddyId, normalizeRelationshipDims);
    roster.initializeSeeds(() => {});
    const actor = procedural(social, 'runtime_roster_actor');
    actor.displayName = 'D'.repeat(60);
    actor.handle = 'H'.repeat(60);
    actor.roles = ['diner-staff', 'diner-staff', 'INVALID ROLE'];
    const registered = roster.register(actor);
    expect(registered.id).toBe(actor.id);
    expect(registered.status).toBe('stranger');
    expect(roster.get(actor.id)?.status).toBeUndefined();
    expect(roster.get(actor.id)?.displayName).toHaveLength(40);
    expect(roster.get(actor.id)?.handle).toHaveLength(40);
    expect(roster.get(actor.id)?.roles).toEqual(['diner-staff', 'diner-staff']);
    const firstDay = Number(Object.keys(actor.schedule)[0]);
    const originalMessage = roster.get(actor.id)!.schedule[firstDay]![0]!.awayMessage;
    actor.schedule[firstDay]![0]!.awayMessage = 'source mutated';
    expect(roster.get(actor.id)!.schedule[firstDay]![0]!.awayMessage).toBe(originalMessage);
    expect(() => roster.register(actor)).toThrow(/already registered/);
    expect(() => roster.register({ ...actor, id: SEED_CHARACTERS[0]!.handle })).toThrow(/already registered/);
    expect(() => roster.register({ ...actor, id: 'bad id' })).toThrow();
    expect(roster.size).toBe(SEED_CHARACTERS.length + 1);
  });

  it('emits registration/removal only through SocialEngine and keeps contact truth separate', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const events = vi.spyOn(bus, 'emit');
    const actor = procedural(social, 'runtime_blocked_contact', 'blocked');
    expect(social.registerBuddy(actor).status).toBe('blocked');
    expect(social.getActorCondition(actor.id)?.contact).toBe('blocked');
    expect(social.getRelationshipStage(actor.id)).toBeDefined();
    expect(events).toHaveBeenCalledWith('social:buddy_registered',
      { buddy: expect.objectContaining({ id: actor.id, status: 'blocked' }) });
    expect(social.getState().buddies![actor.id]!.status).toBeUndefined();
    expect(social.removeBuddy(actor.id)).toBe(true);
    expect(social.removeBuddy(actor.id)).toBe(false);
    expect(events).toHaveBeenCalledWith('social:buddy_removed', { buddyId: actor.id });
  });

  it('restores procedural definitions, removed seeds and all dependent owners exactly', () => {
    const social = new SocialEngine(new EventBus());
    const removedSeed = social.getBuddies()[1]!.id;
    const actor = procedural(social, 'persisted_roster_actor');
    social.registerBuddy(actor);
    social.learnHandle(actor.id, actor.handle);
    social.setAgenda(actor.id, [
      { id: 'a', kind: 'work', label: 'work', day: 2, startMinute: 400, endMinute: 500 },
    ]);
    social.removeBuddy(removedSeed);
    const saved = social.getState();
    expect(saved.removedSeedActorIds).toContain(removedSeed);
    expect(saved.buddies?.[actor.id]).toBeDefined();
    const restored = new SocialEngine(new EventBus(), saved);
    expect(restored.getBuddy(removedSeed)).toBeUndefined();
    expect(restored.getBuddy(actor.id)?.id).toBe(actor.id);
    expect(restored.getKnownHandles(actor.id)).toEqual([actor.handle]);
    expect(restored.getAgenda(actor.id)).toHaveLength(1);
    expectRosterAndOwnersParity(restored.getState(), saved);
  });

  it('replaces prior identities on repeated restore without stale actors or events', () => {
    const bus = new EventBus();
    const world = new SocialEngine(bus);
    const seed = world.getBuddies()[0]!.id;
    const first = procedural(world, 'restore_prior_actor');
    world.registerBuddy(first);
    const firstSave = world.getState();
    world.removeBuddy(first.id);
    world.removeBuddy(seed);
    const secondSave = world.getState();
    const emit = vi.spyOn(bus, 'emit');
    world.restoreState(firstSave);
    expect(world.getBuddy(first.id)).toBeDefined();
    expect(world.getBuddy(seed)).toBeDefined();
    world.restoreState(secondSave);
    expect(world.getBuddy(first.id)).toBeUndefined();
    expect(world.getBuddy(seed)).toBeUndefined();
    expectRosterAndOwnersParity(world.getState(), secondSave);
    expect(emit).not.toHaveBeenCalled();
    const broken = { ...secondSave, buddies: { ...secondSave.buddies, invalid_actor: { id: 'invalid_actor' } as any } };
    world.restoreState(broken);
    expect(world.getBuddy('invalid_actor')).toBeUndefined();
    expectRosterAndOwnersParity(world.getState(), secondSave);
  });
});
