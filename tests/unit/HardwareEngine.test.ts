import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { HardwareEngine } from '../../src/engine/HardwareEngine';
import { createScrapYardBundle } from '../../src/engine/hardware/catalog';

describe('HardwareEngine (canonical physical computer state)', () => {
  let eventBus: EventBus;
  let hardware: HardwareEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    hardware = new HardwareEngine(eventBus);
  });

  it('starts with no canonical machine and zero effective specs', () => {
    expect(hardware.getComputerState().assembled).toBe(false);
    expect(hardware.getDisplayState().monitor).toBeNull();
    expect(hardware.getState()).toMatchObject({
      hasComputer: false,
      isPoweredOn: false,
      cpuTier: 0,
      ramMB: 0,
      hddTotalGB: 0,
      hddFreeGB: 0,
      connectionType: null,
      connectionSpeedKbps: 0,
      soundCardInstalled: false,
    });
  });

  it('fails hardware requirements on an empty machine instead of using fake defaults', () => {
    const result = hardware.checkHardwareRequirements({
      minRamMB: 64,
      minCpuTier: 1,
      requiredDiskBytes: 1,
    });

    expect(result.compatible).toBe(false);
    expect(result.reasons.join(' ')).toContain('No computer installed');
  });

  it('installs the temporary modular adapter without importing an OS into hardware state', () => {
    const scrap = createScrapYardBundle();
    expect(scrap.isPoweredOn).toBe(false);

    hardware.installModularHardware(scrap, 'Orion_6.0');

    expect(hardware.getComputerState().assembled).toBe(true);
    expect(hardware.getComputerState().poweredOn).toBe(false);
    expect(hardware.getDisplayState().monitor?.id).toBe('mon_beige_curved_14');
    expect(hardware.getState().ramMB).toBe(64);
    expect('osVersion' in hardware.getState()).toBe(false);
  });

  it('upgrades RAM by mutating canonical RAM sticks', () => {
    hardware.installModularHardware(createScrapYardBundle());

    expect(hardware.upgradeRam(512)).toBe(true);
    expect(hardware.getState().ramMB).toBe(512);
    expect(hardware.getComputerState().ramSticks.reduce((n, stick) => n + stick.sizeMb, 0)).toBe(512);
    expect(hardware.upgradeRam(256)).toBe(false);
  });

  it('upgrades the canonical network card', () => {
    hardware.installModularHardware(createScrapYardBundle());

    expect(hardware.upgradeConnection('dsl_512k')).toBe(true);
    expect(hardware.getState().connectionType).toBe('dsl_512k');
    expect(hardware.getState().connectionSpeedKbps).toBe(512);
  });

  it('calculates RAM pressure using an explicit OS baseline', () => {
    hardware.installModularHardware(createScrapYardBundle());
    hardware.upgradeRam(512);

    const nominal = hardware.calculateRamPressure(100, 64);
    expect(nominal.status).toBe('nominal');
    expect(nominal.freeRamMB).toBe(348);

    const elevated = hardware.calculateRamPressure(350, 64);
    expect(elevated.status).toBe('elevated');

    const critical = hardware.calculateRamPressure(420, 64);
    expect(critical.status).toBe('critical');
  });

  it('allocates and frees bytes against canonical primary storage', () => {
    hardware.installModularHardware(createScrapYardBundle());
    const before = hardware.getComputerState().storage[0]!.freeBytes;

    expect(hardware.allocateDiskSpaceBytes(100_000_000)).toBe(true);
    expect(hardware.getComputerState().storage[0]!.freeBytes).toBe(before - 100_000_000);

    hardware.freeDiskSpaceBytes(50_000_000);
    expect(hardware.getComputerState().storage[0]!.freeBytes).toBe(before - 50_000_000);
  });
});
