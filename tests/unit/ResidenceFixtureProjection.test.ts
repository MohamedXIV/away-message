import { describe, expect, it } from 'vitest';
import type {
  GeneratedPhysicalObjectDef,
  GeneratedPlacementSlotDef,
  GeneratedObjectPlacementDef,
} from '../../src/engine/worldContent.generated';
import {
  authoredObjectInstanceId,
  materializeAuthoredPhysicalObjects,
  movePhysicalObject,
  type PhysicalRuntimeGraph,
} from '../../src/engine/physical/PhysicalContextRuntime';
import {
  projectFixtureVisuals,
  selectFixtureVisualVariant,
  type FixtureVisualCatalog,
} from '../../src/world/ResidenceFixtureProjection';

const objectDefs: GeneratedPhysicalObjectDef[] = [
  {
    id: 'test_bed_def',
    name: 'Synthetic Bed',
    kind: 'bed',
    containerId: null,
    affordances: ['sleep'],
    toolCapabilities: [],
    resourceCapabilities: [],
    tags: ['fixture'],
  },
  {
    id: 'test_rug_def',
    name: 'Synthetic Rug',
    kind: 'decor',
    containerId: null,
    affordances: ['inspect'],
    toolCapabilities: [],
    resourceCapabilities: [],
    tags: ['decor'],
  },
];

const slots: GeneratedPlacementSlotDef[] = [
  {
    id: 'test_bed_slot',
    name: 'Bed Slot',
    spaceId: 'test_space',
    anchorId: 'test_bed_anchor',
    parentPlacementId: null,
    slotKind: 'floor',
    allowedObjectKinds: ['bed'],
    tags: [],
  },
  {
    id: 'test_rug_slot',
    name: 'Rug Slot',
    spaceId: 'test_space',
    anchorId: 'test_rug_anchor',
    parentPlacementId: null,
    slotKind: 'floor',
    allowedObjectKinds: ['decor'],
    tags: [],
  },
  {
    id: 'test_rug_slot_alt',
    name: 'Alternate Rug Slot',
    spaceId: 'test_space',
    anchorId: 'test_rug_anchor_alt',
    parentPlacementId: null,
    slotKind: 'floor',
    allowedObjectKinds: ['decor'],
    tags: [],
  },
];

const placements: GeneratedObjectPlacementDef[] = [
  { id: 'test_bed_placement', objectDefId: 'test_bed_def', slotId: 'test_bed_slot' },
  { id: 'test_rug_placement', objectDefId: 'test_rug_def', slotId: 'test_rug_slot' },
];

const graph: PhysicalRuntimeGraph = { objectDefs, slots, placements };

const catalog: FixtureVisualCatalog = {
  test_bed_def: {
    defaultVariantId: 'basic',
    variants: {
      basic: {
        test_view_a: { assetId: 'test_bed_basic_a', depth: 20 },
        test_view_b: { assetId: 'test_bed_basic_b', depth: 10 },
      },
      upgraded: {
        test_view_a: { assetId: 'test_bed_upgraded_a', depth: 20 },
        test_view_b: { assetId: 'test_bed_upgraded_b', depth: 10 },
      },
    },
  },
  test_rug_def: {
    defaultVariantId: 'woven',
    variants: {
      woven: {
        test_view_a: { assetId: 'test_rug_a', depth: 5 },
      },
    },
  },
};

describe('modular fixture visual projection (#87)', () => {
  it('projects one semantic object identity to view-specific art deterministically', () => {
    const state = materializeAuthoredPhysicalObjects(graph);

    expect(projectFixtureVisuals('test_view_a', state, graph, catalog)).toEqual([
      {
        objectInstanceId: authoredObjectInstanceId('test_rug_placement'),
        authoredPlacementId: 'test_rug_placement',
        slotId: 'test_rug_slot',
        objectDefId: 'test_rug_def',
        variantId: 'woven',
        assetId: 'test_rug_a',
        depth: 5,
      },
      {
        objectInstanceId: authoredObjectInstanceId('test_bed_placement'),
        authoredPlacementId: 'test_bed_placement',
        slotId: 'test_bed_slot',
        objectDefId: 'test_bed_def',
        variantId: 'basic',
        assetId: 'test_bed_basic_a',
        depth: 20,
      },
    ]);

    const viewB = projectFixtureVisuals('test_view_b', state, graph, catalog);
    expect(viewB.map((entry) => entry.objectInstanceId)).toEqual([
      authoredObjectInstanceId('test_bed_placement'),
    ]);
    expect(viewB[0]?.assetId).toBe('test_bed_basic_b');
  });

  it('changes only visual selection when a property fixture variant changes', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const selections = selectFixtureVisualVariant({}, 'test_bed_def', 'upgraded', catalog);
    const projected = projectFixtureVisuals('test_view_a', state, graph, catalog, selections);

    expect(projected.find((entry) => entry.objectDefId === 'test_bed_def')).toMatchObject({
      objectInstanceId: authoredObjectInstanceId('test_bed_placement'),
      authoredPlacementId: 'test_bed_placement',
      slotId: 'test_bed_slot',
      variantId: 'upgraded',
      assetId: 'test_bed_upgraded_a',
    });
    expect(state.objects[authoredObjectInstanceId('test_bed_placement')]?.objectDefId).toBe('test_bed_def');
  });

  it('fails closed for unknown variants and missing view art without mutating state', () => {
    expect(() => selectFixtureVisualVariant({}, 'test_bed_def', 'missing', catalog)).toThrow(
      'Unknown fixture visual variant missing for test_bed_def.',
    );

    const state = materializeAuthoredPhysicalObjects(graph);
    const before = structuredClone(state);
    expect(projectFixtureVisuals('test_view_missing', state, graph, catalog)).toEqual([]);
    expect(state).toEqual(before);
  });

  it('follows generic physical placement state instead of owning a second placement graph', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const moved = movePhysicalObject(
      state,
      authoredObjectInstanceId('test_rug_placement'),
      'test_rug_slot_alt',
      graph,
    );
    const projected = projectFixtureVisuals('test_view_a', moved, graph, catalog);

    expect(projected.find((entry) => entry.objectDefId === 'test_rug_def')).toMatchObject({
      objectInstanceId: authoredObjectInstanceId('test_rug_placement'),
      slotId: 'test_rug_slot_alt',
    });
  });
});
