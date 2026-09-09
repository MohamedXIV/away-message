import { describe, expect, it } from 'vitest';
import {
  InventoryEngine,
  type HardwareInstallSlot,
  type SlottedOwnedItem,
} from '../../src/engine/InventoryEngine';
import type { OwnedItem, PlayerInventoryState } from '../../src/engine/types';

type ExactHardwareInstallApi = InventoryEngine & {
  installOwnedHardware(instanceId: string, slot: HardwareInstallSlot): { displacedInstanceId: string | null };
};

function owned(
  instanceId: string,
  catalogItemId: string,
  kind: OwnedItem['kind'] = 'hardware',
  location: OwnedItem['location'] = 'room_package',
  installSlot?: HardwareInstallSlot,
): SlottedOwnedItem {
  return { instanceId, catalogItemId, kind, location, ...(installSlot ? { installSlot } : {}) };
}

function inventoryWith(items: SlottedOwnedItem[]): ExactHardwareInstallApi {
  return new InventoryEngine({ items } as Partial<PlayerInventoryState>) as ExactHardwareInstallApi;
}

function slottedItems(inventory: InventoryEngine): SlottedOwnedItem[] {
  return inventory.getState().items as SlottedOwnedItem[];
}

describe('InventoryEngine exact owned hardware installation', () => {
  it('moves one exact at-home instance into a compatible installed slot', () => {
    const inventory = inventoryWith([
      owned('ram-a', 'ram_sdram_64'),
      owned('ram-b', 'ram_sdram_128'),
    ]);

    expect(inventory.installOwnedHardware('ram-a', 'ram:0')).toEqual({ displacedInstanceId: null });

    expect(slottedItems(inventory)).toEqual([
      owned('ram-a', 'ram_sdram_64', 'hardware', 'installed', 'ram:0'),
      owned('ram-b', 'ram_sdram_128'),
    ]);
  });

  it('atomically swaps an occupied slot back to the at-home package without duplication', () => {
    const inventory = inventoryWith([
      owned('ram-a', 'ram_sdram_64', 'hardware', 'installed', 'ram:0'),
      owned('ram-b', 'ram_sdram_128'),
    ]);

    expect(inventory.installOwnedHardware('ram-b', 'ram:0')).toEqual({ displacedInstanceId: 'ram-a' });

    expect(slottedItems(inventory)).toEqual([
      owned('ram-a', 'ram_sdram_64'),
      owned('ram-b', 'ram_sdram_128', 'hardware', 'installed', 'ram:0'),
    ]);
    expect(new Set(slottedItems(inventory).map((item) => item.instanceId)).size).toBe(2);
  });

  it('rejects missing, not-at-home, or incompatible instances without mutating inventory', () => {
    const inventory = inventoryWith([
      owned('ram-a', 'ram_sdram_64', 'hardware', 'installed', 'ram:0'),
      owned('disk-a', 'hdd_10gb'),
    ]);
    const before = inventory.getState();

    expect(() => inventory.installOwnedHardware('missing', 'ram:1')).toThrow(/missing|owned/i);
    expect(() => inventory.installOwnedHardware('ram-a', 'ram:1')).toThrow(/room_package|room package|at-home/i);
    expect(() => inventory.installOwnedHardware('disk-a', 'ram:1')).toThrow(/compatible|ram/i);
    expect(inventory.getState()).toEqual(before);
  });
});
