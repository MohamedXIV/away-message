import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import type { CoreSimulationRuntime } from '../../src/engine/kernel/CoreSimulationRuntime';
import type { NpcComputerSimulationRuntime } from '../../src/engine/kernel/NpcComputerSimulationRuntime';
import type { PhysicalSimulationRuntime } from '../../src/engine/kernel/PhysicalSimulationRuntime';

function graph(engine: SimulationEngine) {
  return engine as unknown as {
    core: CoreSimulationRuntime;
    npc: NpcComputerSimulationRuntime;
    physical: PhysicalSimulationRuntime;
  };
}

describe('#171 atomic composed-kernel production contract', () => {
  it('exports the sole composed kernel through the historical public path without executable inheritance', () => {
    expect(SimulationEngine).toBe(SimulationKernel);
    expect(Object.getPrototypeOf(SimulationEngine.prototype)).toBe(Object.prototype);
    const engine = new SimulationEngine();
    expect(Object.getPrototypeOf(engine)).toBe(SimulationKernel.prototype);
  });

  it('contains neither of the retired inherited execution modules', () => {
    expect(existsSync(new URL('../../src/engine/SimulationEngineCore.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../src/engine/SimulationEngineLegacyFacade.ts', import.meta.url))).toBe(false);
  });

  it('uses the same clock, event bus, inventory and domain authorities throughout its composition', () => {
    const engine = new SimulationEngine();
    const owners = graph(engine);
    expect(owners.core.clock).toBe(engine.clock);
    expect(owners.core.events).toBe(engine.events);
    expect(owners.core.social).toBe(engine.social);
    expect(owners.core.economy).toBe(engine.economy);
    expect(owners.core.hardware).toBe(engine.hardware);
    expect(owners.npc.inventory).toBe(engine.inventory);
    expect(owners.physical.getScenarioState()).toEqual(engine.getScenarioState());
    expect(owners.physical.getResidenceState()).toEqual(engine.getResidenceState());
    expect(owners.physical.getPhysicalWorldState()).toEqual(engine.getPhysicalWorldState());
  });

  it('publishes one coherent current-format player mutation and retains it after a snapshot roundtrip', () => {
    const engine = new SimulationEngine();
    const observations: Array<{ cash: number; flag: unknown }> = [];
    const unsubscribe = engine.subscribe((state) => {
      observations.push({ cash: state.player.cash, flag: state.world.flags['kernel:contract'] });
    });
    const startingCash = engine.economy.getCash();
    const result = engine.dispatchAction({
      type: 'WORLD_SET_FLAG', key: 'kernel:contract', value: 'composed',
    });
    expect(result.success).toBe(true);
    expect(observations).toHaveLength(2);
    expect(observations.at(-1)?.flag).toBe('composed');
    expect(engine.economy.getCash()).toBe(startingCash);
    const snapshot = engine.exportSnapshot();
    const restored = new SimulationEngine();
    restored.loadSnapshot(snapshot);
    expect(restored.exportSnapshot().world.flags['kernel:contract']).toBe('composed');
    expect(restored.exportSnapshot().player.cash).toBe(startingCash);
    unsubscribe();
  });

  it('keeps state projection and snapshot queries free of mood/event mutations', () => {
    const engine = new SimulationEngine();
    let changedEvents = 0;
    engine.events.on('mood:changed', () => { changedEvents++; });
    const before = engine.mood.getState();
    const first = engine.getState();
    const second = engine.getState();
    engine.exportSnapshot();
    expect(first.mood).toEqual(second.mood);
    expect(engine.mood.getState()).toEqual(before);
    expect(changedEvents).toBe(0);

    expect(engine.dispatchAction({
      type: 'WORLD_SET_FLAG', key: 'kernel:publication', value: true,
    }).success).toBe(true);
    expect(changedEvents).toBe(1);
    engine.getState();
    expect(changedEvents).toBe(1);
  });

  it('publishes a completed game-minute transaction only after NPC owners settle', () => {
    const engine = new SimulationEngine();
    const states: Array<{ time: number; mobility: unknown; lives: unknown }> = [];
    const unsubscribe = engine.subscribe((state) => {
      states.push({
        time: state.time.totalMinutes,
        mobility: state.npcMobility,
        lives: state.npcLives,
      });
    });
    const beforeMinute = engine.clock.getTotalMinutes();

    engine.advanceGameMinutes(60, 'atomic-minute-publication');

    expect(engine.clock.getTotalMinutes()).toBe(beforeMinute + 60);
    expect(states).toHaveLength(2);
    expect(states.at(-1)?.time).toBe(beforeMinute + 60);
    expect(states.at(-1)?.mobility).toEqual(engine.getNpcMobilityState());
    expect(states.at(-1)?.lives).toEqual(engine.getNpcLivesState());
    unsubscribe();
  });

  it('does not publish or run population-wide work on zero-minute realtime frames', () => {
    const engine = new SimulationEngine();
    let publications = 0;
    let timeTicks = 0;
    const unsubscribe = engine.subscribe(() => { publications++; });
    engine.events.on('time:tick', () => { timeTicks++; });
    const minute = engine.clock.getTotalMinutes();
    engine.advanceRealTime(1 / 60);
    expect(engine.clock.getTotalMinutes()).toBe(minute);
    expect(timeTicks).toBe(0);
    expect(publications).toBe(1);
    unsubscribe();
  });
});
