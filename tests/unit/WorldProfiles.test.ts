import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/codegen';
import { validAssetTables, cloneTables as clone } from './worldFixtures';

/**
 * #51 Slice 6 — light/audio/ambient profiles.
 * Authored environmental configuration only: no mutable light on/off
 * state, no runtime weather/event state belongs in these tables.
 */
export function validProfileTables(): ContentTables {
  const base = validAssetTables();
  const assets = { ...(base['assets'] as Record<string, Record<string, unknown>>) };
  assets['asset_a2'] = {
    name: 'Asset A2',
    kind: 'audio',
    uri: 'assets/world/a2.mp3',
    normalMapAssetId: '',
    tags: '[]',
  };
  return {
    ...base,
    assets,
    lightProfiles: {
      light_a1: {
        name: 'Light A1',
        timeOfDay: 'day',
        colorTint: '#fff2d9',
        intensity: 1,
        tags: '[]',
      },
    },
    audioProfiles: {
      audio_a1: {
        name: 'Audio A1',
        kind: 'ambience',
        assetId: 'asset_a2',
        volume: 0.6,
        tags: '[]',
      },
    },
    ambientProfiles: {
      ambient_a1: {
        name: 'Ambient A1',
        weather: 'clear',
        timeOfDay: 'evening',
        density: 0.5,
        tags: '[]',
      },
    },
  };
}

describe('World content light/audio/ambient profiles (#51 slice 6)', () => {
  it('accepts the minimal valid profile fixture', () => {
    expect(validateContent(validProfileTables())).toEqual([]);
  });

  it('rejects invalid profile IDs', () => {
    for (const table of ['lightProfiles', 'audioProfiles', 'ambientProfiles']) {
      const tables = clone(validProfileTables());
      const first = Object.keys(tables[table]!)[0]!;
      const row = tables[table]![first];
      delete tables[table]![first];
      (tables[table]!['BAD ID'] as unknown) = row;
      const errors = validateContent(tables);
      expect(errors.some((e) => e.includes(`${table}/BAD ID`))).toBe(true);
    }
  });

  it('rejects a light profile with a malformed color tint', () => {
    const tables = clone(validProfileTables());
    (tables['lightProfiles']!['light_a1']! as Record<string, unknown>)['colorTint'] = 'warm';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('lightProfiles/light_a1') && e.includes('colorTint'))).toBe(true);
  });

  it('rejects a light profile with a negative intensity', () => {
    const tables = clone(validProfileTables());
    (tables['lightProfiles']!['light_a1']! as Record<string, unknown>)['intensity'] = -1;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('lightProfiles/light_a1') && e.includes('intensity'))).toBe(true);
  });

  it('rejects an audio profile with a malformed kind tag', () => {
    const tables = clone(validProfileTables());
    (tables['audioProfiles']!['audio_a1']! as Record<string, unknown>)['kind'] = 'BAD KIND';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('audioProfiles/audio_a1') && e.includes('kind'))).toBe(true);
  });

  it('rejects an audio profile with out-of-range volume', () => {
    const tables = clone(validProfileTables());
    (tables['audioProfiles']!['audio_a1']! as Record<string, unknown>)['volume'] = 1.5;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('audioProfiles/audio_a1') && e.includes('volume'))).toBe(true);
  });

  it('rejects an audio profile assetId pointing at a missing asset', () => {
    const tables = clone(validProfileTables());
    (tables['audioProfiles']!['audio_a1']! as Record<string, unknown>)['assetId'] = 'asset_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('audioProfiles/audio_a1') && e.includes('assetId'))).toBe(true);
  });

  it('rejects an ambient profile with a negative density', () => {
    const tables = clone(validProfileTables());
    (tables['ambientProfiles']!['ambient_a1']! as Record<string, unknown>)['density'] = -0.5;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('ambientProfiles/ambient_a1') && e.includes('density'))).toBe(true);
  });

  it('rejects an ambient profile with a malformed weather tag', () => {
    const tables = clone(validProfileTables());
    (tables['ambientProfiles']!['ambient_a1']! as Record<string, unknown>)['weather'] = 'BAD WEATHER';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('ambientProfiles/ambient_a1') && e.includes('weather'))).toBe(true);
  });
});

describe('World profile codegen (#51 slice 6)', () => {
  it('emits typed profile registries deterministically', () => {
    const first = generateWorldRegistrySource(validProfileTables());
    const second = generateWorldRegistrySource(clone(validProfileTables()));
    expect(first).toBe(second);
    for (const token of [
      'GENERATED_LIGHT_PROFILES',
      'GENERATED_AUDIO_PROFILES',
      'GENERATED_AMBIENT_PROFILES',
      'light_a1',
      'audio_a1',
      'ambient_a1',
    ]) {
      expect(first, `missing ${token}`).toContain(token);
    }
  });

  it('stays in sync: committed world registry matches content/store.json', () => {
    const raw = readFileSync(new URL('../../content/store.json', import.meta.url), 'utf8');
    const committed = readFileSync(new URL('../../src/engine/worldContent.generated.ts', import.meta.url), 'utf8');
    expect(generateWorldRegistrySource(parseContentJson(raw))).toBe(committed);
  });
});
