import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Open-ended sandbox continuity', () => {
  let sim: SimulationEngine;

  beforeEach(() => {
    sim = new SimulationEngine();
  });

  it('world events continue as time advances without a campaign ending', () => {
    sim.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 3 * 1440, reason: 'advance sandbox' });
    expect(sim.getState().world.triggeredEvents.length).toBeGreaterThan(0);
    expect(sim.getState().world.triggeredEvents.some((e) => e.id === 'myplace_v2_launch')).toBe(true);
  });

  it('continues well beyond two weeks without completion/free-play semantics', () => {
    sim.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 30 * 1440, reason: 'long sandbox run' });
    const state = sim.getState();
    expect(state.time.day).toBeGreaterThan(14);
    expect(state.world.flags['evaluation_complete']).toBeUndefined();
    expect(state.world.flags['free_play_unlocked']).toBeUndefined();
  });
});
