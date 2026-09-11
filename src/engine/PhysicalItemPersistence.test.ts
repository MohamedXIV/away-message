import { describe, expect, it } from 'vitest';
import { SimulationEngine } from './SimulationEngine';
import type { PlayerInventoryState } from './types';

const legacyInventory: PlayerInventoryState = {
  purchaseCounts: {},
  items: [
    {
      instanceId: 'media-save-1',
      catalogItemId: 'media_orion_48_setup',
      kind: 'media',
      location: 'inventory',
    },
  ],
};

describe('physical-world persistence', () => {
  it('hydrates legacy v6 ownership into canonical physical state and preserves exact identity across export/reload', () => {
    const first = new SimulationEngine({ inventory: legacyInventory });
    const snapshot = first.exportSnapshot();

    expect(snapshot.physicalWorld.items['media-save-1']).toEqual({
      instanceId: 'media-save-1',
      definitionId: 'media_orion_48_setup',
      location: { kind: 'container', containerInstanceId: 'player-inventory' },
    });

    const reloaded = new SimulationEngine(snapshot).exportSnapshot();
    expect(reloaded.physicalWorld).toEqual(snapshot.physicalWorld);
    expect(Object.keys(reloaded.physicalWorld.items)).toEqual(['media-save-1']);
  });

  it('treats persisted physical state as location authority instead of re-projecting a conflicting legacy location', () => {
    const first = new SimulationEngine({ inventory: legacyInventory });
    const snapshot = first.exportSnapshot();
    snapshot.physicalWorld.items['media-save-1']!.location = {
      kind: 'worldAnchor',
      anchorId: 'room104:desk',
    };

    const reloaded = new SimulationEngine(snapshot).exportSnapshot();
    expect(reloaded.physicalWorld.items['media-save-1']?.location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room104:desk',
    });
    expect(reloaded.inventory.items).toHaveLength(1);
  });

  it('owns authoritative physical transfers through the SimulationEngine facade and persists the exact result', () => {
    const simulation = new SimulationEngine({ inventory: legacyInventory });

    simulation.transferPhysicalItem('media-save-1', {
      kind: 'worldAnchor',
      anchorId: 'room104:desk',
    });

    expect(simulation.getPhysicalWorldState().items['media-save-1']?.location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room104:desk',
    });
    expect(simulation.exportSnapshot().physicalWorld.items['media-save-1']?.location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room104:desk',
    });
  });

  it('rejects invalid facade transfers atomically without mutating canonical physical state', () => {
    const simulation = new SimulationEngine({ inventory: legacyInventory });
    const before = simulation.getPhysicalWorldState();

    expect(() =>
      simulation.transferPhysicalItem('media-save-1', {
        kind: 'container',
        containerInstanceId: 'missing-container',
      }),
    ).toThrow(/container/i);

    expect(simulation.getPhysicalWorldState()).toEqual(before);
    expect(simulation.exportSnapshot().physicalWorld).toEqual(before);
  });

  it('uses generated non-PC definitions through the same facade and preserves the moved instance on reload', () => {
    const simulation = new SimulationEngine({
      physicalWorld: {
        items: {
          'generic-item-1': {
            instanceId: 'generic-item-1',
            definitionId: 'item_a',
            location: { kind: 'worldAnchor', anchorId: 'anchor_a1' },
          },
        },
        containers: {
          'player-inventory': {
            instanceId: 'player-inventory',
            definitionId: 'player_inventory',
          },
          'generic-container-1': {
            instanceId: 'generic-container-1',
            definitionId: 'container_a',
          },
        },
      },
    });

    simulation.transferPhysicalItem('generic-item-1', {
      kind: 'container',
      containerInstanceId: 'generic-container-1',
    });

    const snapshot = simulation.exportSnapshot();
    expect(snapshot.physicalWorld.items['generic-item-1']?.location).toEqual({
      kind: 'container',
      containerInstanceId: 'generic-container-1',
    });

    const reloaded = new SimulationEngine(snapshot);
    expect(reloaded.getPhysicalWorldState().items['generic-item-1']?.location).toEqual({
      kind: 'container',
      containerInstanceId: 'generic-container-1',
    });
    expect(Object.keys(reloaded.getPhysicalWorldState().items)).toEqual(['generic-item-1']);
  });
});
