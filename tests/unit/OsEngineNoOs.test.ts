import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { OsEngine } from '../../src/engine/OsEngine';

const emptyHardware = {
  hasComputer: true,
  isPoweredOn: true,
  cpuTier: 2,
  cpuName: 'Test CPU',
  ramMB: 1024,
  hddTotalGB: 20,
  hddFreeGB: 10,
  connectionType: 'dsl_256k' as const,
  connectionSpeedKbps: 256,
  soundCardInstalled: true,
  speakersInstalled: false,
  webcamInstalled: false,
};

describe('OsEngine without an installed operating system', () => {
  it('does not invent Orion 4.8', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: null });

    expect(os.getCurrentOsId()).toBeNull();
    expect(os.getCurrentRelease()).toBeNull();
    expect(os.getInstalledReleases()).toEqual([]);
    expect(os.getTheme()).toBeNull();
    expect(os.getRamOverheadMB()).toBe(0);
    expect(os.getBootTimeSeconds()).toBe(0);
  });

  it('round-trips explicit null state', () => {
    const first = new OsEngine(new EventBus(), { currentOsId: null });
    const second = new OsEngine(new EventBus(), first.getState());
    expect(second.getCurrentOsId()).toBeNull();
  });

  it('reports software compatibility failure when no OS is installed', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: null });
    const result = os.checkCompatibility({
      minOs: 'Orion_4.8',
      minRamMB: 64,
      minCpuTier: 1,
      requiredDiskBytes: 1,
    });

    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain('No operating system installed.');
  });

  it('can evaluate a full release from no OS without downgrade/family crashes', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: null });
    const result = os.canInstall('Orion_4.8', emptyHardware, 1);
    expect(result.reasons.some((reason) => reason.includes('Downgrade'))).toBe(false);
  });
});
