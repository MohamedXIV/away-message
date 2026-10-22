import { describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import type { LiveSimulationState } from '../../src/engine/SimulationEngine';
import {
  POPULATION_SCALE_TIERS,
  createPopulationScaleFixture,
  flushPopulationScaleAsyncCompletions,
  populationScaleDigest,
} from '../../src/engine/benchmark/PopulationScaleGate';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type {
  SimulationWorkerCommand, SimulationWorkerReply, SimulationWorkerRequest,
} from '../../src/simulation/host/SimulationHostProtocol';

/**
 * #175 + #177 integration: SAME agenda / route / appointment / contacts /
 * conversation fixture across a direct composed owner and the actual
 * Dedicated Worker request queue. Do not time fixture setup, snapshot import,
 * or full exports as though they were player-facing message projections.
 */
function ownerHarness() {
  const messages: SimulationWorkerReply[] = [];
  const runtime = createSimulationWorkerRuntime(message => messages.push(message));
  let nextId = 0;
  return {
    messages,
    async ask(command: SimulationWorkerCommand): Promise<unknown> {
      const id = ++nextId;
      await runtime.receive({ ...command, id } as SimulationWorkerRequest);
      const reply = messages.find(message => message.type === 'result' && message.id === id);
      if (!reply || reply.type !== 'result') throw new Error('Worker did not answer');
      if (!reply.ok) throw new Error(reply.error.message);
      return reply.value;
    },
    close() { runtime.close(); },
  };
}

describe('combined #175 Worker × #177 canonical rich population proof', () => {
  for (const population of POPULATION_SCALE_TIERS) {
    it(`replays ${population} actors with real agendas, contacts and route-backed appointments`, async () => {
      const fixture = createPopulationScaleFixture(population);
      expect(fixture.engine.social.getBuddies()).toHaveLength(population);
      expect(fixture.agendaActorIds).toHaveLength(fixture.localActorIds.length);
      expect(fixture.appointmentActorIds.length).toBeGreaterThan(0);
      expect(fixture.seededMessageCount).toBeGreaterThan(0);

      // Both owners start from EXACTLY the same already-prepared, current
      // canonical snapshot; no shadow simulation runs inside React.
      const seed = fixture.engine.exportSnapshot();
      const expected = new SimulationKernel(structuredClone(seed));
      const worker = ownerHarness();
      try {
        await worker.ask({ op: 'init', initialState: structuredClone(seed) });
        const initial = await worker.ask({ op: 'query', query: {
          kind: 'labPage', actorPage: 0, meetingPage: 0,
        } }) as { roster: { total: number }; appointments: { total: number } };
        expect(initial.roster.total).toBe(population);
        expect(initial.appointments.total).toBe(fixture.appointmentActorIds.length);

        const before = await worker.ask({ op: 'export' }) as LiveSimulationState;
        expect(populationScaleDigest(before)).toBe(populationScaleDigest(expected.exportSnapshot()));

        // A no-minute frame cannot execute a population pass.
        await worker.ask({ op: 'realtime', seconds: 0 });
        const afterZero = await worker.ask({ op: 'export' }) as LiveSimulationState;
        expect(populationScaleDigest(afterZero)).toBe(populationScaleDigest(before));

        const readsStart = performance.now();
        const view = await worker.ask({ op: 'query', query: { kind: 'gameView' } }) as {
          revision: number;
          hud: { revision: number };
          world: { revision: number };
          player: { revision: number };
        };
        const readsMs = performance.now() - readsStart;
        expect(view.revision).toBe(view.hud.revision);
        expect(view.revision).toBe(view.world.revision);
        expect(view.revision).toBe(view.player.revision);
        expect(JSON.stringify(view).length).toBeLessThan(40_000);

        const messenger = await worker.ask({ op: 'query', query: {
          kind: 'messenger', maxContacts: 32,
        } }) as { contacts: unknown[] };
        expect(messenger.contacts.length).toBeLessThanOrEqual(32);
        const contactId = fixture.knownActorIds[0]!;
        const conversation = await worker.ask({ op: 'query', query: {
          kind: 'conversation', actorId: contactId, offset: 0, limit: 30,
        } }) as { messages: unknown[]; total: number };
        expect(conversation.total).toBeGreaterThanOrEqual(6);
        expect(conversation.messages.length).toBeLessThanOrEqual(30);

        // Same chunk, same simulated minute, SAME authoritative domain state.
        const start = performance.now();
        await worker.ask({ op: 'advance', minutes: 1, reason: 'combined-rich-scale' });
        const workerTickMs = performance.now() - start;
        expected.advanceGameMinutes(1, 'combined-rich-scale');
        await flushPopulationScaleAsyncCompletions();

        const result = await worker.ask({ op: 'export' }) as LiveSimulationState;
        expect(populationScaleDigest(result)).toBe(populationScaleDigest(expected.exportSnapshot()));
        const after = await worker.ask({ op: 'query', query: { kind: 'labPage' } }) as {
          roster: { total: number }; appointments: { total: number };
        };
        expect(after.roster.total).toBe(population);
        expect(after.appointments.total).toBe(fixture.appointmentActorIds.length);
        expect(worker.messages.some(event => event.type === 'change')).toBe(true);

        console.info('[combined-worker-scale]', JSON.stringify({
          population,
          seed: fixture.seed,
          local: fixture.localActorIds.length,
          remote: fixture.remoteActorIds.length,
          agendas: fixture.agendaActorIds.length,
          appointments: fixture.appointmentActorIds.length,
          knownContacts: fixture.knownActorIds.length,
          seededMessages: fixture.seededMessageCount,
          gameViewBytes: JSON.stringify(view).length,
          gameViewReadMs: Number(readsMs.toFixed(3)),
          oneMinuteWorkerRpcMs: Number(workerTickMs.toFixed(3)),
          canonicalDigest: populationScaleDigest(result),
          equivalentToDirectOwner: true,
          measurement: 'single-run in-process Worker protocol; not browser FPS or a sampled benchmark',
        }));
      } finally {
        worker.close();
      }
    }, 180_000);
  }

  it('records the coarse-time versus per-minute policy issue without accepting either as equivalent', async () => {
    const fixture = createPopulationScaleFixture(20);
    const seed = fixture.engine.exportSnapshot();
    const coarse = new SimulationKernel(structuredClone(seed));
    const fine = new SimulationKernel(structuredClone(seed));
    coarse.advanceGameMinutes(30, 'coarse-policy-probe');
    for (let i = 0; i < 30; i++) fine.advanceGameMinutes(1, 'coarse-policy-probe');
    await flushPopulationScaleAsyncCompletions();
    // Same clock end is required; snapshot equality is NOT asserted because
    // the owning time/needs/Life domains have documented divergent semantics.
    expect(coarse.clock.getTotalMinutes()).toBe(fine.clock.getTotalMinutes());
    console.info('[combined-worker-coarse-policy]', JSON.stringify({
      sameMinute: true,
      equivalentCanonicalDigest:
        populationScaleDigest(coarse.exportSnapshot()) === populationScaleDigest(fine.exportSnapshot()),
      status: 'diagnostic only; owner policy decision remains open in #177',
    }));
  }, 180_000);
});
