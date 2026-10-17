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

  it('publishes explicit direct domain writes once for bounded React views and legacy state', () => {
    const previous = useSimulationStore.getState().engine;
    const engine = new SimulationEngine();
    const getState = vi.spyOn(engine, 'getState');
    const changes: number[] = [];
    try {
      useSimulationStore.getState().setEngine(engine);
      const stop = engine.subscribeChanges(change => changes.push(change.revision));
      const baseline = engine.getRevision();
      const before = getState.mock.calls.length;

      // Direct domain owner writes do not go through the CommandBus.
      engine.world.setFlag('met_in_person', true);
      useSimulationStore.getState().syncStateFromEngine();
      expect(engine.getRevision()).toBe(baseline + 1);
      expect(changes.at(-1)).toBe(baseline + 1);
      expect(engine.getWorldRead().metInPerson).toBe(true);
      expect(getState.mock.calls.length - before).toBe(0); // change-only hot path
      expect(useSimulationStore.getState().state.world.flags.met_in_person).toBe(true);
      expect(getState.mock.calls.length - before).toBe(1); // explicit legacy read
      expect(useSimulationStore.getState().state.time.totalMinutes).toBe(engine.clock.getTotalMinutes());
      expect(getState.mock.calls.length - before).toBe(1); // one snapshot per revision

      // Full legacy listeners are removed when unbinding, change-only
      // reads still deliver no giant snapshots.
      stop();
    } finally {
      useSimulationStore.getState().setEngine(previous);
      getState.mockRestore();
    }
  });

  it('isolates serializable change payloads from mutation by earlier subscribers', () => {
    const engine = new SimulationEngine();
    const whole = vi.spyOn(engine, 'getState');
    const first: string[][] = [];
    const second: string[][] = [];
    const stopFirst = engine.subscribeChanges(change => {
      expect(Object.isFrozen(change)).toBe(true);
      expect(Object.isFrozen(change.changedDomains)).toBe(true);
      expect(() => (change.changedDomains as string[]).push('fake_domain')).toThrow();
      first.push([...change.changedDomains]);
    });
    const stopSecond = engine.subscribeChanges(change => second.push([...change.changedDomains]));
    expect(first).toEqual([['unknown']]);
    expect(second).toEqual([['unknown']]);

    engine.dispatchAction({ type: 'WORLD_SET_FLAG', key: 'frozen_revision_172', value: true });
    expect(first).toHaveLength(2);
    // World is source-backed. The kernel may also legitimately reconcile
    // derived Mood at the same atomic publication boundary.
    expect(first[1]).toEqual(expect.arrayContaining(['world', 'unknown']));
    expect(first[1]).not.toContain('fake_domain');
    expect(second).toEqual(first);
    expect(whole).not.toHaveBeenCalled();
    stopSecond();
    stopFirst();
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

  it('publishes Zustand revisions without full snapshot construction until explicitly read', () => {
    const previous = useSimulationStore.getState().engine;
    const engine = new SimulationEngine();
    const wholeState = vi.spyOn(engine, 'getState');
    try {
      useSimulationStore.getState().setEngine(engine);
      expect(wholeState).not.toHaveBeenCalled();
      const before = useSimulationStore.getState().state;
      // World flag mutation has no internal PC/NPC snapshot dependencies.
      // Time advancement itself may call the legacy kernel read for NPC
      // coordination; this assertion isolates Zustand publication cost.
      const result = useSimulationStore.getState().dispatchAction({
        type: 'WORLD_SET_FLAG', key: 'lazy_publisher_smoke', value: true,
      });
      expect(result.success).toBe(true);
      expect(wholeState).not.toHaveBeenCalled(); // no normal UI publication cost
      const after = useSimulationStore.getState().state;
      expect(after).not.toBe(before);
      expect(after.world.flags.lazy_publisher_smoke).toBe(true);
      const callsForExplicitMaterialization = wholeState.mock.calls.length;
      // Kernel's composed getState can make nested internal reads. The lazy
      // legacy proxy must reuse that ONE materialized result per revision.
      expect(callsForExplicitMaterialization).toBeGreaterThan(0);
      expect(after.player.cash).toBe(engine.economy.getState().cash);
      expect(wholeState.mock.calls.length).toBe(callsForExplicitMaterialization);

      engine.world.setFlag('lazy_publisher_next', true);
      engine.publishExternalChange();
      expect(wholeState.mock.calls.length).toBe(callsForExplicitMaterialization);
      const nextView = useSimulationStore.getState().state;
      expect(nextView).not.toBe(after);
      expect(nextView.world.flags.lazy_publisher_next).toBe(true);
      const callsForNextMaterialization = wholeState.mock.calls.length;
      expect(callsForNextMaterialization).toBeGreaterThan(callsForExplicitMaterialization);
      expect(nextView.player.cash).toBe(engine.economy.getState().cash);
      expect(wholeState.mock.calls.length).toBe(callsForNextMaterialization);
    } finally {
      useSimulationStore.getState().setEngine(previous);
      wholeState.mockRestore();
    }
  });
});