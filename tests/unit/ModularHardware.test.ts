import { describe, it, expect } from 'vitest';
import {
  calculateTotalRamMb,
  calculateTotalDiskBytes,
  calculateFreeDiskBytes,
  canAddRamStick,
  replaceMonitor,
  toLegacyHardwareState,
} from '../../src/engine/hardware/HardwareManager';
import {
  createScrapYardBundle,
  createFamilyRefurbBundle,
  createPowerWorkstationBundle,
} from '../../src/engine/hardware/catalog';
import { migrateSnapshotToV5 } from '../../src/persistence/slots';
import type { SimulationState } from '../../src/engine/types';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('ModularHardware Architecture', () => {
  it('correctly calculates total RAM across installed sticks', () => {
    const bundle = createScrapYardBundle();
    // Scrap Yard comes with 1 stick of 64MB
    expect(calculateTotalRamMb(bundle)).toBe(64);

    // Add another 128MB stick
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
    const bundle = createScrapYardBundle(); // motherboard has 2 ram slots
    expect(bundle.motherboard.ramSlots).toBe(2);

    const stick1 = { id: 'ram_1', name: '64MB', sizeMb: 64 };
    const stick2 = { id: 'ram_2', name: '64MB', sizeMb: 64 };
    const stick3 = { id: 'ram_3', name: '64MB', sizeMb: 64 };

    // Initially has 1 stick, so can add 1 more
    expect(canAddRamStick(bundle, stick2).ok).toBe(true);

    // Fill the 2 slots
    const full = {
      ...bundle,
      ramSticks: [stick1, stick2],
    };
    expect(canAddRamStick(full, stick3).ok).toBe(false);
  });

  it('calculates storage bytes accurately', () => {
    const bundle = createFamilyRefurbBundle();
    expect(calculateTotalDiskBytes(bundle)).toBe(6_400_000_000);
    expect(calculateFreeDiskBytes(bundle)).toBe(4_200_000_000);
  });

  it('replaces single components cleanly without mutating others', () => {
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
    // CPU and RAM remain untouched
    expect(updated.cpu.id).toBe(bundle.cpu.id);
    expect(updated.ramSticks.length).toBe(bundle.ramSticks.length);
  });

  it('converts modular state to legacy HardwareState contract', () => {
    const workstation = createPowerWorkstationBundle();
    const legacy = toLegacyHardwareState(workstation, 'Orion_6.0');

    expect(legacy.cpuTier).toBe(2);
    expect(legacy.ramMB).toBe(256);
    expect(legacy.hddTotalGB).toBe(20.4);
    expect(legacy.connectionType).toBe('dsl_256k');
    expect(legacy.connectionSpeedKbps).toBe(256);
    expect(legacy.osVersion).toBe('Orion_6.0');
    expect(legacy.soundCardInstalled).toBe(true);
  });

  it('generates valid starter bundles with all required modular sub-components', () => {
    const scrap = createScrapYardBundle();
    const family = createFamilyRefurbBundle();
    const pro = createPowerWorkstationBundle();

    for (const b of [scrap, family, pro]) {
      expect(b.hasComputer).toBe(true);
      expect(b.motherboard).toBeDefined();
      expect(b.cpu).toBeDefined();
      expect(b.ramSticks.length).toBeGreaterThan(0);
      expect(b.storage).toBeDefined();
      expect(b.opticalDrive).toBeDefined();
      expect(b.soundCard).toBeDefined();
      expect(b.networkCard).toBeDefined();
      expect(b.monitor).toBeDefined();
    }
  });

  it('migrates legacy pre-v5 save snapshots to v5 preserving existing player computer', () => {
    const legacySnapshot = {
      player: { cash: 100, energy: 80, fatigue: 10, socialBattery: 90, rentDueDay: 7, rentAmount: 140, rentPaid: false } as any,
      hardware: {
        cpuTier: 2,
        cpuName: 'Upgraded Orion x86',
        ramMB: 1024,
        hddTotalGB: 80.0,
        hddFreeGB: 45.0,
        connectionType: 'dsl_1m' as const,
        connectionSpeedKbps: 1024,
        osVersion: 'Orion_5.0' as const,
        soundCardInstalled: true,
        speakersInstalled: true,
        webcamInstalled: false,
      },
    } as unknown as SimulationState;

    const migrated = migrateSnapshotToV5(legacySnapshot, 4);
    expect(migrated.hardware.hasComputer).toBe(true);
    expect(migrated.hardware.modular).toBeDefined();
    expect(migrated.hardware.modular!.cpu.tier).toBe(2);
    expect(migrated.hardware.modular!.ramSticks[0]!.sizeMb).toBe(1024);
    expect(migrated.hardware.modular!.networkCard!.type).toBe('dsl_1m');
  });

  it('installs modular hardware bundle and syncs SimulationEngine state', () => {
    const sim = new SimulationEngine();
    expect(sim.getState().hardware.hasComputer).toBe(false);

    let notifiedState: SimulationState | null = null;
    sim.subscribe((s) => {
      notifiedState = s;
    });

    const scrap = createScrapYardBundle();
    sim.hardware.installModularHardware(scrap, 'Orion_4.8');

    expect(sim.getState().hardware.hasComputer).toBe(true);
    expect(sim.getState().hardware.ramMB).toBe(64);
    expect(notifiedState).not.toBeNull();
    expect((notifiedState as unknown as SimulationState).hardware.hasComputer).toBe(true);
  });
});
