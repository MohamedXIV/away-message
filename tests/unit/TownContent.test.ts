import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONTENT_SCHEMA } from '../../src/tools/content/schema';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/codegen';
import { validTownTables, cloneTables as clone } from './worldFixtures';

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
    const raw = readFileSync(new URL('../../content/store.json', import.meta.url), 'utf8');
    const tables = parseContentJson(raw);
    expect(validateContent(tables)).toEqual([]);
    expect(Object.keys(tables['districts'] ?? {}).sort()).toEqual(['district_a', 'district_b']);
    expect(Object.keys(tables['busLines'] ?? {})).toEqual(['line_ab']);
  });

  it('stays in sync: committed world registry matches content/store.json', () => {
    const raw = readFileSync(new URL('../../content/store.json', import.meta.url), 'utf8');
    const committed = readFileSync(new URL('../../src/engine/worldContent.generated.ts', import.meta.url), 'utf8');
    expect(generateWorldRegistrySource(parseContentJson(raw))).toBe(committed);
  });
});
