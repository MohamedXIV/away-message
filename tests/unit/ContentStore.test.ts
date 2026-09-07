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

describe('Content store editor renames (no code changes needed)', () => {
  function renamedTables(): ReturnType<typeof parseContentJson> {
    const tables = parseContentJson(JSON.stringify({
      buddies: {
        rayan: { role: 'ryan', displayName: 'Rayan', handle: 'rayan_cart', myplace: 'rayan_cart', archetype: 'coworker', status: 'friend', metVia: 'core', color: '#d96c3b', persona: 'Warm food-cart coworker.', typingSpeedWpm: 80, formerIds: '["ryan", "ryan_foodcart", "tacocart_ryan"]', reach: 'local', hair: 'brown', eyes: 'brown', languages: '[{"lang":"en","level":5}]' },
      },
      buddyTraits: { rayan: { shyness: 25, warmth: 78, discipline: 50, spontaneity: 72, loyalty: 62 } },
      buddyHearts: { rayan: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 } },
      buddySchedules: { rayan: { blocks: '[{"start":0,"end":1440,"status":"online","msg":"hi"}]' } },
      pools: {},
    }));
    return tables;
  }

  it('validates a full id+handle rename with a save bridge', () => {
    expect(validateContent(renamedTables())).toEqual([]);
  });

  it('rejects duplicate roles and formerIds colliding with live ids', () => {
    const dup = renamedTables();
    (dup['buddies']!['maya'] as unknown) = { ...(dup['buddies']!['rayan'] as object), role: 'ryan' };
    (dup['buddyTraits']!['maya'] as unknown) = { ...(dup['buddyTraits']!['rayan'] as object) };
    (dup['buddyHearts']!['maya'] as unknown) = { ...(dup['buddyHearts']!['rayan'] as object) };
    (dup['buddySchedules']!['maya'] as unknown) = { ...(dup['buddySchedules']!['rayan'] as object) };
    expect(validateContent(dup).some((e) => e.includes('duplicate role'))).toBe(true);

    const tables = renamedTables();
    (tables['buddies']!['rayan']! as Record<string, unknown>)['formerIds'] = '["maya"]';
    (tables['buddies']!['maya'] as unknown) = { ...((tables['buddies']!['rayan'] as Record<string, unknown>)) };
    (tables['buddyTraits']!['maya'] as unknown) = { ...(tables['buddyTraits']!['rayan'] as object) };
    (tables['buddyHearts']!['maya'] as unknown) = { ...(tables['buddyHearts']!['rayan'] as object) };
    (tables['buddySchedules']!['maya'] as unknown) = { ...(tables['buddySchedules']!['rayan'] as object) };
    (tables['buddies']!['maya'] as Record<string, unknown>)['role'] = 'maya';
    (tables['buddies']!['maya'] as Record<string, unknown>)['formerIds'] = '[]';
    expect(validateContent(tables).some((e) => e.includes('collides'))).toBe(true);
  });

  it('emits role + formerIds into the generated registry', () => {
    const source = generateRegistrySource(renamedTables());
    expect(source).toContain(`role: "ryan"`);
    expect(source).toContain(`formerIds: ["ryan", "ryan_foodcart", "tacocart_ryan"]`);
    expect(source).toContain(`id: "rayan"`);
  });
});
