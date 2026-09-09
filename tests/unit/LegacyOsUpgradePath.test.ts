import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('legacy OS upgrade path retirement', () => {
  it('rejects the old cash-plus-install action even when an OS is already installed', () => {
    const engine = new SimulationEngine({
      os: {
        currentOsId: 'Orion_4.8',
        installedPatchIds: [],
      },
    });
    const before = engine.getState();

    const result = engine.dispatchAction({
      type: 'HARDWARE_UPGRADE_OS',
      targetOs: 'Orion_5.0',
      cost: 29,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/legacy os upgrades are retired/i);
    expect(engine.getState().player.cash).toBe(before.player.cash);
    expect(engine.getState().os.currentOsId).toBe('Orion_4.8');
  });
});
