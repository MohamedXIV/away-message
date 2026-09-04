import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

/**
 * P6.6 leniency proof: total neglect for two weeks must never trap, kill,
 * bankrupt below zero, or lock the game. Recovery must always work.
 */
describe('P6.6 leniency guarantees', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  it('two weeks of total neglect stays playable', () => {
    sim.advanceGameMinutes(14 * 24 * 60, 'two weeks of neglect');
    const player = sim.getState().player;
    expect(player.cash).toBeGreaterThanOrEqual(0);
    expect(player.health).toBeGreaterThanOrEqual(0);
    expect(player.hunger).toBeLessThanOrEqual(100);
    expect(player.energy).toBeGreaterThanOrEqual(0);
    expect(sim.economy.effectiveMaxEnergy()).toBeGreaterThanOrEqual(40);
    expect(Number.isFinite(player.rentAmount)).toBe(true);
    expect(player.rentAmount).toBeLessThan(1000);
    // The game still ticks and the player can still act
    sim.advanceGameMinutes(60, 'one more hour');
    expect(sim.clock.getTime().day).toBe(15);
  });

  it('recovery always works from the bottom', () => {
    sim.advanceGameMinutes(14 * 24 * 60, 'two weeks of neglect');
    sim.economy.earnCash(100, 'test funds');
    // Real restock loop: pickup order → pantry → cook
    const order = sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [{ sku: 'grocery_bag', qty: 1 }], fulfillment: 'pickup' });
    expect(order.success).toBe(true);
    expect(sim.getState().player.pantry.groceries).toBe(1);
    expect(sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'groceries' }).success).toBe(true);
    expect(sim.getState().player.hunger).toBeLessThanOrEqual(45);
    sim.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 } as any);
    expect(sim.getState().player.energy).toBeGreaterThan(40);
  });

  it('work is always available as a way back (no death spiral)', () => {
    sim.advanceGameMinutes(7 * 24 * 60, 'a week of neglect');
    (sim.economy as any).state.energy = 45; // floor-ish, worst realistic case
    // P7: walk to the cart first (ignoreFatigue not needed at 45% energy)
    expect(sim.dispatchAction({ type: 'TRAVEL_TO', to: 'cart', mode: 'walk' }).success).toBe(true);
    const res = sim.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 240, wage: 62 });
    expect(res.success).toBe(true);
  });

  it('rent never evicts — only kind, reversible pressure', () => {
    sim.advanceGameMinutes(30 * 24 * 60, 'a month of unpaid rent');
    const player = sim.getState().player;
    expect(player.rentPaid).toBe(false);
    // Still playing: time passes, body bounded, no lockout flag beyond downloads
    expect(sim.world.getFlag('rent_overdue')).toBe(true);
    expect(player.health).toBeGreaterThanOrEqual(0);
    expect(player.cash).toBeGreaterThanOrEqual(0);
    // ...and paying fixes everything
    sim.economy.earnCash(1000, 'test funds');
    expect(sim.dispatchAction({ type: 'PLAYER_PAY_RENT' }).success).toBe(true);
    expect(sim.world.getFlag('rent_overdue')).toBe(false);
  });
});
