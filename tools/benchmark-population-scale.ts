/**
 * #177 deterministic population scaling and stress gate.
 *
 * Run: npm run bench:population
 *
 * This runner exercises canonical simulation behavior only. It never asserts
 * wall-clock thresholds; correctness checks gate, timings are evidence tied to
 * the recorded Node/CPU environment. The fixtures are the same ones exported
 * for later #175 Worker-host integration.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { SimulationEngine } from '../src/engine/SimulationEngine';
import { createSimulationBenchmarkEngineFactory } from '../src/engine/benchmark/SimulationBenchmarkFixture';
import {
  POPULATION_SCALE_SEED,
  POPULATION_SCALE_TIERS,
  collectPopulationScaleMetrics,
  createPopulationScaleFixture,
  flushPopulationScaleAsyncCompletions,
  populationScaleEngineDigest,
} from '../src/engine/benchmark/PopulationScaleGate';

interface SampleStats {
  samples: number;
  minMs: number;
  medianMs: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
}

interface CorrectnessCheck {
  id: string;
  ok: boolean;
  detail: string;
}

interface TierSamplePlan {
  idle: number;
  normal: number;
  extended: number;
  reads: number;
  persistence: number;
}

const DEFAULT_SAMPLE_PLAN: Record<number, TierSamplePlan> = {
  20: { idle: 5, normal: 5, extended: 2, reads: 5, persistence: 3 },
  100: { idle: 4, normal: 4, extended: 2, reads: 3, persistence: 3 },
  250: { idle: 3, normal: 2, extended: 1, reads: 2, persistence: 2 },
  500: { idle: 2, normal: 2, extended: 1, reads: 1, persistence: 1 },
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const normalTickCount = envInt('POP_SCALE_TICKS', 3);
const extendedDays = envInt('POP_SCALE_DAYS', 3);
const idleFrames = Math.max(1, Math.min(59, envInt('POP_SCALE_IDLE_FRAMES', 30)));
const sampleOverride = process.env.POP_SCALE_SAMPLES
  ? envInt('POP_SCALE_SAMPLES', 1)
  : null;
const warmupOverride = process.env.POP_SCALE_WARMUPS
  ? envInt('POP_SCALE_WARMUPS', 0)
  : null;

function nowMs(): number {
  return performance.now();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function stats(values: readonly number[]): SampleStats {
  if (values.length === 0) {
    return { samples: 0, minMs: 0, medianMs: 0, meanMs: 0, p95Ms: 0, maxMs: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    samples: values.length,
    minMs: round(sorted[0] ?? 0),
    medianMs: round(percentile(sorted, 0.5)),
    meanMs: round(total / values.length),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

function planFor(tier: number): TierSamplePlan {
  const base = DEFAULT_SAMPLE_PLAN[tier] ?? { idle: 2, normal: 2, extended: 1, reads: 1, persistence: 1 };
  if (sampleOverride === null) return base;
  return {
    idle: sampleOverride,
    normal: sampleOverride,
    extended: Math.max(1, Math.min(base.extended, sampleOverride)),
    reads: sampleOverride,
    persistence: sampleOverride,
  };
}

function warmupsFor(tier: number, workload: keyof TierSamplePlan): number {
  if (warmupOverride !== null) return warmupOverride;
  if (workload === 'persistence') return 0;
  return tier >= 500 ? 1 : 2;
}

function measureIsolated<T>(
  setup: () => T,
  action: (subject: T) => void,
  samples: number,
  warmups: number,
): SampleStats {
  const durations: number[] = [];
  for (let index = 0; index < warmups + samples; index += 1) {
    const subject = setup();
    const started = nowMs();
    action(subject);
    const duration = nowMs() - started;
    if (index >= warmups) durations.push(duration);
  }
  return stats(durations);
}

function measureSync(action: () => void, samples: number, warmups: number): SampleStats {
  for (let index = 0; index < warmups; index += 1) action();
  const durations: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const started = nowMs();
    action();
    durations.push(nowMs() - started);
  }
  return stats(durations);
}

async function measureAsync(
  action: () => Promise<void>,
  samples: number,
  warmups: number,
): Promise<SampleStats> {
  for (let index = 0; index < warmups; index += 1) await action();
  const durations: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const started = nowMs();
    await action();
    durations.push(nowMs() - started);
  }
  return stats(durations);
}

interface TickSequenceResult {
  perTick: SampleStats;
  perSampleTotal: SampleStats;
  ticksMeasured: number;
}

function measureTickSequence(
  createEngine: () => SimulationEngine,
  tickCount: number,
  samples: number,
  warmups: number,
): TickSequenceResult {
  const perTick: number[] = [];
  const totals: number[] = [];
  for (let sample = 0; sample < warmups + samples; sample += 1) {
    const engine = createEngine();
    let total = 0;
    for (let tick = 0; tick < tickCount; tick += 1) {
      const started = nowMs();
      engine.advanceGameMinutes(1, 'population-benchmark:normal');
      const duration = nowMs() - started;
      if (sample >= warmups) {
        perTick.push(duration);
        total += duration;
      }
    }
    if (sample >= warmups) totals.push(total);
  }
  return {
    perTick: stats(perTick),
    perSampleTotal: stats(totals),
    ticksMeasured: perTick.length,
  };
}

function addCheck(
  checks: CorrectnessCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail });
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function resolveGitSha(): string {
  const injected = process.env.SIM_BENCH_HEAD_SHA ?? process.env.GITHUB_SHA;
  if (injected) return injected;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function heapSnapshot(): { heapUsedBytes: number; rssBytes: number } {
  const usage = process.memoryUsage();
  return { heapUsedBytes: usage.heapUsed, rssBytes: usage.rss };
}

interface ScalingEvidence {
  steadyTickP50Vs20: number;
  steadyTickP50VsPrevious: number;
  steadyTickP50PerLocalActorMs: number | null;
  exportP50Vs20: number;
}

async function benchmarkTier(
  tier: number,
  checks: CorrectnessCheck[],
): Promise<Record<string, unknown>> {
  const plan = planFor(tier);
  const fixture = createPopulationScaleFixture(tier);
  const startMinute = fixture.engine.clock.getTotalMinutes();
  const heapAfterSetup = heapSnapshot();

  const coldSnapshot = fixture.engine.exportSnapshot();
  const coldEngineFactory = createSimulationBenchmarkEngineFactory(coldSnapshot);

  // Idle evidence: sub-minute frames must not run population work.
  const idleFrame = measureIsolated(
    coldEngineFactory,
    (engine) => engine.advanceRealTime(1 / 60),
    plan.idle,
    warmupsFor(tier, 'idle'),
  );
  const idleBurst = measureIsolated(
    coldEngineFactory,
    (engine) => {
      for (let frame = 0; frame < idleFrames; frame += 1) engine.advanceRealTime(1 / 60);
    },
    plan.idle,
    warmupsFor(tier, 'idle'),
  );
  const idleCheckEngine = coldEngineFactory();
  const idleBeforeDigest = populationScaleEngineDigest(idleCheckEngine);
  for (let frame = 0; frame < idleFrames; frame += 1) idleCheckEngine.advanceRealTime(1 / 60);
  const idleAfterDigest = populationScaleEngineDigest(idleCheckEngine);
  const idleClockUnchanged = idleCheckEngine.clock.getTotalMinutes() === startMinute;
  const idleDigestUnchanged = idleBeforeDigest === idleAfterDigest;
  addCheck(
    checks,
    `${tier}.idle.no-population-work`,
    idleClockUnchanged && idleDigestUnchanged,
    `${idleFrames} frames, clock unchanged=${idleClockUnchanged}, canonical digest unchanged=${idleDigestUnchanged}`,
  );

  // One warm minute stabilizes persisted Life entries before measuring
  // steady-state ticks; the cold first minute is measured separately.
  fixture.engine.advanceGameMinutes(1, 'population-benchmark:warm');
  const warmSnapshot = fixture.engine.exportSnapshot();
  const warmEngineFactory = createSimulationBenchmarkEngineFactory(warmSnapshot);

  const coldFirstTick = measureIsolated(
    coldEngineFactory,
    (engine) => engine.advanceGameMinutes(1, 'population-benchmark:cold'),
    Math.max(1, Math.min(plan.normal, tier >= 250 ? 1 : 2)),
    0,
  );
  const steadyTicks = measureTickSequence(
    warmEngineFactory,
    normalTickCount,
    plan.normal,
    warmupsFor(tier, 'normal'),
  );

  for (let tick = 0; tick < normalTickCount; tick += 1) {
    fixture.engine.advanceGameMinutes(1, 'population-benchmark:normal');
  }
  const normalMetrics = collectPopulationScaleMetrics(fixture);
  const normalDigest = populationScaleEngineDigest(fixture.engine);

  const deterministicA = warmEngineFactory();
  const deterministicB = warmEngineFactory();
  deterministicA.advanceGameMinutes(1, 'population-benchmark:determinism');
  deterministicB.advanceGameMinutes(1, 'population-benchmark:determinism');
  const deterministicDigestA = populationScaleEngineDigest(deterministicA);
  const deterministicDigestB = populationScaleEngineDigest(deterministicB);
  addCheck(
    checks,
    `${tier}.normal.deterministic-digest`,
    deterministicDigestA === deterministicDigestB,
    `same-seed replay digest ${deterministicDigestA.slice(0, 16)} vs ${deterministicDigestB.slice(0, 16)}`,
  );

  const activeTrips = Object.values(normalMetrics.trips).reduce(
    (total, count) => total + count,
    0,
  );
  addCheck(
    checks,
    `${tier}.normal.scheduled-activity`,
    activeTrips > 0 && normalMetrics.agendaEntries > 0,
    `${activeTrips} trip record(s), ${normalMetrics.agendaEntries} agenda entries, intents=${JSON.stringify(normalMetrics.intents)}`,
  );
  addCheck(
    checks,
    `${tier}.normal.population-stable`,
    normalMetrics.population === tier,
    `${normalMetrics.population}/${tier} actors after ${normalTickCount + 1} minutes`,
  );
  addCheck(
    checks,
    `${tier}.normal.remote-not-physical`,
    normalMetrics.remotePhysicalActors === 0,
    `${normalMetrics.remotePhysicalActors} remote actors with local position/trip`,
  );
  addCheck(
    checks,
    `${tier}.normal.tick-count`,
    fixture.engine.clock.getTotalMinutes() === startMinute + normalTickCount + 1,
    `clock ${startMinute} -> ${fixture.engine.clock.getTotalMinutes()}`,
  );

  // Extended multi-day work. Day-boundary passes repeatedly create agendas,
  // resolve appointments and open/close trips; no population growth is allowed.
  const extendedSampleDays: number[][] = [];
  const extendedHeap: Array<{ before: number; after: number }> = [];
  let extendedDigest = '';
  let extendedMetrics = normalMetrics;
  let extendedSnapshotBytes = normalMetrics.snapshotBytes;
  for (let sample = 0; sample < plan.extended; sample += 1) {
    const engine = warmEngineFactory();
    const dayTimes: number[] = [];
    const heapBefore = heapSnapshot().heapUsedBytes;
    for (let day = 0; day < extendedDays; day += 1) {
      const started = nowMs();
      engine.advanceGameMinutes(1440, 'population-benchmark:extended-day');
      dayTimes.push(nowMs() - started);
    }
    await flushPopulationScaleAsyncCompletions();
    const heapAfter = heapSnapshot().heapUsedBytes;
    extendedSampleDays.push(dayTimes);
    extendedHeap.push({ before: heapBefore, after: heapAfter });
    if (sample === plan.extended - 1) {
      extendedDigest = populationScaleEngineDigest(engine);
      extendedMetrics = collectPopulationScaleMetrics({ ...fixture, engine });
      extendedSnapshotBytes = extendedMetrics.snapshotBytes;
    }
  }
  const flatDayTimes = extendedSampleDays.flat();
  const firstDayTimes = extendedSampleDays[0] ?? [];
  const extendedDayTrend = {
    firstDayMs: round(firstDayTimes[0] ?? 0),
    lastDayMs: round(firstDayTimes[firstDayTimes.length - 1] ?? 0),
    ratio: firstDayTimes[0] && firstDayTimes.length > 1
      ? round((firstDayTimes[firstDayTimes.length - 1] ?? 0) / firstDayTimes[0]!)
      : null,
  };
  addCheck(
    checks,
    `${tier}.extended.population-stable`,
    extendedMetrics.population === tier,
    `${extendedMetrics.population}/${tier} actors after ${extendedDays} day(s)`,
  );
  addCheck(
    checks,
    `${tier}.extended.remote-not-physical`,
    extendedMetrics.remotePhysicalActors === 0,
    `${extendedMetrics.remotePhysicalActors} remote actors with local position/trip`,
  );
  addCheck(
    checks,
    `${tier}.extended.bounded-projections`,
    extendedMetrics.projections.messengerContacts <= 32
      && extendedMetrics.projections.conversationMessages <= 30
      && extendedMetrics.projections.pulseContacts <= 500,
    `messenger=${extendedMetrics.projections.messengerContacts}, conversation=${extendedMetrics.projections.conversationMessages}, pulse=${extendedMetrics.projections.pulseContacts}`,
  );
  addCheck(
    checks,
    `${tier}.extended.digest-present`,
    extendedDigest.length === 64,
    `digest ${extendedDigest.slice(0, 16)}`,
  );

  // Semantic read pressure. All reads must be side-effect free.
  const readsBeforeDigest = populationScaleEngineDigest(fixture.engine);
  const targetedCount = Math.min(32, fixture.knownActorIds.length);
  const reads = {
    hud: measureSync(() => fixture.engine.getHudProjection(), plan.reads, warmupsFor(tier, 'reads')),
    world: measureSync(() => fixture.engine.getWorldRead(), plan.reads, warmupsFor(tier, 'reads')),
    chrome: measureSync(() => fixture.engine.getChromeRead(), plan.reads, warmupsFor(tier, 'reads')),
    presence: measureSync(() => fixture.engine.getPresenceRead(), plan.reads, warmupsFor(tier, 'reads')),
    situation: measureSync(() => fixture.engine.getSituationRead(), plan.reads, warmupsFor(tier, 'reads')),
    messenger: measureSync(() => fixture.engine.getMessengerRead(32), plan.reads, warmupsFor(tier, 'reads')),
    pulseContacts: measureSync(() => fixture.engine.getPulseContactsRead(), plan.reads, warmupsFor(tier, 'reads')),
    conversationPage: measureSync(
      () => fixture.engine.getConversationRead(fixture.knownActorIds[0]!, 0, 30),
      plan.reads,
      warmupsFor(tier, 'reads'),
    ),
    selectedActor: measureSync(
      () => fixture.engine.getPlayerActorRead(fixture.knownActorIds[0]!),
      plan.reads,
      warmupsFor(tier, 'reads'),
    ),
    targetedActorPass: measureSync(() => {
      for (const actorId of fixture.knownActorIds.slice(0, targetedCount)) {
        fixture.engine.getLifeSnapshot(actorId);
        fixture.engine.getCharacterIntent(actorId);
        fixture.engine.getPlayerActorRead(actorId);
      }
    }, plan.reads, warmupsFor(tier, 'reads')),
    allActorIntentPass: measureSync(() => {
      for (const actorId of fixture.localActorIds) fixture.engine.getCharacterIntent(actorId);
    }, Math.max(1, Math.min(plan.reads, tier >= 250 ? 1 : 2)), 0),
  };
  const readsAfterDigest = populationScaleEngineDigest(fixture.engine);
  addCheck(
    checks,
    `${tier}.reads.side-effect-free`,
    readsBeforeDigest === readsAfterDigest,
    `digest stable=${readsBeforeDigest === readsAfterDigest}`,
  );
  addCheck(
    checks,
    `${tier}.reads.bounded`,
    normalMetrics.projections.messengerContacts <= 32
      && normalMetrics.projections.conversationMessages <= 30
      && normalMetrics.projections.pulseContacts <= 500,
    `messenger=${normalMetrics.projections.messengerContacts}, conversation=${normalMetrics.projections.conversationMessages}, pulse=${normalMetrics.projections.pulseContacts}`,
  );

  // Persistence is measured separately from normal gameplay work.
  const persistenceSnapshot = fixture.engine.exportSnapshot();
  const exportSnapshot = measureSync(
    () => fixture.engine.exportSnapshot(),
    plan.persistence,
    warmupsFor(tier, 'persistence'),
  );
  const exportSnapshotAsync = await measureAsync(
    async () => {
      await fixture.engine.exportSnapshotAsync();
    },
    plan.persistence,
    warmupsFor(tier, 'persistence'),
  );
  const restoreDurations: number[] = [];
  let restoredDigest = '';
  for (let sample = 0; sample < plan.persistence; sample += 1) {
    const copy = structuredClone(persistenceSnapshot);
    const started = nowMs();
    const restored = new SimulationEngine(copy);
    restoreDurations.push(nowMs() - started);
    restoredDigest = populationScaleEngineDigest(restored);
  }
  addCheck(
    checks,
    `${tier}.persistence.round-trip`,
    restoredDigest === normalDigest,
    `restored digest matches=${restoredDigest === normalDigest}`,
  );

  const scaling: ScalingEvidence = {
    steadyTickP50Vs20: 1,
    steadyTickP50VsPrevious: 1,
    steadyTickP50PerLocalActorMs: null,
    exportP50Vs20: 1,
  };

  return {
    population: tier,
    fixture: {
      seed: fixture.seed,
      seedActors: fixture.base.seedActorCount,
      localActors: fixture.localActorIds.length,
      remoteActors: fixture.remoteActorIds.length,
      knownContacts: fixture.knownActorIds.length,
      agendaActors: fixture.agendaActorIds.length,
      appointmentActors: fixture.appointmentActorIds.length,
      routes: fixture.routes,
      seededMessages: fixture.seededMessageCount,
      heapAfterSetup,
    },
    idle: {
      presentationFrames: idleFrames,
      singleFrame: idleFrame,
      burst: idleBurst,
      meanFrameMs: round(idleBurst.medianMs / idleFrames),
      clockUnchanged: idleClockUnchanged,
      digestUnchanged: idleDigestUnchanged,
      digest: idleBeforeDigest,
    },
    normal: {
      tickCount: normalTickCount,
      coldFirstTick,
      perTick: steadyTicks.perTick,
      perSampleTotal: steadyTicks.perSampleTotal,
      ticksMeasured: steadyTicks.ticksMeasured,
      minutesAdvanced: normalTickCount + 1,
      metrics: normalMetrics,
      digest: normalDigest,
    },
    extended: {
      days: extendedDays,
      dayJump: stats(flatDayTimes),
      perSampleDayTimes: extendedSampleDays.map((times) => times.map(round)),
      dayTrend: extendedDayTrend,
      heapDeltaBytes: extendedHeap.reduce(
        (total, sample) => total + (sample.after - sample.before),
        0,
      ),
      messageCount: extendedMetrics.messageCount,
      agendaEntries: extendedMetrics.agendaEntries,
      tripActors: extendedMetrics.tripActors,
      appointmentStatuses: extendedMetrics.appointmentStatuses,
      snapshotBytes: extendedSnapshotBytes,
      digest: extendedDigest,
    },
    reads: {
      stats: reads,
      projectionBytes: {
        messenger: normalMetrics.projections.messengerBytes,
        pulse: normalMetrics.projections.pulseBytes,
        conversation: normalMetrics.projections.conversationBytes,
        hud: normalMetrics.projections.hudBytes,
        world: normalMetrics.projections.worldBytes,
        chrome: normalMetrics.projections.chromeBytes,
        presence: normalMetrics.projections.presenceBytes,
        situation: normalMetrics.projections.situationBytes,
        website: normalMetrics.projections.websiteBytes,
      },
      digestStable: readsBeforeDigest === readsAfterDigest,
    },
    persistence: {
      exportSnapshot,
      exportSnapshotAsync,
      restore: stats(restoreDurations),
      serializedSnapshotBytes: jsonBytes(persistenceSnapshot),
      digestMatches: restoredDigest === normalDigest,
      digest: restoredDigest,
    },
    scaling,
  };
}

function computeScaling(
  results: Array<Record<string, any>>,
): void {
  const baseline = results.find((result) => result.population === 20);
  const baseTick = baseline?.normal?.perTick?.medianMs as number | undefined;
  const baseExport = baseline?.persistence?.exportSnapshot?.medianMs as number | undefined;
  let previousTick: number | undefined;
  for (const result of results) {
    const tick = result.normal?.perTick?.medianMs as number | undefined;
    const exportMs = result.persistence?.exportSnapshot?.medianMs as number | undefined;
    const localActors = result.fixture?.localActors as number | undefined;
    result.scaling = {
      steadyTickP50Vs20: baseTick && tick ? round(tick / baseTick) : null,
      steadyTickP50VsPrevious: previousTick && tick ? round(tick / previousTick) : null,
      steadyTickP50PerLocalActorMs: localActors && tick ? round(tick / localActors) : null,
      exportP50Vs20: baseExport && exportMs ? round(exportMs / baseExport) : null,
    };
    if (tick) previousTick = tick;
  }
}

async function main(): Promise<void> {
  const checks: CorrectnessCheck[] = [];
  const results: Array<Record<string, any>> = [];
  for (const tier of POPULATION_SCALE_TIERS) {
    results.push(await benchmarkTier(tier, checks));
  }
  computeScaling(results);

  const correctness = {
    overall: checks.every((check) => check.ok),
    checks,
  };
  const environment = {
    node: process.version,
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model ?? 'unknown',
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
  };
  const report = {
    schemaVersion: 1,
    issue: 177,
    purpose:
      'Away Message deterministic population scaling and stress evidence (Node process, canonical simulation; not browser FPS or Worker transport)',
    generatedAt: new Date().toISOString(),
    gitSha: resolveGitSha(),
    environment,
    config: {
      seed: POPULATION_SCALE_SEED,
      populations: [...POPULATION_SCALE_TIERS],
      samplePlan: Object.fromEntries(
        POPULATION_SCALE_TIERS.map((tier) => [tier, planFor(tier)]),
      ),
      normalTickCount,
      extendedDays,
      idleFrames,
      sampleOverride,
      warmupOverride,
      digest: 'sha256 of canonical snapshot excluding wall-clock telemetry',
    },
    correctness,
    populations: results,
    limitations: [
      'Timings are Node process wall-clock measurements and vary by host load; no timing threshold gates this run.',
      'Generated transit content currently exposes the routes listed per tier; the fixture documents rather than invents missing destinations.',
      'Coarse multi-day jumps are measured with identical chunking per sample. Coarse jumps are not asserted to equal repeated one-minute ticks; see the #177 report.',
      'Heap readings are process-wide observations, not per-fixture allocation deltas.',
      'The fixture uses authored seed actors already present in a fresh SimulationEngine; generated actors are deterministic BuddyCharacter definitions, not inert object placeholders.',
    ],
  };

  const json = JSON.stringify(report, null, 2);
  const outputPath = process.env.POP_SCALE_OUTPUT;
  if (outputPath) writeFileSync(outputPath, `${json}\n`, 'utf8');
  console.log('POPULATION_SCALE_JSON_BEGIN');
  console.log(json);
  console.log('POPULATION_SCALE_JSON_END');

  if (!correctness.overall) {
    const failed = checks.filter((check) => !check.ok).map((check) => check.id);
    console.error(`Population scale correctness gate failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

void main();
