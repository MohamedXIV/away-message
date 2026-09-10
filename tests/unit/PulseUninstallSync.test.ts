import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Pulse installed-release synchronization', () => {
  it('uninstall removes Pulse launch/version truth without erasing social history', () => {
    const snapshot = new SimulationEngine().exportSnapshot();
    snapshot.installedSoftware = [
      {
        id: 'inst_sw_pulse_52',
        appId: 'app.pulse',
        name: 'Pulse Messenger',
        version: '5.2',
        installedBytes: 33_554_432,
        installPath: 'C:/Program Files/Pulse',
        installedAtMinute: 10,
        isPortable: false,
        isAdware: false,
        shortcuts: [],
      },
    ];
    snapshot.pulse.currentPulseId = 'pulse_5.2';

    const engine = new SimulationEngine(snapshot);
    const socialBefore = engine.exportSnapshot().social;

    expect(engine.software.isInstalled('app.pulse')).toBe(true);
    expect(engine.pulse.getCurrentPulseId()).toBe('pulse_5.2');

    expect(engine.software.uninstallSoftware('inst_sw_pulse_52')).toBe(true);

    expect(engine.software.isInstalled('app.pulse')).toBe(false);
    expect(engine.pulse.getCurrentPulseId()).toBeNull();
    expect(engine.exportSnapshot().social).toEqual(socialBefore);
  });
});
