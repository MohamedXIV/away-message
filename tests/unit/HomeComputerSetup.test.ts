import { describe, expect, it } from 'vitest';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PHYSICAL_ITEM_CATALOG, HARDWARE_STORE_INVENTORY } from '../../src/engine/hardware/catalog';
import { resolveRoomComputerAssembly } from '../../src/engine/hardware/assembleOwnedComputer';
import type { OwnedItemKind, PlayerInventoryState } from '../../src/engine/types';

function makeInventory(): PlayerInventoryState {
  return {
    items: [
      { instanceId: 'purchase:starter:1:cpu_celeron_366:1', catalogItemId: 'cpu_celeron_366', kind: 'hardware', location: 'room_package' },
      { instanceId: 'purchase:starter:1:mon_beige_curved_14:1', catalogItemId: 'mon_beige_curved_14', kind: 'display', location: 'room_package' },
      { instanceId: 'purchase:starter:1:media_orion_48_setup:1', catalogItemId: 'media_orion_48_setup', kind: 'media', location: 'room_package' },
    ],
    purchaseCounts: { starter: 1 },
  };
}

function makePurchasedStarter(): PlayerInventoryState {
  const starter = HARDWARE_STORE_INVENTORY.find((item) => item.id === 'bundle_scrapyard');
  if (!starter) throw new Error('Missing starter SKU fixture.');
  const kinds = Object.fromEntries(Object.values(PHYSICAL_ITEM_CATALOG).map((item) => [item.id, item.kind])) as Record<string, OwnedItemKind>;
  const inventory = new InventoryEngine();
  inventory.commitPurchase(inventory.preparePurchase(starter.id, starter.contents, kinds));
  return inventory.getState();
}

function purchaseStarter(engine: SimulationEngine): void {
  const result = engine.dispatchAction({ type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard' });
  expect(result.success).toBe(true);
}

describe('Issue #8 owned-item installation transaction', () => {
  it('prepares without mutation, then installs exactly the selected owned instances', () => {
    const inventory = new InventoryEngine(makeInventory());
    const cpuId = 'purchase:starter:1:cpu_celeron_366:1';
    const monitorId = 'purchase:starter:1:mon_beige_curved_14:1';
    const mediaId = 'purchase:starter:1:media_orion_48_setup:1';
    const prepared = inventory.prepareInstallOwnedItems([cpuId, monitorId]);
    expect(inventory.getState().items.map((item) => item.location)).toEqual(['room_package', 'room_package', 'room_package']);
    inventory.commitInstallOwnedItems(prepared);
    const byId = new Map(inventory.getState().items.map((item) => [item.instanceId, item]));
    expect(byId.get(cpuId)?.location).toBe('installed');
    expect(byId.get(monitorId)?.location).toBe('installed');
    expect(byId.get(mediaId)?.location).toBe('room_package');
  });

  it('rejects missing, duplicate, and non-room-package instances without mutation', () => {
    const state = makeInventory();
    state.items[0] = { ...state.items[0]!, location: 'installed' };
    const inventory = new InventoryEngine(state);
    const before = inventory.getState();
    expect(() => inventory.prepareInstallOwnedItems(['missing'])).toThrow(/owned item|missing|not found/i);
    expect(() => inventory.prepareInstallOwnedItems(['purchase:starter:1:mon_beige_curved_14:1', 'purchase:starter:1:mon_beige_curved_14:1'])).toThrow(/duplicate/i);
    expect(() => inventory.prepareInstallOwnedItems(['purchase:starter:1:cpu_celeron_366:1'])).toThrow(/room_package|room package|location/i);
    expect(inventory.getState()).toEqual(before);
  });

  it('rejects a stale prepared install after the same instances were already committed', () => {
    const inventory = new InventoryEngine(makeInventory());
    const id = 'purchase:starter:1:cpu_celeron_366:1';
    const first = inventory.prepareInstallOwnedItems([id]);
    const stale = inventory.prepareInstallOwnedItems([id]);
    inventory.commitInstallOwnedItems(first);
    const afterFirstCommit = inventory.getState();
    expect(() => inventory.commitInstallOwnedItems(stale)).toThrow(/stale|room_package|room package|location/i);
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
    const installedCatalogIds = result.assembly.instanceIds.map((id) => state.items.find((item) => item.instanceId === id)?.catalogItemId);
    expect(installedCatalogIds).not.toContain('media_orion_48_setup');
    expect(result.assembly.instanceIds).toHaveLength(9);
  });

  it('rejects incomplete room packages without mutating ownership', () => {
    const state = makePurchasedStarter();
    const monitorResult = resolveRoomComputerAssembly(state.items.filter((item) => item.catalogItemId !== 'mon_beige_curved_14'));
    expect(monitorResult.ok).toBe(false);
    if (!monitorResult.ok) expect(monitorResult.error).toMatch(/monitor/i);
    const cpuResult = resolveRoomComputerAssembly(state.items.filter((item) => item.catalogItemId !== 'cpu_celeron_366'));
    expect(cpuResult.ok).toBe(false);
    if (!cpuResult.ok) expect(cpuResult.error).toMatch(/cpu/i);
    expect(state.items.every((item) => item.location === 'room_package')).toBe(true);
  });
});

describe('Issue #8 atomic at-home setup action', () => {
  it('sets up the purchased starter once, costs exactly 15 minutes, and leaves OS/media/power untouched', () => {
    const engine = new SimulationEngine();
    purchaseStarter(engine);
    const beforeMinutes = engine.clock.getTotalMinutes();
    const beforeOs = engine.os.getCurrentOsId();

    const result = engine.dispatchAction({ type: 'COMPUTER_SETUP_AT_HOME' } as any);
    expect(result.success).toBe(true);
    expect(engine.clock.getTotalMinutes()).toBe(beforeMinutes + 15);

    const state = engine.getState();
    expect(state.computer.assembled).toBe(true);
    expect(state.computer.poweredOn).toBe(false);
    expect(state.computer.insertedMediaId).toBeNull();
    expect(state.display.monitor?.id).toBe('mon_beige_curved_14');
    expect(state.os.currentOsId).toBe(beforeOs);
    expect(state.os.currentOsId).toBeNull();
    expect(state.hardware.ramMB).toBe(64);

    const media = state.inventory.items.find((item) => item.catalogItemId === 'media_orion_48_setup');
    expect(media?.location).toBe('room_package');
    expect(state.inventory.items.filter((item) => item.kind !== 'media').every((item) => item.location === 'installed')).toBe(true);

    const snapshotAfterFirst = engine.exportSnapshot();
    const second = engine.dispatchAction({ type: 'COMPUTER_SETUP_AT_HOME' } as any);
    expect(second.success).toBe(false);
    expect(engine.clock.getTotalMinutes()).toBe(beforeMinutes + 15);
    expect(engine.exportSnapshot()).toEqual(snapshotAfterFirst);
  });

  it('rejects an incomplete package atomically with no time, inventory, hardware, display, or OS mutation', () => {
    const engine = new SimulationEngine();
    purchaseStarter(engine);
    const inventory = engine.inventory.getState();
    engine.inventory.loadState({
      ...inventory,
      items: inventory.items.filter((item) => item.catalogItemId !== 'mon_beige_curved_14'),
    });
    const before = engine.exportSnapshot();
    const beforeMinutes = engine.clock.getTotalMinutes();

    const result = engine.dispatchAction({ type: 'COMPUTER_SETUP_AT_HOME' } as any);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/monitor/i);
    expect(engine.clock.getTotalMinutes()).toBe(beforeMinutes);
    expect(engine.exportSnapshot()).toEqual(before);
  });
});
