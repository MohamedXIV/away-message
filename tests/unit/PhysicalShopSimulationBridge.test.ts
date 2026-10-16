import { describe, expect, it } from 'vitest';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';
import type { PhysicalShopFixtureDefinition } from '../../src/engine/PhysicalShopEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

const STORE_ID = 'corner_mart';
const WORLD_SEED = 'issue-28-store-seed';

const fixtures: readonly PhysicalShopFixtureDefinition[] = [{
  id: 'front_shelf',
  slots: [
    { id: 'front_shelf:0', eligibleDefinitionIds: ['corner-mart:noodles_cup', 'corner-mart:grocery_bag'] },
    { id: 'front_shelf:1', eligibleDefinitionIds: ['corner-mart:grocery_bag', 'corner-mart:noodles_cup'] },
  ],
}];

const prices = {
  'corner-mart:noodles_cup': 2,
  'corner-mart:grocery_bag': 8,
} as const;

describe('SimulationEngine physical shop bridge (#28)', () => {
  it('materializes first-entry stock once and preserves exact slots across reads and reload', () => {
    const sim = new SimulationEngine();
    const first = sim.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures);
    expect(sim.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures)).toEqual(first);
    // The first visit is a command, not a hidden write during UI read.
    expect(sim.initializePhysicalShop(STORE_ID, WORLD_SEED, fixtures)).toBe(true);
    expect(sim.initializePhysicalShop(STORE_ID, WORLD_SEED, fixtures)).toBe(false);
    expect(Object.keys(first.stockBySlot)).toEqual(['front_shelf:0', 'front_shelf:1']);

    const restored = new SimulationEngine(sim.exportSnapshot());
    expect(restored.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures)).toEqual(first);
  });

  it('persists take/return and keeps cashier talk available with an empty basket', () => {
    const sim = new SimulationEngine();
    expect(sim.getPhysicalShopCashierCapabilities(STORE_ID, WORLD_SEED, fixtures))
      .toEqual({ talk: true, checkout: false });

    const itemId = sim.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures)
      .stockBySlot['front_shelf:0']!;
    expect(sim.takePhysicalShopItem(STORE_ID, WORLD_SEED, fixtures, itemId).location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
    expect(sim.getPhysicalShopCashierCapabilities(STORE_ID, WORLD_SEED, fixtures))
      .toEqual({ talk: true, checkout: true });

    const restored = new SimulationEngine(sim.exportSnapshot());
    expect(restored.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures).ownershipByItemId[itemId])
      .toBe('unpaid');
    expect(restored.returnPhysicalShopItem(STORE_ID, WORLD_SEED, fixtures, itemId).location).toEqual({
      kind: 'storeStock',
      storeId: STORE_ID,
      slotId: 'front_shelf:0',
    });
  });

  it('checks out exact carried goods and preserves paid ownership/location on reload', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'issue-28 checkout test');
    const itemId = sim.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures)
      .stockBySlot['front_shelf:0']!;
    const definitionId = sim.takePhysicalShopItem(STORE_ID, WORLD_SEED, fixtures, itemId).definitionId;
    const cashBefore = sim.getState().player.cash;

    const result = sim.checkoutPhysicalShop(STORE_ID, WORLD_SEED, fixtures, prices);
    expect(result.success).toBe(true);
    expect(result.itemIds).toEqual([itemId]);
    expect(result.total).toBe(prices[definitionId as keyof typeof prices]);
    expect(sim.getState().player.cash).toBe(cashBefore - result.total!);

    const restored = new SimulationEngine(sim.exportSnapshot());
    expect(restored.getPhysicalShopState(STORE_ID, WORLD_SEED, fixtures).ownershipByItemId[itemId])
      .toBe('owned');
    expect(restored.getPhysicalWorldState().items[itemId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
  });
});
