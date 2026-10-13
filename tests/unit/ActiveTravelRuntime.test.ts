import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { planTravel } from '../../src/engine/transit/TravelPlanner';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import { twoLineFixture } from './transitFixtures';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { ActiveTravelRuntime } from '../../src/engine/kernel/ActiveTravelRuntime';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function fixture() {
  const network = buildTransitNetwork(twoLineFixture());
  const planned = planTravel(network, {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute: 600,
  });
  if (!planned.ok) throw new Error('Expected fixture bus plan');
  const trip = commitTravelPlan('player', planned.plan, 600);
  const owners = createCoreDomainOwners();
  const relocations: string[] = [];
  const departures: string[] = [];
  const runtime = new ActiveTravelRuntime(
    owners,
    (actorId) => { departures.push(actorId); },
    (actorId, placeId) => { relocations.push(`${actorId}:${placeId}`); return true; },
    () => ({ success: true }),
    () => [],
    () => ({ kind: 'none' } as never),
    trip,
  );
  return { owners, runtime, trip, relocations, departures, plan: planned.plan };
}

describe('ActiveTravelRuntime — one committed journey owner', () => {
  it('holds current-format journey state behind a defensive public read', () => {
    const { runtime, trip } = fixture();
    expect(runtime.getActiveTravel()).toEqual(trip);
    const publicRead = runtime.getActiveTravel()!;
    publicRead.plan.originPlaceId = 'tampered';
    expect(runtime.getActiveTravel()?.plan.originPlaceId).toBe('place_a1');
    runtime.loadState(trip);
    expect(runtime.getActiveTravel()).toEqual(trip);
  });

  it('advances through wait/bus legs and arrives only once on canonical clock progression', () => {
    const { owners, runtime, relocations } = fixture();
    owners.clock.setTotalMinutes(625);
    runtime.synchronizeActiveTravel();
    expect(runtime.getActiveTravel()?.status).toBe('active');
    expect(runtime.getActiveTravel()?.currentLegIndex).toBe(2);
    expect(runtime.collectEncounterCandidates()).toEqual([]);
    expect(relocations).toHaveLength(0);

    owners.clock.setTotalMinutes(637);
    runtime.synchronizeActiveTravel();
    expect(runtime.getActiveTravel()?.status).toBe('arrived');
    expect(relocations).toEqual(['player:place_b1']);

    runtime.synchronizeActiveTravel();
    expect(relocations).toEqual(['player:place_b1']);
  });

  it('public SimulationEngine delegates current travel state to the exact composed owner', () => {
    const engine = new SimulationEngine();
    const runtime = (engine as unknown as { activeTravel: ActiveTravelRuntime }).activeTravel;
    const { trip } = fixture();

    engine.setActiveTravel(trip);
    expect(runtime.getActiveTravel()).toEqual(engine.getActiveTravel());
    expect(engine.exportSnapshot().activeTravel).toEqual(trip);
    engine.loadSnapshot(engine.exportSnapshot());
    expect((engine as unknown as { activeTravel: ActiveTravelRuntime }).activeTravel)
      .toBe(runtime);
    expect(engine.getActiveTravel()).toEqual(trip);
  });
});
