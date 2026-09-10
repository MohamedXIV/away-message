import { describe, expect, it } from 'vitest';
import type { HardwareInstallSlot, SlottedOwnedItem } from '../../src/engine/InventoryEngine';
import type { ActionResult } from '../../src/engine/types';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

type AtHomeHardwareInstaller = {
  installOwnedHardwareAtHome(instanceId: string, slot: HardwareInstallSlot): ActionResult;
};

describe('at-home hardware authoritative commit', () => {
  it('installs one exact owned RAM instance and updates effective machine RAM atomically', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'part_ram_128mb').success).toBe(true);

    const before = engine.getState();
    const candidate = before.inventory.items.find(
      (item) => item.catalogItemId === 'ram_sdram_128' && item.location === 'room_package',
    );
    expect(candidate).toBeDefined();
    expect(before.hardware.ramMB).toBe(64);
    expect(before.computer.ramSticks.map((stick) => stick.id)).toEqual(['ram_sdram_64_a']);

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'ram:1',
    );

    expect(result.success).toBe(true);

    const after = engine.getState();
    const installed = after.inventory.items.find(
      (item) => item.instanceId === candidate!.instanceId,
    ) as SlottedOwnedItem | undefined;

    expect(installed).toMatchObject({
      instanceId: candidate!.instanceId,
      catalogItemId: 'ram_sdram_128',
      location: 'installed',
      installSlot: 'ram:1',
    });
    expect(after.computer.ramSticks.map((stick) => stick.id)).toEqual([
      'ram_sdram_64_a',
      'ram_sdram_128',
    ]);
    expect(after.hardware.ramMB).toBe(192);
    expect(after.display).toEqual(before.display);
    expect(after.os).toEqual(before.os);
  });

  it('replaces the exact CPU instance and updates canonical/effective CPU state atomically', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_family').success).toBe(true);

    const before = engine.getState();
    const oldCpu = before.inventory.items.find(
      (item) => item.catalogItemId === 'cpu_celeron_366' && item.location === 'installed',
    ) as SlottedOwnedItem | undefined;
    const candidate = before.inventory.items.find(
      (item) => item.catalogItemId === 'cpu_pentium2_500' && item.location === 'room_package',
    );

    expect(oldCpu).toMatchObject({ installSlot: 'cpu' });
    expect(candidate).toBeDefined();
    expect(before.computer.cpu).not.toBeNull();
    expect(before.computer.cpu!.id).toBe('cpu_celeron_366');

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'cpu',
    );

    expect(result.success).toBe(true);

    const after = engine.getState();
    expect(after.inventory.items.find((item) => item.instanceId === candidate!.instanceId)).toMatchObject({
      catalogItemId: 'cpu_pentium2_500',
      location: 'installed',
      installSlot: 'cpu',
    });
    expect(after.inventory.items.find((item) => item.instanceId === oldCpu!.instanceId)).toMatchObject({
      catalogItemId: 'cpu_celeron_366',
      location: 'room_package',
    });
    expect(after.computer.cpu).not.toBeNull();
    expect(after.computer.cpu!.id).toBe('cpu_pentium2_500');
    expect(after.hardware.cpuTier).toBe(after.computer.cpu!.tier);
    expect(after.display).toEqual(before.display);
    expect(after.os).toEqual(before.os);
  });

  it('keeps purchased network hardware in Room 104 until the exact owned instance is installed', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_family').success).toBe(true);

    const before = engine.getState();
    const oldNetwork = before.inventory.items.find(
      (item) => item.catalogItemId === 'modem_v90_56k' && item.location === 'installed',
    ) as SlottedOwnedItem | undefined;
    const candidate = before.inventory.items.find(
      (item) => item.catalogItemId === 'nic_fast_ethernet' && item.location === 'room_package',
    );

    expect(oldNetwork).toMatchObject({ installSlot: 'network' });
    expect(candidate).toBeDefined();
    expect(before.computer.networkCard?.id).toBe('modem_v90_56k');
    expect(before.hardware.connectionType).toBe('dialup_56k');

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'network',
    );

    expect(result.success).toBe(true);

    const after = engine.getState();
    expect(after.inventory.items.find((item) => item.instanceId === candidate!.instanceId)).toMatchObject({
      catalogItemId: 'nic_fast_ethernet',
      location: 'installed',
      installSlot: 'network',
    });
    expect(after.inventory.items.find((item) => item.instanceId === oldNetwork!.instanceId)).toMatchObject({
      catalogItemId: 'modem_v90_56k',
      location: 'room_package',
    });
    expect(after.computer.networkCard?.id).toBe('nic_fast_ethernet');
    expect(after.hardware.connectionType).toBe('dsl_256k');
    expect(after.display).toEqual(before.display);
    expect(after.os).toEqual(before.os);
  });

  it('replaces the exact sound-card instance while preserving display and OS state', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_workstation').success).toBe(true);

    const before = engine.getState();
    const oldSound = before.inventory.items.find(
      (item) => item.catalogItemId === 'sound_sb16' && item.location === 'installed',
    ) as SlottedOwnedItem | undefined;
    const candidate = before.inventory.items.find(
      (item) => item.catalogItemId === 'sound_sb_live' && item.location === 'room_package',
    );

    expect(oldSound).toMatchObject({ installSlot: 'sound' });
    expect(candidate).toBeDefined();
    expect(before.computer.soundCard?.id).toBe('sound_sb16');

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'sound',
    );

    expect(result.success).toBe(true);

    const after = engine.getState();
    expect(after.inventory.items.find((item) => item.instanceId === candidate!.instanceId)).toMatchObject({
      catalogItemId: 'sound_sb_live',
      location: 'installed',
      installSlot: 'sound',
    });
    expect(after.inventory.items.find((item) => item.instanceId === oldSound!.instanceId)).toMatchObject({
      catalogItemId: 'sound_sb16',
      location: 'room_package',
    });
    expect(after.computer.soundCard?.id).toBe('sound_sb_live');
    expect(after.display).toEqual(before.display);
    expect(after.os).toEqual(before.os);
  });

  it('replaces the exact optical-drive instance while preserving display and OS state', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_family').success).toBe(true);

    const before = engine.getState();
    const oldOptical = before.inventory.items.find(
      (item) => item.catalogItemId === 'optical_cdrom_24x' && item.location === 'installed',
    ) as SlottedOwnedItem | undefined;
    const candidate = before.inventory.items.find(
      (item) => item.catalogItemId === 'optical_cdrw_32x' && item.location === 'room_package',
    );

    expect(oldOptical).toMatchObject({ installSlot: 'optical:0' });
    expect(candidate).toBeDefined();
    expect(before.computer.opticalDrives[0]?.id).toBe('optical_cdrom_24x');
    expect(before.computer.insertedMediaId).toBeNull();

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'optical:0',
    );

    expect(result.success).toBe(true);

    const after = engine.getState();
    expect(after.inventory.items.find((item) => item.instanceId === candidate!.instanceId)).toMatchObject({
      catalogItemId: 'optical_cdrw_32x',
      location: 'installed',
      installSlot: 'optical:0',
    });
    expect(after.inventory.items.find((item) => item.instanceId === oldOptical!.instanceId)).toMatchObject({
      catalogItemId: 'optical_cdrom_24x',
      location: 'room_package',
    });
    expect(after.computer.opticalDrives[0]?.id).toBe('optical_cdrw_32x');
    expect(after.computer.insertedMediaId).toBeNull();
    expect(after.display).toEqual(before.display);
    expect(after.os).toEqual(before.os);
  });

  it('replaces the exact monitor instance while preserving computer, OS, and software state', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'part_mon_trinitron').success).toBe(true);

    const before = engine.getState();
    const oldMonitor = before.inventory.items.find(
      (item) => item.catalogItemId === 'mon_beige_curved_14' && item.location === 'installed',
    ) as SlottedOwnedItem | undefined;
    const candidate = before.inventory.items.find(
      (item) => item.catalogItemId === 'mon_trinitron_17' && item.location === 'room_package',
    );

    expect(oldMonitor).toMatchObject({ installSlot: 'monitor:0' });
    expect(candidate).toBeDefined();
    expect(before.display.monitor?.id).toBe('mon_beige_curved_14');

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'monitor:0',
    );

    expect(result.success).toBe(true);

    const after = engine.getState();
    const installed = after.inventory.items.find(
      (item) => item.instanceId === candidate!.instanceId,
    ) as SlottedOwnedItem | undefined;
    const displaced = after.inventory.items.find(
      (item) => item.instanceId === oldMonitor!.instanceId,
    ) as SlottedOwnedItem | undefined;

    expect(installed).toMatchObject({
      catalogItemId: 'mon_trinitron_17',
      location: 'installed',
      installSlot: 'monitor:0',
    });
    expect(displaced).toMatchObject({
      catalogItemId: 'mon_beige_curved_14',
      location: 'room_package',
    });
    expect(displaced?.installSlot).toBeUndefined();
    expect(after.display.monitor).toMatchObject({
      id: 'mon_trinitron_17',
      curvature: 0,
      scanlineIntensity: 0.2,
      bloomIntensity: 0.15,
      flicker: false,
    });
    expect(after.computer).toEqual(before.computer);
    expect(after.os).toEqual(before.os);
    expect(after.installedSoftware).toEqual(before.installedSoftware);
  });

  it('preserves exact RAM and monitor instance-slot assignments across save and reload', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'part_ram_128mb').success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'part_mon_trinitron').success).toBe(true);

    const owned = engine.getState().inventory.items;
    const ram = owned.find(
      (item) => item.catalogItemId === 'ram_sdram_128' && item.location === 'room_package',
    );
    const monitor = owned.find(
      (item) => item.catalogItemId === 'mon_trinitron_17' && item.location === 'room_package',
    );
    expect(ram).toBeDefined();
    expect(monitor).toBeDefined();

    const installer = engine as unknown as AtHomeHardwareInstaller;
    expect(installer.installOwnedHardwareAtHome(ram!.instanceId, 'ram:1').success).toBe(true);
    expect(installer.installOwnedHardwareAtHome(monitor!.instanceId, 'monitor:0').success).toBe(true);

    const snapshot = engine.exportSnapshot();
    const restored = new SimulationEngine();
    restored.loadSnapshot(snapshot as any);

    const after = restored.getState();
    expect(after.inventory.items.find((item) => item.instanceId === ram!.instanceId)).toMatchObject({
      catalogItemId: 'ram_sdram_128',
      location: 'installed',
      installSlot: 'ram:1',
    });
    expect(after.inventory.items.find((item) => item.instanceId === monitor!.instanceId)).toMatchObject({
      catalogItemId: 'mon_trinitron_17',
      location: 'installed',
      installSlot: 'monitor:0',
    });
    expect(after.computer.ramSticks.map((stick) => stick.id)).toEqual([
      'ram_sdram_64_a',
      'ram_sdram_128',
    ]);
    expect(after.hardware.ramMB).toBe(192);
    expect(after.display.monitor?.id).toBe('mon_trinitron_17');
  });
});
