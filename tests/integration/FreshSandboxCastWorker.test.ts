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
    const members = Object.values(first.buddies ?? {});
    expect(members).toHaveLength(8);
    expect(members.filter(actor => actor.reach === 'remote')).toHaveLength(2);
    expect(new Set(members.map(actor => actor.id)).size).toBe(8);
    expect(members.flatMap(actor => actor.roles ?? []))
      .toEqual(expect.arrayContaining(['landlord', 'cart-owner', 'diner-staff', 'canal-regular']));
    for (const actor of members) {
      expect(seedCharacterIds()).not.toContain(actor.id);
      expect(actor.isProcedural).toBe(true);
      expect(first.knownHandles?.[actor.id]).toBeUndefined();
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
    expect(engine.getMessengerRead().contacts).toHaveLength(0);
    const reloaded = new SimulationKernel(engine.exportSnapshot());
    expect(reloaded.social.getBuddyIds()).toEqual(ids);
    expect(reloaded.getMessengerRead().contacts).toHaveLength(0);
    for (const id of seedCharacterIds()) expect(reloaded.social.getBuddy(id)).toBeUndefined();
  });

  it('validates Worker new-world seed, exports real generated roster and hides seeded profiles', async () => {
    const worker = workerHarness();
    try {
      await worker.ask({ op: 'init', freshRosterSeed: 'playtest-cast-004' });
      const world = await worker.ask({ op: 'export' }) as SimulationState;
      expect(Object.keys(world.social.buddies ?? {})).toHaveLength(8);
      expect(world.social.removedSeedActorIds).toEqual(seedCharacterIds());
      expect(Object.keys(world.myplace.npcProfiles)).not.toContain('maya_x');
      expect(Object.keys(world.myplace.npcProfiles).length).toBeGreaterThan(0);
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
