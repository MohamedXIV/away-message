import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EconomyEngine } from '../../src/engine/EconomyEngine';
import { PlayerNeedsEngine } from '../../src/engine/PlayerNeedsEngine';
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
    expect(economy.getState().pantry.noodles).toBe(2); // stocked starter pantry
    const res = economy.eatMeal('noodles');
    expect(res.success).toBe(true);
    expect(economy.getState().cash).toBe(cash - 3);
    expect(economy.getState().hunger).toBe(60 - 35);
    expect(economy.getState().pantry.noodles).toBe(1);
  });

  it('groceries feed well and heal a little', () => {
    economy.addPantry('groceries', 1);
    economy.advanceTime(20 * 60); // hunger 90
    const healthBefore = economy.getState().health;
    expect(economy.eatMeal('groceries').success).toBe(true);
    expect(economy.getState().hunger).toBe(90 - 70);
    expect(economy.getState().health).toBe(Math.min(100, healthBefore + 3));
    expect(economy.getState().pantry.groceries).toBe(0);
  });

  it('empty pantry blocks meals (buy more first)', () => {
    economy = new EconomyEngine(new EventBus(), {
      pantry: { noodles: 0, groceries: 0 },
    });
    const res = economy.eatMeal('noodles');
    expect(res.success).toBe(false);
    expect(res.error).toContain('pantry');
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
  let needs: PlayerNeedsEngine;
  beforeEach(() => { needs = new PlayerNeedsEngine(new EventBus()); });

  it('good nights repay debt first, then restore to the improved ceiling', () => {
    needs = new PlayerNeedsEngine(new EventBus(), { energy: 40, sleepDebt: 4 });
    needs.restOrSleep(8, 23);
    expect(needs.getState().sleepDebt).toBe(1);
    expect(needs.getState().energy).toBe(100 - 3);
  });

  it('post-2am crashes halve recovery and add debt', () => {
    needs.consumeEnergy(60);
    needs.restOrSleep(8, 3);
    expect(needs.getState().energy).toBeLessThan(100);
    expect(needs.getState().sleepDebt).toBe(2);
  });

  it('short naps repay proportionally', () => {
    needs.consumeEnergy(50);
    needs.restOrSleep(2, 14);
    expect(needs.getState().energy).toBe(50 + 30);
    expect(needs.getState().sleepDebt).toBe(1);
  });

  it('debt, hunger and health cap the energy ceiling (floor 40)', () => {
    expect(needs.effectiveMaxEnergy()).toBe(100);
    needs = new PlayerNeedsEngine(new EventBus(), { hunger: 85 });
    expect(needs.effectiveMaxEnergy()).toBe(80);
    needs = new PlayerNeedsEngine(new EventBus(), {
      hunger: 85,
      sleepDebt: 10,
      health: 20,
    });
    expect(needs.effectiveMaxEnergy()).toBe(40);
  });
});

describe('P6.1 day drift and care', () => {
  it('starvation requests cross-domain emergency food without owning cash', () => {
    const needs = new PlayerNeedsEngine(new EventBus(), { hunger: 90, health: 90 });
    const result = needs.handleDayTransition();
    expect(result.emergencyFoodNeeded).toBe(true);
    expect(needs.getState().health).toBe(87);

    needs.applyEmergencyFoodRelief();
    expect(needs.getState().hunger).toBe(70);
  });

  it('eating well recovers health', () => {
    const needs = new PlayerNeedsEngine(new EventBus(), { hunger: 20, health: 80 });
    expect(needs.handleDayTransition().emergencyFoodNeeded).toBe(false);
    expect(needs.getState().health).toBe(83);
  });

  it('showers help a little', () => {
    const needs = new PlayerNeedsEngine(new EventBus(), { energy: 90, health: 80 });
    needs.showerBoost();
    expect(needs.getState().health).toBe(82);
    expect(needs.getState().energy).toBe(93);
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
    sim.economy.addPantry('groceries', 1);
    sim.advanceGameMinutes(20 * 60, 'long day');
    const res = sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'groceries' });
    expect(res.success).toBe(true);
    expect(sim.getState().player.hunger).toBeLessThanOrEqual(30);
  });
});
