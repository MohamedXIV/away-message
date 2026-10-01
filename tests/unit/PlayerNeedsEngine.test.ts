import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { PlayerNeedsEngine } from '../../src/engine/PlayerNeedsEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('PlayerNeedsEngine (#130)', () => {
  it('hydrates deterministically, clamps bounds, and exposes semantic bands', () => {
    const needs = new PlayerNeedsEngine(new EventBus(), {
      energy: 200,
      fatigue: -5,
      hunger: 84,
      health: 35,
      sleepDebt: 99,
      socialBattery: 140,
    });
    expect(needs.getState()).toEqual({
      energy: 100,
      fatigue: 0,
      hunger: 84,
      health: 35,
      sleepDebt: 10,
      socialBattery: 100,
    });
    expect(needs.getSnapshot()).toMatchObject({
      energyBand: 'rested',
      hungerBand: 'hungry',
      effectiveMaxEnergy: 40,
      isStarving: false,
    });
  });

  it('keeps hunger drift, energy ceiling and sleep recovery deterministic', () => {
    const needs = new PlayerNeedsEngine(new EventBus(), {
      energy: 20,
      hunger: 79,
      health: 90,
      sleepDebt: 2,
    });
    needs.advanceTime(60);
    expect(needs.getState().hunger).toBe(82);
    expect(needs.effectiveMaxEnergy()).toBe(74);

    needs.restOrSleep(8, 23);
    expect(needs.getState()).toMatchObject({
      energy: 80,
      fatigue: 0,
      sleepDebt: 0,
    });
  });

  it('keeps social battery independent and emits only effective semantic changes', () => {
    const bus = new EventBus();
    const changed = vi.fn();
    bus.on('needs:changed', changed);
    const needs = new PlayerNeedsEngine(bus, { socialBattery: 10 });

    expect(needs.spendSocialBattery(4)).toBe(true);
    expect(needs.getState().socialBattery).toBe(6);
    expect(needs.spendSocialBattery(10)).toBe(false);
    needs.rechargeSocialBattery(200);
    needs.rechargeSocialBattery(1);

    expect(needs.getState().socialBattery).toBe(100);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('keeps pantry and spatial position outside the Needs contract', () => {
    const snapshot = new PlayerNeedsEngine(new EventBus()).getSnapshot() as Record<string, unknown>;
    expect(snapshot).not.toHaveProperty('pantry');
    expect(snapshot).not.toHaveProperty('location');
    expect(snapshot).not.toHaveProperty('cash');
  });

  it('orchestrates a work shift through Finance + Needs without duplicated authority', () => {
    const sim = new SimulationEngine();
    sim.economy.setLocation('cart');

    const beforeCash = sim.economy.getCash();
    const beforeNeeds = sim.needs.getState();
    const result = sim.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 240, wage: 62 });

    expect(result.success).toBe(true);
    expect(sim.economy.getCash()).toBe(beforeCash + 62);
    expect(sim.needs.getState().energy).toBe(beforeNeeds.energy - 35);
    expect(sim.needs.getState().fatigue).toBe(beforeNeeds.fatigue + 25);
    expect(sim.economy.getState().energy).toBe(sim.needs.getState().energy);
  });

  it('round-trips current-format Needs state independently from Finance', () => {
    const sim = new SimulationEngine();
    sim.needs.consumeEnergy(41);
    sim.needs.addHunger(17);
    sim.needs.spendSocialBattery(22);

    const snapshot = sim.getState();
    expect(snapshot.needs).toEqual(sim.needs.getState());

    const restored = new SimulationEngine(snapshot);
    expect(restored.needs.getState()).toEqual(sim.needs.getState());
    expect(restored.economy.getState().energy).toBe(restored.needs.getState().energy);
  });

  it('keeps day health drift in Needs and finance-dependent emergency food in orchestration', () => {
    const sim = new SimulationEngine({
      player: {
        ...new SimulationEngine().getState().player,
        cash: 0,
        hunger: 95,
        health: 90,
      },
    });

    sim.events.emit('time:day_changed', {
      newDay: 2,
      previousDay: 1,
      time: sim.clock.getTime(),
    });

    expect(sim.economy.getCash()).toBe(0);
    expect(sim.needs.getState().health).toBe(82);
    expect(sim.needs.getState().hunger).toBe(95);
  });
});
