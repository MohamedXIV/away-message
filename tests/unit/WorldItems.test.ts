import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/codegen';

/**
 * #51 Slice 2 — item/container semantic validation + codegen.
 * Neutral contract fixture (not production content):
 *   item_a (food, portable) + container_a (capacity 10, accepts food).
 * Definition-only: no instance state (location, contents, owner, stock).
 */
export function validItemTables(): ContentTables {
  return {
    archetypes: {
      regular: {
        label: 'Regular',
        description: 'Item fixture scaffold.',
        personaHint: 'Steady.',
        vocabulary: '[]',
        defaultInterests: '[]',
        defaultSong: '',
        typingSpeedWpm: 70,
      },
    },
    items: {
      item_a: {
        name: 'Item A',
        kind: 'food',
        portable: true,
        volume: 1,
        tags: '["food","perishable"]',
      },
    },
    containers: {
      container_a: {
        name: 'Container A',
        capacity: 10,
        allowedItemKinds: '["food"]',
        tags: '["storage"]',
      },
    },
  };
}

function clone(tables: ContentTables): ContentTables {
  return JSON.parse(JSON.stringify(tables));
}

describe('World content items/containers (#51 slice 2)', () => {
  it('accepts the minimal valid item/container fixture', () => {
    expect(validateContent(validItemTables())).toEqual([]);
  });

  it('rejects invalid item IDs', () => {
    const tables = clone(validItemTables());
    (tables['items']!['BAD ID'] as unknown) = { name: 'Bad', kind: 'food', portable: true, volume: 1, tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('items/BAD ID'))).toBe(true);
  });

  it('rejects an item with an empty name', () => {
    const tables = clone(validItemTables());
    (tables['items']!['item_a']! as Record<string, unknown>)['name'] = '';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('items/item_a') && e.includes('name'))).toBe(true);
  });

  it('rejects an item with a malformed kind tag', () => {
    const tables = clone(validItemTables());
    (tables['items']!['item_a']! as Record<string, unknown>)['kind'] = 'BAD KIND';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('items/item_a') && e.includes('kind'))).toBe(true);
  });

  it('rejects an item with a negative volume', () => {
    const tables = clone(validItemTables());
    (tables['items']!['item_a']! as Record<string, unknown>)['volume'] = -1;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('items/item_a') && e.includes('volume'))).toBe(true);
  });

  it('rejects an item with malformed tags JSON', () => {
    const tables = clone(validItemTables());
    (tables['items']!['item_a']! as Record<string, unknown>)['tags'] = 'not-json';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('items/item_a') && e.includes('tags'))).toBe(true);
  });

  it('rejects invalid container IDs', () => {
    const tables = clone(validItemTables());
    (tables['containers']!['BAD ID'] as unknown) = { name: 'Bad', capacity: 5, allowedItemKinds: '[]', tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('containers/BAD ID'))).toBe(true);
  });

  it('rejects a container with zero capacity', () => {
    const tables = clone(validItemTables());
    (tables['containers']!['container_a']! as Record<string, unknown>)['capacity'] = 0;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('containers/container_a') && e.includes('capacity'))).toBe(true);
  });

  it('rejects a container with malformed allowedItemKinds', () => {
    const tables = clone(validItemTables());
    (tables['containers']!['container_a']! as Record<string, unknown>)['allowedItemKinds'] = '["OK","BAD KIND"]';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('containers/container_a') && e.includes('allowedItemKinds'))).toBe(true);
  });

  it('accepts an unrestricted container (empty allowedItemKinds)', () => {
    const tables = clone(validItemTables());
    (tables['containers']!['container_a']! as Record<string, unknown>)['allowedItemKinds'] = '[]';
    expect(validateContent(tables)).toEqual([]);
  });
});

describe('World item/container codegen (#51 slice 2)', () => {
  it('emits typed item/container registries deterministically', () => {
    const first = generateWorldRegistrySource(validItemTables());
    const second = generateWorldRegistrySource(clone(validItemTables()));
    expect(first).toBe(second);
    for (const token of [
      'GENERATED_ITEMS',
      'GENERATED_CONTAINERS',
      'item_a',
      'container_a',
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
