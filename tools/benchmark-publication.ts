/**
 * #172 publication and bounded-read timing probe.
 * Run: npm run bench:publication
 * Deterministic fixtures, measured Node timings; no device-specific hard gate.
 * This is not a browser FPS claim and does not measure full NPC world ticks.
 */
import { performance } from 'node:perf_hooks';
import { arch, cpus, platform } from 'node:os';
import { writeFileSync } from 'node:fs';
import { BENCHMARK_POPULATIONS, createSimulationBenchmarkFixture } from '../src/engine/benchmark/SimulationBenchmarkFixture';

interface Stats { samples: number; medianMs: number; p95Ms: number; maxMs: number }
const sampleCount = Math.max(3, Math.min(40, Number(process.env.PUBLICATION_BENCH_SAMPLES || 9) || 9));

function stats(action: () => unknown): Stats {
  const times: number[] = [];
  action(); action(); // warm before timing
  for (let n = 0; n < sampleCount; n++) {
    const t = performance.now();
    action();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const round = (ms: number) => Math.round(ms * 1000) / 1000;
  return {
    samples: times.length,
    medianMs: round(times[Math.floor((times.length - 1) / 2)]!),
    p95Ms: round(times[Math.ceil(times.length * 0.95) - 1]!),
    maxMs: round(times[times.length - 1]!),
  };
}

function probe(population: number) {
  const { engine, actorIds } = createSimulationBenchmarkFixture(population);
  const buddyId = actorIds[0]!;
  const buddy = engine.social.getBuddy(buddyId)!;
  engine.social.learnHandle(buddyId, buddy.handle);
  for (let i = 0; i < 125; i++) {
    engine.social.sendMessage(buddyId, 'player', buddyId, 'publication benchmark message ' + i, 480 + i);
  }
  engine.publishExternalChange();

  let fullStateReadsDuringPublication = 0;
  let revisionNotifications = 0;
  const originalGetState = engine.getState.bind(engine);
  engine.getState = () => {
    fullStateReadsDuringPublication++;
    return originalGetState();
  };
  const off = engine.subscribeChanges(() => { revisionNotifications++; });
  let mutationSerial = 0;
  const publication = stats(() => {
    engine.world.setFlag('publication_bench_marker', ++mutationSerial);
    engine.publishExternalChange();
  });
  off();
  if (fullStateReadsDuringPublication !== 0) {
    throw new Error(`Publication unexpectedly constructed ${fullStateReadsDuringPublication} full snapshots at ${population} actors`);
  }
  if (revisionNotifications !== sampleCount + 3) {
    throw new Error(`Missing revision messages: ${revisionNotifications} at population ${population}`);
  }
  engine.getState = originalGetState;

  // Unlike a cached getState() call, this phase forces a NEW published
  // revision before the composed snapshot read; measured time includes the
  // small revision publication plus first materialization. No constructor,
  // 500-actor fixture setup, or NPC time tick is timed.
  let coldSerial = 0;
  const coldSnapshotAfterRevision = stats(() => {
    engine.world.setFlag('publication_bench_cold_snapshot', ++coldSerial);
    engine.publishExternalChange();
    engine.getState();
  });

  const reads = {
    hud: stats(() => engine.getHudProjection()),
    world: stats(() => engine.getWorldRead()),
    chrome: stats(() => engine.getChromeRead()),
    messenger: stats(() => engine.getMessengerRead(32)),
    conversationPage: stats(() => engine.getConversationRead(buddyId, 0, 50)),
    selectedActor: stats(() => engine.getPlayerActorRead(buddyId)),
    situation: stats(() => engine.getSituationRead()),
    website: stats(() => engine.getWebsiteRead()),
    cachedSnapshot: stats(() => engine.getState()),
    coldSnapshotAfterRevision,
  };
  const payloadBytes = {
    revision: Buffer.byteLength(JSON.stringify({
      revision: engine.getRevision(),
      atMinute: engine.clock.getTotalMinutes(),
      changedDomains: ['world', 'unknown'],
    })),
    chrome: Buffer.byteLength(JSON.stringify(engine.getChromeRead())),
    messenger: Buffer.byteLength(JSON.stringify(engine.getMessengerRead(32))),
    conversationPage: Buffer.byteLength(JSON.stringify(engine.getConversationRead(buddyId, 0, 50))),
    selectedActor: Buffer.byteLength(JSON.stringify(engine.getPlayerActorRead(buddyId))),
    situation: Buffer.byteLength(JSON.stringify(engine.getSituationRead())),
    fullSnapshot: Buffer.byteLength(JSON.stringify(engine.getState())),
  };

  return {
    actors: population,
    messages: engine.getConversationRead(buddyId, 0, 50).total,
    publication,
    revisionNotifications,
    fullStateReadsDuringPublication,
    reads,
    payloadBytes,
    heapUsedBytes: process.memoryUsage().heapUsed,
  };
}

const output = {
  schemaVersion: 1,
  purpose: 'Away Message #172 exact-head publication and UI-read timing, Node process (not browser FPS)',
  head: process.env.PUBLICATION_BENCH_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'unknown',
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown' },
  samplesPerPhase: sampleCount,
  populations: BENCHMARK_POPULATIONS.map(population => probe(population)),
};

const json = JSON.stringify(output, null, 2);
if (process.env.PUBLICATION_BENCH_OUTPUT) {
  writeFileSync(process.env.PUBLICATION_BENCH_OUTPUT, json + '\n', 'utf8');
}
console.log('PUBLICATION_BENCHMARK_JSON_BEGIN');
console.log(json);
console.log('PUBLICATION_BENCHMARK_JSON_END');
