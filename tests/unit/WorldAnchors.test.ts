import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseContentJson,
  validateContent,
  generateWorldRegistrySource,
} from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/codegen';
import { validSpaceTables, cloneTables as clone } from './worldFixtures';

/**
 * #51 Slice 4 — anchors + interactions.
 * Anchors pin authored interaction points inside a view (normalized 0..1
 * bounds, cf. HotspotBounds precedent). Interactions bind one capability
 * to one anchor. Runtime interaction state stays out of content.
 */
export function validAnchorTables(): ContentTables {
  return {
    ...validSpaceTables(),
    anchors: {
      anchor_a1: {
        viewId: 'view_a1',
        name: 'Anchor A1',
        x: 0.5,
        y: 0.5,
        tags: '["hotspot"]',
      },
    },
    interactions: {
      interaction_a1: {
        anchorId: 'anchor_a1',
        capability: 'inspect',
        name: 'Interaction A1',
        tags: '[]',
      },
    },
  };
}

describe('World content anchors/interactions (#51 slice 4)', () => {
  it('accepts the minimal valid anchor/interaction fixture', () => {
    expect(validateContent(validAnchorTables())).toEqual([]);
  });

  it('rejects invalid anchor IDs', () => {
    const tables = clone(validAnchorTables());
    (tables['anchors']!['BAD ID'] as unknown) = { viewId: 'view_a1', name: 'Bad', x: 0.5, y: 0.5, tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('anchors/BAD ID'))).toBe(true);
  });

  it('rejects an anchor targeting a missing view', () => {
    const tables = clone(validAnchorTables());
    (tables['anchors']!['anchor_a1']! as Record<string, unknown>)['viewId'] = 'view_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('anchors/anchor_a1') && e.includes('viewId'))).toBe(true);
  });

  it('rejects an anchor with out-of-range bounds', () => {
    const tables = clone(validAnchorTables());
    (tables['anchors']!['anchor_a1']! as Record<string, unknown>)['x'] = 1.5;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('anchors/anchor_a1') && e.includes('.x'))).toBe(true);
  });

  it('rejects an anchor with an empty name', () => {
    const tables = clone(validAnchorTables());
    (tables['anchors']!['anchor_a1']! as Record<string, unknown>)['name'] = '';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('anchors/anchor_a1') && e.includes('name'))).toBe(true);
  });

  it('rejects invalid interaction IDs', () => {
    const tables = clone(validAnchorTables());
    (tables['interactions']!['BAD ID'] as unknown) = { anchorId: 'anchor_a1', capability: 'inspect', name: 'Bad', tags: '[]' };
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('interactions/BAD ID'))).toBe(true);
  });

  it('rejects an interaction targeting a missing anchor', () => {
    const tables = clone(validAnchorTables());
    (tables['interactions']!['interaction_a1']! as Record<string, unknown>)['anchorId'] = 'anchor_ghost';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('interactions/interaction_a1') && e.includes('anchorId'))).toBe(true);
  });

  it('rejects an interaction with an empty capability', () => {
    const tables = clone(validAnchorTables());
    (tables['interactions']!['interaction_a1']! as Record<string, unknown>)['capability'] = '';
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('interactions/interaction_a1') && e.includes('capability'))).toBe(true);
  });
});

describe('World anchor/interaction codegen (#51 slice 4)', () => {
  it('emits typed anchor/interaction registries deterministically', () => {
    const first = generateWorldRegistrySource(validAnchorTables());
    const second = generateWorldRegistrySource(clone(validAnchorTables()));
    expect(first).toBe(second);
    for (const token of [
      'GENERATED_ANCHORS',
      'GENERATED_INTERACTIONS',
      'anchor_a1',
      'interaction_a1',
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
