import { describe, expect, it } from 'vitest';
import type { PlayerInventoryState } from './types';
import type { PhysicalWorldState } from './PhysicalItemEngine';
import { bridgeOwnedInventoryIntoPhysicalWorld } from './PhysicalItemBridge';

const inventory: PlayerInventoryState = {
  purchaseCounts: {},
  items: [
    { instanceId: 'part-1', catalogItemId: 'cpu_basic', kind: 'hardware', location: 'room_package' },
    { instanceId: 'disc-1', catalogItemId: 'orion_disc', kind: 'media', location: 'inserted' },
  ],
};

const emptyPhysical: PhysicalWorldState = {
  items: {},
  containers: {
    'player-inventory': { instanceId: 'player-inventory', definitionId: 'player_inventory' },
  },
};

describe('bridgeOwnedInventoryIntoPhysicalWorld', () => {
  it('preserves legacy instance identity and maps owned items into physical locations without duplicates', () => {
    const bridged = bridgeOwnedInventoryIntoPhysicalWorld(emptyPhysical, inventory);

    expect(Object.keys(bridged.items).sort()).toEqual(['disc-1', 'part-1']);
    expect(bridged.items['part-1']).toMatchObject({
      instanceId: 'part-1',
      definitionId: 'cpu_basic',
      location: { kind: 'worldAnchor', anchorId: 'room104:hardware-package' },
    });
    expect(bridged.items['disc-1']).toMatchObject({
      instanceId: 'disc-1',
      definitionId: 'orion_disc',
      location: { kind: 'installed', hostInstanceId: 'computer:primary', slotId: 'media:inserted' },
    });
  });

  it('is idempotent for already-bridged instance IDs and rejects identity conflicts', () => {
    const once = bridgeOwnedInventoryIntoPhysicalWorld(emptyPhysical, inventory);
    expect(bridgeOwnedInventoryIntoPhysicalWorld(once, inventory)).toEqual(once);

    const conflicting: PhysicalWorldState = {
      ...once,
      items: {
        ...once.items,
        'part-1': { ...once.items['part-1']!, definitionId: 'different-definition' },
      },
    };

    expect(() => bridgeOwnedInventoryIntoPhysicalWorld(conflicting, inventory)).toThrow(/identity conflict/i);
  });

  it('maps ordinary inventory ownership to the canonical player container', () => {
    const carried: PlayerInventoryState = {
      purchaseCounts: {},
      items: [{ instanceId: 'book-1', catalogItemId: 'book', kind: 'media', location: 'inventory' }],
    };

    const bridged = bridgeOwnedInventoryIntoPhysicalWorld(emptyPhysical, carried);
    expect(bridged.items['book-1']?.location).toEqual({
      kind: 'container',
      containerInstanceId: 'player-inventory',
    });
  });
});
