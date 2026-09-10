import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import { validSpaceTables, cloneTables as clone } from './worldFixtures';

describe('World content spaces/views (#51 slice 3)', () => {
  it('accepts the minimal valid space/view fixture', () => {
    expect(validateContent(validSpaceTables())).toEqual([]);
  });

  it('rejects invalid space IDs', () => {
    const tables = clone(validSpaceTables());
    (tables['spaces']!['BAD ID'] as unknown) = { placeId: 'place_a1', name: 'Bad', tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('spaces/BAD ID'))).toBe(true);
  });

  it('rejects a space referencing a missing place', () => {
    const tables = clone(validSpaceTables());
    (tables['spaces']!['space_a1']! as Record<string, unknown>)['placeId'] = 'place_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('spaces/space_a1') && e.includes('placeId'))).toBe(true);
  });

  it('rejects a space with an empty name', () => {
    const tables = clone(validSpaceTables());
    (tables['spaces']!['space_a1']! as Record<string, unknown>)['name'] = '';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('spaces/space_a1') && e.includes('name'))).toBe(true);
  });

  it('rejects invalid view IDs', () => {
    const tables = clone(validSpaceTables());
    (tables['views']!['BAD ID'] as unknown) = { spaceId: 'space_a1', name: 'Bad', neighbors: '[]', tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('views/BAD ID'))).toBe(true);
  });

  it('rejects a view referencing a missing space', () => {
    const tables = clone(validSpaceTables());
    (tables['views']!['view_a1']! as Record<string, unknown>)['spaceId'] = 'space_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('views/view_a1') && e.includes('spaceId'))).toBe(true);
  });

  it('rejects a view neighbor referencing a missing view', () => {
    const tables = clone(validSpaceTables());
    (tables['views']!['view_a1']! as Record<string, unknown>)['neighbors'] = '["view_ghost"]';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('views/view_a1') && e.includes('view_ghost'))).toBe(true);
  });

  it('rejects a view neighboring itself', () => {
    const tables = clone(validSpaceTables());
    (tables['views']!['view_a1']! as Record<string, unknown>)['neighbors'] = '["view_a1"]';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('views/view_a1') && e.includes('neighbors'))).toBe(true);
  });

  it('rejects malformed neighbors JSON', () => {
    const tables = clone(validSpaceTables());
    (tables['views']!['view_a1']! as Record<string, unknown>)['neighbors'] = 'not-json';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('views/view_a1') && e.includes('neighbors'))).toBe(true);
  });
});

describe('World space/view codegen (#51 slice 3)', () => {
  it('emits typed space/view registries deterministically', () => {
    const first = generateWorldRegistrySource(validSpaceTables());
    const second = generateWorldRegistrySource(clone(validSpaceTables()));
    expect(first).toBe(second);
    for (const token of [
      'GENERATED_SPACES',
      'GENERATED_VIEWS',
      'space_a1',
      'view_a1',
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
