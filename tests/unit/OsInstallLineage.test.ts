import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { OsEngine } from '../../src/engine/OsEngine';

const capableHardware = {
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

describe('OS install lineage semantics', () => {
  it('upgrades an installed full release by replacing the current OS', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: 'Orion_4.8' });

    const eligible = os.canInstall('Orion_5.0', capableHardware, 6);
    expect(eligible.ok).toBe(true);

    const result = os.beginInstall('Orion_5.0', capableHardware, 6, 1000);
    expect(result.success).toBe(true);
    expect(result.previousOs).toBe('Orion_4.8');
    expect(os.getCurrentOsId()).toBe('Orion_5.0');
  });

  it('rejects a patch when its required base OS is absent without changing installed state', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: 'Orion_5.0' });
    const before = os.getState();

    const eligible = os.canInstall('Orion_6.1', capableHardware, 10);
    expect(eligible.ok).toBe(false);
    expect(eligible.reasons.join(' ')).toContain('Requires Orion_6.0 first.');

    const result = os.beginInstall('Orion_6.1', capableHardware, 10, 1000);
    expect(result.success).toBe(false);
    expect(os.getState()).toEqual(before);
  });

  it('installs a patch over its required base without replacing the base release', () => {
    const os = new OsEngine(new EventBus(), { currentOsId: 'Orion_6.0' });

    const result = os.beginInstall('Orion_6.1', capableHardware, 10, 1000);

    expect(result.success).toBe(true);
    expect(result.previousOs).toBe('Orion_6.0');
    expect(os.getCurrentOsId()).toBe('Orion_6.0');
    expect(os.getState().installedPatchIds).toContain('Orion_6.1');
    expect(os.getInstalledReleases().map((release) => release.id)).toEqual(
      expect.arrayContaining(['Orion_6.0', 'Orion_6.1']),
    );
  });
});
