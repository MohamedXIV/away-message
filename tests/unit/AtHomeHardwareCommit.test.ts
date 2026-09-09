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
});
