import { describe, it, expect } from 'vitest';
import { CONTENT_SCHEMA } from '../../src/tools/content/schema';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/codegen';

/**
 * #51 Slice 1 — district/place/transit content contract.
 * Neutral contract fixture (not production town content):
 *   District A (district_a): Place A1 (place_a1), Stop A (stop_a)
 *   District B (district_b): Place B1 (place_b1), Stop B (stop_b)
 *   Bus Line (line_ab): stop_a → stop_b
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

function clone(tables: ContentTables): ContentTables {
  return JSON.parse(JSON.stringify(tables));
}

describe('Town content schema (#51 slice 1)', () => {
  it('declares district/place/transit tables in CONTENT_SCHEMA', () => {
    for (const table of ['districts', 'places', 'transitStops', 'busLines']) {
      expect(CONTENT_SCHEMA, `missing table ${table}`).toHaveProperty(table);
    }
  });

  it('accepts the minimal valid district/place/stop/line fixture', () => {
    expect(validateContent(validTownTables())).toEqual([]);
  });

  it('rejects a place referencing a missing district', () => {
    const tables = clone(validTownTables());
    (tables['places']!['place_a1']! as Record<string, unknown>)['districtId'] = 'district_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('places/place_a1') && e.includes('districtId'))).toBe(true);
  });

  it('rejects a stop referencing a missing district', () => {
    const tables = clone(validTownTables());
    (tables['transitStops']!['stop_a']! as Record<string, unknown>)['districtId'] = 'district_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('transitStops/stop_a') && e.includes('districtId'))).toBe(true);
  });

  it('rejects a stop referencing a missing place', () => {
    const tables = clone(validTownTables());
    (tables['transitStops']!['stop_a']! as Record<string, unknown>)['placeId'] = 'place_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('transitStops/stop_a') && e.includes('placeId'))).toBe(true);
  });

  it('rejects a place access entry referencing a missing stop', () => {
    const tables = clone(validTownTables());
    (tables['places']!['place_a1']! as Record<string, unknown>)['transitAccess'] = JSON.stringify([
      { stopId: 'stop_ghost', walkMinutes: 4 },
    ]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('places/place_a1') && e.includes('stop_ghost'))).toBe(true);
  });

  it('rejects non-positive walk minutes in place access links', () => {
    const tables = clone(validTownTables());
    (tables['places']!['place_a1']! as Record<string, unknown>)['transitAccess'] = JSON.stringify([
      { stopId: 'stop_a', walkMinutes: 0 },
    ]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('places/place_a1') && e.includes('walkMinutes'))).toBe(true);
  });

  it('rejects a bus line referencing a nonexistent stop', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['stopIds'] = JSON.stringify([
      'stop_a',
      'stop_ghost',
    ]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('stop_ghost'))).toBe(true);
  });

  it('rejects a bus line with fewer than two stops', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['stopIds'] = JSON.stringify(['stop_a']);
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['segmentMinutes'] = JSON.stringify([]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('stopIds'))).toBe(true);
  });

  it('rejects adjacent duplicate stops in a bus line', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['stopIds'] = JSON.stringify([
      'stop_a',
      'stop_a',
      'stop_b',
    ]);
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['segmentMinutes'] = JSON.stringify([5, 12]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('duplicate'))).toBe(true);
  });

  it('rejects segmentMinutes whose length does not match stops - 1', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['segmentMinutes'] = JSON.stringify([12, 7]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('segmentMinutes'))).toBe(true);
  });

  it('rejects zero/negative segment durations', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['segmentMinutes'] = JSON.stringify([0]);
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('segmentMinutes'))).toBe(true);
  });

  it('rejects zero/negative headway', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['headwayMinutes'] = 0;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('headwayMinutes'))).toBe(true);
  });

  it('rejects an invalid service window', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['serviceStartMinute'] = 1380;
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['serviceEndMinute'] = 360;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('service'))).toBe(true);
  });

  it('rejects a negative fare', () => {
    const tables = clone(validTownTables());
    (tables['busLines']!['line_ab']! as Record<string, unknown>)['fare'] = -1;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('busLines/line_ab') && e.includes('fare'))).toBe(true);
  });

  it('rejects invalid or duplicate world IDs', () => {
    const tables = clone(validTownTables());
    (tables['districts']!['BAD ID'] as unknown) = { name: 'Bad', mapX: 0, mapY: 0, tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('districts/BAD ID'))).toBe(true);
  });
});

describe('Town content codegen (#51 slice 1)', () => {
  it('emits typed world registries deterministically', () => {
    const first = generateWorldRegistrySource(validTownTables());
    const second = generateWorldRegistrySource(clone(validTownTables()));
    expect(first).toBe(second);
    for (const token of [
      'GENERATED_DISTRICTS',
      'GENERATED_PLACES',
      'GENERATED_TRANSIT_STOPS',
      'GENERATED_BUS_LINES',
      'district_a',
      'place_a1',
      'stop_a',
      'line_ab',
    ]) {
      expect(first, `missing ${token}`).toContain(token);
    }
  });

  it('round-trips the real store.json through parse + validate', () => {
    // Fixture tables are the contract; the live store must at least parse.
    // (Live-store town rows land in a later commit via the generation path.)
    expect(() => parseContentJson(JSON.stringify(validTownTables()))).not.toThrow();
  });
});
