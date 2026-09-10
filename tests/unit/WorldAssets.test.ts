import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/codegen';
import { validAnchorTables, cloneTables as clone } from './worldFixtures';

/**
 * #51 Slice 5 — asset definitions + normal-map metadata.
 * An asset is a renderer-neutral reference (diffuse/base source plus an
 * optional normal-map sibling asset). Items and views may point at an
 * asset via optional assetId. No Phaser rendering lives here.
 */
export function validAssetTables(): ContentTables {
  const base = validAnchorTables();
  const views = { ...(base['views'] as Record<string, Record<string, unknown>>) };
  views['view_a1'] = { ...views['view_a1'], assetId: 'asset_a1' };
  return {
    ...base,
    items: {
      item_a: {
        name: 'Item A',
        kind: 'food',
        portable: true,
        volume: 1,
        assetId: 'asset_a1',
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
    views,
    assets: {
      asset_a1: {
        name: 'Asset A1',
        kind: 'image',
        uri: 'assets/world/a1.png',
        normalMapAssetId: 'asset_a1_n',
        tags: '[]',
      },
      asset_a1_n: {
        name: 'Asset A1 Normal',
        kind: 'image',
        uri: 'assets/world/a1_n.png',
        normalMapAssetId: '',
        tags: '[]',
      },
    },
  };
}

describe('World content assets (#51 slice 5)', () => {
  it('accepts the minimal valid asset fixture', () => {
    expect(validateContent(validAssetTables())).toEqual([]);
  });

  it('rejects invalid asset IDs', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['BAD ID'] as unknown) = { name: 'Bad', kind: 'image', uri: 'assets/world/bad.png', normalMapAssetId: '', tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/BAD ID'))).toBe(true);
  });

  it('rejects an asset with an empty name', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_a1']! as Record<string, unknown>)['name'] = '';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/asset_a1') && e.includes('name'))).toBe(true);
  });

  it('rejects an asset with a malformed kind tag', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_a1']! as Record<string, unknown>)['kind'] = 'BAD KIND';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/asset_a1') && e.includes('kind'))).toBe(true);
  });

  it('rejects an asset with an empty uri', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_a1']! as Record<string, unknown>)['uri'] = '';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/asset_a1') && e.includes('uri'))).toBe(true);
  });

  it('rejects a normal-map reference to a missing asset', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_a1']! as Record<string, unknown>)['normalMapAssetId'] = 'asset_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/asset_a1') && e.includes('normalMapAssetId'))).toBe(true);
  });

  it('rejects a normal-map reference to itself', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_a1']! as Record<string, unknown>)['normalMapAssetId'] = 'asset_a1';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/asset_a1') && e.includes('normalMapAssetId'))).toBe(true);
  });

  it('rejects a normal-map target that is not an image', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_sfx'] as unknown) = { name: 'Sfx', kind: 'audio', uri: 'assets/world/sfx.mp3', normalMapAssetId: '', tags: '[]' };
    (tables['assets']!['asset_a1']! as Record<string, unknown>)['normalMapAssetId'] = 'asset_sfx';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('assets/asset_a1') && e.includes('normalMapAssetId'))).toBe(true);
  });

  it('rejects an item assetId pointing at a missing asset', () => {
    const tables = clone(validAssetTables());
    (tables['items']!['item_a']! as Record<string, unknown>)['assetId'] = 'asset_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('items/item_a') && e.includes('assetId'))).toBe(true);
  });

  it('rejects a view assetId pointing at a missing asset', () => {
    const tables = clone(validAssetTables());
    (tables['views']!['view_a1']! as Record<string, unknown>)['assetId'] = 'asset_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('views/view_a1') && e.includes('assetId'))).toBe(true);
  });
});

describe('World asset codegen (#51 slice 5)', () => {
  it('emits typed asset registries deterministically', () => {
    const first = generateWorldRegistrySource(validAssetTables());
    const second = generateWorldRegistrySource(clone(validAssetTables()));
    expect(first).toBe(second);
    for (const token of [
      'GENERATED_ASSETS',
      'asset_a1',
      'asset_a1_n',
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
