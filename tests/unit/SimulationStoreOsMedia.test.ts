import { afterEach, describe, expect, it } from 'vitest';
import { SimulationEngine, type OsInstallPlan } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import type { ActionResult } from '../../src/engine/types';

type OsMediaStore = ReturnType<typeof useSimulationStore.getState> & {
  insertOwnedMediaAtHome(instanceId: string): ActionResult;
  ejectOwnedMediaAtHome(): ActionResult<{ mediaInstanceId: string }>;
  prepareOsInstallFromInsertedMedia(): ActionResult<OsInstallPlan>;
  commitOsInstall(plan: OsInstallPlan): ActionResult;
};

const originalEngine = useSimulationStore.getState().engine;

afterEach(() => {
  useSimulationStore.getState().setEngine(originalEngine);
});

function starterReady(): { engine: SimulationEngine; discId: string } {
  const engine = new SimulationEngine();
  expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
  expect(engine.setupComputerAtHome().success).toBe(true);
  const disc = engine.getState().inventory.items.find(
    (item) => item.catalogItemId === 'media_orion_48_setup',
  );
  expect(disc).toBeDefined();
  return { engine, discId: disc!.instanceId };
}

describe('simulation store physical OS media actions', () => {
  it('inserts and ejects owned media while synchronizing inventory and drive state', () => {
    const { engine, discId } = starterReady();
    useSimulationStore.getState().setEngine(engine);
    const store = useSimulationStore.getState() as OsMediaStore;

    expect(store.insertOwnedMediaAtHome(discId).success).toBe(true);
    expect(useSimulationStore.getState().state.computer.insertedMediaId).toBe(discId);
    expect(
      useSimulationStore.getState().state.inventory.items.find((item) => item.instanceId === discId)?.location,
    ).toBe('inserted');

    expect(store.ejectOwnedMediaAtHome().success).toBe(true);
    expect(useSimulationStore.getState().state.computer.insertedMediaId).toBeNull();
    expect(
      useSimulationStore.getState().state.inventory.items.find((item) => item.instanceId === discId)?.location,
    ).toBe('inventory');
  });

  it('prepares without sync mutation and commits through one synchronized store action', () => {
    const { engine, discId } = starterReady();
    useSimulationStore.getState().setEngine(engine);
    const store = useSimulationStore.getState() as OsMediaStore;
    expect(store.insertOwnedMediaAtHome(discId).success).toBe(true);

    const prepared = store.prepareOsInstallFromInsertedMedia();
    expect(prepared.success).toBe(true);
    expect(prepared.data?.mode).toBe('fresh');
    expect(useSimulationStore.getState().state.os.currentOsId).toBeNull();

    const beforeMinutes = useSimulationStore.getState().state.time.totalMinutes;
    expect(store.commitOsInstall(prepared.data!).success).toBe(true);
    expect(useSimulationStore.getState().state.os.currentOsId).toBe('Orion_4.8');
    expect(useSimulationStore.getState().state.time.totalMinutes - beforeMinutes).toBe(
      prepared.data!.durationMinutes,
    );
  });
});
