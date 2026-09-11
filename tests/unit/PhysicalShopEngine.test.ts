import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
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

const prices: Readonly<Record<string, number>> = {
  soda: 2.5,
  noodles: 3.25,
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

  it('keeps the cashier talkable with an empty basket and adds checkout only when unpaid goods exist', () => {
    const { shop } = createShop();
    expect(shop.getCashierCapabilities()).toEqual({ talk: true, checkout: false });

    const instanceId = shop.getState().stockBySlot['front_shelf:0']!;
    shop.take(instanceId, 'player_inventory');
    expect(shop.getCashierCapabilities()).toEqual({ talk: true, checkout: true });
  });

  it('lets SimulationEngine own atomic checkout, deduct exactly once, and preserve carried locations', () => {
    const simulation = new SimulationEngine();
    const { shop, physicalItems } = createShop();
    const instanceIds = [
      shop.getState().stockBySlot['front_shelf:0']!,
      shop.getState().stockBySlot['front_shelf:1']!,
    ];
    for (const instanceId of instanceIds) shop.take(instanceId, 'player_inventory');

    const expectedTotal = instanceIds.reduce(
      (sum, instanceId) => sum + prices[physicalItems.getItem(instanceId).definitionId]!,
      0,
    );
    const cashBefore = simulation.getState().player.cash;
    const result = simulation.checkoutPhysicalShop(shop, prices);

    expect(result).toEqual({ success: true, total: expectedTotal, itemIds: instanceIds });
    expect(simulation.getState().player.cash).toBe(cashBefore - expectedTotal);
    for (const instanceId of instanceIds) {
      expect(shop.getState().ownershipByItemId[instanceId]).toBe('owned');
      expect(physicalItems.getItem(instanceId).location).toEqual({
        kind: 'container',
        containerInstanceId: 'player_inventory',
      });
    }

    const cashAfter = simulation.getState().player.cash;
    expect(simulation.checkoutPhysicalShop(shop, prices).success).toBe(false);
    expect(simulation.getState().player.cash).toBe(cashAfter);
  });

  it('fails checkout atomically when cash is insufficient and preserves unpaid goods across reload', () => {
    const simulation = new SimulationEngine();
    const { shop, physicalItems } = createShop();
    const instanceId = shop.getState().stockBySlot['front_shelf:0']!;
    shop.take(instanceId, 'player_inventory');

    const beforeState = shop.getState();
    const beforeWorld = physicalItems.getState();
    const cashBefore = simulation.getState().player.cash;
    const result = simulation.checkoutPhysicalShop(shop, { soda: 1000, noodles: 1000 });

    expect(result.success).toBe(false);
    expect(simulation.getState().player.cash).toBe(cashBefore);
    expect(shop.getState()).toEqual(beforeState);
    expect(physicalItems.getState()).toEqual(beforeWorld);

    const restored = createShop(shop.getState(), physicalItems.getState());
    expect(restored.shop.getState().ownershipByItemId[instanceId]).toBe('unpaid');
    expect(restored.physicalItems.getItem(instanceId).location).toEqual({
      kind: 'container',
      containerInstanceId: 'player_inventory',
    });
  });

  it('preserves paid carried goods across shop-state and physical-world reload', () => {
    const simulation = new SimulationEngine();
    const { shop, physicalItems } = createShop();
    const instanceId = shop.getState().stockBySlot['front_shelf:0']!;
    shop.take(instanceId, 'player_inventory');
    expect(simulation.checkoutPhysicalShop(shop, prices).success).toBe(true);

    const restored = createShop(shop.getState(), physicalItems.getState());
    expect(restored.shop.getState().ownershipByItemId[instanceId]).toBe('owned');
    expect(restored.physicalItems.getItem(instanceId).location).toEqual({
      kind: 'container',
      containerInstanceId: 'player_inventory',
    });
  });
});
