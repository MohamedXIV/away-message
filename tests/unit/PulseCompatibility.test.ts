import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { PulseEngine } from '../../src/engine/PulseEngine';
import { clearProceduralPulseReleases } from '../../src/engine/PulseCatalog';
import type { HardwareState, OsVersion } from '../../src/engine/types';

const capableHardware = {
  ramMB: 1024,
  hddFreeGB: 10,
} as HardwareState;

afterEach(() => {
  clearProceduralPulseReleases();
});

describe('Pulse compatibility uses ordered Orion requirements', () => {
  it('honors arbitrary minimum OS releases instead of hard-coded Pulse 6 checks', () => {
    const pulse = new PulseEngine(new EventBus());
    pulse.registerProceduralRelease({
      id: 'pulse_5.4-test',
      version: '5.4',
      build: '5.4.0-test',
      displayName: 'Pulse Messenger 5.4 Test',
      family: '5.x',
      kind: 'minor',
      channel: 'stable',
      releaseDay: 1,
      changelog: ['Compatibility-ordering regression fixture'],
      requirements: {
        minOs: 'Orion_5.0' as OsVersion,
        minRamMB: 512,
        minDiskMB: 8,
      },
      installSizeMB: 8,
    });

    const tooOld = pulse.canInstall('pulse_5.4-test', capableHardware, 'Orion_4.8', 1);
    expect(tooOld.ok).toBe(false);
    expect(tooOld.reasons).toContain('Requires Orion_5.0 or later (have Orion_4.8).');

    const exactMinimum = pulse.canInstall('pulse_5.4-test', capableHardware, 'Orion_5.0', 1);
    expect(exactMinimum.ok).toBe(true);
  });
});
