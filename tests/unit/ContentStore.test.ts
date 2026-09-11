import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContentStore } from '../../src/tools/content/schema';
import {
  parseContentJson,
  validateContent,
  generateRegistrySource,
  contentHash,
} from '../../src/tools/content/codegen';
import type { Tables } from 'tinybase';

function loadStoreJson(): string {
  return readFileSync(new URL('../../content/store.json', import.meta.url), 'utf8');
}

describe('Content store (TinyBase source of truth)', () => {
  it('ships a valid store: parses, schema-loads, and passes engine validation', () => {
    const tables = parseContentJson(loadStoreJson());
    const store = createContentStore();
    expect(() => store.setTables(tables as unknown as Tables)).not.toThrow();
    expect(validateContent(tables)).toEqual([]);
    // Roster order is authorial (seeded rolls depend on iteration order).
    expect(Object.keys(tables['characters'] ?? {})).toEqual(['ryan', 'maya', 'nora', 'henderson']);
  });

  it('generates deterministically (same bytes every run)', () => {
    const tables = parseContentJson(loadStoreJson());
    const first = generateRegistrySource(tables);
    const second = generateRegistrySource(JSON.parse(JSON.stringify(tables)));
    expect(first).toBe(second);
    expect(first).toContain('GENERATED_CHARACTERS');
    expect(first).toContain('GENERATED_DIALOGUE_POOLS');
    expect(contentHash(tables)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('rejects bad rows loudly (ids, archetypes, ranges, orphans, routines, pools)', () => {
    const tables = parseContentJson(loadStoreJson());
    (tables['characters']!['maya']! as Record<string, unknown>)['archetypeId'] = 'vampire';
    (tables['temperaments']!['maya']! as Record<string, unknown>)['shyness'] = 120;
    (tables['temperaments']!['ghost'] as unknown) = { shyness: 1, warmth: 1, discipline: 1, spontaneity: 1, loyalty: 1 };
    (tables['routines']!['ryan']! as Record<string, unknown>)['wakeMinute'] = 2000;
    (tables['dialoguePools']!['leave:sleep:soft']! as Record<string, unknown>)['lines'] = '[]';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('maya') && e.includes('archetypeId'))).toBe(true);
    expect(errors.some((e) => e.includes('shyness'))).toBe(true);
    expect(errors.some((e) => e.includes('ghost'))).toBe(true);
    expect(errors.some((e) => e.includes('wakeMinute'))).toBe(true);
    expect(errors.some((e) => e.includes('1..12'))).toBe(true);
  });

  it('stays in sync: committed generated file matches content/store.json', () => {
    const tables = parseContentJson(loadStoreJson());
    const committed = readFileSync(new URL('../../src/engine/coreBuddies.generated.ts', import.meta.url), 'utf8');
    expect(generateRegistrySource(tables)).toBe(committed);
  });

  it('imports the Inspector overlay module without API drift', async () => {
    const mod = await import('../../src/tools/ContentInspector');
    expect(typeof mod.ContentInspector).toBe('function');
    expect(typeof mod.exportStoreJson).toBe('function');
    expect(typeof mod.tablesFromGenerated).toBe('function');
    const tables = mod.tablesFromGenerated();
    expect(Object.keys(tables['characters'] ?? {}).sort()).toEqual(['henderson', 'maya', 'nora', 'ryan']);
  }, 15000);
});

describe('Content store editor renames (no code changes needed)', () => {
  function renamedTables(): ReturnType<typeof parseContentJson> {
    const raw = JSON.parse(loadStoreJson()) as Record<string, Record<string, unknown>>;
    raw['characters']!['rayan'] = { ...(raw['characters']!['ryan'] as object) };
    delete raw['characters']!['ryan'];
    raw['temperaments']!['rayan'] = { ...(raw['temperaments']!['ryan'] as object) };
    delete raw['temperaments']!['ryan'];
    raw['initialAffinities']!['rayan'] = { ...(raw['initialAffinities']!['ryan'] as object) };
    delete raw['initialAffinities']!['ryan'];
    raw['routines']!['rayan'] = { ...(raw['routines']!['ryan'] as object) };
    delete raw['routines']!['ryan'];
    raw['artProfiles']!['rayan'] = { ...(raw['artProfiles']!['ryan'] as object) };
    delete raw['artProfiles']!['ryan'];
    raw['backstories']!['rayan'] = { ...(raw['backstories']!['ryan'] as object) };
    delete raw['backstories']!['ryan'];
    return parseContentJson(JSON.stringify(raw));
  }

  it('validates a character id rename when relations are updated', () => {
    expect(validateContent(renamedTables())).toEqual([]);
  });

  it('rejects duplicate roles', () => {
    const dup = renamedTables();
    (dup['characters']!['maya'] as Record<string, unknown>)['role'] = 'ryan';
    expect(validateContent(dup).some((e) => e.includes('duplicate role'))).toBe(true);
  });

  it('emits role into the generated registry', () => {
    const source = generateRegistrySource(renamedTables());
    expect(source).toContain(`role: "ryan"`);
    expect(source).toContain(`id: "rayan"`);
  });
});
