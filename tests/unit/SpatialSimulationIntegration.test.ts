import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import type { NpcMobilityState } from '../../src/engine/transit/NpcTrips';
import type { TravelPlan } from '../../src/engine/transit/types';

function fiveMinuteWalk(): TravelPlan {
  return {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute: 480,
    arriveAtMinute: 485,
    legs: [
      {
        kind: 'walk',
        fromPlaceId: 'place_a1',
        toPlaceId: 'place_b1',
        minutes: 5,
      },
    ],
    walkMinutes: 5,
    waitMinutes: 0,
    rideMinutes: 0,
    totalMinutes: 5,
    fare: 0,
    transferCount: 0,
    busLineIds: [],
  };
}

describe('simulation spatial integration (#93)', () => {
  it('persists only XYZ and derives membership again after reload', () => {
    const sim = new SimulationEngine();
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });

    expect(sim.getActorSpatialProjection('player')).toEqual({
      position: { x: 20, y: 60, z: 0 },
      membership: {
        districtId: 'district_a',
        placeId: 'place_a1',
        spaceId: 'space_a1',
      },
    });

    const snapshot = sim.exportSnapshot();
    expect(snapshot.actorSpatialPositions).toEqual({
      player: { x: 20, y: 60, z: 0 },
    });

    const restored = new SimulationEngine(snapshot);
    expect(restored.getActorSpatialProjection('player')).toEqual({
      position: { x: 20, y: 60, z: 0 },
      membership: {
        districtId: 'district_a',
        placeId: 'place_a1',
        spaceId: 'space_a1',
      },
    });
  });

  it('clears local player XYZ during travel and applies destination entry only at arrival', () => {
    const sim = new SimulationEngine();
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });

    const started = sim.startTravel('player', fiveMinuteWalk(), 'test_trip');
    expect(started.success).toBe(true);
    expect(sim.getActorSpatialProjection('player')).toBeNull();
    expect(sim.getActiveTravel()?.status).toBe('active');

    sim.advanceGameMinutes(4, 'travel');
    expect(sim.getActorSpatialProjection('player')).toBeNull();
    expect(sim.getActiveTravel()?.status).toBe('active');

    sim.advanceGameMinutes(1, 'travel');
    expect(sim.getActiveTravel()).toMatchObject({
      status: 'arrived',
      farePaid: 0,
      plan: { totalMinutes: 5, destinationPlaceId: 'place_b1' },
    });
    expect(sim.getActorSpatialProjection('player')).toEqual({
      position: { x: 80, y: 40, z: 0 },
      membership: { districtId: 'district_b', placeId: 'place_b1' },
    });
  });

  it('projects an NPC arrival into the same XYZ contract without changing trip timing', () => {
    const plan = fiveMinuteWalk();
    const trip = commitTravelPlan('maya', plan, 480, 'appt_test');
    const npcMobility: NpcMobilityState = {
      places: { maya: 'place_a1' },
      trips: {
        maya: {
          trip,
          intentKind: 'attend_appointment',
          sourceKind: 'appointment',
          sourceId: 'appt_test',
          originPlaceId: 'place_a1',
          destinationPlaceId: 'place_b1',
          desiredArrivalMinute: 485,
          plannedDepartureMinute: 480,
          expectedArrivalMinute: 485,
          policy: 'fastest',
          status: 'planned',
        },
      },
    };

    const sim = new SimulationEngine({
      npcMobility,
      actorSpatialPositions: {
        maya: { x: 20, y: 60, z: 0 },
      },
    });

    sim.advanceGameMinutes(4, 'npc travel');
    expect(sim.getActorSpatialProjection('maya')).toBeNull();

    sim.advanceGameMinutes(1, 'npc travel');
    expect(sim.getNpcTrip('maya')).toMatchObject({
      status: 'arrived',
      completedAtMinute: 485,
      expectedArrivalMinute: 485,
    });
    expect(sim.getActorSpatialProjection('maya')).toEqual({
      position: { x: 80, y: 40, z: 0 },
      membership: { districtId: 'district_b', placeId: 'place_b1' },
    });
  });

  it('save/reload mid-trip preserves transit truth and restores destination XYZ exactly once', () => {
    const sim = new SimulationEngine();
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });
    expect(sim.startTravel('player', fiveMinuteWalk(), 'reload_trip').success).toBe(true);

    sim.advanceGameMinutes(2, 'travel');
    const snapshot = sim.exportSnapshot();
    expect(snapshot.actorSpatialPositions?.['player']).toBeUndefined();
    expect(snapshot.activeTravel).toMatchObject({
      status: 'active',
      farePaid: 0,
      plan: { totalMinutes: 5 },
    });

    const restored = new SimulationEngine(snapshot);
    expect(restored.getActorSpatialProjection('player')).toBeNull();

    restored.advanceGameMinutes(3, 'travel');
    expect(restored.getActiveTravel()).toMatchObject({
      status: 'arrived',
      farePaid: 0,
      plan: { totalMinutes: 5, destinationPlaceId: 'place_b1' },
    });
    expect(restored.getActorSpatialProjection('player')).toEqual({
      position: { x: 80, y: 40, z: 0 },
      membership: { districtId: 'district_b', placeId: 'place_b1' },
    });

    const afterArrival = restored.exportSnapshot();
    restored.advanceGameMinutes(30, 'after arrival');
    expect(restored.exportSnapshot().actorSpatialPositions).toEqual(
      afterArrival.actorSpatialPositions,
    );
  });

  it('uses settled XYZ as NPC physical place authority and keeps transit cache derived', () => {
    const sim = new SimulationEngine({
      npcMobility: {
        trips: {},
        places: { maya: 'place_a1' },
      },
    });

    sim.relocateActorSpatially('maya', { x: 80, y: 40, z: 0 });

    expect(sim.getNpcPlaceState('maya')).toEqual({
      status: 'at_place',
      placeId: 'place_b1',
    });
    expect(sim.getState().npcMobility?.places['maya']).toBe('place_b1');
  });

  it('emits derived spatial transitions while renderer/view state stays irrelevant', () => {
    const sim = new SimulationEngine();
    const transitions: string[] = [];
    sim.events.on('spatial:transition', ({ actorId, transition }) => {
      transitions.push(`${actorId}:${transition.type}`);
    });

    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'pc' });
    sim.relocateActorSpatially('player', { x: 80, y: 40, z: 0 });

    expect(transitions).toEqual([
      'player:DistrictEntered',
      'player:PlaceEntered',
      'player:SpaceEntered',
      'player:SpaceExited',
      'player:PlaceExited',
      'player:DistrictExited',
      'player:DistrictEntered',
      'player:PlaceEntered',
    ]);
    expect(sim.getActorSpatialProjection('player')?.membership).toEqual({
      districtId: 'district_b',
      placeId: 'place_b1',
    });
  });
});
