import { describe, expect, it } from 'vitest';
import {
  GENERATED_BUS_LINES,
  GENERATED_DISTRICTS,
  GENERATED_PLACES,
  GENERATED_TRANSIT_STOPS,
} from '../../src/engine/worldContent.generated';
import type {
  GeneratedBusLineDef,
  GeneratedDistrictDef,
  GeneratedPlaceDef,
  GeneratedTransitStopDef,
} from '../../src/engine/worldContent.generated';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { emptyTransitServiceState } from '../../src/engine/transit/types';

/** In-code two-line fixture: line_ab (stop_a → stop_b) + line_bc (stop_b → stop_c). */
export function twoLineFixture(): {
  districts: GeneratedDistrictDef[];
  places: GeneratedPlaceDef[];
  stops: GeneratedTransitStopDef[];
  lines: GeneratedBusLineDef[];
} {
  return {
    districts: [
      { id: 'district_a', name: 'District A', mapX: 20, mapY: 60, tags: ['residential'] },
      { id: 'district_b', name: 'District B', mapX: 80, mapY: 40, tags: ['downtown'] },
      { id: 'district_c', name: 'District C', mapX: 50, mapY: 20, tags: ['riverside'] },
    ],
    places: [
      {
        id: 'place_a1',
        districtId: 'district_a',
        name: 'Place A1',
        transitAccess: [{ stopId: 'stop_a', walkMinutes: 4 }],
      },
      {
        id: 'place_b1',
        districtId: 'district_b',
        name: 'Place B1',
        transitAccess: [{ stopId: 'stop_b', walkMinutes: 5 }],
      },
      {
        id: 'place_c1',
        districtId: 'district_c',
        name: 'Place C1',
        transitAccess: [{ stopId: 'stop_c', walkMinutes: 3 }],
      },
    ],
    stops: [
      { id: 'stop_a', districtId: 'district_a', name: 'Stop A', placeId: 'place_a1', mapX: 22, mapY: 58 },
      { id: 'stop_b', districtId: 'district_b', name: 'Stop B', placeId: 'place_b1', mapX: 78, mapY: 42 },
      { id: 'stop_c', districtId: 'district_c', name: 'Stop C', placeId: 'place_c1', mapX: 50, mapY: 22 },
    ],
    lines: [
      {
        id: 'line_ab',
        name: 'Line AB',
        stopIds: ['stop_a', 'stop_b'],
        serviceStartMinute: 360,
        serviceEndMinute: 1380,
        headwayMinutes: 20,
        segmentMinutes: [12],
        fare: 2,
      },
      {
        id: 'line_bc',
        name: 'Line BC',
        stopIds: ['stop_b', 'stop_c'],
        serviceStartMinute: 360,
        serviceEndMinute: 1380,
        headwayMinutes: 30,
        segmentMinutes: [9],
        fare: 2,
      },
    ],
  };
}

describe('TransitNetwork adaptation (#35 slice 1)', () => {
  it('adapts the live generated fixture', () => {
    const network = buildTransitNetwork({
      districts: GENERATED_DISTRICTS,
      places: GENERATED_PLACES,
      stops: GENERATED_TRANSIT_STOPS,
      lines: GENERATED_BUS_LINES,
    });

    expect(network.places.get('place_a1')?.districtId).toBe('district_a');
    expect(network.accessFromPlace('place_a1')).toEqual([{ stopId: 'stop_a', walkMinutes: 4 }]);
    expect(network.linesAtStop('stop_a')).toEqual([{ lineId: 'line_ab', stopIndex: 0 }]);
    expect(network.linesAtStop('stop_b')).toEqual([{ lineId: 'line_ab', stopIndex: 1 }]);
  });

  it('adapts an in-code two-line network with a shared transfer stop', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const atB = network.linesAtStop('stop_b');
    expect(atB).toContainEqual({ lineId: 'line_ab', stopIndex: 1 });
    expect(atB).toContainEqual({ lineId: 'line_bc', stopIndex: 0 });
    expect(network.accessFromPlace('place_c1')).toEqual([{ stopId: 'stop_c', walkMinutes: 3 }]);
  });

  it('fails loudly on dangling references', () => {
    const broken = twoLineFixture();
    broken.places[0]!.districtId = 'district_ghost';
    expect(() => buildTransitNetwork(broken)).toThrow(/district_ghost/);

    const brokenLine = twoLineFixture();
    brokenLine.lines[0]!.stopIds = ['stop_a', 'stop_ghost'];
    expect(() => buildTransitNetwork(brokenLine)).toThrow(/stop_ghost/);
  });

  it('builds deterministically and exposes an empty service state', () => {
    const first = buildTransitNetwork(twoLineFixture());
    const second = buildTransitNetwork(twoLineFixture());
    expect([...first.districts.keys()]).toEqual([...second.districts.keys()]);
    expect([...first.places.entries()]).toEqual([...second.places.entries()]);
    expect([...first.stops.entries()]).toEqual([...second.stops.entries()]);
    expect([...first.lines.entries()]).toEqual([...second.lines.entries()]);
    expect(first.linesAtStop('stop_b')).toEqual(second.linesAtStop('stop_b'));
    expect(first.accessFromPlace('place_a1')).toEqual(second.accessFromPlace('place_a1'));
    expect(emptyTransitServiceState()).toEqual({
      closedStopIds: [],
      closedLineIds: [],
      lineDelayMinutes: {},
      headwayMultiplier: {},
    });
  });
});
