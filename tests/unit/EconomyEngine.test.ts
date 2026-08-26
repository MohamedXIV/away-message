import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EconomyEngine } from '../../src/engine/EconomyEngine';

describe('EconomyEngine (Cash, Energy, Work Shifts & Rent)', () => {
  let eventBus: EventBus;
  let economy: EconomyEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    economy = new EconomyEngine(eventBus);
  });

  it('initializes with default starting financial and energy parameters', () => {
    const state = economy.getState();
    expect(state.cash).toBe(38.0);
    expect(state.energy).toBe(100);
    expect(state.fatigue).toBe(0);
    expect(state.rentDueDay).toBe(7);
    expect(state.rentAmount).toBe(140.0);
    expect(state.rentPaid).toBe(false);
    expect(economy.getEnergyStatus()).toBe('Rested');
  });

  it('earns and spends cash with precision and event emission', () => {
    let emittedDelta = 0;
    eventBus.on('economy:cash_changed', ({ delta }) => {
      emittedDelta = delta;
    });

    economy.earnCash(20.5, 'Tips');
    expect(economy.getCash()).toBe(58.5);
    expect(emittedDelta).toBe(20.5);

    const spendOk = economy.spendCash(15.25, 'Snacks');
    expect(spendOk).toBe(true);
    expect(economy.getCash()).toBe(43.25);
    expect(emittedDelta).toBe(-15.25);

    const spendTooMuch = economy.spendCash(100.0, 'Luxury');
    expect(spendTooMuch).toBe(false);
    expect(economy.getCash()).toBe(43.25);
  });

  it('performs food cart work shift earning wage and consuming energy', () => {
    let shiftCompletedEvent = false;
    eventBus.on('economy:shift_completed', () => {
      shiftCompletedEvent = true;
    });

    const shift = economy.performWorkShift(240, 62.0);
    expect(shift.success).toBe(true);
    expect(shift.earnedWage).toBe(62.0);
    expect(economy.getCash()).toBe(100.0); // 38 + 62
    expect(economy.getState().energy).toBe(65); // 100 - 35
    expect(economy.getState().fatigue).toBe(25);
    expect(shiftCompletedEvent).toBe(true);
  });

  it('prevents work shift when player is exhausted (<15 energy)', () => {
    economy.consumeEnergy(90); // 100 -> 10 energy
    expect(economy.getEnergyStatus()).toBe('Exhausted');

    const shift = economy.performWorkShift();
    expect(shift.success).toBe(false);
    expect(shift.error).toContain('Too exhausted');
    expect(economy.getCash()).toBe(38.0);
  });

  it('manages motel rent payment lifecycle', () => {
    // Cannot afford with $38.00
    const failPay = economy.payRent();
    expect(failPay.success).toBe(false);
    expect(economy.getState().rentPaid).toBe(false);

    // Earn money and pay rent
    economy.earnCash(150.0, 'Hard work');
    const successPay = economy.payRent();
    expect(successPay.success).toBe(true);
    expect(economy.getState().rentPaid).toBe(true);
    expect(economy.getCash()).toBe(48.0); // 38 + 150 - 140

    // Cannot pay twice for same period
    const doublePay = economy.payRent();
    expect(doublePay.success).toBe(false);
  });

  it('applies day transition food deduction and late rent fee on Day 8 if unpaid', () => {
    // Day rollover on Day 2: Deducts $10 food
    economy.handleDayTransition(2);
    expect(economy.getCash()).toBe(28.0); // 38 - 10

    // Day rollover to Day 8 with unpaid rent: adds $15 late fee
    economy.handleDayTransition(8);
    expect(economy.getState().rentAmount).toBe(155.0); // 140 + 15
  });

  it('restores energy on rest or sleep', () => {
    economy.consumeEnergy(60);
    economy.addFatigue(50);
    expect(economy.getState().energy).toBe(40);
    expect(economy.getState().fatigue).toBe(50);

    // Full 8-hour sleep restores 100%
    economy.restOrSleep(8);
    expect(economy.getState().energy).toBe(100);
    expect(economy.getState().fatigue).toBe(0);
  });
});
