import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';

const ROOM_STORAGE_IDS = [
  'room104:desk-storage',
  'room104:wardrobe',
  'room104:bedside-storage',
  'room104:kitchen-storage',
] as const;

describe('Room 104 canonical physical storage (#26)', () => {
  it('hydrates the four fixed room containers into canonical PhysicalWorldState', () => {
    const sim = new SimulationEngine();
    const physical = sim.getPhysicalWorldState();

    for (const id of ROOM_STORAGE_IDS) {
      expect(physical.containers[id]).toMatchObject({ instanceId: id });
    }
  });

  it('uses normal #18 transfer rules and preserves exact item location across save/reload', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'room storage test');
    const pickup = sim.placeGroceryOrder([{ sku: 'noodles_cup', qty: 1 }], 'pickup', sim.clock.getTotalMinutes());
    expect(pickup.success).toBe(true);

    const afterPickup = sim.getPhysicalWorldState();
    const bag = Object.values(afterPickup.items).find((item) =>
      item.instanceId.startsWith('shopping-bag:')
      && item.location.kind === 'container'
      && item.location.containerInstanceId === PLAYER_INVENTORY_CONTAINER_ID
    );
    expect(bag).toBeDefined();

    const [grocery] = sim.openPhysicalContainer(bag!.instanceId, PLAYER_INVENTORY_CONTAINER_ID);
    expect(grocery).toBeDefined();

    sim.transferPhysicalItem(grocery!.instanceId, {
      kind: 'container',
      containerInstanceId: 'room104:desk-storage',
    });

    const restored = new SimulationEngine(sim.exportSnapshot());
    expect(restored.getPhysicalWorldState().items[grocery!.instanceId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: 'room104:desk-storage',
    });
  });

  it('backfills fixed Room 104 containers when loading an older physical snapshot that predates them', () => {
    const original = new SimulationEngine();
    const oldSnapshot = original.exportSnapshot();
    for (const id of ROOM_STORAGE_IDS) {
      delete oldSnapshot.physicalWorld.containers[id];
    }

    const restored = new SimulationEngine(oldSnapshot);
    const physical = restored.getPhysicalWorldState();

    for (const id of ROOM_STORAGE_IDS) {
      expect(physical.containers[id]).toMatchObject({ instanceId: id });
    }
  });
});
