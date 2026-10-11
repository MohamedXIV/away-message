import { writeFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import {
  BENCHMARK_POPULATIONS,
  countBenchmarkMessages,
  createSimulationBenchmarkFixture,
  createSimulationBenchmarkEngineFactory,
  populateBenchmarkMessages,
} from '../src/engine/benchmark/SimulationBenchmarkFixture';

interface SampleStats {
  samples: number;
  minMs: number;
  medianMs: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
}

interface PopulationResult {
  population: number;
  localActors: number;
  remoteActors: number;
  seedActors: number;
  heapUsedBytesAfterSetup: number;
  zeroMinuteRealtime: SampleStats;
  oneGameMinute: SampleStats;
  sixtyGameMinutes: SampleStats;
  allActorIntentPass: SampleStats;
  coldGetState: SampleStats;
  cachedGetState: SampleStats;
  socialGetState: SampleStats;
  exportSnapshot: SampleStats;
  serializedSnapshotBytes: number;
}

interface ConversationResult {
  messages: number;
  socialSnapshot: SampleStats;
  serializedSocialBytes: number;
}

const DEFAULT_SAMPLES = 7;
const DEFAULT_WARMUPS = 2;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const samples = envInt('SIM_BENCH_SAMPLES', DEFAULT_SAMPLES);
const warmups = envInt('SIM_BENCH_WARMUPS', DEFAULT_WARMUPS);

function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function measure(
  action: () => void,
  options?: { samples?: number; warmups?: number },
): SampleStats {
  const localSamples = options?.samples ?? samples;
  const localWarmups = options?.warmups ?? warmups;

  for (let index = 0; index < localWarmups; index += 1) action();

  const durations: number[] = [];
  for (let index = 0; index < localSamples; index += 1) {
    const started = nowMs();
    action();
    durations.push(nowMs() - started);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);

  return {
    samples: durations.length,
    minMs: round(sorted[0] ?? 0),
    medianMs: round(percentile(sorted, 0.5)),
    meanMs: round(total / Math.max(1, durations.length)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

function measureIsolated<T>(
  setup: () => T,
  action: (subject: T) => void,
  options?: { samples?: number; warmups?: number },
): SampleStats {
  const localSamples = options?.samples ?? samples;
  const localWarmups = options?.warmups ?? warmups;
  const durations: number[] = [];

  for (let index = 0; index < localWarmups + localSamples; index += 1) {
    const subject = setup();
    const started = nowMs();
    action(subject);
    const duration = nowMs() - started;
    if (index >= localWarmups) durations.push(duration);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    samples: durations.length,
    minMs: round(sorted[0] ?? 0),
    medianMs: round(percentile(sorted, 0.5)),
    meanMs: round(total / Math.max(1, durations.length)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

function benchmarkPopulation(population: number): PopulationResult {
  const fixture = createSimulationBenchmarkFixture(population);
  const { engine, actorIds } = fixture;

  // Materialize current Life Matrix entries before timing so population
  // registration/setup cost does not contaminate tick measurements.
  for (const actorId of actorIds) {
    engine.getLifeSnapshot(actorId);
  }

  const heapUsedBytesAfterSetup = process.memoryUsage().heapUsed;
  const preparedSnapshot = engine.exportSnapshot();

  const freshEngine = createSimulationBenchmarkEngineFactory(preparedSnapshot);

  // Each RAF-style sample starts from the same snapshot. Even without a game
  // minute, advanceRealTime updates realtime telemetry and runs legacy NPC
  // pressure/mobility work, so reusing the engine would contaminate later
  // samples. Rehydration remains outside the timed action.
  const zeroMinuteRealtime = measureIsolated(freshEngine, (fresh) => {
    fresh.advanceRealTime(1 / 60);
  });

  const allActorIntentPass = measure(() => {
    for (const actorId of actorIds) {
      engine.getCharacterIntent(actorId);
    }
  });

  // Cold and cached reads are separated. Isolated setup happens outside the
  // timed region so constructor/rehydration cost does not contaminate getState.
  const coldGetState = measureIsolated(
    freshEngine,
    (fresh) => {
      fresh.getState();
    },
  );

  engine.getState();
  const cachedGetState = measure(() => {
    engine.getState();
  });

  const socialGetState = measure(() => {
    engine.social.getState();
  });

  // Mutating time samples run from the exact same prepared snapshot every
  // time. This avoids later samples observing trips/events created by earlier
  // samples and makes before/after comparisons reproducible.
  const oneGameMinute = measureIsolated(
    freshEngine,
    (fresh) => {
      fresh.advanceGameMinutes(1, 'benchmark:one-minute');
    },
  );

  const sixtyGameMinutes = measureIsolated(
    freshEngine,
    (fresh) => {
      fresh.advanceGameMinutes(60, 'benchmark:sixty-minutes');
    },
    { samples: Math.min(3, samples), warmups: 1 },
  );

  const exportSnapshot = measure(
    () => {
      engine.exportSnapshot();
    },
    { samples: Math.min(3, samples), warmups: 1 },
  );

  const serializedSnapshot = JSON.stringify(preparedSnapshot);

  return {
    population,
    localActors: fixture.localActorIds.length,
    remoteActors: fixture.remoteActorIds.length,
    seedActors: fixture.seedActorCount,
    heapUsedBytesAfterSetup,
    zeroMinuteRealtime,
    oneGameMinute,
    sixtyGameMinutes,
    allActorIntentPass,
    coldGetState,
    cachedGetState,
    socialGetState,
    exportSnapshot,
    serializedSnapshotBytes: Buffer.byteLength(serializedSnapshot, 'utf8'),
  };
}

function benchmarkConversationHistory(): ConversationResult[] {
  const fixture = createSimulationBenchmarkFixture(20);
  const checkpoints = [0, 100, 1_000, 5_000] as const;
  const results: ConversationResult[] = [];
  let current = 0;

  for (const target of checkpoints) {
    populateBenchmarkMessages(fixture, target - current);
    current = target;

    const actual = countBenchmarkMessages(fixture);
    if (actual !== target) {
      throw new Error(
        `Conversation benchmark expected ${target} messages, found ${actual}.`,
      );
    }

    const socialSnapshot = measure(() => {
      fixture.engine.social.getState();
    });

    const serializedSocial = JSON.stringify(fixture.engine.social.getState());
    results.push({
      messages: target,
      socialSnapshot,
      serializedSocialBytes: Buffer.byteLength(serializedSocial, 'utf8'),
    });
  }

  return results;
}

const report = {
  schemaVersion: 1,
  purpose: 'SIM-KERNEL #169 pre-refactor baseline',
  gitSha: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
  runtime: {
    node: process.version,
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model ?? 'unknown',
    cpuCount: cpus().length,
  },
  config: {
    samples,
    warmups,
    populationTargets: [...BENCHMARK_POPULATIONS],
    conversationCheckpoints: [0, 100, 1_000, 5_000],
  },
  populations: BENCHMARK_POPULATIONS.map((population) =>
    benchmarkPopulation(population),
  ),
  conversations: benchmarkConversationHistory(),
};

const json = JSON.stringify(report, null, 2);
const outputPath = process.env.SIM_BENCH_OUTPUT;
if (outputPath) {
  writeFileSync(outputPath, `${json}\n`, 'utf8');
}

console.log('SIM_BENCHMARK_JSON_BEGIN');
console.log(json);
console.log('SIM_BENCHMARK_JSON_END');
