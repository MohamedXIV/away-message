import { buildCharacter } from '../CharacterEngine';
import { SimulationEngine } from '../SimulationEngine';
import type { BuddyCharacter, CharacterArchetype } from '../types';

export const BENCHMARK_POPULATIONS = [20, 100, 250, 500] as const;

export interface SimulationBenchmarkFixture {
  engine: SimulationEngine;
  actorIds: string[];
  localActorIds: string[];
  remoteActorIds: string[];
  seedActorCount: number;
}

/** Rehydrate every mutating sample from the same prepared benchmark state. */
export function createSimulationBenchmarkEngineFactory(
  preparedSnapshot: ReturnType<SimulationEngine['exportSnapshot']>,
): () => SimulationEngine {
  return () => new SimulationEngine(structuredClone(preparedSnapshot));
}

const ARCHETYPES: readonly CharacterArchetype[] = [
  'student',
  'coworker',
  'regular',
  'artist',
  'nightowl',
  'trader',
];

function benchmarkCharacter(index: number): BuddyCharacter {
  const suffix = String(index).padStart(4, '0');
  const remote = index % 4 === 0;
  const archetype = ARCHETYPES[index % ARCHETYPES.length] ?? 'regular';
  return buildCharacter({
    id: `bench_${suffix}`,
    displayName: `Benchmark Actor ${suffix}`,
    handle: `bench${suffix}`,
    archetype,
    reach: remote ? 'remote' : 'local',
    metVia: remote ? 'nightboard' : 'work',
    status: 'acquaintance',
    createdDay: 1,
    roles: [
      archetype === 'student' ? 'student' : 'benchmark_actor',
      'benchmark_actor',
    ],
  }).definition;
}

/**
 * Stable, offline-only scale fixture.
 *
 * The target count includes authored seed actors already present in a fresh
 * SimulationEngine. Additional actors are deterministic CharacterEngine
 * definitions: 75% local / 25% remote by generated-index policy.
 *
 * This helper intentionally performs no timing or optimization work. It is
 * shared by the benchmark runner and fixture-correctness tests.
 */
export function createSimulationBenchmarkFixture(
  targetPopulation: number,
): SimulationBenchmarkFixture {
  if (!Number.isInteger(targetPopulation) || targetPopulation <= 0) {
    throw new Error('targetPopulation must be a positive integer.');
  }

  const engine = new SimulationEngine();
  const seedActorCount = engine.social.getBuddies().length;
  if (targetPopulation < seedActorCount) {
    throw new Error(
      `targetPopulation ${targetPopulation} is smaller than the fresh seed roster ${seedActorCount}.`,
    );
  }

  let generatedIndex = 1;
  while (engine.social.getBuddies().length < targetPopulation) {
    const definition = benchmarkCharacter(generatedIndex);
    generatedIndex += 1;
    if (engine.social.getBuddy(definition.id)) continue;
    engine.social.registerBuddy(definition);
  }

  const buddies = engine.social.getBuddies();
  const actorIds = buddies.map((buddy) => buddy.id).sort();
  const localActorIds = buddies
    .filter((buddy) => buddy.reach !== 'remote')
    .map((buddy) => buddy.id)
    .sort();
  const remoteActorIds = buddies
    .filter((buddy) => buddy.reach === 'remote')
    .map((buddy) => buddy.id)
    .sort();

  return {
    engine,
    actorIds,
    localActorIds,
    remoteActorIds,
    seedActorCount,
  };
}

/**
 * Populate bounded synthetic chat history using normal SocialEngine writes.
 *
 * Message IDs are intentionally produced by the current runtime implementation
 * (which #174 will later make deterministic); benchmark correctness relies on
 * stable counts/payload sizes, not byte-identical message IDs.
 */
export function populateBenchmarkMessages(
  fixture: SimulationBenchmarkFixture,
  messageCount: number,
): void {
  if (!Number.isInteger(messageCount) || messageCount < 0) {
    throw new Error('messageCount must be a non-negative integer.');
  }
  if (fixture.actorIds.length === 0) return;

  for (let index = 0; index < messageCount; index += 1) {
    const actorId = fixture.actorIds[index % fixture.actorIds.length]!;
    const fromPlayer = index % 2 === 0;
    fixture.engine.social.sendMessage(
      actorId,
      fromPlayer ? 'player' : actorId,
      fromPlayer ? actorId : 'player',
      `benchmark message ${String(index).padStart(6, '0')} payload-xxxxxxxxxxxxxxxxxxxxxxxx`,
      480 + index,
      !fromPlayer,
      ['benchmark'],
    );
  }
}

export function countBenchmarkMessages(
  fixture: SimulationBenchmarkFixture,
): number {
  const state = fixture.engine.social.getState();
  return Object.values(state.conversations)
    .reduce((total, conversation) => total + conversation.length, 0);
}
