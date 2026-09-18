import { describe, expect, it } from 'vitest';
import {
  CONTENT_INDEX_IDS,
  CONTENT_RELATIONSHIP_IDS,
  createContentModel,
} from '../../src/tools/content/model';

describe('authored content model graph (#100)', () => {
  it('derives authored containment through shared TinyBase relationships and indexes', () => {
    const { store, relationships, indexes } = createContentModel();

    store.setRow('districts', 'district_a', { name: 'District A', mapX: 0, mapY: 0, tags: '[]' });
    store.setRow('places', 'place_a', {
      districtId: 'district_a',
      name: 'Place A',
      transitAccess: '[]',
      legacyIds: '[]',
    });
    store.setRow('spaces', 'space_a', { placeId: 'place_a', name: 'Space A', tags: '[]' });
    store.setRow('views', 'view_a', {
      spaceId: 'space_a',
      name: 'View A',
      neighbors: '[]',
      assetId: '',
      tags: '[]',
    });
    store.setRow('anchors', 'anchor_a', {
      viewId: 'view_a',
      name: 'Anchor A',
      x: 0.5,
      y: 0.5,
      tags: '[]',
    });
    store.setRow('interactions', 'interaction_a', {
      anchorId: 'anchor_a',
      capability: 'inspect',
      name: 'Inspect',
      tags: '[]',
    });

    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.placeDistrict, 'place_a')).toBe('district_a');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.spacePlace, 'space_a')).toBe('place_a');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.viewSpace, 'view_a')).toBe('space_a');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.anchorView, 'anchor_a')).toBe('view_a');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.interactionAnchor, 'interaction_a')).toBe('anchor_a');

    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.placesByDistrict, 'district_a')).toEqual(['place_a']);
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.spacesByPlace, 'place_a')).toEqual(['space_a']);
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.viewsBySpace, 'space_a')).toEqual(['view_a']);
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.anchorsByView, 'view_a')).toEqual(['anchor_a']);
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.interactionsByAnchor, 'anchor_a')).toEqual(['interaction_a']);
  });

  it('updates derived containment when an authored foreign key changes', () => {
    const { store, relationships, indexes } = createContentModel();

    store.setRow('districts', 'district_a', { name: 'District A', mapX: 0, mapY: 0, tags: '[]' });
    store.setRow('places', 'place_a', {
      districtId: 'district_a',
      name: 'Place A',
      transitAccess: '[]',
      legacyIds: '[]',
    });
    store.setRow('places', 'place_b', {
      districtId: 'district_a',
      name: 'Place B',
      transitAccess: '[]',
      legacyIds: '[]',
    });
    store.setRow('spaces', 'space_a', { placeId: 'place_a', name: 'Space A', tags: '[]' });

    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.spacePlace, 'space_a')).toBe('place_a');
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.spacesByPlace, 'place_a')).toEqual(['space_a']);

    store.setCell('spaces', 'space_a', 'placeId', 'place_b');

    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.spacePlace, 'space_a')).toBe('place_b');
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.spacesByPlace, 'place_a')).toEqual([]);
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.spacesByPlace, 'place_b')).toEqual(['space_a']);
  });
});
