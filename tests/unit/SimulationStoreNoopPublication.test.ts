import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';

describe('#172 Zustand action publication matches canonical commits', () => {
  it('rejects invalid CommandBus and direct computer actions without synthetic revisions', () => {
    const priorEngine = useSimulationStore.getState().engine;
    const engine = new SimulationEngine();
    const full = vi.spyOn(engine, 'getState');
    const received: number[] = [];
    try {
      useSimulationStore.getState().setEngine(engine);
      const stop = engine.subscribeChanges(change => received.push(change.revision));
      received.length = 0;
      const baseline = engine.getRevision();
      const initialLegacyState = useSimulationStore.getState().state;

      expect(useSimulationStore.getState().dispatchAction({
        type: 'PLAYER_SPEND_CASH', amount: 10000000, reason: 'rejected spend regression',
      }).success).toBe(false);
      expect(useSimulationStore.getState().purchaseStoreItem('not-a-real-sku').success).toBe(false);
      expect(useSimulationStore.getState().setupComputerAtHome().success).toBe(false);
      expect(useSimulationStore.getState().setComputerPower(true).success).toBe(false);
      expect(useSimulationStore.getState().insertOwnedMediaAtHome('missing-media').success).toBe(false);
      expect(useSimulationStore.getState().ejectOwnedMediaAtHome().success).toBe(false);

      expect(engine.getRevision()).toBe(baseline);
      expect(received).toHaveLength(0);
      expect(useSimulationStore.getState().state).toBe(initialLegacyState);
      expect(full).not.toHaveBeenCalled();
      stop();
    } finally {
      useSimulationStore.getState().setEngine(priorEngine);
      full.mockRestore();
    }
  });

  it('publishes real purchases/setup/power once, and leaves repeated power as a true no-op', () => {
    const priorEngine = useSimulationStore.getState().engine;
    const engine = new SimulationEngine();
    const full = vi.spyOn(engine, 'getState');
    const changes: Array<{ revision: number; domains: readonly string[] }> = [];
    try {
      useSimulationStore.getState().setEngine(engine);
      const stop = engine.subscribeChanges(change => changes.push({
        revision: change.revision, domains: change.changedDomains,
      }));
      changes.length = 0;

      expect(useSimulationStore.getState().purchaseStoreItem('bundle_scrapyard').success).toBe(true);
      expect(changes).toHaveLength(1);
      expect(changes[0]?.domains).toEqual(expect.arrayContaining(['inventory', 'unknown']));
      expect(engine.getPcBootState()).toBe('awaiting_setup');

      expect(useSimulationStore.getState().setupComputerAtHome().success).toBe(true);
      expect(changes).toHaveLength(2);
      expect(changes[1]?.domains).toEqual(expect.arrayContaining(['hardware', 'inventory', 'clock', 'unknown']));
      expect(engine.getPcBootState()).toBe('powered_off');

      expect(useSimulationStore.getState().setComputerPower(true).success).toBe(true);
      expect(changes).toHaveLength(3);
      expect(changes[2]?.domains).toEqual(expect.arrayContaining(['hardware', 'unknown']));
      expect(engine.getPcBootState()).toBe('no_boot_device');

      const revision = engine.getRevision();
      const publishedLegacyState = useSimulationStore.getState().state;
      expect(useSimulationStore.getState().setComputerPower(true).success).toBe(true);
      expect(engine.getRevision()).toBe(revision);
      expect(changes).toHaveLength(3);
      expect(useSimulationStore.getState().state).toBe(publishedLegacyState);

      expect(useSimulationStore.getState().setComputerPower(false).success).toBe(true);
      expect(changes).toHaveLength(4);
      expect(changes[3]?.revision).toBe(revision + 1);
      expect(engine.getPcBootState()).toBe('powered_off');
      expect(full).not.toHaveBeenCalled();
      stop();
    } finally {
      useSimulationStore.getState().setEngine(priorEngine);
      full.mockRestore();
    }
  });
  it('does not fabricate Zustand revisions for successful no-op commands', () => {
    const priorEngine = useSimulationStore.getState().engine;
    const engine = new SimulationEngine();
    const full = vi.spyOn(engine, 'getState');
    const seen: Array<{ revision: number; domains: readonly string[] }> = [];
    try {
      useSimulationStore.getState().setEngine(engine);
      const stop = engine.subscribeChanges(change => seen.push({
        revision: change.revision, domains: change.changedDomains,
      }));
      seen.length = 0;
      const initial = useSimulationStore.getState().state;
      const baseline = engine.getRevision();
      const dispatch = useSimulationStore.getState().dispatchAction;

      // These commands are successful by contract but write nothing.
      expect(dispatch({ type: 'TIME_ADVANCE_MINUTES', minutes: 0 }).success).toBe(true);
      expect(dispatch({ type: 'VFS_EMPTY_TRASH' }).success).toBe(true);
      expect(dispatch({ type: 'TIME_SET_PAUSED', paused: false }).success).toBe(true);
      expect(engine.getRevision()).toBe(baseline);
      expect(seen).toHaveLength(0);
      expect(useSimulationStore.getState().state).toBe(initial);
      expect(full).not.toHaveBeenCalled();

      expect(dispatch({ type: 'TIME_SET_PAUSED', paused: true }).success).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0]!.domains).toContain('unknown');
      const pausedView = useSimulationStore.getState().state;
      expect(dispatch({ type: 'TIME_SET_PAUSED', paused: true }).success).toBe(true);
      expect(engine.getRevision()).toBe(baseline + 1);
      expect(seen).toHaveLength(1);
      expect(useSimulationStore.getState().state).toBe(pausedView);

      expect(dispatch({ type: 'WORLD_SET_FLAG', key: 'bounded_noop_172', value: true }).success).toBe(true);
      expect(seen).toHaveLength(2);
      const worldView = useSimulationStore.getState().state;
      expect(dispatch({ type: 'WORLD_SET_FLAG', key: 'bounded_noop_172', value: true }).success).toBe(true);
      expect(dispatch({ type: 'NARRATIVE_SET_FLAG', key: 'bounded_noop_172', value: true }).success).toBe(true);
      expect(seen).toHaveLength(2);
      expect(engine.getRevision()).toBe(baseline + 2);
      expect(useSimulationStore.getState().state).toBe(worldView);
      expect(full).not.toHaveBeenCalled();
      stop();
    } finally {
      useSimulationStore.getState().setEngine(priorEngine);
      full.mockRestore();
    }
  });

});
