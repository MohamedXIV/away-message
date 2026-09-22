import {
  CONTENT_INDEX_IDS,
  CONTENT_QUERY_IDS,
  CONTENT_RELATIONSHIP_IDS,
  type ContentModel,
} from '../content/model';

export interface ContentNodeRef {
  tableId: string;
  rowId: string;
}

interface HierarchyEdge {
  parentTableId: string;
  childTableId: string;
  relationshipId: string;
  indexId: string;
}

/**
 * Editor navigation metadata only. Every edge delegates identity/reference
 * truth to the shared ContentModel relationship + index definitions.
 */
const HIERARCHY_EDGES: readonly HierarchyEdge[] = [
  {
    parentTableId: 'districts',
    childTableId: 'places',
    relationshipId: CONTENT_RELATIONSHIP_IDS.placeDistrict,
    indexId: CONTENT_INDEX_IDS.placesByDistrict,
  },
  {
    parentTableId: 'places',
    childTableId: 'spaces',
    relationshipId: CONTENT_RELATIONSHIP_IDS.spacePlace,
    indexId: CONTENT_INDEX_IDS.spacesByPlace,
  },
  {
    parentTableId: 'spaces',
    childTableId: 'views',
    relationshipId: CONTENT_RELATIONSHIP_IDS.viewSpace,
    indexId: CONTENT_INDEX_IDS.viewsBySpace,
  },
  {
    parentTableId: 'views',
    childTableId: 'anchors',
    relationshipId: CONTENT_RELATIONSHIP_IDS.anchorView,
    indexId: CONTENT_INDEX_IDS.anchorsByView,
  },
  {
    parentTableId: 'anchors',
    childTableId: 'interactions',
    relationshipId: CONTENT_RELATIONSHIP_IDS.interactionAnchor,
    indexId: CONTENT_INDEX_IDS.interactionsByAnchor,
  },
  {
    parentTableId: 'spaces',
    childTableId: 'placementSlots',
    relationshipId: CONTENT_RELATIONSHIP_IDS.placementSlotSpace,
    indexId: CONTENT_INDEX_IDS.placementSlotsBySpace,
  },
  {
    parentTableId: 'placementSlots',
    childTableId: 'objectPlacements',
    relationshipId: CONTENT_RELATIONSHIP_IDS.objectPlacementSlot,
    indexId: CONTENT_INDEX_IDS.objectPlacementsBySlot,
  },
  {
    parentTableId: 'places',
    childTableId: 'placeServicePolicies',
    relationshipId: CONTENT_RELATIONSHIP_IDS.placeServicePolicyPlace,
    indexId: CONTENT_INDEX_IDS.placeServicePoliciesByPlace,
  },
  {
    parentTableId: 'places',
    childTableId: 'venueRoles',
    relationshipId: CONTENT_RELATIONSHIP_IDS.venueRolePlace,
    indexId: CONTENT_INDEX_IDS.venueRolesByPlace,
  },
  {
    parentTableId: 'places',
    childTableId: 'venueStations',
    relationshipId: CONTENT_RELATIONSHIP_IDS.venueStationPlace,
    indexId: CONTENT_INDEX_IDS.venueStationsByPlace,
  },
  {
    parentTableId: 'places',
    childTableId: 'venueServices',
    relationshipId: CONTENT_RELATIONSHIP_IDS.venueServicePlace,
    indexId: CONTENT_INDEX_IDS.venueServicesByPlace,
  },
  {
    parentTableId: 'places',
    childTableId: 'activityTemplates',
    relationshipId: CONTENT_RELATIONSHIP_IDS.activityTemplatePlace,
    indexId: CONTENT_INDEX_IDS.activityTemplatesByPlace,
  },
];

function uniqueSorted(nodes: ContentNodeRef[]): ContentNodeRef[] {
  const byKey = new Map<string, ContentNodeRef>();
  for (const node of nodes) {
    byKey.set(node.tableId + '/' + node.rowId, node);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.tableId.localeCompare(b.tableId) || a.rowId.localeCompare(b.rowId),
  );
}

export function getContentParents(
  model: ContentModel,
  node: ContentNodeRef,
): ContentNodeRef[] {
  const parents: ContentNodeRef[] = [];

  for (const edge of HIERARCHY_EDGES) {
    if (edge.childTableId !== node.tableId) continue;
    const parentRowId = model.relationships.getRemoteRowId(
      edge.relationshipId,
      node.rowId,
    );
    if (parentRowId) {
      parents.push({
        tableId: edge.parentTableId,
        rowId: parentRowId,
      });
    }
  }

  return uniqueSorted(parents);
}

export function getContentChildren(
  model: ContentModel,
  node: ContentNodeRef,
): ContentNodeRef[] {
  const children: ContentNodeRef[] = [];

  for (const edge of HIERARCHY_EDGES) {
    if (edge.parentTableId !== node.tableId) continue;
    for (const rowId of model.indexes.getSliceRowIds(edge.indexId, node.rowId)) {
      children.push({
        tableId: edge.childTableId,
        rowId,
      });
    }
  }

  return uniqueSorted(children);
}

/**
 * Shared query proof used by Studio physical navigation. This deliberately
 * calls the ContentModel query rather than filtering raw editor tables.
 */
export function getPlacementSlotsInSpace(
  model: ContentModel,
  spaceId: string,
): ContentNodeRef[] {
  model.queries.setParamValue(
    CONTENT_QUERY_IDS.placementSlotsInSpace,
    'spaceId',
    spaceId,
  );
  return model.queries
    .getResultRowIds(CONTENT_QUERY_IDS.placementSlotsInSpace)
    .map((rowId) => ({ tableId: 'placementSlots', rowId }))
    .sort((a, b) => a.rowId.localeCompare(b.rowId));
}
