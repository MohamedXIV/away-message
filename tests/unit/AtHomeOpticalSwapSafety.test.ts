import { describe, expect, it } from 'vitest';
import type { HardwareInstallSlot, SlottedOwnedItem } from '../../src/engine/InventoryEngine';
import type { ActionResult } from '../../src/engine/types';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

type AtHomeHardwareInstaller = {
  installOwnedHardwareAtHome(instanceId: string, slot: HardwareInstallSlot): ActionResult;
};

describe('at-home optical replacement safety', () => {
  it('blocks replacing the active optical drive while owned media is inserted without mutating either side', () => {
    const engine = new SimulationEngine({ player: { cash: 500 } } as any);

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_family').success).toBe(true);

    const beforeInsert = engine.getState();
    const oldOptical = beforeInsert.inventory.items.find(
      (item) => item.catalogItemId === 'optical_cdrom_24x' && item.location === 'installed',
    ) as SlottedOwnedItem | undefined;
    const candidate = beforeInsert.inventory.items.find(
      (item) => item.catalogItemId === 'optical_cdrw_32x' && item.location === 'room_package',
    );
    const media = beforeInsert.inventory.items.find(
      (item) => item.catalogItemId === 'media_orion_50_setup' && item.location === 'room_package',
    );

    expect(oldOptical).toMatchObject({ installSlot: 'optical:0' });
    expect(candidate).toBeDefined();
    expect(media).toBeDefined();
    expect(engine.insertOwnedMediaAtHome(media!.instanceId).success).toBe(true);

    const beforeSwap = engine.getState();
    expect(beforeSwap.computer.insertedMediaId).toBe(media!.instanceId);
    expect(beforeSwap.inventory.items.find((item) => item.instanceId === media!.instanceId)).toMatchObject({
      location: 'inserted',
    });

    const result = (engine as unknown as AtHomeHardwareInstaller).installOwnedHardwareAtHome(
      candidate!.instanceId,
      'optical:0',
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/eject/i);

    const after = engine.getState();
    expect(after.computer.opticalDrives[0]?.id).toBe('optical_cdrom_24x');
    expect(after.computer.insertedMediaId).toBe(media!.instanceId);
    expect(after.inventory.items.find((item) => item.instanceId === oldOptical!.instanceId)).toMatchObject({
      location: 'installed',
      installSlot: 'optical:0',
    });
    expect(after.inventory.items.find((item) => item.instanceId === candidate!.instanceId)).toMatchObject({
      location: 'room_package',
    });
    expect(after.inventory.items.find((item) => item.instanceId === media!.instanceId)).toMatchObject({
      location: 'inserted',
    });
  });
});
