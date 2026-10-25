import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_POPULATIONS,
  createSimulationBenchmarkFixture,
} from '../../src/engine/benchmark/SimulationBenchmarkFixture';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type {
  SimulationWorkerCommand, SimulationWorkerReply, SimulationWorkerRequest,
} from '../../src/simulation/host/SimulationHostProtocol';

type WorkerHarness = ReturnType<typeof makeHarness>;

function makeHarness() {
  const sent: SimulationWorkerReply[] = [];
  const owner = createSimulationWorkerRuntime(message => sent.push(message));
  let sequence = 0;
  return {
    events: sent,
    async ask(command: SimulationWorkerCommand): Promise<unknown> {
      const id = ++sequence;
      await owner.receive({ ...command, id } as SimulationWorkerRequest);
      const reply = sent.find(value => value.type === 'result' && value.id === id);
      if (!reply || reply.type !== 'result') throw new Error('No response from Worker owner');
      if (!reply.ok) throw new Error(reply.error.message);
      return reply.value;
    },
    close() { owner.close(); },
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function ownerTruth(snapshot: unknown): string {
  // Telemetry contains wall clock observations, not deterministic game truth.
  const copy = structuredClone(snapshot) as Record<string, unknown>;
  delete copy.telemetry;
  return JSON.stringify(copy);
}

describe('#175 canonical Worker population transport after default root cutover', () => {
  // These fixtures deliberately exercise the ACTUAL Worker request FIFO and
  // SimulationKernel at 20/100/250/500. They are not browser FPS numbers,
  // and do not claim #177's richer agenda/route workload is merged.
  for (const population of BENCHMARK_POPULATIONS) {
    it(`replays a ${population}-actor world through Worker IPC with stable results and bounded reads`, async () => {
      const fixture = createSimulationBenchmarkFixture(population);
      const knownId = fixture.actorIds[0]!;
      const buddy = fixture.engine.social.getBuddy(knownId)!;
      expect(fixture.engine.social.learnHandle(knownId, buddy.handle)).toBe(true);
      for (let index = 0; index < 45; index++) {
        fixture.engine.social.sendMessage(
          knownId, index % 2 === 0 ? 'player' : knownId,
          index % 2 === 0 ? knownId : 'player',
          `Worker scale proof ${index}`, 480 + index,
        );
      }
      const seed = fixture.engine.exportSnapshot();
      const snapshots: string[] = [];
      const queryLatencies: number[] = [];
      const advanceLatencies: number[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const host: WorkerHarness = makeHarness();
        try {
          await host.ask({ op: 'init', initialState: structuredClone(seed) });
          const first = await host.ask({ op: 'query', query: { kind: 'hud' } }) as {
            revision: number; time: { totalMinutes: number };
          };
          const firstMinute = first.time.totalMinutes;
          expect((await host.ask({ op: 'query', query: { kind: 'actor', actorId: 'unknown_private_actor' } })))
            .toBeNull();

          // No RAF-driven population pass: zero delta must retain game time.
          const zeroStart = performance.now();
          await host.ask({ op: 'realtime', seconds: 0 });
          const zeroMs = performance.now() - zeroStart;
          const afterZero = await host.ask({ op: 'query', query: { kind: 'hud' } }) as {
            time: { totalMinutes: number };
          };
          expect(afterZero.time.totalMinutes).toBe(firstMinute);
          expect(zeroMs).toBeGreaterThanOrEqual(0);

          for (let sample = 0; sample < 3; sample++) {
            const start = performance.now();
            const view = await host.ask({ op: 'query', query: { kind: 'gameView' } }) as {
              revision: number;
              hud: { revision: number };
              world: { revision: number };
              player: { revision: number };
            };
            queryLatencies.push(performance.now() - start);
            expect(view.revision).toBe(view.hud.revision);
            expect(view.revision).toBe(view.world.revision);
            expect(view.revision).toBe(view.player.revision);
            expect(JSON.stringify(view)).not.toContain('conversations');
            // This is intentionally a small, bounded game view even at 500.
            expect(JSON.stringify(view).length).toBeLessThan(40_000);
          }
          const messenger = await host.ask({ op: 'query', query: { kind: 'messenger', maxContacts: 32 } }) as {
            contacts: unknown[];
          };
          expect(messenger.contacts.length).toBeLessThanOrEqual(32);
          const conversation = await host.ask({
            op: 'query', query: { kind: 'conversation', actorId: knownId, limit: 25, offset: 0 },
          }) as { messages: unknown[]; total: number };
          expect(conversation.messages.length).toBeLessThanOrEqual(25);
          expect(conversation.total).toBeGreaterThanOrEqual(45);

          const start = performance.now();
          await host.ask({ op: 'advance', minutes: 1, reason: 'worker-population-gate' });
          advanceLatencies.push(performance.now() - start);
          const hud = await host.ask({ op: 'query', query: { kind: 'hud' } }) as {
            time: { totalMinutes: number };
          };
          expect(hud.time.totalMinutes).toBe(firstMinute + 1);
          const saved = await host.ask({ op: 'export' });
          snapshots.push(ownerTruth(saved));
          expect(host.events.some(event => event.type === 'change')).toBe(true);
        } finally {
          host.close();
        }
      }
      // Two separately created canonical owners receive the SAME snapshot.
      // Neither may leak prior worker state or generate a divergent world.
      expect(snapshots[1]).toEqual(snapshots[0]);
      console.info('[worker-population-gate]', JSON.stringify({
        head: process.env.GITHUB_SHA ?? 'local',
        population, runs: 2, boundedGameViewSamples: queryLatencies.length,
        queryMedianMs: Math.round(median(queryLatencies) * 1000) / 1000,
        oneMinuteMedianMs: Math.round(median(advanceLatencies) * 1000) / 1000,
        deterministic: true,
        transport: 'Worker request FIFO (in-process harness, not browser FPS)',
      }));
    }, 90_000);
  }

  it('has one canonical owner per Worker and denies a second initialization', async () => {
    const host = makeHarness();
    try {
      await host.ask({ op: 'init' });
      await expect(host.ask({ op: 'init' })).rejects.toThrow('already initialized');
      const atZero = await host.ask({ op: 'query', query: { kind: 'gameView' } });
      expect(atZero).toHaveProperty('revision');
    } finally { host.close(); }
  });
});
