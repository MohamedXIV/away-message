import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('GameContextReadApi (#132)', () => {
  it('provides stable read-only time/environment/needs/mood contracts', () => {
    const sim = new SimulationEngine();
    const time = sim.gameContext.time.current();
    const current = sim.gameContext.environment.current();
    const at = sim.gameContext.environment.at({ atMinute: time.totalMinutes });
    const forecast = sim.gameContext.environment.forecast({
      atMinute: time.totalMinutes,
      count: 3,
    });

    expect(current).toEqual(at);
    expect(forecast).toHaveLength(3);
    expect(sim.gameContext.player.needs()).toEqual(sim.needs.getSnapshot());
    expect(sim.gameContext.player.mood()).toEqual(sim.mood.getCurrentSnapshot());
    expect(Object.isFrozen(sim.gameContext)).toBe(true);
    expect(Object.isFrozen(sim.gameContext.environment)).toBe(true);
  });
});
