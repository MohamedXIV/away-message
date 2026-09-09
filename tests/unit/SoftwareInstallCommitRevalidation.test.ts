import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import type { OsVersion } from '../../src/engine/types';

describe('SoftwareRegistry install commit revalidation', () => {
  it('rejects commit when hardware stops satisfying requirements after preflight', () => {
    const eventBus = new EventBus();
    const vfs = new FileSystemEngine(eventBus);
    const hardware: { os: OsVersion | null; ramMb: number; cpuTier: number } = {
      os: 'Orion_4.8',
      ramMb: 512,
      cpuTier: 1,
    };
    const registry = new SoftwareRegistry(eventBus, vfs, {
      getOsVersion: () => hardware.os,
      getRamMb: () => hardware.ramMb,
      getCpuTier: () => hardware.cpuTier,
    });

    const session = registry.startInstallerWizard('sw_pulse_52');
    expect(session.compatibilityResult.isCompatible).toBe(true);

    hardware.ramMb = 256;

    expect(() => registry.completeInstallation(session.sessionId, 20)).toThrow(
      /requirements|compatibility/i,
    );
    expect(registry.isInstalled('app.pulse')).toBe(false);
  });
});
