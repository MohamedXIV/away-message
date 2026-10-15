import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';

describe('#172 revision-only publication and bounded HUD projection', () => {
  it('notifies change subscribers without building a broad state or leaking owner internals', () => {
    const engine = new SimulationEngine();
    const wholeState = vi.spyOn(engine, 'getState');
    const changes: unknown[] = [];
    const stop = engine.subscribeChanges(change => changes.push(change));
    expect(wholeState).not.toHaveBeenCalled();
    const atStart = engine.clock.getTotalMinutes();
    expect(changes).toEqual([{ revision: 0, atMinute: atStart, changedDomains: ['unknown'] }]);
    expect(engine.getHudProjection()).toMatchObject({
      revision: 0, time: { totalMinutes: atStart },
      cash: engine.economy.getState().cash,
    });
    expect(wholeState).not.toHaveBeenCalled();

    engine.advanceGameMinutes(10, 'bounded pub fixture');
    expect(engine.getRevision()).toBeGreaterThan(0);
    expect(changes.length).toBeGreaterThan(1);
    expect(changes.at(-1)).toMatchObject({
      revision: engine.getRevision(),
      atMinute: atStart + 10,
      changedDomains: expect.arrayContaining(['clock', 'unknown']),
    });
    const hud = engine.getHudProjection();
    expect(hud.revision).toBe(engine.getRevision());
    expect(hud.time.totalMinutes).toBe(atStart + 10);
    expect(JSON.parse(JSON.stringify(changes.at(-1)))).toEqual(changes.at(-1));
    expect(wholeState).not.toHaveBeenCalled();

    const beforeStop = changes.length;
    stop();
    engine.advanceGameMinutes(5, 'after unsubscribe');
    expect(changes).toHaveLength(beforeStop);
    wholeState.mockRestore();
  });

  it('coalesces owner-emitted domains without pretending silent writers are covered', () => {
    const engine = new SimulationEngine();
    const observations: string[][] = [];
    const off = engine.subscribeChanges(change => observations.push([...change.changedDomains]));
    engine.dispatchAction({ type: 'WORLD_SET_FLAG', key: 'publisher_fixture', value: true });
    expect(observations.at(-1)).toEqual(expect.arrayContaining(['world', 'unknown']));
    const set = new Set(observations.at(-1));
    expect(set.size).toBe(observations.at(-1)?.length); // one domain per boundary
    engine.advanceGameMinutes(2, 'domain event fixture');
    expect(observations.at(-1)).toEqual(expect.arrayContaining(['clock', 'unknown']));
    off();
  });

  it('keeps legacy full-snapshot subscription behavior while migrating consumers', () => {
    const engine = new SimulationEngine();
    const wholeState = vi.spyOn(engine, 'getState');
    const states: Array<{ minute: number }> = [];
    const stop = engine.subscribe(snapshot => states.push({ minute: snapshot.time.totalMinutes }));
    expect(wholeState).toHaveBeenCalledTimes(1);
    engine.advanceGameMinutes(2, 'legacy subscriber parity');
    expect(states.at(-1)?.minute).toBe(engine.clock.getTotalMinutes());
    expect(wholeState).toHaveBeenCalledTimes(2);
    stop();
  });

  it('Zustand consumes the delivered snapshot and avoids command follow-up rebuild', () => {
    const previous = useSimulationStore.getState().engine;
    const engine = new SimulationEngine();
    const wholeState = vi.spyOn(engine, 'getState');
    try {
      useSimulationStore.getState().setEngine(engine);
      expect(wholeState).toHaveBeenCalledTimes(1);
      const calls = wholeState.mock.calls.length;
      const result = useSimulationStore.getState().dispatchAction({
        type: 'TIME_ADVANCE_MINUTES', minutes: 5, reason: 'store read dedup',
      });
      expect(result.success).toBe(true);
      expect(wholeState.mock.calls.length - calls).toBe(1);
      expect(useSimulationStore.getState().state.time.totalMinutes).toBe(engine.clock.getTotalMinutes());
    } finally {
      useSimulationStore.getState().setEngine(previous);
      wholeState.mockRestore();
    }
  });
});