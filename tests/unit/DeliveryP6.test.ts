import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { GROCERY_SKUS, deliveryEtaMinutes } from '../../src/engine/DeliveryEngine';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';

describe('P6 CornerMart catalog', () => {
  it('prices real pantry stock', () => {
    expect(GROCERY_SKUS.noodle_6pack!.price).toBe(10);
    expect(GROCERY_SKUS.noodle_6pack!.qty).toBe(6);
    expect(GROCERY_SKUS.grocery_feast!.pantry).toBe('groceries');
  });

  it('courier ETAs land in the 2–24h window, deterministically', () => {
    const eta = deliveryEtaMinutes('ord_test_1');
    expect(eta).toBeGreaterThanOrEqual(120);
    expect(eta).toBeLessThanOrEqual(24 * 60);
    expect(deliveryEtaMinutes('ord_test_1')).toBe(eta);
  });
});

describe('P6 grocery orders (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => {
    sim = new SimulationEngine();
    sim.economy.earnCash(200, 'test funds');
  });

  it('rejects empty carts, unknown SKUs and poverty', () => {
    expect(sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [], fulfillment: 'delivery' }).success).toBe(false);
    expect(sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [{ sku: 'moon', qty: 1 }], fulfillment: 'delivery' }).success).toBe(false);
    (sim.economy as any).state.cash = 1;
    expect(sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [{ sku: 'noodles_cup', qty: 1 }], fulfillment: 'delivery' }).success).toBe(false);
  });

  it('pickup is a 30-minute errand that returns with a carried physical bag', () => {
    const before = sim.clock.getTotalMinutes();
    const pantryBefore = sim.getState().player.pantry.noodles;
    const res = sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [{ sku: 'noodle_6pack', qty: 1 }], fulfillment: 'pickup' });
    expect(res.success).toBe(true);
    expect(sim.clock.getTotalMinutes()).toBe(before + 30);
    expect(sim.getState().player.pantry.noodles).toBe(pantryBefore);
    expect(sim.getState().player.cash).toBe(238 - 10);

    const orderId = (res.data as { orderId: string }).orderId;
    const bagId = `shopping-bag:${orderId}`;
    const physical = sim.getPhysicalWorldState();
    expect(physical.items[bagId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
    expect(Object.values(physical.items).filter(
      (item) => item.location.kind === 'container' && item.location.containerInstanceId === bagId,
    )).toHaveLength(1);
  });

  it('delivery is slow, free of effort, and becomes a physical parcel on arrival', () => {
    const res = sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [{ sku: 'grocery_bag', qty: 2 }], fulfillment: 'delivery' });
    expect(res.success).toBe(true);
    const orderId = (res.data as { orderId: string }).orderId;
    const order = sim.delivery.getState().orders.find((o) => o.id === orderId)!;
    expect(order.status).toBe('transit');
    expect(order.readyMinute - order.placedMinute).toBeGreaterThanOrEqual(120);
    expect(order.readyMinute - order.placedMinute).toBeLessThanOrEqual(24 * 60);
    expect(sim.getState().player.pantry.groceries).toBe(0);
    sim.advanceGameMinutes(order.readyMinute - order.placedMinute + 1, 'waiting for courier');
    expect(sim.delivery.getState().orders.find((o) => o.id === orderId)!.status).toBe('done');
    expect(sim.getState().player.pantry.groceries).toBe(0);
    expect(sim.getPhysicalWorldState().items[`parcel:${orderId}`]?.location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room104:delivery',
    });
  });

  it('persists orders across save/restore', () => {
    sim.dispatchAction({ type: 'PLAYER_PLACE_ORDER', items: [{ sku: 'noodles_cup', qty: 1 }], fulfillment: 'delivery' });
    const restored = new SimulationEngine(sim.getState() as any);
    expect(restored.delivery.getState().orders.length).toBe(1);
    expect(restored.getState().player.pantry).toEqual(sim.getState().player.pantry);
  });
});