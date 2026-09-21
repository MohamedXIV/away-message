import { describe, expect, it } from 'vitest';
import { ResidenceTenancy } from '../../src/engine/ResidenceTenancy';
import { commitHousingMove, type HousingOffer } from '../../src/engine/residence/HousingProgression';
import {
  getReachableAffordances,
  resolveContextRequirements,
  resolvePlaceDeliveryTarget,
  type PhysicalObjectRuntimeState,
  type PhysicalRuntimeGraph,
  type PlaceServicePolicy,
} from '../../src/engine/physical/PhysicalContextRuntime';
import type { PhysicalWorldState } from '../../src/engine/PhysicalItemEngine';
import type { GeneratedPhysicalObjectDef, GeneratedPlacementSlotDef } from '../../src/engine/worldContent.generated';

describe('HousingProgression cross-authority consumers', () => {
  const workSurface: GeneratedPhysicalObjectDef = {
    id: 'test_owned_work_surface',
    name: 'Owned work surface',
    kind: 'furniture',
    containerId: null,
    affordances: ['inspect', 'use_terminal'],
    toolCapabilities: ['work_surface'],
    resourceCapabilities: ['power'],
    tags: [],
  };
  const oldFixture: GeneratedPhysicalObjectDef = {
    id: 'test_old_property_fixture',
    name: 'Old property fixture',
    kind: 'furniture',
    containerId: null,
    affordances: ['old_fixture_action'],
    toolCapabilities: ['old_property_tool'],
    resourceCapabilities: [],
    tags: [],
  };
  const slots: GeneratedPlacementSlotDef[] = [
    { id: 'old_owned_slot', name: 'Old owned slot', spaceId: 'test_old_space', anchorId: 'old_owned_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['furniture'], tags: [] },
    { id: 'old_fixture_slot', name: 'Old fixture slot', spaceId: 'test_old_space', anchorId: 'old_fixture_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['furniture'], tags: [] },
    { id: 'new_owned_slot', name: 'New owned slot', spaceId: 'test_new_space', anchorId: 'new_owned_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['furniture'], tags: [] },
    { id: 'new_delivery_slot', name: 'New delivery slot', spaceId: 'test_new_space', anchorId: 'new_delivery_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: [], tags: [] },
  ];
  const graph: PhysicalRuntimeGraph = { objectDefs: [workSurface, oldFixture], slots, placements: [] };
  const state: PhysicalObjectRuntimeState = {
    objects: {
      owned_terminal_desk_17: { instanceId: 'owned_terminal_desk_17', objectDefId: 'test_owned_work_surface', location: { kind: 'slot', slotId: 'old_owned_slot' } },
      old_property_fixture_3: { instanceId: 'old_property_fixture_3', objectDefId: 'test_old_property_fixture', location: { kind: 'slot', slotId: 'old_fixture_slot' } },
    },
  };
  const offer: HousingOffer = {
    id: 'offer_new_home',
    placeId: 'test_new_home',
    available: true,
    monthlyRent: 80,
    moveInCost: 25,
  };
  const policies: PlaceServicePolicy[] = [
    { placeId: 'test_old_home', acceptsDelivery: false, deliveryTargetSlotId: null },
    { placeId: 'test_new_home', acceptsDelivery: true, deliveryTargetSlotId: 'new_delivery_slot' },
  ];
  const physicalWorld: PhysicalWorldState = { items: {}, containers: {} };

  it('makes existing physical and service authorities observe the new canonical home after moving', () => {
    const residence = new ResidenceTenancy({ currentResidencePlaceId: 'test_old_home', tenancyId: 'tenancy_old', moveInMinute: 10, currentRent: 40 });
    const result = commitHousingMove({
      offer,
      residence,
      tenancyId: 'tenancy_new',
      moveInMinute: 500,
      spendMoveInCost: () => true,
      setRecurringRentAmount: () => {},
      physicalState: state,
      physicalGraph: graph,
      moves: [{ objectInstanceId: 'owned_terminal_desk_17', targetSlotId: 'new_owned_slot' }],
      isPlayerOwnedObject: (id) => id === 'owned_terminal_desk_17',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const homePlaceId = residence.resolveHomePlaceId();
    expect(homePlaceId).toBe('test_new_home');

    expect(getReachableAffordances('test_new_space', result.physicalState, graph)).toEqual([
      { objectInstanceId: 'owned_terminal_desk_17', affordance: 'inspect' },
      { objectInstanceId: 'owned_terminal_desk_17', affordance: 'use_terminal' },
    ]);
    expect(getReachableAffordances('test_old_space', result.physicalState, graph)).toEqual([
      { objectInstanceId: 'old_property_fixture_3', affordance: 'old_fixture_action' },
    ]);

    expect(resolveContextRequirements({
      spaceId: 'test_new_space',
      objectState: result.physicalState,
      graph,
      physicalWorld,
      itemDefinitions: {},
      playerInventoryContainerId: 'test_player_inventory',
      requirements: [
        { kind: 'tool', capability: 'work_surface' },
        { kind: 'resource', capability: 'power' },
      ],
    })).toEqual({
      ok: true,
      bindings: [
        { kind: 'tool', capability: 'work_surface', objectInstanceId: 'owned_terminal_desk_17' },
        { kind: 'resource', capability: 'power', objectInstanceId: 'owned_terminal_desk_17' },
      ],
    });
    expect(resolveContextRequirements({
      spaceId: 'test_old_space',
      objectState: result.physicalState,
      graph,
      physicalWorld,
      itemDefinitions: {},
      playerInventoryContainerId: 'test_player_inventory',
      requirements: [{ kind: 'tool', capability: 'work_surface' }],
    })).toEqual({ ok: false, missing: [{ kind: 'tool', capability: 'work_surface' }] });

    const delivery = resolvePlaceDeliveryTarget(homePlaceId!, policies, graph);
    expect(delivery).toEqual({
      ok: true,
      location: { kind: 'worldAnchor', anchorId: 'new_delivery_anchor' },
      slotId: 'new_delivery_slot',
    });
    expect(resolvePlaceDeliveryTarget('test_old_home', policies, graph)).toEqual({
      ok: false,
      reason: 'delivery_not_accepted',
    });
  });
});
