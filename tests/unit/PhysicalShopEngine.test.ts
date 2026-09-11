import { describe, expect, it } from 'vitest';
import {
  PhysicalItemEngine,
  type PhysicalContainerDefinition,
  type PhysicalItemDefinition,
  type PhysicalWorldState,
} from '../../src/engine/PhysicalItemEngine';
import { PhysicalShopEngine, type PhysicalShopState } from '../../src/engine/PhysicalShopEngine';

const itemDefinitions: Readonly<Record<string, PhysicalItemDefinition>> = {
  soda: { id: 'soda', kind: 'grocery', portable: true, volume: 1 },
  noodles: { id: 'noodles', kind: 'grocery', portable: true, volume: 1 },
};

const containerDefinitions: Readonly<Record<string, PhysicalContainerDefinition>> = {
  player_inventory: {
    id: 'player_inventory',
    capacity: 12,
    allowedItemKinds: ['grocery'],
  },
};

function emptyWorld(): PhysicalWorldState {
  return {
    items: {},
    containers: {
      player_inventory: { instanceId: 'player_inventory', definitionId: 'player_inventory' },
    },
  };
}

function createShop(
  persisted?: PhysicalShopState,
  world: PhysicalWorldState = emptyWorld(),
): { shop: PhysicalShopEngine; physicalItems: PhysicalItemEngine } {
  const physicalItems = new PhysicalItemEngine(world, itemDefinitions, containerDefinitions);
  const shop = new PhysicalShopEngine({
    storeId: 'corner_mart',
    worldSeed: 'save-001',
    physicalItems,
    persistedState: persisted,
    fixtures: [
      {
        id: 'front_shelf',
        slots: [
          { id: 'front_shelf:0', eligibleDefinitionIds: ['soda', 'noodles'] },
          { id: 'front_shelf:1', eligibleDefinitionIds: ['soda', 'noodles'] },
          { id: 'front_shelf:2', eligibleDefinitionIds: ['soda', 'noodles'] },
        ],
      },
    ],
  });
  return { shop, physicalItems };
}

describe('PhysicalShopEngine (#27)', () => {
  it('materializes deterministic exact stock once and restores the persisted slot layout without rerandomizing', () => {
    const first = createShop();
    const firstState = first.shop.getState();
    const firstWorld = first.physicalItems.getState();

    expect(Object.keys(firstState.stockBySlot)).toEqual([
      'front_shelf:0',
      'front_shelf:1',
      'front_shelf:2',
    ]);
    expect(Object.keys(firstWorld.items)).toHaveLength(3);

    for (const [slotId, instanceId] of Object.entries(firstState.stockBySlot)) {
      expect(firstWorld.items[instanceId]).toMatchObject({
        instanceId,
        location: { kind: 'storeStock', storeId: 'corner_mart', slotId },
      });
      expect(firstState.ownershipByItemId[instanceId]).toBe('store');
    }

    const restored = createShop(firstState, firstWorld);
    expect(restored.shop.getState()).toEqual(firstState);
    expect(restored.physicalItems.getState()).toEqual(firstWorld);
  });

  it('moves one exact store item into player inventory as unpaid and can return the same identity to its authored slot', () => {
    const { shop, physicalItems } = createShop();
    const before = shop.getState();
    const instanceId = before.stockBySlot['front_shelf:0']!;

    shop.take(instanceId, 'player_inventory');
    expect(physicalItems.getItem(instanceId).location).toEqual({
      kind: 'container',
      containerInstanceId: 'player_inventory',
    });
    expect(shop.getState().ownershipByItemId[instanceId]).toBe('unpaid');
    expect(shop.getState().stockBySlot['front_shelf:0']).toBeUndefined();

    shop.returnToStock(instanceId);
    expect(physicalItems.getItem(instanceId).location).toEqual({
      kind: 'storeStock',
      storeId: 'corner_mart',
      slotId: 'front_shelf:0',
    });
    expect(shop.getState().ownershipByItemId[instanceId]).toBe('store');
    expect(shop.getState().stockBySlot['front_shelf:0']).toBe(instanceId);
  });
});