import { describe, it, expect } from 'vitest';
import {
  checkOsInstallEligibility,
  createInitialInstallState,
} from '../../src/engine/os/OsInstallerEngine';
import type { HardwareState } from '../../src/engine/types';

describe('OS Setup Wizard & Eligibility Gating', () => {
  const baseHardware: HardwareState = {
    hasComputer: true,
    isPoweredOn: true,
    cpuTier: 1,
    cpuName: 'Orion Single-Core 450MHz',
    ramMB: 512,
    hddTotalGB: 40.0,
    hddFreeGB: 8.0,
    connectionType: 'dsl_256k',
    connectionSpeedKbps: 256,
    osVersion: 'Orion_4.8',
    soundCardInstalled: true,
    speakersInstalled: false,
    webcamInstalled: false,
  };

  it('initializes install state in clean idle phase', () => {
    const state = createInitialInstallState();
    expect(state.phase).toBe('idle');
    expect(state.progressPercent).toBe(0);
    expect(state.mode).toBe('upgrade');
    expect(state.targetOs).toBeNull();
  });

  it('approves installation when hardware meets OS requirements', () => {
    // Orion 5.0 requires: 512MB RAM, 1.5GB disk, CPU tier 1
    const result = checkOsInstallEligibility('Orion_5.0', baseHardware);
    expect(result.ok).toBe(true);
    expect(result.release?.displayName).toBe('Orion OS 5.0');
    expect(result.release?.theme).toBe('orion50');
  });

  it('rejects installation when RAM is insufficient for higher generation OS', () => {
    // Orion 6.0 requires 768MB RAM; base has only 512MB
    const result = checkOsInstallEligibility('Orion_6.0', baseHardware);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('768 MB');
  });

  it('rejects installation when free disk space is insufficient', () => {
    const lowDiskHardware: HardwareState = {
      ...baseHardware,
      hddFreeGB: 0.5, // 500 MB free
    };
    const result = checkOsInstallEligibility('Orion_5.0', lowDiskHardware);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('free hard disk space');
  });

  it('rejects unknown or invalid OS identifiers', () => {
    const result = checkOsInstallEligibility('Orion_99.0' as any, baseHardware);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Unknown OS release');
  });
});
