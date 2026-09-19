import { describe, expect, it } from 'vitest';
import type {
  GeneratedPhysicalObjectDef,
  GeneratedPlacementSlotDef,
  GeneratedObjectPlacementDef,
} from '../../src/engine/worldContent.generated';
import {
  authoredObjectInstanceId,
  getReachableAffordances,
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
  { id: 'test_bed_def', name: 'Synthetic Bed', kind: 'bed', containerId: null, affordances: ['sleep'], toolCapabilities: [], resourceCapabilities: [], tags: ['fixture'] },
  { id: 'test_rug_def', name: 'Synthetic Rug', kind: 'decor', containerId: null, affordances: ['inspect'], toolCapabilities: [], resourceCapabilities: [], tags: ['decor'] },
  { id: 'test_desk_def', name: 'Synthetic Desk', kind: 'desk', containerId: null, affordances: ['use'], toolCapabilities: ['computer'], resourceCapabilities: [], tags: ['fixture'] },
  { id: 'test_chair_def', name: 'Synthetic Chair', kind: 'chair', containerId: null, affordances: ['sit'], toolCapabilities: [], resourceCapabilities: [], tags: ['fixture'] },
];

const slots: GeneratedPlacementSlotDef[] = [
  { id: 'test_bed_slot', name: 'Bed Slot', spaceId: 'test_space', anchorId: 'test_bed_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['bed'], tags: [] },
  { id: 'test_bed_slot_alt', name: 'Second Bed Slot', spaceId: 'test_space', anchorId: 'test_bed_anchor_alt', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['bed'], tags: [] },
  { id: 'test_rug_slot', name: 'Rug Slot', spaceId: 'test_space', anchorId: 'test_rug_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['decor'], tags: [] },
  { id: 'test_rug_slot_alt', name: 'Alternate Rug Slot', spaceId: 'test_space', anchorId: 'test_rug_anchor_alt', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['decor'], tags: [] },
  { id: 'test_desk_slot', name: 'Desk Slot', spaceId: 'test_space', anchorId: 'test_desk_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['desk'], tags: [] },
  { id: 'test_chair_nested_slot', name: 'Desk Chair Slot', spaceId: null, anchorId: 'test_chair_anchor', parentPlacementId: 'test_desk_placement', slotKind: 'nested', allowedObjectKinds: ['chair'], tags: [] },
];

const placements: GeneratedObjectPlacementDef[] = [
  { id: 'test_bed_placement', objectDefId: 'test_bed_def', slotId: 'test_bed_slot' },
  { id: 'test_bed_placement_alt', objectDefId: 'test_bed_def', slotId: 'test_bed_slot_alt' },
  { id: 'test_rug_placement', objectDefId: 'test_rug_def', slotId: 'test_rug_slot' },
  { id: 'test_desk_placement', objectDefId: 'test_desk_def', slotId: 'test_desk_slot' },
  { id: 'test_chair_placement', objectDefId: 'test_chair_def', slotId: 'test_chair_nested_slot' },
];

const graph: PhysicalRuntimeGraph = { objectDefs, slots, placements };
const catalog: FixtureVisualCatalog = {
  test_bed_def: { defaultVariantId: 'basic', variants: { basic: { test_view_a: { assetId: 'test_bed_basic_a', depth: 20 }, test_view_b: { assetId: 'test_bed_basic_b', depth: 10 } }, upgraded: { test_view_a: { assetId: 'test_bed_upgraded_a', depth: 20 }, test_view_b: { assetId: 'test_bed_upgraded_b', depth: 10 } } } },
  test_rug_def: { defaultVariantId: 'woven', variants: { woven: { test_view_a: { assetId: 'test_rug_a', depth: 5 } } } },
  test_desk_def: { defaultVariantId: 'standard', variants: { standard: { test_view_a: { assetId: 'test_desk_a', depth: 15 }, test_view_b: { assetId: 'test_desk_b', depth: 15 } } } },
  test_chair_def: { defaultVariantId: 'standard', variants: { standard: { test_view_a: { assetId: 'test_chair_a', depth: 16 }, test_view_b: { assetId: 'test_chair_b', depth: 16 } } } },
};

describe('modular fixture visual projection (#87)', () => {
  it('projects one semantic object identity to view-specific art deterministically', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const viewA = projectFixtureVisuals('test_view_a', state, graph, catalog);
    expect(viewA.find((entry) => entry.objectInstanceId === authoredObjectInstanceId('test_rug_placement'))).toMatchObject({ authoredPlacementId: 'test_rug_placement', slotId: 'test_rug_slot', objectDefId: 'test_rug_def', variantId: 'woven', assetId: 'test_rug_a', depth: 5 });
    expect(viewA.filter((entry) => entry.objectDefId === 'test_bed_def')).toHaveLength(2);
    const viewB = projectFixtureVisuals('test_view_b', state, graph, catalog);
    expect(viewB.filter((entry) => entry.objectDefId === 'test_bed_def')).toHaveLength(2);
    expect(viewB.filter((entry) => entry.objectDefId === 'test_bed_def').every((entry) => entry.assetId === 'test_bed_basic_b')).toBe(true);
    expect(viewB.every((entry) => entry.objectInstanceId.startsWith('authored:'))).toBe(true);
  });

  it('changes only one concrete fixture visual when same-definition fixtures coexist', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const targetId = authoredObjectInstanceId('test_bed_placement');
    const otherId = authoredObjectInstanceId('test_bed_placement_alt');
    const selections = selectFixtureVisualVariant({}, targetId, 'test_bed_def', 'upgraded', catalog);
    const projected = projectFixtureVisuals('test_view_a', state, graph, catalog, selections);
    expect(projected.find((entry) => entry.objectInstanceId === targetId)).toMatchObject({ authoredPlacementId: 'test_bed_placement', slotId: 'test_bed_slot', variantId: 'upgraded', assetId: 'test_bed_upgraded_a' });
    expect(projected.find((entry) => entry.objectInstanceId === otherId)).toMatchObject({ variantId: 'basic', assetId: 'test_bed_basic_a' });
    expect(state.objects[targetId]?.objectDefId).toBe('test_bed_def');
    expect(state.objects[otherId]?.objectDefId).toBe('test_bed_def');
  });

  it('fails closed for unknown variants and missing view art without mutating state', () => {
    expect(() => selectFixtureVisualVariant({}, authoredObjectInstanceId('test_bed_placement'), 'test_bed_def', 'missing', catalog)).toThrow('Unknown fixture visual variant missing for test_bed_def.');
    const state = materializeAuthoredPhysicalObjects(graph);
    const before = structuredClone(state);
    expect(projectFixtureVisuals('test_view_missing', state, graph, catalog)).toEqual([]);
    expect(state).toEqual(before);
  });

  it('follows generic physical placement state instead of owning a second placement graph', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const moved = movePhysicalObject(state, authoredObjectInstanceId('test_rug_placement'), 'test_rug_slot_alt', graph);
    const projected = projectFixtureVisuals('test_view_a', moved, graph, catalog);
    expect(projected.find((entry) => entry.objectDefId === 'test_rug_def')).toMatchObject({ objectInstanceId: authoredObjectInstanceId('test_rug_placement'), slotId: 'test_rug_slot_alt' });
  });

  it('keeps nested desk/chair visuals on the same physical identities and affordance authority', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const deskId = authoredObjectInstanceId('test_desk_placement');
    const chairId = authoredObjectInstanceId('test_chair_placement');
    const projected = projectFixtureVisuals('test_view_b', state, graph, catalog);

    expect(projected.find((entry) => entry.objectInstanceId === deskId)).toMatchObject({ slotId: 'test_desk_slot', assetId: 'test_desk_b' });
    expect(projected.find((entry) => entry.objectInstanceId === chairId)).toMatchObject({ slotId: 'test_chair_nested_slot', assetId: 'test_chair_b' });
    expect(getReachableAffordances('test_space', state, graph)).toEqual(expect.arrayContaining([
      { objectInstanceId: deskId, affordance: 'use' },
      { objectInstanceId: chairId, affordance: 'sit' },
    ]));
  });
});
