import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('generic software install authority', () => {
  it('cannot commit an ordinary app install when the compatibility preflight failed', () => {
    const engine = new SimulationEngine();
    const freeDiskBefore = engine.vfs.getFreeDiskBytes();
    const session = engine.software.startInstallerWizard('sw_pulse_52');

    expect(session.compatibilityResult.isCompatible).toBe(false);
    expect(session.compatibilityResult.osCheck.passed).toBe(false);
    expect(() => engine.software.completeInstallation(session.sessionId, 0)).toThrow(
      /requirements|compatible|compatibility/i,
    );
    expect(engine.software.isInstalled('app.pulse')).toBe(false);
    expect(engine.software.getInstalledSoftware()).toEqual([]);
    expect(engine.vfs.getFreeDiskBytes()).toBe(freeDiskBefore);
    expect(engine.vfs.readFile('C:/Desktop/Pulse Messenger.lnk')).toBeUndefined();
  });
});
