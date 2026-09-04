import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EconomyEngine } from '../../src/engine/EconomyEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildBodyHint } from '../../src/engine/BodyDirector';

function makeEconomy(): EconomyEngine {
  return new EconomyEngine(new EventBus());
}

describe('P6.1 hunger and meals', () => {
  let economy: EconomyEngine;
  beforeEach(() => { economy = makeEconomy(); });

  it('hunger rises ~3/hour with time', () => {
    expect(economy.getState().hunger).toBe(30);
    economy.advanceTime(20 * 60);
    expect(economy.getState().hunger).toBe(30 + 60);
    economy.advanceTime(100 * 60);
    expect(economy.getState().hunger).toBe(100); // capped
  });

  it('noodles cost money and relieve hunger', () => {
    const cash = economy.getState().cash;
    economy.advanceTime(10 * 60); // hunger 30 → 60
    const res = economy.eatMeal('noodles');
    expect(res.success).toBe(true);
    expect(economy.getState().cash).toBe(cash - 3);
    expect(economy.getState().hunger).toBe(60 - 35);
  });

  it('groceries feed well and heal a little', () => {
    economy.advanceTime(20 * 60); // hunger 90
    const healthBefore = economy.getState().health;
    expect(economy.eatMeal('groceries').success).toBe(true);
    expect(economy.getState().hunger).toBe(90 - 70);
    expect(economy.getState().health).toBe(Math.min(100, healthBefore + 3));
  });

  it('broke players cannot eat (honest failure, no debt)', () => {
    const broke = new EconomyEngine(new EventBus(), { cash: 1 });
    const res = broke.eatMeal('noodles');
    expect(res.success).toBe(false);
    expect(broke.getState().cash).toBe(1);
    expect(broke.getState().hunger).toBe(30);
  });
});

describe('P6.1 sleep quality and debt', () => {
  let economy: EconomyEngine;
  beforeEach(() => { economy = makeEconomy(); });

  it('good nights repay debt first, then restore to the improved ceiling', () => {
    economy.consumeEnergy(60);
    (economy as any).state.sleepDebt = 4;
    economy.restOrSleep(8, 23);
    expect(economy.getState().sleepDebt).toBe(1);
    expect(economy.getState().energy).toBe(100 - 3); // ceiling with debt 1
  });

  it('post-2am crashes halve recovery and add debt', () => {
    economy.consumeEnergy(60);
    economy.restOrSleep(8, 3);
    expect(economy.getState().energy).toBeLessThan(100);
    expect(economy.getState().sleepDebt).toBe(2);
  });

  it('short naps repay proportionally', () => {
    economy.consumeEnergy(50);
    economy.restOrSleep(2, 14);
    expect(economy.getState().energy).toBe(50 + 30);
    expect(economy.getState().sleepDebt).toBe(1);
  });

  it('debt, hunger and health cap the energy ceiling (floor 40)', () => {
    expect(economy.effectiveMaxEnergy()).toBe(100);
    (economy as any).state.hunger = 85;
    expect(economy.effectiveMaxEnergy()).toBe(80);
    (economy as any).state.sleepDebt = 10;
    (economy as any).state.health = 20;
    expect(economy.effectiveMaxEnergy()).toBe(40); // 100-20-30-10 hits the floor exactly
  });
});

describe('P6.1 day drift and care', () => {
  let economy: EconomyEngine;
  beforeEach(() => { economy = makeEconomy(); });

  it('starving forces a sad chips run (or health loss when broke)', () => {
    (economy as any).state.hunger = 90;
    const cash = economy.getState().cash;
    economy.handleDayTransition(2);
    expect(economy.getState().hunger).toBe(70);
    expect(economy.getState().cash).toBeLessThan(cash);

    const broke = new EconomyEngine(new EventBus(), { cash: 0 });
    (broke as any).state.hunger = 90;
    const health = broke.getState().health;
    broke.handleDayTransition(2);
    expect(broke.getState().health).toBeLessThan(health);
  });

  it('eating well recovers health', () => {
    (economy as any).state.hunger = 20;
    (economy as any).state.health = 80;
    economy.handleDayTransition(2);
    expect(economy.getState().health).toBe(83);
  });

  it('showers help a little', () => {
    (economy as any).state.health = 80;
    economy.consumeEnergy(10);
    economy.showerBoost();
    expect(economy.getState().health).toBe(82);
    expect(economy.getState().energy).toBe(93);
  });
});

describe('P6.1 body hints (pure)', () => {
  it('prioritizes exhausted → starving → unwell, silent when fine', () => {
    expect(buildBodyHint({ energy: 80, hunger: 30, health: 90, sleepDebt: 0 })).toBe('');
    expect(buildBodyHint({ energy: 10, hunger: 90, health: 20, sleepDebt: 5 })).toContain('exhausted');
    expect(buildBodyHint({ energy: 80, hunger: 90, health: 20, sleepDebt: 5 })).toContain('barely eaten');
    expect(buildBodyHint({ energy: 80, hunger: 30, health: 20, sleepDebt: 5 })).toContain('unwell');
  });
});

describe('P6.1 simulation wiring', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('time advances hunger and room meals cost pantry money', () => {
    sim.advanceGameMinutes(10 * 60, 'morning');
    expect(sim.getState().player.hunger).toBe(30 + 30);
    const cash = sim.getState().player.cash;
    const res = sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'meal' });
    expect(res.success).toBe(true);
    expect(sim.getState().player.cash).toBeLessThan(cash);
    expect(sim.getState().player.hunger).toBeLessThan(60);
  });

  it('groceries work through the room action (UI button arrives in P6.3)', () => {
    sim.advanceGameMinutes(20 * 60, 'long day');
    const res = sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'groceries' });
    expect(res.success).toBe(true);
    expect(sim.getState().player.hunger).toBeLessThanOrEqual(30);
  });
});
