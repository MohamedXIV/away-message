import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Game Context read boundary (#132)', () => {
  it('exposes stable semantic Environment, Needs and Mood reads', () => {
    const sim = new SimulationEngine();
    const time = sim.gameContext.time.current();
    const current = sim.gameContext.environment.current();
    const atCurrent = sim.gameContext.environment.at({ atMinute: time.totalMinutes });
    const forecast = sim.gameContext.environment.forecast({ days: 3 });
    const needs = sim.gameContext.player.needs();
    const mood = sim.gameContext.player.mood();

    expect(current).toEqual(atCurrent);
    expect(forecast).toHaveLength(3);
    expect(forecast[0]?.atMinute).toBe(time.totalMinutes);
    expect(needs.energyBand).toBeDefined();
    expect(needs.hungerBand).toBeDefined();
    expect(mood.band).toBeDefined();
    expect(mood.atMinute).toBe(time.totalMinutes);
  });

  it('returns detached snapshots so consumers cannot mutate authority', () => {
    const sim = new SimulationEngine();
    const first = sim.gameContext.environment.current();
    const originalTagCount = first.weather.tags.length;

    first.weather.tags.push('consumer-mutation');

    expect(sim.gameContext.environment.current().weather.tags).toHaveLength(originalTagCount);
  });

  it('survives save/load and large time jumps through one public context', () => {
    const sim = new SimulationEngine();
    sim.mood.applyEffect({
      kind: 'meaningful_achievement',
      sourceRef: 'test:game-context',
    });
    const before = sim.gameContext.player.mood();
    const restored = new SimulationEngine(sim.exportSnapshot());

    expect(restored.gameContext.player.mood()).toEqual(before);

    restored.advanceGameMinutes(24 * 60);
    const after = restored.gameContext.player.mood();
    expect(after.atMinute).toBe(before.atMinute + 24 * 60);
    expect(after.influences.some((influence) => influence.sourceRef === 'test:game-context')).toBe(false);
  });
});
