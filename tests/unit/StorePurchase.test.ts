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

type StorePurchaseResultData = {
  purchasedItemIds: string[];
  charged: number;
  recoveredLegacyPurchase: boolean;
};

function api(inventory: InventoryEngine): InventoryPurchaseApi {
  return inventory as InventoryPurchaseApi;
}

function stateWithCounts(inventory: InventoryEngine): PlayerInventoryState & { purchaseCounts?: Record<string, number> } {
  return inventory.getState() as PlayerInventoryState & { purchaseCounts?: Record<string, number> };
}

function buy(sim: SimulationEngine, skuId: string, storeId = 'silicon_spares') {
  return sim.dispatchAction({ type: 'STORE_PURCHASE_ITEM', storeId, skuId } as any);
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

describe('SimulationEngine atomic Silicon & Spares purchase', () => {
  it('charges $35 exactly once and grants all starter items without setting up a PC or OS', () => {
    const sim = new SimulationEngine();
    const beforeComputer = sim.getState().computer;
    const beforeDisplay = sim.getState().display;
    const beforeOs = sim.getState().os;

    const result = buy(sim, 'bundle_scrapyard');

    expect(result.success).toBe(true);
    expect(result.data as StorePurchaseResultData).toMatchObject({
      charged: 35,
      recoveredLegacyPurchase: false,
    });
    expect((result.data as StorePurchaseResultData).purchasedItemIds).toHaveLength(10);
    expect(sim.getState().player.cash).toBe(3);
    expect(sim.getState().inventory.items).toHaveLength(10);
    expect(sim.getState().inventory.items.every((item) => item.location === 'room_package')).toBe(true);
    expect(sim.getState().computer).toEqual(beforeComputer);
    expect(sim.getState().computer.assembled).toBe(false);
    expect(sim.getState().computer.poweredOn).toBe(false);
    expect(sim.getState().display).toEqual(beforeDisplay);
    expect(sim.getState().display.monitor).toBeNull();
    expect(sim.getState().os).toEqual(beforeOs);
    expect(sim.getState().os.currentOsId).toBeNull();
  });

  it('is fully atomic on insufficient cash', () => {
    const sim = new SimulationEngine({ player: { cash: 10 } } as any);
    const before = sim.exportSnapshot();

    const result = buy(sim, 'bundle_scrapyard');

    expect(result.success).toBe(false);
    expect(sim.getState().player.cash).toBe(10);
    expect(sim.getState().inventory).toEqual(before.inventory);
    expect(sim.getState().computer).toEqual(before.computer);
    expect(sim.getState().display).toEqual(before.display);
    expect(sim.getState().os).toEqual(before.os);
  });

  it.each(['part_ram_64mb', 'part_mon_trinitron', 'disc_orion_50'])(
    'purchase of %s creates ownership only',
    (skuId) => {
      const sim = new SimulationEngine({ player: { cash: 500 } } as any);
      const beforeComputer = sim.getState().computer;
      const beforeDisplay = sim.getState().display;
      const beforeOs = sim.getState().os;

      expect(buy(sim, skuId).success).toBe(true);
      expect(sim.getState().computer).toEqual(beforeComputer);
      expect(sim.getState().display).toEqual(beforeDisplay);
      expect(sim.getState().os).toEqual(beforeOs);
    },
  );

  it('rejects unknown stores and SKUs without changing cash or ownership', () => {
    const sim = new SimulationEngine({ player: { cash: 500 } } as any);
    const before = sim.exportSnapshot();

    expect(buy(sim, 'bundle_scrapyard', 'unknown_store').success).toBe(false);
    expect(buy(sim, 'not_a_real_sku').success).toBe(false);
    expect(sim.getState().player.cash).toBe(before.player.cash);
    expect(sim.getState().inventory).toEqual(before.inventory);
  });

  it('rejects a second non-repeatable starter without a second charge', () => {
    const sim = new SimulationEngine({ player: { cash: 100 } } as any);

    expect(buy(sim, 'bundle_scrapyard').success).toBe(true);
    const afterFirst = sim.exportSnapshot();
    const second = buy(sim, 'bundle_scrapyard');

    expect(second.success).toBe(false);
    expect(sim.getState().player.cash).toBe(afterFirst.player.cash);
    expect(sim.getState().inventory).toEqual(afterFirst.inventory);
  });

  it('allows repeatable RAM twice and allocates distinct purchase instance IDs', () => {
    const sim = new SimulationEngine({ player: { cash: 100 } } as any);

    expect(buy(sim, 'part_ram_64mb').success).toBe(true);
    expect(buy(sim, 'part_ram_64mb').success).toBe(true);

    const ids = sim.getState().inventory.items.map((item) => item.instanceId);
    expect(ids).toEqual([
      'purchase:part_ram_64mb:1:ram_sdram_64:1',
      'purchase:part_ram_64mb:2:ram_sdram_64:1',
    ]);
    expect(sim.getState().inventory.purchaseCounts.part_ram_64mb).toBe(2);
  });

  it('turns the exact migrated recovery into one zero-charge starter package', () => {
    const sim = new SimulationEngine({
      player: { cash: 3 },
      inventory: {
        items: [],
        purchaseCounts: {},
        legacyRecovery: { starterBundlePurchaseLost: true, consumed: false },
      },
    } as any);

    const first = buy(sim, 'bundle_scrapyard');
    expect(first.success).toBe(true);
    expect(first.data as StorePurchaseResultData).toMatchObject({
      charged: 0,
      recoveredLegacyPurchase: true,
    });
    expect(sim.getState().player.cash).toBe(3);
    expect(sim.getState().inventory.items).toHaveLength(10);
    expect(sim.getState().inventory.legacyRecovery?.consumed).toBe(true);

    const afterFirst = sim.exportSnapshot();
    expect(buy(sim, 'bundle_scrapyard').success).toBe(false);
    expect(sim.exportSnapshot()).toEqual(afterFirst);
  });

  it('does not give a normal $3 player a free starter', () => {
    const sim = new SimulationEngine({ player: { cash: 3 } } as any);
    const before = sim.exportSnapshot();

    expect(buy(sim, 'bundle_scrapyard').success).toBe(false);
    expect(sim.exportSnapshot()).toEqual(before);
  });

  it('preserves purchased instance IDs and purchase counts across snapshot reload', () => {
    const sim = new SimulationEngine({ player: { cash: 100 } } as any);
    expect(buy(sim, 'part_ram_64mb').success).toBe(true);
    expect(buy(sim, 'part_ram_64mb').success).toBe(true);

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine();
    restored.loadSnapshot(snapshot as any);

    expect(restored.getState().inventory).toEqual(snapshot.inventory);
  });
});
