import { describe, expect, it } from 'vitest';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import type { OwnedItem, PlayerInventoryState } from '../../src/engine/types';

type PreparedInventoryInstall = {
  instanceIds: string[];
  sourceItems: OwnedItem[];
};

type InventoryInstallApi = InventoryEngine & {
  prepareInstallOwnedItems(instanceIds: readonly string[]): PreparedInventoryInstall;
  commitInstallOwnedItems(prepared: PreparedInventoryInstall): void;
};

function inventoryWith(items: OwnedItem[]): InventoryInstallApi {
  return new InventoryEngine({ items } as Partial<PlayerInventoryState>) as InventoryInstallApi;
}

function owned(instanceId: string, location: OwnedItem['location'] = 'room_package'): OwnedItem {
  return {
    instanceId,
    catalogItemId: `catalog:${instanceId}`,
    kind: 'hardware',
    location,
  };
}

describe('InventoryEngine owned-item installation transaction', () => {
  it('rejects a missing owned instance without mutating inventory', () => {
    const inventory = inventoryWith([owned('cpu')]);
    const before = inventory.getState();

    expect(() => inventory.prepareInstallOwnedItems(['cpu', 'missing'])).toThrow(/missing|owned/i);
    expect(inventory.getState()).toEqual(before);
  });

  it('rejects duplicate requested instance IDs without mutating inventory', () => {
    const inventory = inventoryWith([owned('cpu')]);
    const before = inventory.getState();

    expect(() => inventory.prepareInstallOwnedItems(['cpu', 'cpu'])).toThrow(/duplicate/i);
    expect(inventory.getState()).toEqual(before);
  });

  it('rejects items that are not currently in the room package', () => {
    const inventory = inventoryWith([owned('cpu', 'installed')]);
    const before = inventory.getState();

    expect(() => inventory.prepareInstallOwnedItems(['cpu'])).toThrow(/room_package|room package/i);
    expect(inventory.getState()).toEqual(before);
  });

  it('prepares without mutation and commits only the exact requested instances', () => {
    const inventory = inventoryWith([owned('cpu'), owned('ram'), owned('setup-cd')]);

    const prepared = inventory.prepareInstallOwnedItems(['cpu', 'ram']);
    expect(inventory.getState().items.map((item) => item.location)).toEqual([
      'room_package',
      'room_package',
      'room_package',
    ]);

    inventory.commitInstallOwnedItems(prepared);

    expect(inventory.getState().items).toEqual([
      owned('cpu', 'installed'),
      owned('ram', 'installed'),
      owned('setup-cd', 'room_package'),
    ]);
  });

  it('rejects a stale prepared transaction if an item moved before commit', () => {
    const inventory = inventoryWith([owned('cpu'), owned('ram')]);
    const prepared = inventory.prepareInstallOwnedItems(['cpu', 'ram']);

    inventory.loadState({
      ...inventory.getState(),
      items: [owned('cpu', 'installed'), owned('ram')],
    });
    const beforeCommit = inventory.getState();

    expect(() => inventory.commitInstallOwnedItems(prepared)).toThrow(/stale|room_package|room package/i);
    expect(inventory.getState()).toEqual(beforeCommit);
  });
});
