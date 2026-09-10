import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createScrapYardBundle } from '../../src/engine/hardware/catalog';
import {
  legacyModularToCanonical,
  projectEffectiveHardware,
} from '../../src/engine/hardware/state';

describe('P9 snapshot round-trip (every new system survives save/load)', () => {
  it('preserves affinities, promises, memories, pantry, location, deliveries, wages and empty computer roots', () => {
    const sim = new SimulationEngine();
    sim.social.addCoreMemory('maya', { text: 'Eternal test memory', kind: 'fact', day: 1 });
    sim.social.addPromise('ryan', 'test promise tomorrow', 1, 2);
    sim.social.adjustAffinity('maya', 'ryan', 12);

    const appt = sim.world.scheduleAppointment({
      id: 'test_appt', characterId: 'maya', locationId: 'cafe',
      targetDay: 2, startMinute: 1080, endMinute: 1140,
      description: 'test', status: 'confirmed', rsvp: 'yes', wageOverride: 77,
    });
    expect(appt.wageOverride).toBe(77);

    (sim.economy as any).state.hunger = 64;
    (sim.economy as any).state.pantry.groceries = 3;
    sim.economy.setLocation('canal');
    sim.delivery.recordPickup([{ sku: 'grocery_bag', qty: 1 }], 8, 500);
    sim.advanceGameMinutes(60, 'test hour');

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine(snapshot as any);
    const restoredState = restored.getState();

    expect(restored.social.getCoreMemories('maya').some((m) => m.text === 'Eternal test memory')).toBe(true);
    expect(restored.social.getOpenPromises('ryan').length).toBe(1);
    expect(restored.social.getAffinity('maya', 'ryan')).toBe(sim.social.getAffinity('maya', 'ryan'));
    expect(restored.world.getAppointments().find((a) => a.id === 'test_appt')?.wageOverride).toBe(77);
    expect(restoredState.player.hunger).toBe(sim.getState().player.hunger);
    expect(restoredState.player.pantry.groceries).toBe(3);
    expect(restored.economy.getLocation()).toBe('canal');
    expect(restored.delivery.getState().orders.length).toBe(1);
    expect(restored.clock.getTotalMinutes()).toBe(sim.clock.getTotalMinutes());

    expect(restoredState.computer).toEqual(snapshot.computer);
    expect(restoredState.display).toEqual(snapshot.display);
    expect(restoredState.inventory).toEqual(snapshot.inventory);
    expect(restoredState.os).toEqual(snapshot.os);
    expect(restoredState.hardware).toEqual(projectEffectiveHardware(restoredState.computer));
    expect('osVersion' in restoredState.hardware).toBe(false);
    expect('modular' in restoredState.hardware).toBe(false);
  });

  it('round-trips a working PC, display, inventory, and explicit installed OS independently', () => {
    const canonical = legacyModularToCanonical(createScrapYardBundle());
    const sim = new SimulationEngine({
      computer: canonical.computer,
      display: canonical.display,
      inventory: {
        items: [
          {
            instanceId: 'test:monitor:0',
            catalogItemId: canonical.display.monitor!.id,
            kind: 'display',
            location: 'installed',
          },
        ],
      },
      os: {
        currentOsId: 'Orion_4.8',
        installedPatchIds: [],
      },
      installedSoftware: [],
    } as any);

    const saved = sim.exportSnapshot();
    const restored = new SimulationEngine(saved as any).getState();

    expect(restored.computer).toEqual(saved.computer);
    expect(restored.display).toEqual(saved.display);
    expect(restored.inventory).toEqual(saved.inventory);
    expect(restored.os).toEqual(saved.os);
    expect(restored.hardware).toEqual(projectEffectiveHardware(restored.computer));
    expect(restored.os.currentOsId).toBe('Orion_4.8');
    expect(restored.display.monitor?.id).toBe('mon_beige_curved_14');
    expect('osVersion' in restored.hardware).toBe(false);
  });
});
