import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createPowerWorkstationBundle } from '../../src/engine/hardware/catalog';
import { legacyModularToCanonical } from '../../src/engine/hardware/state';

describe('Control Panel, Hardware & Software Management', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    const canonical = legacyModularToCanonical(createPowerWorkstationBundle());
    engine = new SimulationEngine({
      computer: canonical.computer,
      display: canonical.display,
      os: { currentOsId: 'Orion_4.8', installedPatchIds: [] },
      installedSoftware: [],
    } as any);
    engine.hardware.upgradeRam(512);
  });

  it('calculates disk storage utilization accurately', () => {
    const hw = engine.hardware.getState();
    expect(hw.hddTotalGB).toBeGreaterThan(0);
    expect(hw.hddFreeGB).toBeGreaterThan(0);
    expect(hw.hddFreeGB).toBeLessThan(hw.hddTotalGB);
  });

  it('calculates RAM pressure ratio from installed RAM and the authoritative OS baseline', () => {
    const osBaseline = engine.os.getRamOverheadMB();
    const pressure = engine.hardware.calculateRamPressure(128, osBaseline);
    expect(pressure.totalRamMB).toBe(512);
    expect(pressure.usedRamMB).toBe(osBaseline + 128);
    expect(pressure.pressureRatio).toBeCloseTo((osBaseline + 128) / 512, 2);
    expect(pressure.status).toBe('nominal');
  });

  it('uninstalls software and removes shortcuts cleanly', () => {
    engine.dispatchAction({ type: 'SOFTWARE_INSTALL', softwareId: 'sw_pulse_52' });
    expect(engine.software.isInstalled('app.pulse')).toBe(true);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeDefined();

    const installedRecord = engine.software.getInstalledSoftware().find((s) => s.appId === 'app.pulse');
    expect(installedRecord).toBeDefined();

    const uninstallRes = engine.dispatchAction({
      type: 'SOFTWARE_UNINSTALL',
      installedId: installedRecord!.id,
    });
    expect(uninstallRes.success).toBe(true);
    expect(engine.software.isInstalled('app.pulse')).toBe(false);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeUndefined();
  });

  it('keeps OS upgrades in OsEngine while hardware supplies physical requirements', () => {
    expect(engine.os.getCurrentOsId()).toBe('Orion_4.8');
    engine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 7 * 1440, reason: 'to Day 8' });
    expect(engine.clock.getTime().day).toBe(8);

    engine.dispatchAction({ type: 'HARDWARE_UPGRADE_RAM', ramMB: 1024, cost: 0 });
    const res = engine.os.beginInstall(
      'Orion_6.0',
      engine.hardware.getState(),
      engine.clock.getTime().day,
      engine.clock.getTotalMinutes(),
    );

    expect(res.success).toBe(true);
    expect(engine.os.getCurrentOsId()).toBe('Orion_6.0');
    expect('osVersion' in engine.hardware.getState()).toBe(false);
  });
});
