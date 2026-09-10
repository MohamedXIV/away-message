import type { ContentTables } from '../../src/tools/content/codegen';

/**
 * Shared neutral contract fixtures for #51 world-content slices.
 * Not production town content: District A / Place A1 / Stop A,
 * District B / Place B1 / Stop B, Bus Line stop_a → stop_b.
 * Slice tests compose on validTownTables() and add their own tables.
 */
export function validTownTables(): ContentTables {
  return {
    // Minimal character-domain scaffold: validateContent requires at least
    // one archetype, and the live store always carries both domains.
    archetypes: {
      regular: {
        label: 'Regular',
        description: 'Town fixture scaffold.',
        personaHint: 'Steady.',
        vocabulary: '[]',
        defaultInterests: '[]',
        defaultSong: '',
        typingSpeedWpm: 70,
      },
    },
    districts: {
      district_a: { name: 'District A', mapX: 20, mapY: 60, tags: '["residential"]' },
      district_b: { name: 'District B', mapX: 80, mapY: 40, tags: '["downtown"]' },
    },
    places: {
      place_a1: {
        districtId: 'district_a',
        name: 'Place A1',
        transitAccess: JSON.stringify([{ stopId: 'stop_a', walkMinutes: 4 }]),
      },
      place_b1: {
        districtId: 'district_b',
        name: 'Place B1',
        transitAccess: JSON.stringify([{ stopId: 'stop_b', walkMinutes: 5 }]),
      },
    },
    transitStops: {
      stop_a: { districtId: 'district_a', name: 'Stop A', placeId: 'place_a1', mapX: 22, mapY: 58 },
      stop_b: { districtId: 'district_b', name: 'Stop B', placeId: 'place_b1', mapX: 78, mapY: 42 },
    },
    busLines: {
      line_ab: {
        name: 'Line AB',
        stopIds: JSON.stringify(['stop_a', 'stop_b']),
        serviceStartMinute: 360,
        serviceEndMinute: 1380,
        headwayMinutes: 20,
        segmentMinutes: JSON.stringify([12]),
        fare: 2,
      },
    },
  };
}

export function cloneTables(tables: ContentTables): ContentTables {
  return JSON.parse(JSON.stringify(tables));
}
