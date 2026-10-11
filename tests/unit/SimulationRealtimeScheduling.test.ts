import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function spyOnNpcBoundaryPasses(engine: SimulationEngine) {
  const internals = engine as unknown as {
    advanceAllNpcPressuresToNow: () => void;
    progressNpcMobility: () => void;
  };

  return {
    pressure: vi.spyOn(internals, 'advanceAllNpcPressuresToNow'),
    mobility: vi.spyOn(internals, 'progressNpcMobility'),
  };
}

describe('SimulationEngine realtime scheduling', () => {
  it('runs no population-wide NPC passes before an authoritative minute advances', () => {
    const engine = new SimulationEngine();
    const beforeMinute = engine.clock.getTotalMinutes();
    const passes = spyOnNpcBoundaryPasses(engine);

    engine.advanceRealTime(0.5);

    expect(engine.clock.getTotalMinutes()).toBe(beforeMinute);
    expect(passes.pressure).not.toHaveBeenCalled();
    expect(passes.mobility).not.toHaveBeenCalled();

    engine.advanceRealTime(0.5);

    expect(engine.clock.getTotalMinutes()).toBe(beforeMinute + 1);
    expect(passes.pressure).toHaveBeenCalledTimes(1);
    expect(passes.mobility).toHaveBeenCalledTimes(1);
  });

  it('produces the same NPC time-boundary state for equivalent elapsed time chunks', () => {
    const stepped = new SimulationEngine();
    const singleStep = new SimulationEngine();
    const steppedPasses = spyOnNpcBoundaryPasses(stepped);
    const singleStepPasses = spyOnNpcBoundaryPasses(singleStep);

    for (let step = 0; step < 4; step += 1) {
      stepped.advanceRealTime(0.25);
    }
    singleStep.advanceRealTime(1);

    expect(stepped.clock.getTotalMinutes()).toBe(singleStep.clock.getTotalMinutes());
    expect(stepped.getNpcMobilityState()).toEqual(singleStep.getNpcMobilityState());
    expect(stepped.exportSnapshot().npcLives).toEqual(singleStep.exportSnapshot().npcLives);
    expect(steppedPasses.pressure).toHaveBeenCalledTimes(1);
    expect(steppedPasses.mobility).toHaveBeenCalledTimes(1);
    expect(singleStepPasses.pressure).toHaveBeenCalledTimes(1);
    expect(singleStepPasses.mobility).toHaveBeenCalledTimes(1);
  });

  it('does not run population-wide NPC passes for a zero-minute game-time request', () => {
    const engine = new SimulationEngine();
    const passes = spyOnNpcBoundaryPasses(engine);

    engine.advanceGameMinutes(0, 'no-op');

    expect(passes.pressure).not.toHaveBeenCalled();
    expect(passes.mobility).not.toHaveBeenCalled();
  });
});
