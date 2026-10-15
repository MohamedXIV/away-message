import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  countBenchmarkMessages,
  createSimulationBenchmarkFixture,
  createSimulationBenchmarkEngineFactory,
  createSimulationBenchmarkMobilityFixture,
  populateBenchmarkMessages,
} from '../../src/engine/benchmark/SimulationBenchmarkFixture';
import { planDueNpcTrips, progressNpcTrips } from '../../src/engine/transit/NpcTrips';

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

  it('keeps remote benchmarks background-only and allows both local fidelity tiers', () => {
    const fixture = createSimulationBenchmarkFixture(20);
    for (const actorId of fixture.remoteActorIds) {
      expect(fixture.engine.getFidelityTier(actorId)).toBe('background_remote');
    }
    const localTiers = fixture.localActorIds.map(actorId => fixture.engine.getFidelityTier(actorId));
    expect(localTiers.every(tier => tier === 'important_local' || tier === 'local_offscreen')).toBe(true);
    expect(localTiers).toContain('local_offscreen');

    // Promoting an actor to a known contact changes only the derived tier.
    const actorId = fixture.localActorIds.find(id => fixture.engine.getFidelityTier(id) === 'local_offscreen')!;
    const actor = fixture.engine.social.getBuddy(actorId)!;
    expect(fixture.engine.social.learnHandle(actorId, actor.handle)).toBe(true);
    expect(fixture.engine.getFidelityTier(actorId)).toBe('important_local');
  });

  it('keeps the RAF benchmark call below a game-minute boundary', () => {
    const fixture = createSimulationBenchmarkFixture(20);
    const before = fixture.engine.clock.getTotalMinutes();

    fixture.engine.advanceRealTime(1 / 60);

    expect(fixture.engine.clock.getTotalMinutes()).toBe(before);
  });

  it('creates independent realtime samples from the same prepared snapshot', () => {
    const fixture = createSimulationBenchmarkFixture(20);
    for (const actorId of fixture.actorIds) fixture.engine.getLifeSnapshot(actorId);
    const preparedSnapshot = fixture.engine.exportSnapshot();
    const createFreshEngine = createSimulationBenchmarkEngineFactory(preparedSnapshot);
    const firstSample = createFreshEngine();
    firstSample.advanceRealTime(1 / 60);

    const nextSample = createFreshEngine();
    const untouchedSample = createFreshEngine();

    expect(nextSample).not.toBe(firstSample);
    expect(firstSample.exportSnapshot()).not.toEqual(untouchedSample.exportSnapshot());
    expect(nextSample.exportSnapshot()).toEqual(untouchedSample.exportSnapshot());
  });

  it('builds route-backed local mobility work for isolated planning and progression baselines', () => {
    const fixture = createSimulationBenchmarkFixture(20);
    const mobility = createSimulationBenchmarkMobilityFixture(fixture);
    expect(mobility.actorIds).toEqual(fixture.localActorIds);
    expect(Object.keys(mobility.state.places).sort()).toEqual(fixture.localActorIds);

    const planned = planDueNpcTrips(
      mobility.state,
      mobility.intents,
      mobility.nowMinute,
      { network: mobility.network, aliases: mobility.aliases },
    );
    expect(planned.planned).toHaveLength(fixture.localActorIds.length);
    expect(planned.failed).toHaveLength(0);

    const progressed = progressNpcTrips(planned.state, mobility.nowMinute + 60);
    expect(progressed.arrivals).toHaveLength(fixture.localActorIds.length);
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
