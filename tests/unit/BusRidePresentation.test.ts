import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import {
  commitTravelPlan,
  serializeActiveTravel,
  parseActiveTravel,
  travelStateAtMinute,
} from '../../src/engine/transit/ActiveTravel';
import {
  bindBusInteriorProjection,
  compressBusRide,
  projectBusInteriorActors,
} from '../../src/world/transit/BusInteriorPresentation';
import { twoLineFixture } from './transitFixtures';
import type { TravelPlan } from '../../src/engine/transit/types';

describe('BusRidePresentation (#36 slice 4)', () => {
  const samplePlan: TravelPlan = {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute: 600,
    arriveAtMinute: 620,
    legs: [
      { kind: 'walk', fromPlaceId: 'place_a1', toStopId: 'stop_a', minutes: 4 },
      { kind: 'wait', stopId: 'stop_a', lineId: 'line_ab', minutes: 4, boardAtMinute: 608 },
      {
        kind: 'bus',
        lineId: 'line_ab',
        fromStopId: 'stop_a',
        toStopId: 'stop_b',
        boardAtMinute: 608,
        alightAtMinute: 620,
        minutes: 12,
      },
    ],
    walkMinutes: 4,
    waitMinutes: 4,
    rideMinutes: 12,
    totalMinutes: 20,
    fare: 2,
    transferCount: 0,
    busLineIds: ['line_ab'],
  };

  it('fails safely when opening bus interior with no active bus leg', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const travel = commitTravelPlan('player', samplePlan, 600);

    // At minute 602, player is on the initial walk leg, not on the bus!
    const result = bindBusInteriorProjection({
      activeTravel: travel,
      currentMinute: 602,
      network,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_on_bus_leg');
      expect(result.projection).toBeUndefined();
    }
  });

  it('binds to an active bus leg with correct line, stops, and remaining minutes', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const travel = commitTravelPlan('player', samplePlan, 600);

    // At minute 612 (4 minutes into 12 min bus ride)
    const result = bindBusInteriorProjection({
      activeTravel: travel,
      currentMinute: 612,
      network,
      timeOfDay: 'day',
      weather: 'clear',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful bus interior binding');

    expect(result.activeLeg.lineId).toBe('line_ab');
    expect(result.activeLeg.fromStopId).toBe('stop_a');
    expect(result.activeLeg.toStopId).toBe('stop_b');
    expect(result.remainingMinutes).toBe(8); // 620 - 612
    expect(result.progressPercent).toBe(33); // 4 / 12 = 33%

    // Projection inspection
    const proj = result.projection;
    expect(proj.isInterior).toBe(true);
    expect(proj.viewId).toBe('bus_interior_hero');
    expect(proj.anchors.some((a) => a.id === 'bus_window_view')).toBe(true);
    expect(proj.anchors.some((a) => a.id === 'bus_bell_cord')).toBe(true);
    expect(proj.anchors.some((a) => a.id === 'bus_exit_doors')).toBe(true);

    // Interior audio has engine hum
    expect(proj.spatialAudioSources?.some((s) => s.id === 'bus_engine_loop')).toBe(true);
  });

  it('applies interior rain acoustics and day/night interior lighting', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const travel = commitTravelPlan('player', samplePlan, 600);

    // Night + Rain
    const result = bindBusInteriorProjection({
      activeTravel: travel,
      currentMinute: 612,
      network,
      timeOfDay: 'night',
      weather: 'rain',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful binding');

    const proj = result.projection;
    // Inside a bus, rain particle layer is not full-screen foreground
    expect(proj.particles.rain).toBe(false);
    // Interior window rain audio is present and muffled
    const rainAudio = proj.spatialAudioSources?.find((s) => s.id === 'bus_window_rain');
    expect(rainAudio).toBeDefined();
    expect(rainAudio?.parameters?.['muffled']).toBe(1);

    // Interior ceiling lights are lit
    const ceilingLight = proj.lighting.pointLights.find((l) => l.id === 'bus_ceiling_light_1');
    expect(ceilingLight).toBeDefined();
    expect(ceilingLight?.intensity).toBeGreaterThan(1.0);
  });

  it('compressed ride advances authoritative itinerary duration exactly once with no extra fare', () => {
    const travel = commitTravelPlan('player', samplePlan, 600);
    const minute = 610; // 2 min into ride, 10 min left

    const compression = compressBusRide(travel, minute);
    expect(compression.minutesAdvanced).toBe(10);
    expect(compression.targetMinute).toBe(620);

    // Stepping to targetMinute in ActiveTravel resolves destination arrival
    const statusAtArrival = travelStateAtMinute(travel, compression.targetMinute);
    expect(statusAtArrival.status).toBe('arrived');

    // Fare was paid at commit time ($2), compression does not charge extra
    expect(travel.farePaid).toBe(2);
  });

  it('places persistent co-located riders onto seat anchors preserving actor IDs', () => {
    const riders = [
      { actorId: 'actor_henderson', focused: false },
      { actorId: 'actor_nora', selected: true },
    ];

    const projections = projectBusInteriorActors(riders);

    expect(projections.length).toBe(2);
    expect(projections[0]?.actorId).toBe('actor_henderson');
    expect(projections[0]?.viewId).toBe('bus_interior_hero');
    expect(projections[1]?.actorId).toBe('actor_nora');
    expect(projections[1]?.tier).toBe('full_character'); // selected -> full_character
  });

  it('preserves presentation and simulation continuity through JSON save/reload', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const travel = commitTravelPlan('player', samplePlan, 600);

    // Serialize snapshot mid-ride (at 614)
    const json = serializeActiveTravel(travel);
    const reloaded = parseActiveTravel(JSON.parse(json));

    const result = bindBusInteriorProjection({
      activeTravel: reloaded,
      currentMinute: 614,
      network,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected binding after reload');
    expect(result.remainingMinutes).toBe(6);
    expect(result.activeLeg.lineId).toBe('line_ab');
  });
});
