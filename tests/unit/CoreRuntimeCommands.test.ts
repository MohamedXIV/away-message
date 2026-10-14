import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { CoreRuntime } from '../../src/engine/kernel/CoreRuntime';
import { createScrapYardBundle } from '../../src/engine/hardware/catalog';

describe('CoreRuntime Commands — authoritative execution contracts', () => {
  it('debits and credits money exactly once, and rejects payment without state mutation', () => {
    const runtime = new CoreRuntime();
    const initialCash = runtime.owners.economy.getCash();

    // Credit
    const earnRes = runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 50,
      reason: 'freelance gig',
    });
    expect(earnRes.success).toBe(true);
    expect(runtime.owners.economy.getCash()).toBe(initialCash + 50);

    // Debit
    const spendRes = runtime.dispatchAction({
      type: 'PLAYER_SPEND_CASH',
      amount: 20,
      reason: 'supplies',
    });
    expect(spendRes.success).toBe(true);
    expect(runtime.owners.economy.getCash()).toBe(initialCash + 30);

    // Rejected debit
    const failRes = runtime.dispatchAction({
      type: 'PLAYER_SPEND_CASH',
      amount: 999999,
      reason: 'too expensive',
    });
    expect(failRes.success).toBe(false);
    expect(failRes.error).toBe('Insufficient funds.');
    expect(runtime.owners.economy.getCash()).toBe(initialCash + 30);
  });

  it('enforces location gating, energy prerequisites, wage and time advancement on work shifts', () => {
    const runtime = new CoreRuntime();

    // At home by default — cart required
    expect(runtime.owners.economy.getLocation()).toBe('home');
    const rejectedShift = runtime.dispatchAction({
      type: 'PLAYER_WORK_SHIFT',
    });
    expect(rejectedShift.success).toBe(false);
    expect(rejectedShift.error).toContain('travel to Food Cart first');

    // Travel to cart
    runtime.owners.economy.setLocation('cart');
    const cashBefore = runtime.owners.economy.getCash();
    const timeBefore = runtime.owners.clock.getTotalMinutes();
    const energyBefore = runtime.owners.needs.getState().energy;

    const shiftRes = runtime.dispatchAction({
      type: 'PLAYER_WORK_SHIFT',
      durationMinutes: 180,
      wage: 50,
    });
    expect(shiftRes.success).toBe(true);
    expect(shiftRes.data).toMatchObject({
      hours: 3,
      earnedWage: 50,
    });
    expect(runtime.owners.economy.getCash()).toBe(cashBefore + 50);
    expect(runtime.owners.clock.getTotalMinutes()).toBe(timeBefore + 180);
    expect(runtime.owners.needs.getState().energy).toBeLessThan(energyBefore);
  });

  it('sleeps and rests with authoritative jump, recharge, and no double advancement', () => {
    const runtime = new CoreRuntime();
    const startDay = runtime.owners.clock.getTime().day;
    runtime.owners.needs.consumeEnergy(50);
    runtime.owners.needs.spendSocialBattery(40);
    const batteryBefore = runtime.owners.needs.getSocialBattery();

    const sleepRes = runtime.dispatchAction({
      type: 'PLAYER_REST_OR_SLEEP',
      wakeHour: 8,
      wakeMinute: 0,
    });

    expect(sleepRes.success).toBe(true);
    const newTime = runtime.owners.clock.getTime();
    expect(newTime.day).toBe(startDay + 1);
    expect(newTime.hour).toBe(8);
    expect(newTime.minute).toBe(0);
    // Social battery recharged by at least 30
    expect(runtime.owners.needs.getSocialBattery()).toBeGreaterThanOrEqual(batteryBefore + 30);
    // Energy restored
    expect(runtime.owners.needs.getState().energy).toBeGreaterThan(50);
  });

  it('enforces location gating and pantry consumption on room activities', () => {
    const runtime = new CoreRuntime();

    // Move away from home to test location gate
    runtime.owners.economy.setLocation('cafe');
    const outsideTea = runtime.dispatchAction({
      type: 'PLAYER_INTERACT_ROOM',
      activity: 'tea',
    });
    expect(outsideTea.success).toBe(false);
    expect(outsideTea.error).toContain('travel to Room 104 first');

    // Return home
    runtime.owners.economy.setLocation('home');

    // Tea restores energy and battery
    const energyBefore = runtime.owners.needs.getState().energy;
    runtime.owners.needs.spendSocialBattery(10);
    const batteryBefore = runtime.owners.needs.getSocialBattery();

    const teaRes = runtime.dispatchAction({
      type: 'PLAYER_INTERACT_ROOM',
      activity: 'tea',
    });
    expect(teaRes.success).toBe(true);
    expect(runtime.owners.needs.getState().energy).toBe(Math.min(100, energyBefore + 5));
    expect(runtime.owners.needs.getSocialBattery()).toBe(batteryBefore + 3);

    // Meal requires pantry noodles
    const pantryBefore = runtime.owners.economy.getState().pantry.noodles ?? 0;
    if (pantryBefore > 0) {
      const mealRes = runtime.dispatchAction({
        type: 'PLAYER_INTERACT_ROOM',
        activity: 'meal',
      });
      expect(mealRes.success).toBe(true);
      expect(runtime.owners.economy.getState().pantry.noodles).toBe(pantryBefore - 1);
    }
  });

  it('handles view switching with automatic travel home and attendance flag recording', () => {
    const runtime = new CoreRuntime();
    runtime.owners.economy.setLocation('cafe');

    // Switching to PC view while out in the city walks player home
    const switchRes = runtime.dispatchAction({
      type: 'VIEW_SWITCH',
      view: 'pc',
    });
    expect(switchRes.success).toBe(true);
    expect(runtime.getActiveView()).toBe('pc');
    expect(runtime.owners.economy.getLocation()).toBe('home');

    // Switching to cafe records attendance flag
    const day = runtime.owners.clock.getTime().day;
    const cafeSwitch = runtime.dispatchAction({
      type: 'VIEW_SWITCH',
      view: 'cafe',
    });
    expect(cafeSwitch.success).toBe(true);
    expect(runtime.getActiveView()).toBe('cafe');
    expect(runtime.owners.world.getFlag(`visited_cafe_${day}`)).toBe(true);
  });

  it('fails explicitly on unhandled actions without swallowing errors', () => {
    const runtime = new CoreRuntime();
    const result = runtime.dispatchAction({
      type: 'UNKNOWN_TEST_COMMAND' as any,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unhandled action: UNKNOWN_TEST_COMMAND');
  });

  it('handles RAM and connection upgrades over HardwareEngine and EconomyEngine', () => {
    const engine = new SimulationEngine();
    // Set up modular hardware with assembled chassis/motherboard
    engine.hardware.installModularHardware(createScrapYardBundle());

    engine.economy.earnCash(500, 'hardware budget');
    const cashBefore = engine.economy.getCash();

    // RAM upgrade
    const ramRes = engine.dispatchAction({
      type: 'HARDWARE_UPGRADE_RAM',
      ramMB: 256,
      cost: 45,
    });
    expect(ramRes.success).toBe(true);
    expect(engine.economy.getCash()).toBe(cashBefore - 45);
    expect(engine.hardware.getState().ramMB).toBe(256);

    // Connection upgrade
    const netRes = engine.dispatchAction({
      type: 'HARDWARE_UPGRADE_CONNECTION',
      connectionType: 'dsl_256k',
      cost: 30,
    });
    expect(netRes.success).toBe(true);
    expect(engine.economy.getCash()).toBe(cashBefore - 75);
    expect(engine.hardware.getState().connectionType).toBe('dsl_256k');
  });
  it('rejects retired HARDWARE_UPGRADE_OS without mutating cash, OS, or hardware', () => {
    const runtime = new CoreRuntime();
    runtime.owners.economy.earnCash(200, 'test budget');
    const cashBefore = runtime.owners.economy.getCash();
    const osBefore = runtime.owners.os.getCurrentOsId();
    const hwStateBefore = (runtime.owners.hardware as any).state.osVersion;

    const res = runtime.dispatchAction({
      type: 'HARDWARE_UPGRADE_OS',
      targetOs: 'Orion_5.0',
      cost: 29,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/legacy os upgrades are retired/i);
    expect(runtime.owners.economy.getCash()).toBe(cashBefore);
    expect(runtime.owners.os.getCurrentOsId()).toBe(osBefore);
    expect((runtime.owners.hardware as any).state.osVersion).toBe(hwStateBefore);
  });

  it('executes sleep through TimeAdvancement and emits time events authoritatively', () => {
    const runtime = new CoreRuntime();
    const dayChangedEvents: any[] = [];
    const jumpEvents: any[] = [];

    runtime.owners.events.on('time:day_changed', (e) => dayChangedEvents.push(e));
    runtime.owners.events.on('time:jump', (e) => jumpEvents.push(e));

    const dayBefore = runtime.owners.clock.getTime().day;
    runtime.owners.needs.consumeEnergy(50);
    runtime.owners.needs.spendSocialBattery(20);

    const sleepRes = runtime.dispatchAction({
      type: 'PLAYER_REST_OR_SLEEP',
      wakeHour: 8,
      wakeMinute: 0,
    });

    expect(sleepRes.success).toBe(true);
    expect(runtime.owners.clock.getTime().day).toBe(dayBefore + 1);
    expect(runtime.owners.clock.getTime().hour).toBe(8);
    // Verified authoritative events emitted exactly once
    expect(dayChangedEvents.length).toBe(1);
    expect(dayChangedEvents[0].newDay).toBe(dayBefore + 1);
    expect(jumpEvents.length).toBe(1);
    expect(jumpEvents[0].reason).toBe('Sleep');
    // Needs and social battery restored
    expect(runtime.owners.needs.getState().energy).toBeGreaterThan(60);
    expect(runtime.owners.needs.getSocialBattery()).toBeGreaterThan(50);
  });
});
