import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('P9 snapshot round-trip (every new system survives save/load)', () => {
  it('preserves affinities, promises, memories, pantry, location, deliveries, wages', () => {
    const sim = new SimulationEngine();
    // P3/P4 social depth
    sim.social.addCoreMemory('maya', { text: 'Eternal test memory', kind: 'fact', day: 1 });
    sim.social.addPromise('ryan', 'test promise tomorrow', 1, 2);
    sim.social.adjustAffinity('maya', 'ryan', 12);
    // P5 meetings + wage override
    const appt = sim.world.scheduleAppointment({
      id: 'test_appt', characterId: 'maya', locationId: 'cafe',
      targetDay: 2, startMinute: 1080, endMinute: 1140,
      description: 'test', status: 'confirmed', rsvp: 'yes', wageOverride: 77,
    });
    expect(appt.wageOverride).toBe(77);
    // P6 body/pantry/location/deliveries
    (sim.economy as any).state.hunger = 64;
    (sim.economy as any).state.pantry.groceries = 3;
    sim.economy.setLocation('canal');
    sim.delivery.recordPickup([{ sku: 'grocery_bag', qty: 1 }], 8, 500);
    // P6.2 weather is a pure function of day — spot check determinism instead
    sim.advanceGameMinutes(60, 'test hour');

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine(snapshot as any);

    expect(restored.social.getCoreMemories('maya').some((m) => m.text === 'Eternal test memory')).toBe(true);
    expect(restored.social.getOpenPromises('ryan').length).toBe(1);
    expect(restored.social.getAffinity('maya', 'ryan')).toBe(sim.social.getAffinity('maya', 'ryan'));
    expect(restored.world.getAppointments().find((a) => a.id === 'test_appt')?.wageOverride).toBe(77);
    expect(restored.getState().player.hunger).toBe(sim.getState().player.hunger);
    expect(restored.getState().player.pantry.groceries).toBe(3);
    expect(restored.economy.getLocation()).toBe('canal');
    expect(restored.delivery.getState().orders.length).toBe(1);
    expect(restored.clock.getTotalMinutes()).toBe(sim.clock.getTotalMinutes());
  });
});
