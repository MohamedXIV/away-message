import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import {
  createBusStopProjection,
  projectBusStopActors,
  projectStopTimetable,
} from '../../src/world/transit/BusStopPresentation';
import { twoLineFixture } from './transitFixtures';

describe('BusStopPresentation (#36 slice 3)', () => {
  it('creates a generic living-place projection for any transit stop', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const projection = createBusStopProjection({
      stopId: 'stop_a',
      network,
      timeOfDay: 'day',
      minuteOfDay: 720,
      weather: 'clear',
    });

    expect(projection.placeId).toBe('place_a1');
    expect(projection.viewId).toBe('stop_a_hero');
    expect(projection.isInterior).toBe(false);

    // Anchors
    const anchorIds = projection.anchors.map((a) => a.id);
    expect(anchorIds).toContain('bus_stop_timetable_board');
    expect(anchorIds).toContain('bus_stop_shelter_bench');
    expect(anchorIds).toContain('bus_stop_sign');
    expect(anchorIds).toContain('bus_stop_posters');
    expect(anchorIds).toContain('bus_stop_boarding_bay');

    // Timetable interaction authored
    const timetableAnchor = projection.anchors.find((a) => a.id === 'bus_stop_timetable_board');
    expect(timetableAnchor?.interactions.some((i) => i.capability === 'inspect_timetable')).toBe(true);
  });

  it('adapts to all five day phases and weather generically', () => {
    const network = buildTransitNetwork(twoLineFixture());

    // 1. Day phase: night lighting
    const nightProj = createBusStopProjection({
      stopId: 'stop_a',
      network,
      timeOfDay: 'night',
      minuteOfDay: 1320,
      weather: 'clear',
    });
    expect(nightProj.timeOfDay).toBe('night');
    expect(nightProj.lighting.ambientIntensity).toBeLessThan(0.5);
    const shelterLamp = nightProj.lighting.pointLights.find((l) => l.id === 'shelter_overhead_lamp');
    expect(shelterLamp).toBeDefined();
    expect(shelterLamp?.intensity).toBeGreaterThan(1.0);

    // 2. Weather: rainy conditions produce puddles and outdoor rain particles
    const rainProj = createBusStopProjection({
      stopId: 'stop_a',
      network,
      timeOfDay: 'day',
      minuteOfDay: 720,
      weather: 'rain',
    });
    expect(rainProj.particles.rain).toBe(true);
    expect(rainProj.puddleZones && rainProj.puddleZones.length).toBeGreaterThan(0);
    expect(rainProj.spatialAudioSources?.some((s) => s.id === 'stop_rain_shelter')).toBe(true);
  });

  it('projects live authoritative stop timetable for passengers', () => {
    const network = buildTransitNetwork(twoLineFixture());

    // stop_a is served by Line AB (service 360-1380, headway 20)
    // At minute 607, next departures are at 620, 640...
    const timetable = projectStopTimetable(network, 'stop_a', 607);

    expect(timetable.stopId).toBe('stop_a');
    expect(timetable.stopName).toBe('Stop A');
    expect(timetable.lines.length).toBe(1);
    expect(timetable.lines[0]?.lineId).toBe('line_ab');
    expect(timetable.lines[0]?.nextArrivalMinute).toBe(620);
    expect(timetable.lines[0]?.minutesUntilNextArrival).toBe(13);
    expect(timetable.lines[0]?.destinationStopName).toBe('Stop B');
    expect(timetable.lines[0]?.status).toBe('on_time');
  });

  it('places waiting persistent actors onto rider anchors using #95 presentation rules', () => {
    const actor1 = { actorId: 'actor_maya', focused: false };
    const actor2 = { actorId: 'actor_ryan', focused: true };

    const placements = projectBusStopActors([actor1, actor2]);

    expect(placements.length).toBe(2);
    expect(placements[0]?.actorId).toBe('actor_maya');
    expect(placements[0]?.tier).toBe('full_character'); // bench/close distance
    expect(placements[1]?.actorId).toBe('actor_ryan');
    expect(placements[1]?.tier).toBe('full_character'); // focused promotes to full_character
  });

  it('preserves simulation state and does not mutate transit truth', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const beforeStops = network.stops.size;

    createBusStopProjection({
      stopId: 'stop_b',
      network,
      timeOfDay: 'evening',
      minuteOfDay: 1080,
    });

    expect(network.stops.size).toBe(beforeStops);
  });
});
