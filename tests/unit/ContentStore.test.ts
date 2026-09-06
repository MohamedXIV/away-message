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
    expect(Object.keys(tables['buddies'] ?? {})).toEqual(['ryan', 'maya', 'nora', 'henderson']);
  });

  it('generates deterministically (same bytes every run)', () => {
    const tables = parseContentJson(loadStoreJson());
    const first = generateRegistrySource(tables);
    const second = generateRegistrySource(JSON.parse(JSON.stringify(tables)));
    expect(first).toBe(second);
    expect(first).toContain('GENERATED_BUDDIES');
    expect(first).toContain('GENERATED_POOLS');
    expect(contentHash(tables)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('rejects bad rows loudly (ids, archetypes, ranges, orphans, blocks, pools)', () => {
    const tables = parseContentJson(loadStoreJson());
    (tables['buddies']!['maya']! as Record<string, unknown>)['archetype'] = 'vampire';
    (tables['buddyTraits']!['maya']! as Record<string, unknown>)['shyness'] = 120;
    (tables['buddyTraits']!['ghost'] as unknown) = { shyness: 1, warmth: 1, discipline: 1, spontaneity: 1, loyalty: 1 };
    (tables['buddySchedules']!['ryan']! as Record<string, unknown>)['blocks'] = 'nope';
    (tables['pools']!['leave:sleep:soft']! as Record<string, unknown>)['lines'] = '[]';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('maya') && e.includes('archetype'))).toBe(true);
    expect(errors.some((e) => e.includes('shyness'))).toBe(true);
    expect(errors.some((e) => e.includes('ghost'))).toBe(true);
    expect(errors.some((e) => e.includes('blocks'))).toBe(true);
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
    expect(Object.keys(tables['buddies'] ?? {}).sort()).toEqual(['henderson', 'maya', 'nora', 'ryan']);
  });
});
