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
  physicalObjectContainer: 'physicalObjectContainer',
  placementSlotSpace: 'placementSlotSpace',
  placementSlotAnchor: 'placementSlotAnchor',
  placementSlotParentPlacement: 'placementSlotParentPlacement',
  objectPlacementSlot: 'objectPlacementSlot',
  objectPlacementDefinition: 'objectPlacementDefinition',
  placeServicePolicyPlace: 'placeServicePolicyPlace',
  placeServicePolicyDeliverySlot: 'placeServicePolicyDeliverySlot',
  venueRolePlace: 'venueRolePlace',
  venueStationPlace: 'venueStationPlace',
  venueStationSpace: 'venueStationSpace',
  venueStationAnchor: 'venueStationAnchor',
  venueServicePlace: 'venueServicePlace',
  venueServiceSpace: 'venueServiceSpace',
  venueServiceActivityTemplate: 'venueServiceActivityTemplate',
  activityTemplatePlace: 'activityTemplatePlace',
} as const;

export const CONTENT_INDEX_IDS = {
  placesByDistrict: 'placesByDistrict',
  spacesByPlace: 'spacesByPlace',
  viewsBySpace: 'viewsBySpace',
  anchorsByView: 'anchorsByView',
  interactionsByAnchor: 'interactionsByAnchor',
  transitStopsByDistrict: 'transitStopsByDistrict',
  transitStopsByPlace: 'transitStopsByPlace',
  physicalObjectsByKind: 'physicalObjectsByKind',
  placementSlotsBySpace: 'placementSlotsBySpace',
  placementSlotsByParentPlacement: 'placementSlotsByParentPlacement',
  objectPlacementsBySlot: 'objectPlacementsBySlot',
  objectPlacementsByDefinition: 'objectPlacementsByDefinition',
  placeServicePoliciesByPlace: 'placeServicePoliciesByPlace',
  venueRolesByPlace: 'venueRolesByPlace',
  venueStationsByPlace: 'venueStationsByPlace',
  venueServicesByPlace: 'venueServicesByPlace',
  activityTemplatesByPlace: 'activityTemplatesByPlace',
} as const;

export const CONTENT_QUERY_IDS = {
  placementSlotsInSpace: 'placementSlotsInSpace',
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
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.physicalObjectContainer,
      'physicalObjectDefs',
      'containers',
      'containerId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.placementSlotSpace,
      'placementSlots',
      'spaces',
      'spaceId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.placementSlotAnchor,
      'placementSlots',
      'anchors',
      'anchorId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.placementSlotParentPlacement,
      'placementSlots',
      'objectPlacements',
      'parentPlacementId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.objectPlacementSlot,
      'objectPlacements',
      'placementSlots',
      'slotId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.objectPlacementDefinition,
      'objectPlacements',
      'physicalObjectDefs',
      'objectDefId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.placeServicePolicyPlace,
      'placeServicePolicies',
      'places',
      'placeId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.placeServicePolicyDeliverySlot,
      'placeServicePolicies',
      'placementSlots',
      'deliveryTargetSlotId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueRolePlace,
      'venueRoles',
      'places',
      'placeId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueStationPlace,
      'venueStations',
      'places',
      'placeId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueStationSpace,
      'venueStations',
      'spaces',
      'spaceId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueStationAnchor,
      'venueStations',
      'anchors',
      'anchorId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueServicePlace,
      'venueServices',
      'places',
      'placeId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueServiceSpace,
      'venueServices',
      'spaces',
      'spaceId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.venueServiceActivityTemplate,
      'venueServices',
      'activityTemplates',
      'activityTemplateId',
    )
    .setRelationshipDefinition(
      CONTENT_RELATIONSHIP_IDS.activityTemplatePlace,
      'activityTemplates',
      'places',
      'placeId',
    );

  const indexes = createIndexes(store)
    .setIndexDefinition(CONTENT_INDEX_IDS.placesByDistrict, 'places', 'districtId')
    .setIndexDefinition(CONTENT_INDEX_IDS.spacesByPlace, 'spaces', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.viewsBySpace, 'views', 'spaceId')
    .setIndexDefinition(CONTENT_INDEX_IDS.anchorsByView, 'anchors', 'viewId')
    .setIndexDefinition(CONTENT_INDEX_IDS.interactionsByAnchor, 'interactions', 'anchorId')
    .setIndexDefinition(CONTENT_INDEX_IDS.transitStopsByDistrict, 'transitStops', 'districtId')
    .setIndexDefinition(CONTENT_INDEX_IDS.transitStopsByPlace, 'transitStops', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.physicalObjectsByKind, 'physicalObjectDefs', 'kind')
    .setIndexDefinition(CONTENT_INDEX_IDS.placementSlotsBySpace, 'placementSlots', 'spaceId')
    .setIndexDefinition(CONTENT_INDEX_IDS.placementSlotsByParentPlacement, 'placementSlots', 'parentPlacementId')
    .setIndexDefinition(CONTENT_INDEX_IDS.objectPlacementsBySlot, 'objectPlacements', 'slotId')
    .setIndexDefinition(CONTENT_INDEX_IDS.objectPlacementsByDefinition, 'objectPlacements', 'objectDefId')
    .setIndexDefinition(CONTENT_INDEX_IDS.placeServicePoliciesByPlace, 'placeServicePolicies', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.venueRolesByPlace, 'venueRoles', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.venueStationsByPlace, 'venueStations', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.venueServicesByPlace, 'venueServices', 'placeId')
    .setIndexDefinition(CONTENT_INDEX_IDS.activityTemplatesByPlace, 'activityTemplates', 'placeId');

  const queries = createQueries(store).setQueryDefinition(
    CONTENT_QUERY_IDS.placementSlotsInSpace,
    'placementSlots',
    ({ select, where, param }) => {
      select('name');
      select('spaceId');
      select('anchorId');
      select('parentPlacementId');
      select('slotKind');
      select('allowedObjectKinds');
      select('tags');
      where('spaceId', String(param('spaceId') ?? ''));
    },
    { spaceId: '' },
  );

  return { store, relationships, indexes, queries };
}
