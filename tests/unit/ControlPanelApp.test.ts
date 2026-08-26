import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Control Panel, Hardware & Software Management', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('calculates disk storage utilization accurately', () => {
    const hw = engine.hardware.getState();
    expect(hw.hddTotalGB).toBe(40);
    expect(hw.hddFreeGB).toBeGreaterThan(0);
    expect(hw.hddFreeGB).toBeLessThan(40);
  });

  it('calculates RAM pressure ratio from installed RAM', () => {
    const pressure = engine.hardware.calculateRamPressure(128); // 128 MB used by running apps
    expect(pressure.totalRamMB).toBe(512);
    // Baseline OS 4.8 uses 64MB + 128MB = 192MB
    expect(pressure.usedRamMB).toBe(192);
    expect(pressure.pressureRatio).toBeCloseTo(192 / 512, 2);
    expect(pressure.status).toBe('nominal');
  });

  it('uninstalls software and removes shortcuts cleanly', () => {
    // Install Pulse Messenger
    engine.dispatchAction({ type: 'SOFTWARE_INSTALL', softwareId: 'sw_pulse_52' });
    expect(engine.software.isInstalled('app.pulse')).toBe(true);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeDefined();

    const installedRecord = engine.software.getInstalledSoftware().find((s) => s.appId === 'app.pulse');
    expect(installedRecord).toBeDefined();

    // Uninstall
    const uninstallRes = engine.dispatchAction({
      type: 'SOFTWARE_UNINSTALL',
      installedId: installedRecord!.id,
    });
    expect(uninstallRes.success).toBe(true);
    expect(engine.software.isInstalled('app.pulse')).toBe(false);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeUndefined();
  });

  it('handles OS version upgrade/switch cleanly', () => {
    expect(engine.hardware.getState().osVersion).toBe('Orion_4.8');

    // Upgrade RAM to 1024 MB to meet Orion 6.0 requirement (>= 768 MB)
    engine.dispatchAction({
      type: 'HARDWARE_UPGRADE_RAM',
      ramMB: 1024,
      cost: 0,
    });

    const res = engine.dispatchAction({
      type: 'HARDWARE_UPGRADE_OS',
      targetOs: 'Orion_6.0',
      cost: 0,
    });

    expect(res.success).toBe(true);
    expect(engine.hardware.getState().osVersion).toBe('Orion_6.0');
  });
});
