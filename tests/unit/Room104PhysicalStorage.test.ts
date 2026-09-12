import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';
import type { ItemInstance, PhysicalWorldState } from '../../src/engine/PhysicalItemEngine';
import {
  getRoom104StorageContents,
  getRoom104StoragePresence,
} from '../../src/engine/Room104Physical';

const ROOM_STORAGE_IDS = [
  'room104:desk-storage',
  'room104:wardrobe',
  'room104:bedside-storage',
  'room104:kitchen-storage',
] as const;

type StorageTarget = 'desk' | 'wardrobe' | 'bedside' | 'kitchen';
type StorageReader = (state: PhysicalWorldState, target: StorageTarget) => ItemInstance[];

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

  it('reads exact persisted contents from the selected canonical room container', () => {
    const readStorage: StorageReader = getRoom104StorageContents;

    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'room storage read test');
    const pickup = sim.placeGroceryOrder([{ sku: 'noodles_cup', qty: 1 }], 'pickup', sim.clock.getTotalMinutes());
    expect(pickup.success).toBe(true);

    const bag = Object.values(sim.getPhysicalWorldState().items).find((item) =>
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

    const physical = sim.getPhysicalWorldState();
    expect(readStorage(physical, 'desk')).toEqual([
      expect.objectContaining({
        instanceId: grocery!.instanceId,
        location: {
          kind: 'container',
          containerInstanceId: 'room104:desk-storage',
        },
      }),
    ]);
    expect(readStorage(physical, 'wardrobe')).toEqual([]);
  });

  it('projects visible storage presence directly from exact physical item identities', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'room storage visual projection test');
    const pickup = sim.placeGroceryOrder([{ sku: 'noodles_cup', qty: 1 }], 'pickup', sim.clock.getTotalMinutes());
    expect(pickup.success).toBe(true);

    const bag = Object.values(sim.getPhysicalWorldState().items).find((item) =>
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

    expect(getRoom104StoragePresence(sim.getPhysicalWorldState())).toEqual([
      expect.objectContaining({
        target: 'desk',
        containerInstanceId: 'room104:desk-storage',
        itemCount: 1,
        itemInstanceIds: [grocery!.instanceId],
        itemDefinitionIds: [grocery!.definitionId],
      }),
      expect.objectContaining({ target: 'wardrobe', itemCount: 0, itemInstanceIds: [], itemDefinitionIds: [] }),
      expect.objectContaining({ target: 'bedside', itemCount: 0, itemInstanceIds: [], itemDefinitionIds: [] }),
      expect.objectContaining({ target: 'kitchen', itemCount: 0, itemInstanceIds: [], itemDefinitionIds: [] }),
    ]);

    sim.transferPhysicalItem(grocery!.instanceId, {
      kind: 'container',
      containerInstanceId: 'room104:kitchen-storage',
    });

    const moved = getRoom104StoragePresence(sim.getPhysicalWorldState());
    expect(moved.find((entry) => entry.target === 'desk')?.itemCount).toBe(0);
    expect(moved.find((entry) => entry.target === 'kitchen')).toMatchObject({
      itemCount: 1,
      itemInstanceIds: [grocery!.instanceId],
      itemDefinitionIds: [grocery!.definitionId],
    });
  });
});
