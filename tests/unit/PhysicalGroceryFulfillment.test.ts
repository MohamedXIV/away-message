import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PhysicalGroceryFulfillment } from '../../src/engine/kernel/PhysicalGroceryFulfillment';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';

function owner(engine: SimulationEngine): PhysicalGroceryFulfillment {
  return (engine as unknown as { physicalGrocery: PhysicalGroceryFulfillment }).physicalGrocery;
}

describe('PhysicalGroceryFulfillment — one physical pickup/courier authority', () => {
  it('creates one carried pickup bag through the canonical item and order owners', () => {
    const engine = new SimulationEngine();
    const fulfillment = owner(engine);
    engine.economy.earnCash(100, 'pickup fixture');
    const before = engine.exportSnapshot();

    const result = engine.placeGroceryOrder([{ sku: 'noodles_cup', qty: 2 }], 'pickup', engine.clock.getTotalMinutes());
    expect(result.success).toBe(true);
    expect(result.data?.orderId).toBeTruthy();
    expect(engine.clock.getTotalMinutes()).toBe(before.totalMinutes + 30);

    const orderId = result.data!.orderId;
    expect(engine.delivery.getState().orders.find((order) => order.id === orderId)?.status)
      .toBe('done');
    expect(engine.getState().player.pantry.noodles).toBe(before.player.pantry.noodles);
    const physical = engine.getPhysicalWorldState();
    const bagId = `shopping-bag:${orderId}`;
    expect(physical.items[bagId]?.location).toEqual({
      kind: 'container', containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
    expect(Object.values(physical.items).filter(
      (item) => item.location.kind === 'container' && item.location.containerInstanceId === bagId,
    )).toHaveLength(2);
    expect(fulfillment).toBe(owner(engine));
  });

  it('uses the same arrival binding after reload and never duplicates a physical shipment', () => {
    const engine = new SimulationEngine();
    engine.economy.earnCash(100, 'courier fixture');
    const placed = engine.dispatchAction({
      type: 'PLAYER_PLACE_ORDER',
      items: [{ sku: 'grocery_bag', qty: 1 }],
      fulfillment: 'delivery',
    });
    expect(placed.success).toBe(true);
    const orderId = (placed.data as { orderId: string }).orderId;
    const saved = engine.exportSnapshot();
    const ownerBefore = owner(engine);

    engine.loadSnapshot(saved);
    expect(owner(engine)).toBe(ownerBefore);
    const order = engine.delivery.getState().orders.find((o) => o.id === orderId)!;
    engine.advanceGameMinutes(order.readyMinute - engine.clock.getTotalMinutes() + 1, 'courier fixture arrival');
    const physical = engine.getPhysicalWorldState();
    expect(physical.items[`parcel:${orderId}`]).toBeDefined();

    engine.advanceGameMinutes(1, 'courier fixture repeated tick');
    expect(engine.getPhysicalWorldState()).toEqual(physical);
    expect(engine.delivery.getState().orders.find((o) => o.id === orderId)?.status).toBe('done');
  });
});
