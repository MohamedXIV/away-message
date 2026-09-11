import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';

describe('physical parcel opening', () => {
  it('moves the exact parcel contents once into player inventory', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'parcel open test');
    const placed = sim.dispatchAction({
      type: 'PLAYER_PLACE_ORDER',
      items: [{ sku: 'grocery_bag', qty: 2 }],
      fulfillment: 'delivery',
    });
    const orderId = (placed.data as { orderId: string }).orderId;
    const order = sim.delivery.getState().orders.find((candidate) => candidate.id === orderId)!;
    sim.advanceGameMinutes(order.readyMinute - order.placedMinute + 1, 'wait for courier');

    const parcelId = `parcel:${orderId}`;
    const expectedIds = [
      `order-item:${orderId}:grocery_bag:0`,
      `order-item:${orderId}:grocery_bag:1`,
    ];

    expect(sim.openPhysicalContainer(parcelId, PLAYER_INVENTORY_CONTAINER_ID).map((item) => item.instanceId)).toEqual(expectedIds);

    const after = sim.getPhysicalWorldState();
    for (const instanceId of expectedIds) {
      expect(after.items[instanceId]?.location).toEqual({
        kind: 'container',
        containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
      });
    }
    expect(Object.values(after.items).filter(
      (item) => item.location.kind === 'container' && item.location.containerInstanceId === parcelId,
    )).toHaveLength(0);
  });

  it('is idempotent: opening the same empty parcel again creates no duplicate item', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'parcel idempotence test');
    const placed = sim.dispatchAction({
      type: 'PLAYER_PLACE_ORDER',
      items: [{ sku: 'noodles_cup', qty: 1 }],
      fulfillment: 'delivery',
    });
    const orderId = (placed.data as { orderId: string }).orderId;
    const order = sim.delivery.getState().orders.find((candidate) => candidate.id === orderId)!;
    sim.advanceGameMinutes(order.readyMinute - order.placedMinute + 1, 'wait for courier');

    const parcelId = `parcel:${orderId}`;
    const first = sim.openPhysicalContainer(parcelId, PLAYER_INVENTORY_CONTAINER_ID);
    const stateAfterFirst = sim.getPhysicalWorldState();
    const second = sim.openPhysicalContainer(parcelId, PLAYER_INVENTORY_CONTAINER_ID);

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(sim.getPhysicalWorldState()).toEqual(stateAfterFirst);
  });

  it('keeps opened exact identities and locations across save/reload', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'parcel open persistence test');
    const placed = sim.dispatchAction({
      type: 'PLAYER_PLACE_ORDER',
      items: [{ sku: 'noodles_cup', qty: 1 }],
      fulfillment: 'delivery',
    });
    const orderId = (placed.data as { orderId: string }).orderId;
    const order = sim.delivery.getState().orders.find((candidate) => candidate.id === orderId)!;
    sim.advanceGameMinutes(order.readyMinute - order.placedMinute + 1, 'wait for courier');

    const parcelId = `parcel:${orderId}`;
    const [opened] = sim.openPhysicalContainer(parcelId, PLAYER_INVENTORY_CONTAINER_ID);
    const restored = new SimulationEngine(sim.exportSnapshot());

    expect(restored.getPhysicalWorldState().items[opened!.instanceId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
    expect(restored.openPhysicalContainer(parcelId, PLAYER_INVENTORY_CONTAINER_ID)).toEqual([]);
  });
});
