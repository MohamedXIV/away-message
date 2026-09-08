import { describe, expect, it } from 'vitest';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import { PHYSICAL_ITEM_CATALOG, HARDWARE_STORE_INVENTORY } from '../../src/engine/hardware/catalog';
import { resolveRoomComputerAssembly } from '../../src/engine/hardware/assembleOwnedComputer';
import type { OwnedItemKind, PlayerInventoryState } from '../../src/engine/types';

function makeInventory(): PlayerInventoryState {
  return {
    items: [
      {
        instanceId: 'purchase:starter:1:cpu_celeron_366:1',
        catalogItemId: 'cpu_celeron_366',
        kind: 'hardware',
        location: 'room_package',
      },
      {
        instanceId: 'purchase:starter:1:mon_beige_curved_14:1',
        catalogItemId: 'mon_beige_curved_14',
        kind: 'display',
        location: 'room_package',
      },
      {
        instanceId: 'purchase:starter:1:media_orion_48_setup:1',
        catalogItemId: 'media_orion_48_setup',
        kind: 'media',
        location: 'room_package',
      },
    ],
    purchaseCounts: { starter: 1 },
  };
}

function makePurchasedStarter(): PlayerInventoryState {
  const starter = HARDWARE_STORE_INVENTORY.find((item) => item.id === 'bundle_scrapyard');
  if (!starter) throw new Error('Missing starter SKU fixture.');
  const kinds = Object.fromEntries(
    Object.values(PHYSICAL_ITEM_CATALOG).map((item) => [item.id, item.kind]),
  ) as Record<string, OwnedItemKind>;
  const inventory = new InventoryEngine();
  const prepared = inventory.preparePurchase(starter.id, starter.contents, kinds);
  inventory.commitPurchase(prepared);
  return inventory.getState();
}

describe('Issue #8 owned-item installation transaction', () => {
  it('prepares without mutation, then installs exactly the selected owned instances', () => {
    const inventory = new InventoryEngine(makeInventory());
    const api = inventory as InventoryEngine & {
      prepareInstallOwnedItems?: (ids: readonly string[]) => unknown;
      commitInstallOwnedItems?: (prepared: unknown) => void;
    };

    expect(typeof api.prepareInstallOwnedItems).toBe('function');
    expect(typeof api.commitInstallOwnedItems).toBe('function');

    const cpuId = 'purchase:starter:1:cpu_celeron_366:1';
    const monitorId = 'purchase:starter:1:mon_beige_curved_14:1';
    const mediaId = 'purchase:starter:1:media_orion_48_setup:1';
    const prepared = api.prepareInstallOwnedItems!([cpuId, monitorId]);

    expect(inventory.getState().items.map((item) => item.location)).toEqual([
      'room_package',
      'room_package',
      'room_package',
    ]);

    api.commitInstallOwnedItems!(prepared);
    const byId = new Map(inventory.getState().items.map((item) => [item.instanceId, item]));
    expect(byId.get(cpuId)?.location).toBe('installed');
    expect(byId.get(monitorId)?.location).toBe('installed');
    expect(byId.get(mediaId)?.location).toBe('room_package');
  });

  it('rejects missing, duplicate, and non-room-package instances without mutation', () => {
    const state = makeInventory();
    state.items[0] = { ...state.items[0]!, location: 'installed' };
    const inventory = new InventoryEngine(state);
    const api = inventory as InventoryEngine & {
      prepareInstallOwnedItems?: (ids: readonly string[]) => unknown;
    };
    expect(typeof api.prepareInstallOwnedItems).toBe('function');

    const before = inventory.getState();
    expect(() => api.prepareInstallOwnedItems!(['missing'])).toThrow(/owned item|missing|not found/i);
    expect(() =>
      api.prepareInstallOwnedItems!([
        'purchase:starter:1:mon_beige_curved_14:1',
        'purchase:starter:1:mon_beige_curved_14:1',
      ]),
    ).toThrow(/duplicate/i);
    expect(() =>
      api.prepareInstallOwnedItems!(['purchase:starter:1:cpu_celeron_366:1']),
    ).toThrow(/room_package|room package|location/i);
    expect(inventory.getState()).toEqual(before);
  });

  it('rejects a stale prepared install after the same instances were already committed', () => {
    const inventory = new InventoryEngine(makeInventory());
    const api = inventory as InventoryEngine & {
      prepareInstallOwnedItems?: (ids: readonly string[]) => unknown;
      commitInstallOwnedItems?: (prepared: unknown) => void;
    };
    expect(typeof api.prepareInstallOwnedItems).toBe('function');
    expect(typeof api.commitInstallOwnedItems).toBe('function');

    const id = 'purchase:starter:1:cpu_celeron_366:1';
    const first = api.prepareInstallOwnedItems!([id]);
    const stale = api.prepareInstallOwnedItems!([id]);
    api.commitInstallOwnedItems!(first);

    const afterFirstCommit = inventory.getState();
    expect(() => api.commitInstallOwnedItems!(stale)).toThrow(/stale|room_package|room package|location/i);
    expect(inventory.getState()).toEqual(afterFirstCommit);
  });
});

describe('Issue #8 room-package computer assembly resolver', () => {
  it('resolves the authored $35 starter into canonical powered-off hardware and separate display', () => {
    const state = makePurchasedStarter();
    const result = resolveRoomComputerAssembly(state.items);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.assembly.computer.assembled).toBe(true);
    expect(result.assembly.computer.poweredOn).toBe(false);
    expect(result.assembly.computer.insertedMediaId).toBeNull();
    expect(result.assembly.computer.cpu?.clockMhz).toBe(366);
    expect(result.assembly.computer.ramSticks.map((ram) => ram.sizeMb)).toEqual([64]);
    expect(result.assembly.computer.storage[0]?.capacityBytes).toBe(2_100_000_000);
    expect(result.assembly.computer.opticalDrives[0]?.speedMultiplier).toBe(24);
    expect(result.assembly.computer.soundCard?.id).toBe('sound_sb16');
    expect(result.assembly.computer.networkCard?.id).toBe('modem_v90_56k');
    expect(result.assembly.display.monitor?.id).toBe('mon_beige_curved_14');

    const installedCatalogIds = result.assembly.instanceIds.map(
      (id) => state.items.find((item) => item.instanceId === id)?.catalogItemId,
    );
    expect(installedCatalogIds).not.toContain('media_orion_48_setup');
    expect(result.assembly.instanceIds).toHaveLength(9);
  });

  it('rejects incomplete room packages without mutating ownership', () => {
    const state = makePurchasedStarter();
    const withoutMonitor = state.items.filter((item) => item.catalogItemId !== 'mon_beige_curved_14');
    const withoutCpu = state.items.filter((item) => item.catalogItemId !== 'cpu_celeron_366');

    const monitorResult = resolveRoomComputerAssembly(withoutMonitor);
    expect(monitorResult.ok).toBe(false);
    if (!monitorResult.ok) expect(monitorResult.error).toMatch(/monitor/i);

    const cpuResult = resolveRoomComputerAssembly(withoutCpu);
    expect(cpuResult.ok).toBe(false);
    if (!cpuResult.ok) expect(cpuResult.error).toMatch(/cpu/i);

    expect(state.items.every((item) => item.location === 'room_package')).toBe(true);
  });
});
