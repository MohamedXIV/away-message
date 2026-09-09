import { describe, expect, it } from 'vitest';
import type { SlottedOwnedItem } from '../../src/engine/InventoryEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('starter computer exact hardware assignments', () => {
  it('binds each purchased starter physical instance to one deterministic installed slot', () => {
    const engine = new SimulationEngine();

    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);

    const items = engine.getState().inventory.items as SlottedOwnedItem[];
    const slotByCatalogId = Object.fromEntries(
      items
        .filter((item) => item.location === 'installed')
        .map((item) => [item.catalogItemId, item.installSlot]),
    );

    expect(slotByCatalogId).toEqual({
      chassis_scrapyard_beige_atx: 'chassis',
      mb_standard_atx: 'motherboard',
      cpu_celeron_366: 'cpu',
      ram_sdram_64: 'ram:0',
      hdd_2gb: 'storage:0',
      optical_cdrom_24x: 'optical:0',
      sound_sb16: 'sound',
      modem_v90_56k: 'network',
      mon_beige_curved_14: 'monitor:0',
    });

    const installed = items.filter((item) => item.location === 'installed');
    expect(installed.every((item) => item.installSlot !== undefined)).toBe(true);
    expect(new Set(installed.map((item) => item.installSlot)).size).toBe(installed.length);
  });
});
