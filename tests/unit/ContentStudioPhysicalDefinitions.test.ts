import { describe, expect, it } from 'vitest';
import {
  buildContainerRow,
  buildItemRow,
  parseSemanticList,
  serializeSemanticList,
} from '../../src/tools/studio/physicalDefinitionAuthoring';

describe('Content Studio physical-definition authoring', () => {
  it('creates item rows in the canonical #51 TinyBase shape', () => {
    expect(buildItemRow('Milk Crate')).toEqual({
      name: 'Milk Crate',
      kind: 'misc',
      portable: true,
      volume: 1,
      assetId: '',
      tags: '[]',
    });
  });

  it('creates container rows without inventing runtime occupancy or location state', () => {
    expect(buildContainerRow('Diner Shelf')).toEqual({
      name: 'Diner Shelf',
      capacity: 1,
      allowedItemKinds: '[]',
      tags: '[]',
    });
  });

  it('round-trips semantic kind/tag lists as trimmed unique JSON arrays', () => {
    expect(serializeSemanticList([' food ', 'fragile', 'food', ''])).toBe('["food","fragile"]');
    expect(parseSemanticList('["food","fragile"]')).toEqual(['food', 'fragile']);
    expect(parseSemanticList('not-json')).toEqual([]);
  });
});
