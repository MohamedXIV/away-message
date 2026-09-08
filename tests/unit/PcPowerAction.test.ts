import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { resolvePcBootState } from '../../src/desktop/boot/resolvePcBootState';

function prepareStarter(engine: SimulationEngine): void {
  const purchase = engine.dispatchAction({
    type: 'STORE_PURCHASE_ITEM',
    storeId: 'silicon_spares',
    skuId: 'bundle_scrapyard',
  });
  expect(purchase.success).toBe(true);
  const setup = engine.dispatchAction({ type: 'COMPUTER_SETUP_AT_HOME' } as any);
  expect(setup.success).toBe(true);
}

describe('Issue #8 computer power action', () => {
  it('cannot power on an unassembled computer', () => {
    const engine = new SimulationEngine();
    const before = engine.exportSnapshot();
    const result = engine.dispatchAction({ type: 'COMPUTER_SET_POWER', poweredOn: true } as any);
    expect(result.success).toBe(false);
    expect(engine.getState().computer.poweredOn).toBe(false);
    expect(engine.exportSnapshot()).toEqual(before);
  });

  it('powers an assembled no-OS machine without inventing a desktop', () => {
    const engine = new SimulationEngine();
    prepareStarter(engine);

    const result = engine.dispatchAction({ type: 'COMPUTER_SET_POWER', poweredOn: true } as any);
    expect(result.success).toBe(true);
    const state = engine.getState();
    expect(state.computer.poweredOn).toBe(true);
    expect(state.os.currentOsId).toBeNull();
    expect(resolvePcBootState({
      computer: state.computer,
      osId: state.os.currentOsId,
      inventory: state.inventory,
    })).toBe('no_boot_device');
  });

  it('can power the same assembled machine off again', () => {
    const engine = new SimulationEngine();
    prepareStarter(engine);
    expect(engine.dispatchAction({ type: 'COMPUTER_SET_POWER', poweredOn: true } as any).success).toBe(true);
    expect(engine.dispatchAction({ type: 'COMPUTER_SET_POWER', poweredOn: false } as any).success).toBe(true);
    expect(engine.getState().computer.poweredOn).toBe(false);
  });
});
