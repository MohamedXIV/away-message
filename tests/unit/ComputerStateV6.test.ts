import { describe, expect, it } from 'vitest';
import { createScrapYardBundle } from '../../src/engine/hardware/catalog';
import {
  canonicalToLegacyModular,
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
  createEmptyInventoryState,
  legacyFlatHardwareToCanonical,
  legacyModularToCanonical,
  projectEffectiveHardware,
} from '../../src/engine/hardware/state';

describe('v6 computer state', () => {
  it('represents an empty desk without invented specs', () => {
    const computer = createEmptyComputerSetup();
    const display = createEmptyDisplaySetup();
    const inventory = createEmptyInventoryState();

    expect(computer.assembled).toBe(false);
    expect(computer.poweredOn).toBe(false);
    expect(display.monitor).toBeNull();
    expect(inventory.items).toEqual([]);
    expect(projectEffectiveHardware(computer)).toMatchObject({
      hasComputer: false,
      isPoweredOn: false,
      cpuTier: 0,
      cpuName: '',
      ramMB: 0,
      hddTotalGB: 0,
      hddFreeGB: 0,
      connectionType: null,
      connectionSpeedKbps: 0,
      soundCardInstalled: false,
      speakersInstalled: false,
      webcamInstalled: false,
    });
  });

  it('splits a legacy modular bundle into computer and display state', () => {
    const legacy = createScrapYardBundle();
    const { computer, display } = legacyModularToCanonical(legacy);

    expect(computer.assembled).toBe(true);
    expect(computer.cpu?.id).toBe('cpu_celeron_366');
    expect(computer.ramSticks.map((stick) => stick.sizeMb)).toEqual([64]);
    expect(computer.storage[0]?.id).toBe('hdd_quantum_2gb');
    expect(computer.opticalDrives[0]?.id).toBe('optical_cdrom_24x');
    expect(computer).not.toHaveProperty('monitor');
    expect(display.monitor?.id).toBe('mon_beige_curved_14');
  });

  it('keeps the legacy adapter available when canonical state has inserted media', () => {
    const legacy = createScrapYardBundle();
    const { computer, display } = legacyModularToCanonical({
      ...legacy,
      insertedDisc: {
        id: 'disc_orion_48',
        title: 'Orion OS 4.8 Setup CD',
        type: 'os_installer',
        osTarget: 'Orion_4.8',
      },
    });

    expect(computer.insertedMediaId).toBe('disc_orion_48');
    expect(canonicalToLegacyModular(computer, display)).toMatchObject({
      hasComputer: true,
      cpu: { id: 'cpu_celeron_366' },
      monitor: { id: 'mon_beige_curved_14' },
      insertedDisc: null,
    });
  });

  it('converts flat v5 hardware directly without inventing a migrated OS', () => {
    const { computer, display } = legacyFlatHardwareToCanonical({
      hasComputer: true,
      isPoweredOn: false,
      cpuTier: 2,
      cpuName: 'Upgraded Orion x86',
      ramMB: 1024,
      hddTotalGB: 80,
      hddFreeGB: 45,
      connectionType: 'dsl_1m',
      connectionSpeedKbps: 1024,
      soundCardInstalled: true,
    });

    expect(computer.assembled).toBe(true);
    expect(computer.cpu?.id).toBe('cpu_pentium3_800');
    expect(computer.ramSticks[0]?.sizeMb).toBe(1024);
    expect(computer.storage[0]?.capacityBytes).toBe(80_000_000_000);
    expect(computer.networkCard?.type).toBe('dsl_1m');
    expect(display.monitor?.id).toBe('mon_standard_15');
  });

  it('keeps flat no-PC saves truly empty', () => {
    const { computer, display } = legacyFlatHardwareToCanonical({
      hasComputer: false,
      ramMB: 512,
      hddTotalGB: 40,
      hddFreeGB: 7,
      connectionType: 'dsl_256k',
      connectionSpeedKbps: 256,
      soundCardInstalled: true,
    });

    expect(computer).toEqual(createEmptyComputerSetup());
    expect(display).toEqual(createEmptyDisplaySetup());
    expect(projectEffectiveHardware(computer).ramMB).toBe(0);
  });
});
