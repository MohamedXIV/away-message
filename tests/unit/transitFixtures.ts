import type {
  GeneratedBusLineDef,
  GeneratedDistrictDef,
  GeneratedPlaceDef,
  GeneratedTransitStopDef,
} from '../../src/engine/worldContent.generated';

/**
 * Shared neutral transit fixtures for #35 slices (not production content).
 * line_ab (stop_a → stop_b) + line_bc (stop_b → stop_c) share stop_b,
 * so place_a1 → place_c1 requires exactly one transfer.
 */
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
