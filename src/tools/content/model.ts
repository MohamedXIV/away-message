import {
  createIndexes,
  createQueries,
  createRelationships,
} from 'tinybase';
import { createContentStore, type ContentStore } from './schema';

export const CONTENT_RELATIONSHIP_IDS = {
  placeDistrict: 'placeDistrict',
  spacePlace: 'spacePlace',
  viewSpace: 'viewSpace',
  anchorView: 'anchorView',
  interactionAnchor: 'interactionAnchor',
  transitStopDistrict: 'transitStopDistrict',
  transitStopPlace: 'transitStopPlace',
  itemAsset: 'itemAsset',
  viewAsset: 'viewAsset',
  audioProfileAsset: 'audioProfileAsset',
  assetNormalMap: 'assetNormalMap',
} as const;

export const CONTENT_INDEX_IDS = {
  placesByDistrict: 'placesByDistrict',
  spacesByPlace: 'spacesByPlace',
  viewsBySpace: 'viewsBySpace',
  anchorsByView: 'anchorsByView',
  interactionsByAnchor: 'interactionsByAnchor',
  transitStopsByDistrict: 'transitStopsByDistrict',
  transitStopsByPlace: 'transitStopsByPlace',
} as const;

export interface ContentModel {
  store: ContentStore;
  relationships: ReturnType<typeof createRelationships>;
  indexes: ReturnType<typeof createIndexes>;
  queries: ReturnType<typeof createQueries>;
}

/**
 * Shared authored-content model over one TinyBase store.
 *
 * Relationships and indexes are derived navigation aids for tooling/editor use;
 * they do not become runtime simulation authority.
 */
export function createContentModel(store: ContentStore = createContentStore()): ContentModel {
  const relationships = createRelationships(store)
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.placeDistrict,
      'places',
      'districts',
      'districtId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.spacePlace,
      'spaces',
      'places',
      'placeId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.viewSpace,
      'views',
      'spaces',
      'spaceId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.anchorView,
      'anchors',
      'views',
      'viewId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.interactionAnchor,
      'interactions',
      'anchors',
      'anchorId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.transitStopDistrict,
      'transitStops',
      'districts',
      'districtId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.transitStopPlace,
      'transitStops',
      'places',
      'placeId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.itemAsset,
      'items',
      'assets',
      'assetId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.viewAsset,
      'views',
      'assets',
      'assetId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.audioProfileAsset,
      'audioProfiles',
      'assets',
      'assetId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.assetNormalMap,
      'assets',
      'assets',
      'normalMapAssetId',
    );

  const indexes = createIndexes(store)
    .setIndexDefinition(CONTENT_INDEX_IDS.placesByDistrict, 'places', 'districtId')
    .setIndexDefinition(CONTENT_INDEX_IDS.spacesByPlace, 'spaces', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.viewsBySpace, 'views', 'spaceId')
    .setIndexDefinition(CONTENT_INDEX_IDS.anchorsByView, 'anchors', 'viewId')
    .setIndexDefinition(CONTENT_INDEX_IDS.interactionsByAnchor, 'interactions', 'anchorId')
    .setIndexDefinition(CONTENT_INDEX_IDS.transitStopsByDistrict, 'transitStops', 'districtId')
    .setIndexDefinition(CONTENT_INDEX_IDS.transitStopsByPlace, 'transitStops', 'placeId');

  const queries = createQueries(store);

  return { store, relationships, indexes, queries };
}
