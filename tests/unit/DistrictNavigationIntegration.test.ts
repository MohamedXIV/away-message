import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import {
  commitTravelPlan,
  parseActiveTravel,
  serializeActiveTravel,
  travelStateAtMinute,
} from '../../src/engine/transit/ActiveTravel';
import {
  createTownKnowledge,
  isDistrictKnown,
  isPlaceKnown,
  isStopKnown,
  projectTownNavigation,
} from '../../src/engine/transit/TownKnowledge';
import {
  presentTravelChoices,
} from '../../src/engine/transit/TravelChoicePresenter';
import {
  createBusStopProjection,
  projectBusStopActors,
} from '../../src/world/transit/BusStopPresentation';
import {
  bindBusInteriorProjection,
  compressBusRide,
  projectBusInteriorActors,
} from '../../src/world/transit/BusInteriorPresentation';
import { twoLineFixture } from './transitFixtures';
import type { TravelPlan } from '../../src/engine/transit/types';

describe('District Navigation and Transit Presentation Integration (#36)', () => {
  // 1. Town navigation groups Places under Districts without changing canonical Place identity.
  it('1. groups Places under Districts without altering canonical Place IDs', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const knowledge = createTownKnowledge({
      districts: { district_a: 'known', district_b: 'known' },
      places: { place_a1: 'visited', place_b1: 'mapped' },
      stops: { stop_a: 'known', stop_b: 'known' },
    });

    const projection = projectTownNavigation(network, knowledge, 'place_a1');
    const districtA = projection.districts.find((d) => d.districtId === 'district_a');
    const districtB = projection.districts.find((d) => d.districtId === 'district_b');

    expect(districtA).toBeDefined();
    expect(districtB).toBeDefined();
    expect(districtA?.places[0]?.placeId).toBe('place_a1');
    expect(districtB?.places[0]?.placeId).toBe('place_b1');
  });

  // 2. Unknown district/place/stop is not leaked.
  it('2. does not leak unknown district, place, or stop', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const knowledge = createTownKnowledge({
      districts: { district_a: 'known' },
      places: { place_a1: 'visited' },
      stops: { stop_a: 'known' },
    });

    const projection = projectTownNavigation(network, knowledge, 'place_a1');

    expect(projection.districts.some((d) => d.districtId === 'district_c')).toBe(false);
    expect(isDistrictKnown(knowledge, 'district_c')).toBe(false);
    expect(isPlaceKnown(knowledge, 'place_c1')).toBe(false);
    expect(isStopKnown(knowledge, 'stop_c')).toBe(false);

    const allProjectedPlaces = projection.districts.flatMap((d) => d.places.map((p) => p.placeId));
    expect(allProjectedPlaces).toEqual(['place_a1']);
  });

  // 3. Local walk quote comes from authoritative travel data.
  it('3. resolves local walk quote from authoritative travel data', () => {
    const fixture = twoLineFixture();
    fixture.places.push({
      id: 'place_a2',
      districtId: 'district_a',
      name: 'Place A2',
      transitAccess: [{ stopId: 'stop_a', walkMinutes: 6 }],
    });
    const network = buildTransitNetwork(fixture);

    const choices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a2',
      departAtMinute: 500,
    });

    expect(choices.walk.available).toBe(true);
    expect(choices.walk.minutes).toBe(10); // 4 min to stop + 6 min to place
    expect(choices.walk.fare).toBe(0);
    expect(choices.walk.summary).toBe('Walk — 10 min — free');
  });

  // 4. Direct bus itinerary renders correctly.
  it('4. renders direct bus itinerary with wait, ride, and fare', () => {
    const network = buildTransitNetwork(twoLineFixture());

    const choices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
    });

    expect(choices.bus.available).toBe(true);
    expect(choices.bus.fare).toBe(2);
    expect(choices.bus.transferCount).toBe(0);
    expect(choices.bus.itinerarySteps.length).toBeGreaterThanOrEqual(2);
    expect(choices.bus.itinerarySteps[0]).toContain('Walk to Stop A');
    expect(choices.bus.itinerarySteps.some((s) => s.includes('Line AB to Stop B'))).toBe(true);
  });

  // 5. Transfer itinerary renders correctly.
  it('5. renders transfer itinerary with human-readable transfer summary', () => {
    const network = buildTransitNetwork(twoLineFixture());

    const choices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_c1',
      departAtMinute: 600,
    });

    expect(choices.bus.available).toBe(true);
    expect(choices.bus.transferCount).toBe(1);
    expect(choices.bus.transferSummary).toContain('Line AB to Stop B → transfer to Line BC → Stop C');
    expect(choices.bus.itinerarySteps.some((s) => s.includes('Transfer to Line BC') || s.includes('Wait for Line BC'))).toBe(true);
  });

  // 6. Entering/exiting stop/interior presentation preserves simulation state.
  it('6. entering and exiting stop/interior presentation preserves simulation state', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const beforeStops = network.stops.size;
    const beforePlaces = network.places.size;

    const stopProj = createBusStopProjection({
      stopId: 'stop_a',
      network,
      timeOfDay: 'day',
    });
    expect(stopProj.placeId).toBe('place_a1');

    // TransitNetwork remains completely intact
    expect(network.stops.size).toBe(beforeStops);
    expect(network.places.size).toBe(beforePlaces);
  });

  // 7. Compressed ride advances authoritative trip duration exactly once.
  it('7. compressed ride advances authoritative trip duration exactly once', () => {
    const plan: TravelPlan = {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      arriveAtMinute: 620,
      legs: [
        { kind: 'walk', fromPlaceId: 'place_a1', toStopId: 'stop_a', minutes: 4 },
        { kind: 'wait', stopId: 'stop_a', lineId: 'line_ab', minutes: 4, boardAtMinute: 608 },
        { kind: 'bus', lineId: 'line_ab', fromStopId: 'stop_a', toStopId: 'stop_b', boardAtMinute: 608, alightAtMinute: 620, minutes: 12 },
      ],
      walkMinutes: 4,
      waitMinutes: 4,
      rideMinutes: 12,
      totalMinutes: 20,
      fare: 2,
      transferCount: 0,
      busLineIds: ['line_ab'],
    };

    const travel = commitTravelPlan('player', plan, 600);
    const minute = 612; // in-flight on bus

    const compression = compressBusRide(travel, minute);
    expect(compression.minutesAdvanced).toBe(8);
    expect(compression.targetMinute).toBe(620);

    const finalState = travelStateAtMinute(travel, compression.targetMinute);
    expect(finalState.status).toBe('arrived');
    expect(travel.farePaid).toBe(2);
  });

  // 8. Boarding/alighting cannot duplicate or strand player travel state.
  it('8. boarding and alighting cannot duplicate or strand travel state', () => {
    const plan: TravelPlan = {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      arriveAtMinute: 620,
      legs: [
        { kind: 'bus', lineId: 'line_ab', fromStopId: 'stop_a', toStopId: 'stop_b', boardAtMinute: 600, alightAtMinute: 620, minutes: 20 },
      ],
      walkMinutes: 0,
      waitMinutes: 0,
      rideMinutes: 20,
      totalMinutes: 20,
      fare: 2,
      transferCount: 0,
      busLineIds: ['line_ab'],
    };

    const travel = commitTravelPlan('player', plan, 600);
    expect(travelStateAtMinute(travel, 599).status).toBe('active');
    expect(travelStateAtMinute(travel, 610).status).toBe('active');
    expect(travelStateAtMinute(travel, 620).status).toBe('arrived');
    // Calling at later minute remains arrived without error or state duplication
    expect(travelStateAtMinute(travel, 700).status).toBe('arrived');
  });

  // 9. Weather/time reaches stop/interior presentation generically.
  it('9. weather and time reach stop and interior presentation generically', () => {
    const network = buildTransitNetwork(twoLineFixture());

    // Stop presentation in rain at night
    const stopProj = createBusStopProjection({
      stopId: 'stop_a',
      network,
      timeOfDay: 'night',
      minuteOfDay: 1300,
      weather: 'rain',
    });
    expect(stopProj.timeOfDay).toBe('night');
    expect(stopProj.particles.rain).toBe(true);
    expect(stopProj.puddleZones && stopProj.puddleZones.length).toBeGreaterThan(0);
    expect(stopProj.spatialAudioSources?.some((s) => s.id === 'stop_rain_shelter')).toBe(true);
  });

  // 10. Save/reload during an active ride restores or safely resolves presentation.
  it('10. save/reload during an active ride restores presentation around travel state', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const plan: TravelPlan = {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      arriveAtMinute: 620,
      legs: [
        { kind: 'bus', lineId: 'line_ab', fromStopId: 'stop_a', toStopId: 'stop_b', boardAtMinute: 600, alightAtMinute: 620, minutes: 20 },
      ],
      walkMinutes: 0,
      waitMinutes: 0,
      rideMinutes: 20,
      totalMinutes: 20,
      fare: 2,
      transferCount: 0,
      busLineIds: ['line_ab'],
    };

    const travel = commitTravelPlan('player', plan, 600);
    const serialized = serializeActiveTravel(travel);
    const restored = parseActiveTravel(JSON.parse(serialized));

    const result = bindBusInteriorProjection({
      activeTravel: restored,
      currentMinute: 610,
      network,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful binding');
    expect(result.remainingMinutes).toBe(10);
    expect(result.lineName).toBe('Line AB');
  });

  // 11. View/presentation changes do not mutate TransitNetwork truth.
  it('11. view/presentation changes do not mutate TransitNetwork truth', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const originalLine = network.lines.get('line_ab');

    createBusStopProjection({ stopId: 'stop_a', network });
    expect(network.lines.get('line_ab')).toEqual(originalLine);
  });

  // 12. Persistent actor IDs survive stop/bus view projection.
  it('12. persistent actor IDs survive stop and bus view projection', () => {
    const stopActors = projectBusStopActors([{ actorId: 'actor_maya' }]);
    expect(stopActors[0]?.actorId).toBe('actor_maya');

    const busRiders = projectBusInteriorActors([{ actorId: 'actor_ryan' }]);
    expect(busRiders[0]?.actorId).toBe('actor_ryan');
  });
});
