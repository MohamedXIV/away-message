import { describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import { seedCharacterIds } from '../../src/engine/seedCharacters';
import type { SimulationState } from '../../src/engine/types';
import type { SimulationWorkerReply, SimulationWorkerCommand, SimulationWorkerRequest } from '../../src/simulation/host/SimulationHostProtocol';

function workerHarness() {
  const sent: SimulationWorkerReply[] = [];
  const runtime = createSimulationWorkerRuntime(reply => sent.push(reply));
  let nextId = 0;
  return {
    runtime,
    async ask(command: SimulationWorkerCommand): Promise<unknown> {
      const id = ++nextId;
      await runtime.receive({ ...command, id } as SimulationWorkerRequest);
      const response = [...sent].reverse().find(reply => reply.type === 'result' && reply.id === id);
      if (response?.type !== 'result') throw Error('Missing Worker response');
      if (!response.ok) throw Error(response.error.message);
      return response.value;
    },
  };
}

describe('#213 generated Worker starting cast', () => {
  it('creates stable seed-specific residents with live service roles, not protected IDs', () => {
    const first = buildFreshSandboxSocialState('playtest-cast-001');
    const second = buildFreshSandboxSocialState('playtest-cast-002');
    expect(first).toEqual(buildFreshSandboxSocialState('playtest-cast-001'));
    expect(first.buddies).not.toEqual(second.buddies);
    expect(first.removedSeedActorIds).toEqual(seedCharacterIds());
    // Unique world seeds should actually diversify the *visible names*.
    // The old base-31 hash correlated every slot through the UUID's final
    // character and could make multiple fresh worlds look identical.
    const casts = Array.from({ length: 20 }, (_, index) =>
      Object.values(buildFreshSandboxSocialState(`world-variety-${index.toString().padStart(3,'0')}`).buddies ?? {})
        .map(actor => actor.handle).join('|'));
    expect(new Set(casts).size).toBeGreaterThanOrEqual(16);
    const members = Object.values(first.buddies ?? {});
    expect(members).toHaveLength(8);
    expect(members.filter(actor => actor.reach === 'remote')).toHaveLength(2);
    expect(new Set(members.map(actor => actor.id)).size).toBe(8);
    expect(members.flatMap(actor => actor.roles ?? []))
      .toEqual(expect.arrayContaining(['landlord', 'cart-owner', 'diner-staff', 'canal-regular']));
    for (const actor of members) {
      expect(seedCharacterIds()).not.toContain(actor.id);
      expect(actor.isProcedural).toBe(true);
      if (actor.status === 'acquaintance') expect(first.knownHandles?.[actor.id]).toEqual([actor.handle]);
      else expect(first.knownHandles?.[actor.id]).toBeUndefined();
    }
    expect(() => buildFreshSandboxSocialState('bad!')).toThrow('Invalid new-world');
  });

  it('restores generated identities without legacy cast resurrection', () => {
    const social = buildFreshSandboxSocialState('playtest-cast-003');
    const engine = new SimulationKernel({ social, scenarioSeed: 'playtest-cast-003' });
    const ids = engine.social.getBuddyIds();
    expect(ids).toEqual(Object.keys(social.buddies ?? {}));
    expect(engine.social.getBuddyWithRole('landlord')).toBeDefined();
    expect(engine.social.getBuddyWithRole('cart-owner')).toBeDefined();
    for (const id of seedCharacterIds()) expect(engine.social.getBuddy(id)).toBeUndefined();
    // A missing named seed is not an invisible NPC relationship: the sole
    // canonical affinity graph must have no endpoints absent from this roster.
    const savedGraph = engine.exportSnapshot().social.affinities ?? {};
    expect(Object.keys(savedGraph).every(key =>
      key.split('__').every(id => ids.includes(id)))).toBe(true);
    // Scenarios may legitimately introduce additional people. Validate the
    // two explicit preexisting acquaintances by identity, not a fixed count.
    const authoredAcquaintances = Object.keys(social.knownHandles ?? {});
    expect(authoredAcquaintances).toHaveLength(2);
    const actualContacts = engine.getMessengerRead().contacts.map(row => row.actorId);
    expect(actualContacts).toEqual(expect.arrayContaining(authoredAcquaintances));
    expect(actualContacts.every(id => !seedCharacterIds().includes(id))).toBe(true);
    const reloaded = new SimulationKernel(engine.exportSnapshot());
    expect(reloaded.social.getBuddyIds()).toEqual(ids);
    expect(reloaded.getMessengerRead().contacts.map(row => row.actorId))
      .toEqual(actualContacts);
    for (const id of seedCharacterIds()) expect(reloaded.social.getBuddy(id)).toBeUndefined();
  });

  it('validates Worker new-world seed, exports real generated roster and hides seeded profiles', async () => {
    const worker = workerHarness();
    try {
      await worker.ask({ op: 'init', freshRosterSeed: 'playtest-cast-004' });
      const world = await worker.ask({ op: 'export' }) as SimulationState;
      expect(Object.keys(world.social.buddies ?? {})).toHaveLength(8);
      expect(world.social.removedSeedActorIds).toEqual(seedCharacterIds());
      // TransportSimulationState retains a narrower historical MyPlace type;
      // the active MyPlace runtime exports its page map on the real save.
      const profiles = (world.myplace as typeof world.myplace & {
        npcProfiles: Record<string, unknown>;
      }).npcProfiles;
      expect(Object.keys(profiles)).not.toContain('maya_x');
      expect(Object.keys(profiles).length).toBeGreaterThan(0);
      const locals = Object.values(world.social.buddies ?? {}).filter(actor => actor.reach === 'local');
      expect(locals).toHaveLength(6);
      expect(Object.keys(world.actorSpatialPositions ?? {})).toHaveLength(6);
      const cafe = await worker.ask({ op: 'query', query: { kind: 'cafeGuest' } }) as
        ReturnType<SimulationKernel['getCafeGuestRead']>;
      // Authoritative selection favors an actually known, present resident
      // with the strongest connection; it must not be forced to locals[1].
      expect(cafe.guest).not.toBeNull();
      const guestId = cafe.guest!.actorId;
      expect(locals.some(actor => actor.id === guestId)).toBe(true);
      expect((world.social.knownHandles ?? {})[guestId]?.length).toBeGreaterThan(0);
      expect(cafe.guest!.displayName).toBe(world.social.buddies?.[guestId]?.displayName);
      await expect(worker.ask({ op: 'init' })).rejects.toThrow('already initialized');
    } finally {
      worker.runtime.close();
    }
    const invalid = workerHarness();
    try {
      await expect(invalid.ask({ op: 'init', freshRosterSeed: 'bad!' }))
        .rejects.toThrow('Invalid new-world');
      await invalid.ask({ op: 'init', freshRosterSeed: 'playtest-cast-005' });
      const world = await invalid.ask({ op: 'export' }) as SimulationState;
      expect(Object.keys(world.social.buddies ?? {})).toHaveLength(8);
    } finally {
      invalid.runtime.close();
    }
  });
});
