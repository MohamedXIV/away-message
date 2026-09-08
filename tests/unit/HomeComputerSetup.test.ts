import { describe, expect, it } from 'vitest';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { ActionResult, OwnedItem, PlayerInventoryState } from '../../src/engine/types';

type PreparedInventoryInstall = {
  instanceIds: string[];
  sourceItems: OwnedItem[];
};

type InventoryInstallApi = InventoryEngine & {
  prepareInstallOwnedItems(instanceIds: readonly string[]): PreparedInventoryInstall;
  commitInstallOwnedItems(prepared: PreparedInventoryInstall): void;
};

type HomeComputerSetupApi = SimulationEngine & {
  setupComputerAtHome(): ActionResult;
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

describe('SimulationEngine at-home computer setup', () => {
  it('assembles the purchased starter hardware at home in exactly 15 minutes without installing an OS', () => {
    const engine = new SimulationEngine() as HomeComputerSetupApi;
    const purchase = engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard');
    expect(purchase.success).toBe(true);

    const purchased = engine.getState();
    const beforeMinutes = purchased.time.totalMinutes;
    expect(purchased.computer.assembled).toBe(false);
    expect(purchased.display.monitor).toBeNull();
    expect(purchased.os.currentOsId).toBeNull();

    const setup = engine.setupComputerAtHome();
    expect(setup.success).toBe(true);

    const state = engine.getState();
    expect(state.time.totalMinutes).toBe(beforeMinutes + 15);
    expect(state.computer.assembled).toBe(true);
    expect(state.computer.poweredOn).toBe(false);
    expect(state.computer.chassis?.id).toBe('chassis_scrapyard_beige_atx');
    expect(state.computer.motherboard?.id).toBe('mb_standard_atx');
    expect(state.computer.cpu?.id).toBe('cpu_celeron_366');
    expect(state.computer.ramSticks.map((part) => part.id)).toEqual(['ram_sdram_64_a']);
    expect(state.computer.storage.map((part) => part.id)).toEqual(['hdd_quantum_2gb']);
    expect(state.computer.opticalDrives.map((part) => part.id)).toEqual(['optical_cdrom_24x']);
    expect(state.computer.soundCard?.id).toBe('sound_sb16');
    expect(state.computer.networkCard?.id).toBe('modem_v90_56k');
    expect(state.display.monitor?.id).toBe('mon_beige_curved_14');
    expect(state.os.currentOsId).toBeNull();
    expect(state.inventory.items.find((item) => item.catalogItemId === 'media_orion_48_setup')?.location)
      .toBe('room_package');
    expect(
      state.inventory.items
        .filter((item) => item.catalogItemId !== 'media_orion_48_setup')
        .every((item) => item.location === 'installed'),
    ).toBe(true);
  });

  it('does not consume more time or duplicate parts when setup is repeated', () => {
    const engine = new SimulationEngine() as HomeComputerSetupApi;
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);

    const afterFirst = engine.exportSnapshot();
    const repeated = engine.setupComputerAtHome();

    expect(repeated.success).toBe(false);
    const afterSecond = engine.exportSnapshot();
    expect(afterSecond.time.totalMinutes).toBe(afterFirst.time.totalMinutes);
    expect(afterSecond.computer).toEqual(afterFirst.computer);
    expect(afterSecond.display).toEqual(afterFirst.display);
    expect(afterSecond.inventory).toEqual(afterFirst.inventory);
  });

  it('rejects setup when no owned room package exists without consuming time', () => {
    const engine = new SimulationEngine() as HomeComputerSetupApi;
    const before = engine.exportSnapshot();

    const result = engine.setupComputerAtHome();

    expect(result.success).toBe(false);
    const after = engine.exportSnapshot();
    expect(after.time.totalMinutes).toBe(before.time.totalMinutes);
    expect(after.computer).toEqual(before.computer);
    expect(after.display).toEqual(before.display);
    expect(after.inventory).toEqual(before.inventory);
  });
});
