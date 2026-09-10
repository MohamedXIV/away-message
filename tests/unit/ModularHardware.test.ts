import { describe, expect, it } from 'vitest';
import {
  calculateFreeDiskBytes,
  calculateTotalDiskBytes,
  calculateTotalRamMb,
  canAddRamStick,
  replaceMonitor,
} from '../../src/engine/hardware/HardwareManager';
import {
  createFamilyRefurbBundle,
  createPowerWorkstationBundle,
  createScrapYardBundle,
} from '../../src/engine/hardware/catalog';
import {
  legacyModularToCanonical,
  projectEffectiveHardware,
} from '../../src/engine/hardware/state';

describe('ModularHardware v5/catalog adapter', () => {
  it('correctly calculates total RAM across installed sticks', () => {
    const bundle = createScrapYardBundle();
    expect(calculateTotalRamMb(bundle)).toBe(64);

    const updated = {
      ...bundle,
      ramSticks: [
        ...bundle.ramSticks,
        { id: 'ram_sdram_128', name: '128MB SDRAM', sizeMb: 128 },
      ],
    };
    expect(calculateTotalRamMb(updated)).toBe(192);
  });

  it('enforces motherboard RAM slot capacity', () => {
    const bundle = createScrapYardBundle();
    expect(bundle.motherboard.ramSlots).toBe(2);

    const stick1 = { id: 'ram_1', name: '64MB', sizeMb: 64 };
    const stick2 = { id: 'ram_2', name: '64MB', sizeMb: 64 };
    const stick3 = { id: 'ram_3', name: '64MB', sizeMb: 64 };

    expect(canAddRamStick(bundle, stick2).ok).toBe(true);
    expect(canAddRamStick({ ...bundle, ramSticks: [stick1, stick2] }, stick3).ok).toBe(false);
  });

  it('calculates storage bytes accurately', () => {
    const bundle = createFamilyRefurbBundle();
    expect(calculateTotalDiskBytes(bundle)).toBe(6_400_000_000);
    expect(calculateFreeDiskBytes(bundle)).toBe(4_200_000_000);
  });

  it('replaces a monitor in the legacy adapter without mutating other parts', () => {
    const bundle = createScrapYardBundle();
    const newMonitor = {
      id: 'mon_lcd_clean_15',
      name: '15" Flat Panel LCD',
      type: 'early_lcd_15' as const,
      curvature: 0,
      scanlineIntensity: 0,
      bloomIntensity: 0,
      flicker: false,
    };

    const updated = replaceMonitor(bundle, newMonitor);
    expect(updated.monitor.id).toBe('mon_lcd_clean_15');
    expect(updated.monitor.curvature).toBe(0);
    expect(updated.cpu.id).toBe(bundle.cpu.id);
    expect(updated.ramSticks.length).toBe(bundle.ramSticks.length);
  });

  it('projects modular hardware without any OS authority', () => {
    const canonical = legacyModularToCanonical(createPowerWorkstationBundle());
    const effective = projectEffectiveHardware(canonical.computer);

    expect(effective.cpuTier).toBe(2);
    expect(effective.ramMB).toBe(256);
    expect(effective.hddTotalGB).toBe(20.4);
    expect(effective.connectionType).toBe('dsl_256k');
    expect(effective.connectionSpeedKbps).toBe(256);
    expect('osVersion' in effective).toBe(false);
  });

  it('keeps authored bundles physically complete for the temporary adapter', () => {
    for (const bundle of [
      createScrapYardBundle(),
      createFamilyRefurbBundle(),
      createPowerWorkstationBundle(),
    ]) {
      expect(bundle.hasComputer).toBe(true);
      expect(bundle.motherboard).toBeDefined();
      expect(bundle.cpu).toBeDefined();
      expect(bundle.ramSticks.length).toBeGreaterThan(0);
      expect(bundle.storage).toBeDefined();
      expect(bundle.opticalDrive).toBeDefined();
      expect(bundle.soundCard).toBeDefined();
      expect(bundle.networkCard).toBeDefined();
      expect(bundle.monitor).toBeDefined();
    }
  });
});
