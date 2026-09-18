import { describe, expect, it } from 'vitest';
import {
  CONTENT_INDEX_IDS,
  CONTENT_QUERY_IDS,
  CONTENT_RELATIONSHIP_IDS,
  createContentModel,
} from '../../src/tools/content/model';
import {
  generateWorldRegistrySource,
  validatePhysicalGraph,
  type ContentTables,
} from '../../src/tools/content/codegen';

function validPhysicalTables(): ContentTables {
  return {
    places: {
      place_a: {
        districtId: 'district_a',
        name: 'Place A',
        transitAccess: [],
        legacyIds: [],
      },
      place_b: {
        districtId: 'district_b',
        name: 'Place B',
        transitAccess: [],
        legacyIds: [],
      },
    },
    spaces: {
      space_a: { placeId: 'place_a', name: 'Space A', tags: [] },
      space_b: { placeId: 'place_b', name: 'Space B', tags: [] },
    },
    views: {
      view_a: { spaceId: 'space_a', name: 'View A', neighbors: [], assetId: '', tags: [] },
      view_b: { spaceId: 'space_b', name: 'View B', neighbors: [], assetId: '', tags: [] },
    },
    anchors: {
      anchor_a: { viewId: 'view_a', name: 'Anchor A', x: 0.5, y: 0.5, tags: [] },
      anchor_b: { viewId: 'view_b', name: 'Anchor B', x: 0.5, y: 0.5, tags: [] },
    },
    containers: {
      drawer_container: {
        name: 'Drawer',
        capacity: 5,
        allowedItemKinds: [],
        tags: [],
      },
    },
    physicalObjectDefs: {
      desk_def: {
        name: 'Desk',
        kind: 'furniture',
        containerId: '',
        affordances: ['use'],
        toolCapabilities: ['work_surface'],
        resourceCapabilities: [],
        tags: ['work'],
      },
      drawer_def: {
        name: 'Desk Drawer',
        kind: 'storage',
        containerId: 'drawer_container',
        affordances: ['open'],
        toolCapabilities: [],
        resourceCapabilities: [],
        tags: ['storage'],
      },
    },
    placementSlots: {
      desk_slot: {
        name: 'Desk Floor Slot',
        spaceId: 'space_a',
        anchorId: 'anchor_a',
        parentPlacementId: '',
        slotKind: 'floor',
        allowedObjectKinds: ['furniture'],
        tags: [],
      },
      drawer_slot: {
        name: 'Desk Drawer Slot',
        spaceId: '',
        anchorId: '',
        parentPlacementId: 'desk_placement',
        slotKind: 'nested',
        allowedObjectKinds: ['storage'],
        tags: [],
      },
    },
    objectPlacements: {
      desk_placement: {
        objectDefId: 'desk_def',
        slotId: 'desk_slot',
      },
      drawer_placement: {
        objectDefId: 'drawer_def',
        slotId: 'drawer_slot',
      },
    },
  };
}

function clone(tables: ContentTables): ContentTables {
  return structuredClone(tables);
}

