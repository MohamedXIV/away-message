import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import {
  createDefaultTownKnowledge,
  createTownKnowledge,
  hydrateTownKnowledge,
  isDistrictKnown,
  isPlaceKnown,
  isStopKnown,
  projectTownNavigation,
  recordTravelCompletion,
  revealDistrict,
  revealPlace,
  revealStop,
  serializeTownKnowledge,
} from '../../src/engine/transit/TownKnowledge';
import { twoLineFixture } from './transitFixtures';

describe('TownKnowledge and Navigation Projection (#36 slice 1)', () => {
  it('explicitly reveals a district', () => {
    let knowledge = createTownKnowledge();
    expect(isDistrictKnown(knowledge, 'district_a')).toBe(false);
    knowledge = revealDistrict(knowledge, 'district_a');
    expect(isDistrictKnown(knowledge, 'district_a')).toBe(true);
  });

  it('groups places and stops under their districts while preserving canonical IDs', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const knowledge = createTownKnowledge({
      districts: { district_a: 'known', district_b: 'known' },
      places: { place_a1: 'visited', place_b1: 'mapped' },
      stops: { stop_a: 'known', stop_b: 'used' },
    });

    const projection = projectTownNavigation(network, knowledge, 'place_a1');

    expect(projection.totalKnownDistricts).toBe(2);
    expect(projection.currentPlaceId).toBe('place_a1');
    expect(projection.currentDistrictId).toBe('district_a');

    const districtA = projection.districts.find((d) => d.districtId === 'district_a');
    expect(districtA).toBeDefined();
    expect(districtA?.name).toBe('District A');
    expect(districtA?.isCurrent).toBe(true);
    expect(districtA?.places.map((p) => p.placeId)).toEqual(['place_a1']);
    expect(districtA?.places[0]?.name).toBe('Place A1');
    expect(districtA?.places[0]?.isCurrent).toBe(true);
    expect(districtA?.stops.map((s) => s.stopId)).toEqual(['stop_a']);

    const districtB = projection.districts.find((d) => d.districtId === 'district_b');
    expect(districtB).toBeDefined();
    expect(districtB?.places.map((p) => p.placeId)).toEqual(['place_b1']);
    expect(districtB?.places[0]?.isCurrent).toBe(false);
  });

  it('keeps unknown districts, places, and stops strictly hidden', () => {
    const network = buildTransitNetwork(twoLineFixture());
    // Only district_a and place_a1 are known. District C and place_c1 / stop_c are completely unknown.
    const knowledge = createTownKnowledge({
      districts: { district_a: 'known' },
      places: { place_a1: 'visited' },
      stops: { stop_a: 'known' },
    });

    const projection = projectTownNavigation(network, knowledge, 'place_a1');

    expect(projection.districts.some((d) => d.districtId === 'district_c')).toBe(false);
    expect(projection.districts.some((d) => d.districtId === 'district_b')).toBe(false);
    expect(isPlaceKnown(knowledge, 'place_c1')).toBe(false);
    expect(isDistrictKnown(knowledge, 'district_c')).toBe(false);
    expect(isStopKnown(knowledge, 'stop_c')).toBe(false);

    // No leakage in places or stops arrays
    const allProjectedPlaceIds = projection.districts.flatMap((d) => d.places.map((p) => p.placeId));
    expect(allProjectedPlaceIds).toEqual(['place_a1']);
    expect(allProjectedPlaceIds.includes('place_b1')).toBe(false);
    expect(allProjectedPlaceIds.includes('place_c1')).toBe(false);

    const allProjectedStopIds = projection.districts.flatMap((d) => d.stops.map((s) => s.stopId));
    expect(allProjectedStopIds).toEqual(['stop_a']);
    expect(allProjectedStopIds.includes('stop_c')).toBe(false);
  });

  it('automatically reveals parent district when a place or stop is revealed', () => {
    const network = buildTransitNetwork(twoLineFixture());
    let knowledge = createTownKnowledge();
    expect(isDistrictKnown(knowledge, 'district_c')).toBe(false);

    knowledge = revealPlace(knowledge, 'place_c1', 'mapped', network);
    expect(isDistrictKnown(knowledge, 'district_c')).toBe(true);
    expect(knowledge.places['place_c1']).toBe('mapped');

    knowledge = revealStop(knowledge, 'stop_b', 'known', network);
    expect(isDistrictKnown(knowledge, 'district_b')).toBe(true);
    expect(knowledge.stops['stop_b']).toBe('known');
  });

  it('records travel completion by updating visited places, used stops, and lines', () => {
    const network = buildTransitNetwork(twoLineFixture());
    let knowledge = createTownKnowledge({
      districts: { district_a: 'known', district_b: 'known' },
      places: { place_a1: 'visited' },
      stops: { stop_a: 'known' },
    });

    // Simulated trip from place_a1 to place_b1 via stop_a and line_ab
    const tripPlan = {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 400,
      arriveAtMinute: 420,
      legs: [
        { kind: 'walk' as const, fromPlaceId: 'place_a1', toStopId: 'stop_a', minutes: 4 },
        { kind: 'wait' as const, stopId: 'stop_a', lineId: 'line_ab', minutes: 4, boardAtMinute: 408 },
        { kind: 'bus' as const, lineId: 'line_ab', fromStopId: 'stop_a', toStopId: 'stop_b', boardAtMinute: 408, alightAtMinute: 420, minutes: 12 },
      ],
      walkMinutes: 4,
      waitMinutes: 4,
      rideMinutes: 12,
      totalMinutes: 20,
      fare: 2,
      transferCount: 0,
      busLineIds: ['line_ab'],
    };

    knowledge = recordTravelCompletion(knowledge, tripPlan, network);

    expect(knowledge.places['place_b1']).toBe('visited');
    expect(knowledge.stops['stop_a']).toBe('used');
    expect(knowledge.stops['stop_b']).toBe('used');
    expect(knowledge.lines['line_ab']).toBe('used');
    expect(isDistrictKnown(knowledge, 'district_b')).toBe(true);
  });

  it('serializes and hydrates town knowledge correctly', () => {
    const original = createTownKnowledge({
      districts: { district_a: 'known' },
      places: { place_a1: 'familiar' },
      stops: { stop_a: 'used' },
      lines: { line_ab: 'used' },
    });

    const serialized = serializeTownKnowledge(original);
    const hydrated = hydrateTownKnowledge(JSON.parse(serialized));

    expect(hydrated).toEqual(original);
  });

  it('provides sensible default knowledge with initial home or place', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const defaultKnowledge = createDefaultTownKnowledge(network, 'place_a1');

    expect(defaultKnowledge.places['place_a1']).toBe('familiar');
    expect(defaultKnowledge.districts['district_a']).toBe('known');
    expect(defaultKnowledge.stops['stop_a']).toBe('known');
  });
});
