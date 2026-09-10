import { afterEach, describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import type { ActionResult } from '../../src/engine/types';

type LifecycleStore = ReturnType<typeof useSimulationStore.getState> & {
  setupComputerAtHome(): ActionResult;
  setComputerPower(poweredOn: boolean): ActionResult;
};

const originalEngine = useSimulationStore.getState().engine;

afterEach(() => {
  useSimulationStore.getState().setEngine(originalEngine);
});

describe('simulation store computer lifecycle actions', () => {
  it('sets up the owned Room 104 package and synchronizes canonical computer state', () => {
    const engine = new SimulationEngine();
    useSimulationStore.getState().setEngine(engine);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    useSimulationStore.getState().syncStateFromEngine();

    const store = useSimulationStore.getState() as LifecycleStore;
    const result = store.setupComputerAtHome();

    expect(result.success).toBe(true);
    expect(useSimulationStore.getState().state.computer.assembled).toBe(true);
    expect(useSimulationStore.getState().state.computer.poweredOn).toBe(false);
    expect(useSimulationStore.getState().state.os.currentOsId).toBeNull();
  });

  it('powers the assembled computer and synchronizes the no-boot-device state inputs', () => {
    const engine = new SimulationEngine();
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    useSimulationStore.getState().setEngine(engine);

    const store = useSimulationStore.getState() as LifecycleStore;
    const result = store.setComputerPower(true);

    expect(result.success).toBe(true);
    expect(useSimulationStore.getState().state.computer.poweredOn).toBe(true);
    expect(useSimulationStore.getState().state.os.currentOsId).toBeNull();
  });
});
