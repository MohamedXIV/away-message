import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { authoredObjectInstanceId } from '../../src/engine/physical/PhysicalContextRuntime';

const workbenchId = authoredObjectInstanceId('fixture_workbench_placement');
const drawerId = authoredObjectInstanceId('fixture_drawer_placement');

describe('SimulationEngine physical context integration (#103)', () => {
  it('materializes generated placements as exact object identities with nested affordances', () => {
    const sim = new SimulationEngine();

    expect(sim.getPhysicalObjectState()).toEqual({
      objects: {
        [drawerId]: {
          instanceId: drawerId,
          objectDefId: 'fixture_drawer_def',
          authoredPlacementId: 'fixture_drawer_placement',
          location: { kind: 'slot', slotId: 'fixture_drawer_slot' },
        },
        [workbenchId]: {
          instanceId: workbenchId,
          objectDefId: 'fixture_workbench_def',
          authoredPlacementId: 'fixture_workbench_placement',
          location: { kind: 'slot', slotId: 'fixture_workbench_slot' },
        },
      },
    });

    expect(sim.getReachablePhysicalAffordances('space_a1')).toEqual([
      { objectInstanceId: drawerId, affordance: 'open' },
      { objectInstanceId: workbenchId, affordance: 'inspect' },
    ]);

    expect(sim.getPhysicalWorldState().containers[drawerId]).toEqual({
      instanceId: drawerId,
      definitionId: 'container_a',
    });
  });

  it('composes exact local items and semantic providers without merging inventories', () => {
    const sim = new SimulationEngine({
      physicalWorld: {
        items: {
          'local-food-1': {
            instanceId: 'local-food-1',
            definitionId: 'item_a',
            location: { kind: 'container', containerInstanceId: drawerId },
          },
        },
        containers: {
          'player-inventory': {
            instanceId: 'player-inventory',
            definitionId: 'player_inventory',
          },
        },
      },
    });

    const before = sim.getPhysicalWorldState();
    expect(
      sim.resolvePhysicalContextRequirements('space_a1', [
        { kind: 'item', itemKind: 'food', quantity: 1 },
        { kind: 'tool', capability: 'work_surface' },
        { kind: 'resource', capability: 'power' },
      ]),
    ).toEqual({
      ok: true,
      bindings: [
        { kind: 'item', itemInstanceIds: ['local-food-1'] },
        {
          kind: 'tool',
          capability: 'work_surface',
          objectInstanceId: workbenchId,
        },
        {
          kind: 'resource',
          capability: 'power',
          objectInstanceId: workbenchId,
        },
      ],
    });
    expect(sim.getPhysicalWorldState()).toEqual(before);
  });

  it('detaching a parent removes nested local providers and persists the exact state across reload', () => {
    const sim = new SimulationEngine({
      physicalWorld: {
        items: {
          'local-food-1': {
            instanceId: 'local-food-1',
            definitionId: 'item_a',
            location: { kind: 'container', containerInstanceId: drawerId },
          },
        },
        containers: {
          'player-inventory': {
            instanceId: 'player-inventory',
            definitionId: 'player_inventory',
          },
        },
      },
    });

    sim.detachPhysicalObject(workbenchId);

    expect(sim.getReachablePhysicalAffordances('space_a1')).toEqual([]);
    expect(
      sim.resolvePhysicalContextRequirements('space_a1', [
        { kind: 'item', itemKind: 'food', quantity: 1 },
        { kind: 'tool', capability: 'work_surface' },
      ]),
    ).toEqual({
      ok: false,
      missing: [
        { kind: 'item', itemKind: 'food', quantity: 1 },
        { kind: 'tool', capability: 'work_surface' },
      ],
    });

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine(snapshot);

    expect(restored.getPhysicalObjectState()).toEqual(snapshot.physicalObjects);
    expect(restored.getPhysicalObjectState().objects[workbenchId]).toEqual({
      instanceId: workbenchId,
      objectDefId: 'fixture_workbench_def',
      authoredPlacementId: 'fixture_workbench_placement',
      location: { kind: 'detached' },
    });
    expect(restored.getReachablePhysicalAffordances('space_a1')).toEqual([]);
    expect(restored.getPhysicalWorldState().items['local-food-1']?.location).toEqual({
      kind: 'container',
      containerInstanceId: drawerId,
    });
  });
});
