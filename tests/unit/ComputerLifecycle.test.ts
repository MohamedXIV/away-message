import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { getRoomDeskPresentation } from '../../src/world/RoomComputerPresentation';
import type { ActionResult } from '../../src/engine/types';

type PcBootState = 'no_computer' | 'awaiting_setup' | 'powered_off' | 'no_boot_device' | 'desktop';

type ComputerLifecycleApi = SimulationEngine & {
  getPcBootState(): PcBootState;
  setComputerPower(poweredOn: boolean): ActionResult;
};

function engineWithLifecycle(): ComputerLifecycleApi {
  return new SimulationEngine() as ComputerLifecycleApi;
}

describe('PC lifecycle and boot routing', () => {
  it('routes a fresh machine from package to powered-off setup and then no-boot-device', () => {
    const engine = engineWithLifecycle();

    expect(engine.getPcBootState()).toBe('no_computer');
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.getPcBootState()).toBe('awaiting_setup');

    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.getPcBootState()).toBe('powered_off');

    const power = engine.setComputerPower(true);
    expect(power.success).toBe(true);
    expect(engine.getPcBootState()).toBe('no_boot_device');
    expect(engine.getState().os.currentOsId).toBeNull();
  });

  it('rejects powering an unassembled package and does not mutate power state', () => {
    const engine = engineWithLifecycle();
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);

    const before = engine.exportSnapshot();
    const result = engine.setComputerPower(true);

    expect(result.success).toBe(false);
    const after = engine.exportSnapshot();
    expect(after.computer.poweredOn).toBe(false);
    expect(after.computer).toEqual(before.computer);
    expect(engine.getPcBootState()).toBe('awaiting_setup');
  });

  it('routes an installed OS to the desktop only after the assembled machine is powered on', () => {
    const engine = engineWithLifecycle();
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);

    const snapshot = engine.exportSnapshot();
    engine.loadSnapshot({
      ...snapshot,
      os: { currentOsId: 'Orion_4.8', installedPatchIds: [] },
    });

    expect(engine.getPcBootState()).toBe('powered_off');
    expect(engine.setComputerPower(true).success).toBe(true);
    expect(engine.getPcBootState()).toBe('desktop');
  });

  it('preserves the assembled powered-off pre-OS state across save and reload', () => {
    const source = engineWithLifecycle();
    expect(source.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(source.setupComputerAtHome().success).toBe(true);

    const saved = source.exportSnapshot();
    const restored = engineWithLifecycle();
    restored.loadSnapshot(saved);

    expect(restored.getPcBootState()).toBe('powered_off');
    expect(restored.getState().computer).toEqual(saved.computer);
    expect(restored.getState().display).toEqual(saved.display);
    expect(restored.getState().inventory).toEqual(saved.inventory);
    expect(restored.getState().os.currentOsId).toBeNull();
  });
});

describe('Room 104 computer presentation', () => {
  it('distinguishes empty, package, assembled-off, and assembled-on desk states', () => {
    expect(getRoomDeskPresentation('no_computer')).toBe('empty');
    expect(getRoomDeskPresentation('awaiting_setup')).toBe('package');
    expect(getRoomDeskPresentation('powered_off')).toBe('assembled_off');
    expect(getRoomDeskPresentation('no_boot_device')).toBe('assembled_on');
    expect(getRoomDeskPresentation('desktop')).toBe('assembled_on');
  });
});
