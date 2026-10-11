import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
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

  it('keeps the RAF benchmark call below a game-minute boundary', () => {
    const fixture = createSimulationBenchmarkFixture(20);
    const before = fixture.engine.clock.getTotalMinutes();

    fixture.engine.advanceRealTime(1 / 60);

    expect(fixture.engine.clock.getTotalMinutes()).toBe(before);
  });

  it('round-trips the prepared benchmark snapshot without changing roster size', () => {
    const fixture = createSimulationBenchmarkFixture(20);
    for (const actorId of fixture.actorIds) fixture.engine.getLifeSnapshot(actorId);

    const restored = new SimulationEngine(
      structuredClone(fixture.engine.exportSnapshot()),
    );

    expect(restored.social.getBuddies()).toHaveLength(20);
    expect(restored.social.getBuddies().map((buddy) => buddy.id).sort())
      .toEqual(fixture.actorIds);
  });

  it('populates the requested synthetic conversation count through normal social writes', () => {
    const fixture = createSimulationBenchmarkFixture(20);

    expect(countBenchmarkMessages(fixture)).toBe(0);
    populateBenchmarkMessages(fixture, 37);
    expect(countBenchmarkMessages(fixture)).toBe(37);
  });
});
