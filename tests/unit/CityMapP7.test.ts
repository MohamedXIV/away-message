import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  CITY_NODES,
  shortestPath,
  quoteTravel,
  walkEnergyCost,
  rollStreetEncounter,
  BUS_FARE,
} from '../../src/engine/CityMap';

describe('P7 city graph (pure)', () => {
  it('connects every node to home and back', () => {
    for (const id of Object.keys(CITY_NODES)) {
      if (id === 'home') continue;
      const path = shortestPath('home', id as any);
      expect(path[0]).toBe('home');
      expect(path[path.length - 1]).toBe(id);
      expect(path.length).toBeGreaterThanOrEqual(2);
    }
    expect(shortestPath('home', 'home')).toEqual(['home']);
  });

  it('quotes walk vs bus honestly (bus only where lines run)', () => {
    const walk = quoteTravel('home', 'diner', 'walk', false);
    expect(walk.minutes).toBe(20); // 2 + 18 via lobby
    expect(walk.cost).toBe(0);
    const bus = quoteTravel('home', 'diner', 'bus', false);
    expect(bus.busUsed).toBe(false); // home-lobby leg has no bus line
    expect(bus.mode).toBe('walk');
    const cafeBus = quoteTravel('lobby', 'cafe', 'bus', false);
    expect(cafeBus.busUsed).toBe(true);
    expect(cafeBus.cost).toBe(BUS_FARE);
    expect(cafeBus.minutes).toBeLessThan(15);
    // Rain slows feet, not buses
    expect(quoteTravel('home', 'canal', 'walk', true).minutes).toBeGreaterThan(
      quoteTravel('home', 'canal', 'walk', false).minutes
    );
  });

  it('prices walk energy leniently', () => {
    expect(walkEnergyCost(0)).toBe(0);
    expect(walkEnergyCost(14)).toBe(0);
    expect(walkEnergyCost(30)).toBe(2);
  });

  it('rolls one deterministic street encounter per trip', () => {
    const a = rollStreetEncounter('home', 'diner', 3, false, [{ id: 'ryan', name: 'Ryan' }]);
    const b = rollStreetEncounter('home', 'diner', 3, false, [{ id: 'ryan', name: 'Ryan' }]);
    expect(a).toEqual(b);
    expect(rollStreetEncounter('home', 'home', 3, false, [])).toBeNull();
    if (a && a.kind === 'greeting') expect(a.text).toContain('Ryan');
  });
});

describe('P7 travel (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('starts at home and travels with time charged', () => {
    expect(sim.economy.getLocation()).toBe('home');
    const before = sim.clock.getTotalMinutes();
    const res = sim.dispatchAction({ type: 'TRAVEL_TO', to: 'diner', mode: 'walk' });
    expect(res.success).toBe(true);
    expect(sim.economy.getLocation()).toBe('diner');
    expect(sim.clock.getTotalMinutes()).toBe(before + 20);
    // Same-node trips are free no-ops
    const again = sim.dispatchAction({ type: 'TRAVEL_TO', to: 'diner', mode: 'walk' });
    expect(again.success).toBe(true);
    expect(sim.clock.getTotalMinutes()).toBe(before + 20);
  });

  it('buses cost fare and halve time where lines run', () => {
    sim.dispatchAction({ type: 'TRAVEL_TO', to: 'lobby', mode: 'walk' });
    const cash = sim.getState().player.cash;
    const res = sim.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'bus' });
    expect(res.success).toBe(true);
    expect(sim.economy.getLocation()).toBe('cafe');
    expect(sim.getState().player.cash).toBe(cash - BUS_FARE);
  });

  it('rejects unknown nodes, storms and exhaustion', () => {
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'moon' as any, mode: 'walk' }).success).toBe(false);
    sim.advanceGameMinutes(14 * 24 * 60, 'to storm day 15');
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'canal', mode: 'walk' }).success).toBe(false);
    (sim.economy as any).state.energy = 5;
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'laundry', mode: 'walk' }).success).toBe(false);
  });

  it('arrival raises meeting attendance flags', () => {
    sim.advanceGameMinutes(4 * 60, 'to noon');
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'walk' }).success).toBe(true);
    expect(sim.world.getFlag('visited_cafe_1')).toBe(true);
  });

  it('gates outings, room comforts and shifts on location', () => {
    expect(sim.dispatchAction({ type: 'PLAYER_CITY_OUTING', outingId: 'diner_soup' }).success).toBe(false);
    expect(sim.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 240, wage: 62 }).success).toBe(false);
    sim.dispatchAction({ type: 'TRAVEL_TO', to: 'cart', mode: 'walk' });
    expect(sim.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 60, wage: 10 }).success).toBe(true);
    // Room comforts need Room 104
    expect(sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'tea' }).success).toBe(false);
  });

  it('sitting at the PC walks you home (never stranded)', () => {
    sim.dispatchAction({ type: 'TRAVEL_TO', to: 'canal', mode: 'walk' });
    (sim.economy as any).state.energy = 5; // exhausted — auto-trip ignores fatigue
    const res = sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'pc' });
    expect(res.success).toBe(true);
    expect(sim.economy.getLocation()).toBe('home');
  });

  it('persists location across save/restore', () => {
    sim.dispatchAction({ type: 'TRAVEL_TO', to: 'laundry', mode: 'walk' });
    const restored = new SimulationEngine(sim.getState() as any);
    expect(restored.economy.getLocation()).toBe('laundry');
  });
});
