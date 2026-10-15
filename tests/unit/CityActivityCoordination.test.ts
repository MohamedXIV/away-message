import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { CityActivityCoordination } from '../../src/engine/kernel/CityActivityCoordination';

function city(engine: SimulationEngine): CityActivityCoordination {
  return (engine as unknown as { core: { cityActivity: CityActivityCoordination } }).core.cityActivity;
}

describe('CityActivityCoordination — one Economy/Needs/World authority', () => {
  it('uses the same city policy for direct and dispatched travel actions', () => {
    const engine = new SimulationEngine();
    const policy = city(engine);
    expect(policy).toBeInstanceOf(CityActivityCoordination);
    const before = engine.clock.getTotalMinutes();

    const result = engine.dispatchAction({ type: 'TRAVEL_TO', to: 'diner', mode: 'walk' });
    expect(result.success).toBe(true);
    expect(engine.economy.getLocation()).toBe('diner');
    expect(engine.clock.getTotalMinutes()).toBe(before + 20);

    expect(policy.travelTo('diner', 'walk').data?.minutes).toBe(0);
    expect(engine.clock.getTotalMinutes()).toBe(before + 20);
  });

  it('rejects invalid locations and outings without charging any canonical resource', () => {
    const engine = new SimulationEngine();
    const policy = city(engine);
    const before = engine.exportSnapshot();

    expect(policy.travelTo('nowhere', 'walk').success).toBe(false);
    expect(policy.doCityOuting('unknown_outing').success).toBe(false);
    expect(engine.exportSnapshot().player.cash).toBe(before.player.cash);
    expect(engine.economy.getLocation()).toBe('home');
    expect(engine.clock.getTotalMinutes()).toBe(before.time.totalMinutes);
  });

  it('shares the live authored outing gate across direct API and action dispatcher', () => {
    const engine = new SimulationEngine();
    expect(city(engine).doCityOuting('diner_soup').success).toBe(false);
    expect(engine.dispatchAction({
      type: 'PLAYER_CITY_OUTING', outingId: 'diner_soup',
    }).success).toBe(false);
    expect(engine.economy.getLocation()).toBe('home');
  });
});
