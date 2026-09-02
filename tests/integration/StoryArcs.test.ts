import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

// Deprecated Ink story arc — sandbox mode no longer uses beats.
// This file is kept as a skipped regression stub.

describe('14-Day Full Story Arcs Integration Test Suite (deprecated — sandbox)', () => {
  let simEngine: SimulationEngine;

  beforeEach(() => {
    simEngine = new SimulationEngine();
  });

  it.skip('runs complete 14-day evaluation story arc from Day 1 to Day 14 free play unlock', () => {
    expect(simEngine.getState().time.day).toBe(1);
    // Sandbox: beat-based assertions removed. See WorldEventsEngine tests.
  });

  it('sandbox world events trigger on day advance', () => {
    expect(simEngine.getState().world.triggeredEvents.length).toBe(0);
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 3 * 1440, reason: 'jump to day 4' });
    const state = simEngine.getState();
    expect(state.world.triggeredEvents.length).toBeGreaterThan(0);
    expect(state.world.triggeredEvents.some((e) => e.id === 'myplace_v2_launch')).toBe(true);
  });
});
