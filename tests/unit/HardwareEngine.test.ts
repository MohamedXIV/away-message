import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { HardwareEngine } from '../../src/engine/HardwareEngine';

describe('HardwareEngine (PC Specifications, Upgrades & OS Compatibility)', () => {
  let eventBus: EventBus;
  let hardware: HardwareEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    hardware = new HardwareEngine(eventBus);
  });

  it('initializes with baseline late-90s PC specs', () => {
    const state = hardware.getState();
    expect(state.osVersion).toBe('Orion_4.8');
    expect(state.ramMB).toBe(512);
    expect(state.cpuTier).toBe(1);
    expect(state.hddTotalGB).toBe(40.0);
    expect(state.hddFreeGB).toBe(7.0);
    expect(state.connectionType).toBe('dsl_256k');
    expect(state.connectionSpeedKbps).toBe(256);
  });

  it('performs RAM upgrade and emits hardware:upgraded event', () => {
    let upgradedComponent = '';
    eventBus.on('hardware:upgraded', ({ component }) => {
      upgradedComponent = component;
    });

    const ok = hardware.upgradeRam(1024);
    expect(ok).toBe(true);
    expect(hardware.getState().ramMB).toBe(1024);
    expect(upgradedComponent).toBe('RAM');

    // Cannot downgrade or keep same
    expect(hardware.upgradeRam(512)).toBe(false);
  });

  it('performs Internet connection tier upgrade', () => {
    hardware.upgradeConnection('dsl_512k');
    expect(hardware.getState().connectionType).toBe('dsl_512k');
    expect(hardware.getState().connectionSpeedKbps).toBe(512);

    hardware.upgradeConnection('dsl_1m');
    expect(hardware.getState().connectionType).toBe('dsl_1m');
    expect(hardware.getState().connectionSpeedKbps).toBe(1024);
  });

  it('enforces RAM and disk space gating on Orion OS 6.0 upgrade', () => {
    // Attempting OS 6 upgrade with only 512MB RAM fails
    const failRes = hardware.upgradeOs('Orion_6.0');
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('768 MB RAM');
    expect(hardware.getState().osVersion).toBe('Orion_4.8');

    // Upgrade RAM to 1024MB
    hardware.upgradeRam(1024);

    // Now OS 6 upgrade succeeds
    const successRes = hardware.upgradeOs('Orion_6.0');
    expect(successRes.success).toBe(true);
    expect(hardware.getState().osVersion).toBe('Orion_6.0');
  });

  it('correctly validates software compatibility requirements', () => {
    // App requiring Orion 4.8 and 512MB RAM (Pulse 5.2)
    const pulse52Req = {
      minOs: 'Orion_4.8' as const,
      minRamMB: 512,
      minCpuTier: 1,
      requiredDiskBytes: 35_000_000,
    };
    const pulseCheck = hardware.checkRequirements(pulse52Req);
    expect(pulseCheck.compatible).toBe(true);

    // App requiring Orion 6.0 and 768MB RAM (PhotoBox 3.0)
    const photoboxReq = {
      minOs: 'Orion_6.0' as const,
      minRamMB: 768,
      minCpuTier: 1,
      requiredDiskBytes: 70_000_000,
    };
    const photoCheckBefore = hardware.checkRequirements(photoboxReq);
    expect(photoCheckBefore.compatible).toBe(false);
    expect(photoCheckBefore.reasons.length).toBeGreaterThan(0);

    // Upgrade RAM and OS
    hardware.upgradeRam(1024);
    hardware.upgradeOs('Orion_6.0');
    const photoCheckAfter = hardware.checkRequirements(photoboxReq);
    expect(photoCheckAfter.compatible).toBe(true);
  });

  it('calculates RAM pressure under varying application loads', () => {
    // Baseline OS 4.8 takes 64MB
    const pressureNominal = hardware.calculateRamPressure(100); // Total 164 / 512 = ~32%
    expect(pressureNominal.status).toBe('nominal');
    expect(pressureNominal.freeRamMB).toBe(512 - 164);

    const pressureElevated = hardware.calculateRamPressure(350); // Total 414 / 512 = ~80%
    expect(pressureElevated.status).toBe('elevated');

    const pressureCritical = hardware.calculateRamPressure(420); // Total 484 / 512 = ~94%
    expect(pressureCritical.status).toBe('critical');
  });
});
