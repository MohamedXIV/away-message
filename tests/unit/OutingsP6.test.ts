import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  OUTINGS,
  isValidOutingId,
  mayaDinerEncounter,
  noraCanalEncounter,
  buildLaundromatRumor,
} from '../../src/engine/OutingDirector';
import { getWeatherForDay, isWetWeather } from '../../src/engine/WeatherEngine';

describe('P6.3 outing rules (pure)', () => {
  it('defines five priced outings', () => {
    expect(Object.keys(OUTINGS)).toEqual(['diner_soup', 'diner_platter', 'diner_pie', 'canal_walk', 'laundromat']);
    expect(OUTINGS.diner_platter!.cost).toBe(11);
    expect(OUTINGS.canal_walk!.cost).toBe(0);
    expect(isValidOutingId('diner_soup')).toBe(true);
    expect(isValidOutingId('moon')).toBe(false);
  });

  it('gates encounters by hour and rolls deterministically', () => {
    expect(mayaDinerEncounter(8, 1)).toBe(false); // before shift
    expect(mayaDinerEncounter(12, 1)).toBe(mayaDinerEncounter(12, 1));
    expect(noraCanalEncounter(14, 1, false)).toBe(false); // daytime
    expect(noraCanalEncounter(23, 1, true)).toBe(noraCanalEncounter(23, 1, true));
  });

  it('builds laundromat rumors: tense pair → clipping → folklore', () => {
    const tense = buildLaundromatRumor(
      [{ aName: 'Ryan', bName: 'Nora', affinity: -30 }, { aName: 'Maya', bName: 'Ryan', affinity: 15 }],
      ['Orion 7 released'],
      's1'
    );
    expect(tense).toContain('Ryan');
    expect(tense).toContain('Nora');
    const clipping = buildLaundromatRumor(
      [{ aName: 'Maya', bName: 'Ryan', affinity: 15 }],
      ['Orion 7 released'],
      's1'
    );
    expect(clipping).toContain('Orion 7 released');
    expect(buildLaundromatRumor([], [], 's1')).toContain('dryers');
  });
});

describe('P6.3 city outings (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('rejects unknown outings, exhaustion, poverty and storms', () => {
    expect(sim.doCityOuting('moon').success).toBe(false);
    (sim.economy as any).state.energy = 10;
    expect(sim.doCityOuting('canal_walk').success).toBe(false);
    (sim.economy as any).state.energy = 100;
    (sim.economy as any).state.cash = 1;
    expect(sim.doCityOuting('diner_platter').success).toBe(false);
    // Day 15 is a storm: the canal is closed
    sim.advanceGameMinutes(14 * 24 * 60, 'two weeks pass');
    expect(getWeatherForDay(sim.clock.getTime().day).condition).toBe('storm');
    (sim.economy as any).state.energy = 100;
    const res = sim.doCityOuting('canal_walk');
    expect(res.success).toBe(false);
    expect(res.error).toContain('storm');
  });

  it('diner lunch applies costs and Maya encounters by rule', () => {
    sim.advanceGameMinutes(4 * 60, 'morning to noon'); // 08:00 → 12:00 day 1
    const hungerBefore = sim.getState().player.hunger;
    const cashBefore = sim.getState().player.cash;
    const res = sim.dispatchAction({ type: 'PLAYER_CITY_OUTING', outingId: 'diner_soup' });
    expect(res.success).toBe(true);
    expect(sim.getState().player.cash).toBe(cashBefore - 5);
    expect(sim.getState().player.hunger).toBeLessThan(hungerBefore);
    if (mayaDinerEncounter(12, 1)) {
      expect(sim.social.getCoreMemories('maya').some((m) => m.text.includes('diner'))).toBe(true);
      expect(sim.social.getMessages('maya').some((m) => m.tags?.includes('outing'))).toBe(true);
    } else {
      expect(sim.social.getMessages('maya').some((m) => m.tags?.includes('outing'))).toBe(false);
    }
  });

  it('late canal walks can cross Nora', () => {
    sim.advanceGameMinutes(14 * 60, 'to 22:00'); // 08:00 → 22:00 day 1
    const raining = isWetWeather(getWeatherForDay(1).condition);
    const res = sim.dispatchAction({ type: 'PLAYER_CITY_OUTING', outingId: 'canal_walk' });
    expect(res.success).toBe(true);
    if (noraCanalEncounter(22, 1, raining)) {
      expect(sim.social.getCoreMemories('nora').some((m) => m.text.includes('canal'))).toBe(true);
      expect(sim.social.getMessages('nora').some((m) => m.tags?.includes('outing'))).toBe(true);
    } else {
      expect(sim.social.getMessages('nora').some((m) => m.tags?.includes('outing'))).toBe(false);
    }
  });

  it('laundromat returns a rumor and charges correctly', () => {
    const cashBefore = sim.getState().player.cash;
    const res = sim.doCityOuting('laundromat');
    expect(res.success).toBe(true);
    expect(sim.getState().player.cash).toBe(cashBefore - 4);
    expect(typeof res.data?.rumor).toBe('string');
    expect(res.data!.rumor!.length).toBeGreaterThan(10);
  });

  it('room noodles charge exactly $3 once (no double-spend)', () => {
    const res = sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'meal' });
    expect(res.success).toBe(true);
    expect(sim.getState().player.cash).toBe(38 - 3);
  });
});
