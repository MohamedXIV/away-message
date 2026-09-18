import { describe, expect, it } from 'vitest';
import type {
  GeneratedPhysicalObjectDef,
  GeneratedPlacementSlotDef,
  GeneratedObjectPlacementDef,
} from '../../src/engine/worldContent.generated';
import type {
  PhysicalItemDefinition,
  PhysicalWorldState,
} from '../../src/engine/PhysicalItemEngine';
import {
  authoredObjectInstanceId,
  detachPhysicalObject,
  getReachableAffordances,
  getReachablePhysicalObjects,
  materializeAuthoredPhysicalObjects,
  movePhysicalObject,
  resolveContextRequirements,
  resolvePlaceDeliveryTarget,
  type PhysicalRuntimeGraph,
  type PlaceServicePolicy,
} from '../../src/engine/physical/PhysicalContextRuntime';

const objectDefs: GeneratedPhysicalObjectDef[] = [
  {
    id: 'bench_def',
    name: 'Workbench',
    kind: 'furniture',
    containerId: null,
    affordances: ['inspect'],
    toolCapabilities: ['work_surface'],
    resourceCapabilities: ['power'],
    tags: ['work'],
  },
  {
    id: 'drawer_def',
    name: 'Drawer',
    kind: 'storage',
    containerId: 'storage_def',
    affordances: ['open'],
    toolCapabilities: [],
    resourceCapabilities: [],
    tags: ['storage'],
  },
];

const slots: GeneratedPlacementSlotDef[] = [
  {
    id: 'bench_slot_a',
    name: 'Bench A',
    spaceId: 'space_alpha',
    anchorId: 'anchor_alpha',
    parentPlacementId: null,
    slotKind: 'floor',
    allowedObjectKinds: ['furniture'],
    tags: [],
  },
  {
    id: 'drawer_slot',
    name: 'Drawer Slot',
    spaceId: null,
    anchorId: null,
    parentPlacementId: 'bench_placement',
    slotKind: 'nested',
    allowedObjectKinds: ['storage'],
    tags: [],
  },
  {
    id: 'bench_slot_b',
    name: 'Bench B',
    spaceId: 'space_beta',
    anchorId: 'anchor_beta',
    parentPlacementId: null,
    slotKind: 'floor',
    allowedObjectKinds: ['furniture'],
    tags: [],
  },
  {
    id: 'drop_slot',
    name: 'Delivery Target',
    spaceId: 'space_alpha',
    anchorId: 'delivery_anchor',
    parentPlacementId: null,
    slotKind: 'delivery',
    allowedObjectKinds: [],
    tags: ['delivery'],
  },
];

const placements: GeneratedObjectPlacementDef[] = [
  {
    id: 'bench_placement',
    objectDefId: 'bench_def',
    slotId: 'bench_slot_a',
  },
  {
    id: 'drawer_placement',
    objectDefId: 'drawer_def',
    slotId: 'drawer_slot',
  },
];

const graph: PhysicalRuntimeGraph = { objectDefs, slots, placements };

const itemDefinitions: Record<string, PhysicalItemDefinition> = {
  apple: { id: 'apple', kind: 'food', portable: true, volume: 1 },
};

function physicalWorld(): PhysicalWorldState {
  return {
    items: {
      'item-player': {
        instanceId: 'item-player',
        definitionId: 'apple',
        location: { kind: 'container', containerInstanceId: 'player-bag' },
      },
      'item-local': {
        instanceId: 'item-local',
        definitionId: 'apple',
        location: {
          kind: 'container',
          containerInstanceId: authoredObjectInstanceId('drawer_placement'),
        },
      },
    },
    containers: {
      'player-bag': { instanceId: 'player-bag', definitionId: 'player_inventory' },
      [authoredObjectInstanceId('drawer_placement')]: {
        instanceId: authoredObjectInstanceId('drawer_placement'),
        definitionId: 'storage_def',
      },
    },
  };
}

