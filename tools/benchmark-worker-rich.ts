/**
 * #175 × #177: repeatable, exact-head combined Worker FIFO versus direct-owner
 * rich-population benchmark. NOT a native Browser Worker/FPS microbenchmark.
 *
 * Run: npm run bench:worker-rich
 * Set WORKER_RICH_SAMPLES / WORKER_RICH_WARMUPS / WORKER_RICH_OUTPUT.
 * Timing never gates success; canonical digests, scopes and caps do.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { arch, cpus, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { SimulationKernel } from '../src/engine/kernel/SimulationKernel';
import { createPopulationScaleFixture, POPULATION_SCALE_TIERS } from '../src/engine/benchmark/PopulationScaleFixture';
import { flushPopulationScaleAsyncCompletions, populationScaleDigest } from '../src/engine/benchmark/PopulationScaleGate';
import { createSimulationWorkerRuntime } from '../src/simulation/host/SimulationWorkerRuntime';
import type { SimulationWorkerCommand, SimulationWorkerReply, SimulationWorkerRequest } from '../src/simulation/host/SimulationHostProtocol';

type Snapshot = ReturnType<SimulationKernel['exportSnapshot']>;
type SampleStats = { samples: number; medianMs: number; p95Ms: number; minMs: number; maxMs: number };
type Sample = { directMinute: number; workerMinute: number; workerRead: number; allLocalIntents: number; allLocalSnapshots: number; workerInit: number; workerExport: number };

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 20 ? parsed : fallback;
}
const samples = Math.max(2, envInt('WORKER_RICH_SAMPLES', 3));
const warmups = envInt('WORKER_RICH_WARMUPS', 1);
const head = process.env.WORKER_RICH_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'unverified-local';
function round(n: number): number { return Math.round(n * 1000) / 1000; }
function stat(values: number[]): SampleStats {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) throw new Error('No samples');
  return { samples: sorted.length, medianMs: round(sorted[Math.ceil(sorted.length * .5) - 1]!),
    p95Ms: round(sorted[Math.ceil(sorted.length * .95) - 1]!),
    minMs: round(sorted[0]!), maxMs: round(sorted[sorted.length - 1]!) };
}
function measure(action: () => void): number {
  const started = performance.now();
  action();
  return performance.now() - started;
}
function harness() {
  const messages: SimulationWorkerReply[] = [];
  const runtime = createSimulationWorkerRuntime(message => messages.push(message));
  let requestId = 0;
  return {
    async ask(command: SimulationWorkerCommand): Promise<unknown> {
      const id = ++requestId;
      await runtime.receive({ ...command, id } as SimulationWorkerRequest);
      const reply = messages.find(message => message.type === 'result' && message.id === id);
      if (!reply || reply.type !== 'result') throw new Error('Missing Worker FIFO response');
      if (!reply.ok) throw new Error(reply.error.message);
      return reply.value;
    },
    close() { runtime.close(); },
  };
}
async function timed<T>(action: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await action();
  return { value, ms: performance.now() - start };
}
function canonical(snapshot: Snapshot): string { return populationScaleDigest(snapshot); }

async function tier(population: number) {
  const fixture = createPopulationScaleFixture(population);
  const seed = fixture.engine.exportSnapshot();
  const rows: Sample[] = [];
  let digest = '';
  let projectedBytes = 0;
  let coarseEqual: boolean | null = null;
  for (let index = 0; index < warmups + samples; index++) {
    const direct = new SimulationKernel(structuredClone(seed));
    const owner = harness();
    try {
      const init = await timed(() => owner.ask({ op: 'init', initialState: structuredClone(seed) }));
      const before = await owner.ask({ op: 'export' }) as Snapshot;
      if (canonical(before) !== canonical(direct.exportSnapshot())) {
        throw new Error(`Tier ${population}: init diverged`);
      }
      const read = await timed(() => owner.ask({ op: 'query', query: { kind: 'gameView' } }));
      const projection = read.value as { revision: number; hud: { revision: number }; world: { revision: number }; player: { revision: number } };
      projectedBytes = Buffer.byteLength(JSON.stringify(projection));
      if (projectedBytes >= 40_000 || projection.revision !== projection.hud.revision ||
          projection.revision !== projection.world.revision || projection.revision !== projection.player.revision) {
        throw new Error(`Tier ${population}: unbounded or incoherent publication`);
      }
      const readSnapshotBefore = canonical(direct.exportSnapshot());
      const allLocalIntents = measure(() => {
        for (const actorId of fixture.localActorIds) direct.getCharacterIntent(actorId);
      });
      const allLocalSnapshots = measure(() => {
        for (const actorId of fixture.localActorIds) direct.getLifeSnapshot(actorId);
      });
      if (canonical(direct.exportSnapshot()) !== readSnapshotBefore) {
        throw new Error(`Tier ${population}: semantic reads mutated canonical world`);
      }
      await owner.ask({ op: 'realtime', seconds: 0 });
      const zero = await owner.ask({ op: 'export' }) as Snapshot;
      if (canonical(zero) !== canonical(before)) throw new Error(`Tier ${population}: zero-minute tick mutated world`);
      const directMinute = measure(() => direct.advanceGameMinutes(1, 'rich-sampled-benchmark'));
      const workerMinute = await timed(() => owner.ask({ op: 'advance', minutes: 1, reason: 'rich-sampled-benchmark' }));
      await flushPopulationScaleAsyncCompletions();
      const output = await timed(() => owner.ask({ op: 'export' }));
      const workerSnapshot = output.value as Snapshot;
      const actualDigest = canonical(workerSnapshot);
      if (actualDigest !== canonical(direct.exportSnapshot())) {
        throw new Error(`Tier ${population}: direct/Worker digest mismatch at sample ${index}`);
      }
      if (digest && digest !== actualDigest) throw new Error(`Tier ${population}: repeated sample changed deterministic digest`);
      digest = actualDigest;
      if (index >= warmups) rows.push({
        directMinute, workerMinute: workerMinute.ms,
        workerRead: read.ms, allLocalIntents, allLocalSnapshots,
        workerInit: init.ms, workerExport: output.ms,
      });
    } finally { owner.close(); }
  }
  // Diagnostic only: existing #177 policy allows coarse versus fine to differ.
  if (population === 20) {
    const coarse = new SimulationKernel(structuredClone(seed));
    const fine = new SimulationKernel(structuredClone(seed));
    coarse.advanceGameMinutes(30, 'coarse-fine-diagnostic');
    for (let i = 0; i < 30; i++) fine.advanceGameMinutes(1, 'coarse-fine-diagnostic');
    await flushPopulationScaleAsyncCompletions();
    if (coarse.clock.getTotalMinutes() !== fine.clock.getTotalMinutes()) throw new Error('Time endpoints differ');
    coarseEqual = canonical(coarse.exportSnapshot()) === canonical(fine.exportSnapshot());
  }
  const columns = ['directMinute', 'workerMinute', 'workerRead', 'allLocalIntents',
    'allLocalSnapshots', 'workerInit', 'workerExport'] as const;
  const stats = Object.fromEntries(columns.map(name => [name, stat(rows.map(row => row[name]))]));
  const result = {
    population, localActors: fixture.localActorIds.length, remoteActors: fixture.remoteActorIds.length,
    agendaActors: fixture.agendaActorIds.length, appointments: fixture.appointmentActorIds.length,
    messages: fixture.seededMessageCount, boundedGameViewBytes: projectedBytes,
    canonicalDigest: digest, deterministicSamples: rows.length, stats,
    coarseVsFineCanonicalEqual: coarseEqual,
  };
  console.info('[worker-rich-sampled]', JSON.stringify(result));
  return result;
}

async function main() {
  const started = new Date().toISOString();
  const rows = [];
  for (const population of POPULATION_SCALE_TIERS) rows.push(await tier(population));
  const result = {
    kind: 'combined-rich-worker-fifo',
    exactHead: head, started, ended: new Date().toISOString(),
    environment: { node: process.version, platform: platform(), release: release(), arch: arch(),
      cpu: cpus()[0]?.model ?? 'unknown', logicalCpus: cpus().length },
    workload: 'canonical #177 route-backed agenda/appointments + true Worker FIFO + direct-owner digest',
    transport: 'in-process WorkerRuntime message queue; excludes actual browser postMessage and FPS',
    notes: ['No wall-clock threshold gate', 'Coarse-jump equivalence is diagnostic, not asserted',
      'Workload setup excluded from sample timing', 'Worker RPC includes FIFO message handling; direct kernel separate'],
    samplesPerTier: samples, warmupsPerTier: warmups, tiers: rows,
  };
  const outputPath = process.env.WORKER_RICH_OUTPUT;
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  }
  const markdown = [
    '### Combined #175/#177 rich Worker evidence',
    `Exact head: \`${head}\` | Node: \`${process.version}\` | samples/tier: ${samples} | warmups: ${warmups}`,
    '| NPCs | Direct minute p50/p95 | Worker FIFO minute p50/p95 | Intent pass p50/p95 | Life snapshot pass p50/p95 | Bounded view bytes |',
    '|---:|---:|---:|---:|---:|---:|',
    ...rows.map(row => {
      const t = row.stats as Record<string, SampleStats>;
      const f = (key: string) => `${t[key]!.medianMs}/${t[key]!.p95Ms} ms`;
      return `| ${row.population} | ${f('directMinute')} | ${f('workerMinute')} | ${f('allLocalIntents')} | ${f('allLocalSnapshots')} | ${row.boundedGameViewBytes} |`;
    }),
    '',
    'All canonical direct/Worker sample digests match. Time jump divergence is diagnostic only; sampled IPC here is not native browser FPS.',
  ].join('\n');
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
void main().catch(error => {
  console.error('[worker-rich-sampled] ERROR', error);
  process.exitCode = 1;
});
