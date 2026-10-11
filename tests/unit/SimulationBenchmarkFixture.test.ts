import { describe, expect, it } from 'vitest';
import {
  countBenchmarkMessages,
  createSimulationBenchmarkFixture,
  populateBenchmarkMessages,
} from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('SimulationBenchmarkFixture', () => {
  it('builds a deterministic target-sized roster with stable reach partitioning', () => {
    const first = createSimulationBenchmarkFixture(20);
    const second = createSimulationBenchmarkFixture(20);

    expect(first.actorIds).toHaveLength(20);
    expect(new Set(first.actorIds).size).toBe(20);
    expect(first.actorIds).toEqual(second.actorIds);
    expect(first.localActorIds).toEqual(second.localActorIds);
    expect(first.remoteActorIds).toEqual(second.remoteActorIds);
    expect(first.localActorIds.length + first.remoteActorIds.length).toBe(20);
    expect(first.remoteActorIds.length).toBeGreaterThan(0);
  });

  it('keeps remote benchmark actors physically low-fidelity and local actors important-local', () => {
    const fixture = createSimulationBenchmarkFixture(20);

    for (const actorId of fixture.remoteActorIds) {
      expect(fixture.engine.getFidelityTier(actorId)).toBe('background_remote');
    }
    for (const actorId of fixture.localActorIds) {
      expect(fixture.engine.getFidelityTier(actorId)).toBe('important_local');
    }
  });

  it('populates the requested synthetic conversation count through normal social writes', () => {
    const fixture = createSimulationBenchmarkFixture(20);

    expect(countBenchmarkMessages(fixture)).toBe(0);
    populateBenchmarkMessages(fixture, 37);
    expect(countBenchmarkMessages(fixture)).toBe(37);
  });
});
