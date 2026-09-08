import { describe, expect, it } from 'vitest';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { migrateSnapshotToV6 } from '../../src/persistence/migrations/v6ComputerState';
import type { OwnedItemKind, PlayerInventoryState } from '../../src/engine/types';
import type { StoreSkuContent } from '../../src/engine/hardware/types';

type PreparedPurchase = {
  skuId: string;
  purchaseOrdinal: number;
  items: Array<{
    instanceId: string;
    catalogItemId: string;
    kind: OwnedItemKind;
    location: string;
  }>;
  consumeLegacyStarterRecovery: boolean;
};

type InventoryPurchaseApi = InventoryEngine & {
  canPurchaseSku: (skuId: string, repeatable: boolean) => { ok: boolean; error?: string };
  preparePurchase: (
    skuId: string,
    contents: readonly StoreSkuContent[],
    catalogKinds: Readonly<Record<string, OwnedItemKind>>,
    options?: { consumeLegacyStarterRecovery?: boolean; location?: string },
  ) => PreparedPurchase;
  commitPurchase: (prepared: PreparedPurchase) => void;
  canClaimLegacyStarterRecovery: () => boolean;
};

function api(inventory: InventoryEngine): InventoryPurchaseApi {
  return inventory as InventoryPurchaseApi;
}

function stateWithCounts(inventory: InventoryEngine): PlayerInventoryState & { purchaseCounts?: Record<string, number> } {
  return inventory.getState() as PlayerInventoryState & { purchaseCounts?: Record<string, number> };
}

describe('InventoryEngine deterministic store ownership', () => {
  it('backfills an empty purchase-count ledger for fresh and early-v6 inventories', () => {
    expect(stateWithCounts(new InventoryEngine()).purchaseCounts).toEqual({});
    expect(stateWithCounts(new InventoryEngine({ items: [] })).purchaseCounts).toEqual({});
  });

  it('prepares stable purchase instances without mutating ownership', () => {
    const inventory = new InventoryEngine();
    const store = api(inventory);
    expect(typeof store.preparePurchase).toBe('function');

    const prepared = store.preparePurchase(
      'part_ram_64mb',
      [{ catalogItemId: 'ram_sdram_64', quantity: 1 }],
      { ram_sdram_64: 'hardware' },
      { location: 'room_package' },
    );

    expect(stateWithCounts(inventory).items).toHaveLength(0);
    expect(stateWithCounts(inventory).purchaseCounts).toEqual({});
    expect(prepared.purchaseOrdinal).toBe(1);
    expect(prepared.items).toEqual([
      {
        instanceId: 'purchase:part_ram_64mb:1:ram_sdram_64:1',
        catalogItemId: 'ram_sdram_64',
        kind: 'hardware',
        location: 'room_package',
      },
    ]);
  });

  it('commits exactly one purchase ordinal and gives repeatable SKUs a new identity next time', () => {
    const inventory = new InventoryEngine();
    const store = api(inventory);
    expect(typeof store.commitPurchase).toBe('function');
    expect(typeof store.canPurchaseSku).toBe('function');

    const first = store.preparePurchase(
      'part_ram_64mb',
      [{ catalogItemId: 'ram_sdram_64', quantity: 1 }],
      { ram_sdram_64: 'hardware' },
      { location: 'room_package' },
    );
    store.commitPurchase(first);

    expect(stateWithCounts(inventory).purchaseCounts).toEqual({ part_ram_64mb: 1 });
    expect(store.canPurchaseSku('part_ram_64mb', true)).toEqual({ ok: true });

    const second = store.preparePurchase(
      'part_ram_64mb',
      [{ catalogItemId: 'ram_sdram_64', quantity: 1 }],
      { ram_sdram_64: 'hardware' },
      { location: 'room_package' },
    );
    expect(second.purchaseOrdinal).toBe(2);
    expect(second.items[0]?.instanceId).toBe('purchase:part_ram_64mb:2:ram_sdram_64:1');
    store.commitPurchase(second);

    expect(stateWithCounts(inventory).purchaseCounts).toEqual({ part_ram_64mb: 2 });
    expect(stateWithCounts(inventory).items.map((item) => item.instanceId)).toEqual([
      'purchase:part_ram_64mb:1:ram_sdram_64:1',
      'purchase:part_ram_64mb:2:ram_sdram_64:1',
    ]);
  });

  it('rejects a second non-repeatable SKU after commit without allocating another ordinal', () => {
    const inventory = new InventoryEngine();
    const store = api(inventory);
    expect(typeof store.canPurchaseSku).toBe('function');

    const prepared = store.preparePurchase(
      'disc_orion_50',
      [{ catalogItemId: 'media_orion_50_setup', quantity: 1 }],
      { media_orion_50_setup: 'media' },
      { location: 'room_package' },
    );
    store.commitPurchase(prepared);

    expect(store.canPurchaseSku('disc_orion_50', false).ok).toBe(false);
    expect(stateWithCounts(inventory).purchaseCounts?.disc_orion_50).toBe(1);
  });

  it('consumes the migrated starter recovery only when its prepared grant commits', () => {
    const inventory = new InventoryEngine({
      items: [],
      legacyRecovery: { starterBundlePurchaseLost: true, consumed: false },
    });
    const store = api(inventory);
    expect(typeof store.canClaimLegacyStarterRecovery).toBe('function');
    expect(store.canClaimLegacyStarterRecovery()).toBe(true);

    const prepared = store.preparePurchase(
      'bundle_scrapyard',
      [{ catalogItemId: 'cpu_celeron_366', quantity: 1 }],
      { cpu_celeron_366: 'hardware' },
      { consumeLegacyStarterRecovery: true, location: 'room_package' },
    );

    expect(inventory.getState().legacyRecovery?.consumed).toBe(false);
    expect(store.canClaimLegacyStarterRecovery()).toBe(true);

    store.commitPurchase(prepared);
    expect(inventory.getState().legacyRecovery?.consumed).toBe(true);
    expect(store.canClaimLegacyStarterRecovery()).toBe(false);
  });

  it('backfills purchaseCounts during a v5-to-v6 migration', () => {
    const legacyLike = new SimulationEngine().exportSnapshot();
    const migrated = migrateSnapshotToV6(legacyLike, 5) as typeof legacyLike & {
      inventory: PlayerInventoryState & { purchaseCounts?: Record<string, number> };
    };

    expect(migrated.inventory.purchaseCounts).toEqual({});
  });
});
