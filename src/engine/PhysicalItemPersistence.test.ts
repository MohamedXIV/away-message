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
});