describe('generic physical context runtime (#103)', () => {
  it('materializes authored placements as exact runtime identities and resolves nested reachability', () => {
    const state = materializeAuthoredPhysicalObjects(graph);

    expect(state.objects).toEqual({
      [authoredObjectInstanceId('bench_placement')]: {
        instanceId: authoredObjectInstanceId('bench_placement'),
        objectDefId: 'bench_def',
        authoredPlacementId: 'bench_placement',
        location: { kind: 'slot', slotId: 'bench_slot_a' },
      },
      [authoredObjectInstanceId('drawer_placement')]: {
        instanceId: authoredObjectInstanceId('drawer_placement'),
        objectDefId: 'drawer_def',
        authoredPlacementId: 'drawer_placement',
        location: { kind: 'slot', slotId: 'drawer_slot' },
      },
    });

    expect(getReachablePhysicalObjects('space_alpha', state, graph).map((object) => object.instanceId))
      .toEqual([
        authoredObjectInstanceId('bench_placement'),
        authoredObjectInstanceId('drawer_placement'),
      ]);
  });

  it('exposes direct affordances from concrete reachable objects only', () => {
    const state = materializeAuthoredPhysicalObjects(graph);

    expect(getReachableAffordances('space_alpha', state, graph)).toEqual([
      {
        objectInstanceId: authoredObjectInstanceId('bench_placement'),
        affordance: 'inspect',
      },
      {
        objectInstanceId: authoredObjectInstanceId('drawer_placement'),
        affordance: 'open',
      },
    ]);
    expect(getReachableAffordances('space_beta', state, graph)).toEqual([]);
  });

  it('moving a parent object moves its nested providers without changing exact identity', () => {
    const initial = materializeAuthoredPhysicalObjects(graph);
    const moved = movePhysicalObject(
      initial,
      authoredObjectInstanceId('bench_placement'),
      'bench_slot_b',
      graph,
    );

    expect(moved.objects[authoredObjectInstanceId('bench_placement')]?.instanceId)
      .toBe(authoredObjectInstanceId('bench_placement'));
    expect(getReachablePhysicalObjects('space_alpha', moved, graph)).toEqual([]);
    expect(getReachablePhysicalObjects('space_beta', moved, graph).map((object) => object.instanceId))
      .toEqual([
        authoredObjectInstanceId('bench_placement'),
        authoredObjectInstanceId('drawer_placement'),
      ]);
  });

  it('detaching an object removes the affordances/providers it supplied', () => {
    const initial = materializeAuthoredPhysicalObjects(graph);
    const detached = detachPhysicalObject(
      initial,
      authoredObjectInstanceId('bench_placement'),
      graph,
    );

    expect(getReachableAffordances('space_alpha', detached, graph)).toEqual([]);
  });

  it('composes exact items plus semantic tool/resource providers without merging inventories', () => {
    const state = materializeAuthoredPhysicalObjects(graph);
    const world = physicalWorld();
    const before = structuredClone(world);

    const resolved = resolveContextRequirements({
      spaceId: 'space_alpha',
      objectState: state,
      graph,
      physicalWorld: world,
      itemDefinitions,
      playerInventoryContainerId: 'player-bag',
      requirements: [
        { kind: 'item', itemKind: 'food', quantity: 2 },
        { kind: 'tool', capability: 'work_surface' },
        { kind: 'resource', capability: 'power' },
      ],
    });

    expect(resolved).toEqual({
      ok: true,
      bindings: [
        {
          kind: 'item',
          itemInstanceIds: ['item-local', 'item-player'],
        },
        {
          kind: 'tool',
          capability: 'work_surface',
          objectInstanceId: authoredObjectInstanceId('bench_placement'),
        },
        {
          kind: 'resource',
          capability: 'power',
          objectInstanceId: authoredObjectInstanceId('bench_placement'),
        },
      ],
    });
    expect(world).toEqual(before);
  });

  it('fails missing requirements cleanly and detached local containers stop contributing items', () => {
    const initial = materializeAuthoredPhysicalObjects(graph);
    const detachedDrawer = detachPhysicalObject(
      initial,
      authoredObjectInstanceId('drawer_placement'),
      graph,
    );

    const resolved = resolveContextRequirements({
      spaceId: 'space_alpha',
      objectState: detachedDrawer,
      graph,
      physicalWorld: physicalWorld(),
      itemDefinitions,
      playerInventoryContainerId: 'player-bag',
      requirements: [{ kind: 'item', itemKind: 'food', quantity: 2 }],
    });

    expect(resolved).toEqual({
      ok: false,
      missing: [{ kind: 'item', itemKind: 'food', quantity: 1 }],
    });
  });

  it('resolves delivery only through an explicit Place policy and concrete authored target', () => {
    const policies: PlaceServicePolicy[] = [
      {
        placeId: 'place_alpha',
        acceptsDelivery: true,
        deliveryTargetSlotId: 'drop_slot',
      },
      {
        placeId: 'place_beta',
        acceptsDelivery: false,
        deliveryTargetSlotId: null,
      },
    ];

    expect(resolvePlaceDeliveryTarget('place_alpha', policies, graph)).toEqual({
      ok: true,
      location: { kind: 'worldAnchor', anchorId: 'delivery_anchor' },
      slotId: 'drop_slot',
    });
    expect(resolvePlaceDeliveryTarget('place_beta', policies, graph)).toEqual({
      ok: false,
      reason: 'delivery_not_accepted',
    });
    expect(resolvePlaceDeliveryTarget('missing_place', policies, graph)).toEqual({
      ok: false,
      reason: 'missing_place_policy',
    });
  });
});