describe('authored physical graph (#100)', () => {
  it('accepts a generic rooted + nested physical graph without residence special cases', () => {
    expect(validatePhysicalGraph(validPhysicalTables())).toEqual([]);
  });

  it('rejects a root slot whose optional anchor belongs to another space', () => {
    const tables = clone(validPhysicalTables());
    (tables['placementSlots']!['desk_slot']! as Record<string, unknown>)['anchorId'] = 'anchor_b';

    const errors = validatePhysicalGraph(tables);
    expect(errors.some((error) => error.includes('placementSlots/desk_slot.anchorId') && error.includes('space_a'))).toBe(true);
  });

  it('rejects duplicate occupancy of one authored slot', () => {
    const tables = clone(validPhysicalTables());
    tables['objectPlacements']!['second_desk'] = {
      objectDefId: 'desk_def',
      slotId: 'desk_slot',
    };

    const errors = validatePhysicalGraph(tables);
    expect(errors.some((error) => error.includes('objectPlacements/second_desk.slotId') && error.includes('already occupied'))).toBe(true);
  });

  it('keeps direct affordances distinct from substitutable tool capabilities', () => {
    const tables = clone(validPhysicalTables());
    (tables['physicalObjectDefs']!['desk_def']! as Record<string, unknown>)['toolCapabilities'] = ['use'];

    const errors = validatePhysicalGraph(tables);
    expect(errors.some((error) => error.includes('physicalObjectDefs/desk_def') && error.includes('affordance') && error.includes('tool capability'))).toBe(true);
  });

  it('rejects authored nesting cycles', () => {
    const tables = clone(validPhysicalTables());
    (tables['placementSlots']!['desk_slot']! as Record<string, unknown>)['spaceId'] = '';
    (tables['placementSlots']!['desk_slot']! as Record<string, unknown>)['anchorId'] = '';
    (tables['placementSlots']!['desk_slot']! as Record<string, unknown>)['parentPlacementId'] = 'drawer_placement';

    const errors = validatePhysicalGraph(tables);
    expect(errors.some((error) => error.includes('cycle'))).toBe(true);
  });

  it('accepts an explicit delivery policy targeting an anchored root slot in the same place', () => {
    const tables = clone(validPhysicalTables());
    tables['placementSlots']!['delivery_slot'] = {
      name: 'Delivery Slot',
      spaceId: 'space_a',
      anchorId: 'anchor_a',
      parentPlacementId: '',
      slotKind: 'delivery',
      allowedObjectKinds: [],
      tags: ['delivery'],
    };
    tables['placeServicePolicies'] = {
      policy_a: {
        placeId: 'place_a',
        acceptsDelivery: true,
        deliveryTargetSlotId: 'delivery_slot',
      },
    };

    expect(validatePhysicalGraph(tables)).toEqual([]);
    const source = generateWorldRegistrySource(tables);
    expect(source).toContain('GeneratedPlaceServicePolicy');
    expect(source).toContain('GENERATED_PLACE_SERVICE_POLICIES');
    expect(source).toContain('deliveryTargetSlotId: "delivery_slot"');
  });

  it('rejects delivery policy targets outside their canonical place', () => {
    const tables = clone(validPhysicalTables());
    tables['placementSlots']!['delivery_slot_b'] = {
      name: 'Delivery Slot B',
      spaceId: 'space_b',
      anchorId: 'anchor_b',
      parentPlacementId: '',
      slotKind: 'delivery',
      allowedObjectKinds: [],
      tags: ['delivery'],
    };
    tables['placeServicePolicies'] = {
      policy_a: {
        placeId: 'place_a',
        acceptsDelivery: true,
        deliveryTargetSlotId: 'delivery_slot_b',
      },
    };

    const errors = validatePhysicalGraph(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('placeServicePolicies/policy_a.deliveryTargetSlotId') &&
          error.includes("place 'place_a'"),
      ),
    ).toBe(true);
  });

  it('rejects delivery acceptance without an explicit target', () => {
    const tables = clone(validPhysicalTables());
    tables['placeServicePolicies'] = {
      policy_a: {
        placeId: 'place_a',
        acceptsDelivery: true,
        deliveryTargetSlotId: '',
      },
    };

    const errors = validatePhysicalGraph(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('placeServicePolicies/policy_a.deliveryTargetSlotId') &&
          error.includes('explicit target'),
      ),
    ).toBe(true);
  });

  it('exposes relationships, indexes, and a reusable per-space slot query', () => {
    const { store, relationships, indexes, queries } = createContentModel();

    store.setRow('spaces', 'space_a', { placeId: 'place_a', name: 'Space A', tags: [] });
    store.setRow('views', 'view_a', { spaceId: 'space_a', name: 'View A', neighbors: [], assetId: '', tags: [] });
    store.setRow('anchors', 'anchor_a', { viewId: 'view_a', name: 'Anchor A', x: 0.5, y: 0.5, tags: [] });
    store.setRow('physicalObjectDefs', 'desk_def', {
      name: 'Desk',
      kind: 'furniture',
      containerId: '',
      affordances: ['use'],
      toolCapabilities: ['work_surface'],
      resourceCapabilities: [],
      tags: [],
    });
    store.setRow('placementSlots', 'desk_slot', {
      name: 'Desk Slot',
      spaceId: 'space_a',
      anchorId: 'anchor_a',
      parentPlacementId: '',
      slotKind: 'floor',
      allowedObjectKinds: ['furniture'],
      tags: [],
    });
    store.setRow('objectPlacements', 'desk_placement', {
      objectDefId: 'desk_def',
      slotId: 'desk_slot',
    });

    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.placementSlotSpace, 'desk_slot')).toBe('space_a');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.placementSlotAnchor, 'desk_slot')).toBe('anchor_a');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.objectPlacementSlot, 'desk_placement')).toBe('desk_slot');
    expect(relationships.getRemoteRowId(CONTENT_RELATIONSHIP_IDS.objectPlacementDefinition, 'desk_placement')).toBe('desk_def');

    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.placementSlotsBySpace, 'space_a')).toEqual(['desk_slot']);
    expect(indexes.getSliceRowIds(CONTENT_INDEX_IDS.objectPlacementsBySlot, 'desk_slot')).toEqual(['desk_placement']);

    queries.setParamValue(CONTENT_QUERY_IDS.placementSlotsInSpace, 'spaceId', 'space_a');
    expect(queries.getResultRowIds(CONTENT_QUERY_IDS.placementSlotsInSpace)).toEqual(['desk_slot']);
    expect(queries.getResultCell(CONTENT_QUERY_IDS.placementSlotsInSpace, 'desk_slot', 'slotKind')).toBe('floor');
  });
});
