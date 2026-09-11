import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';

describe('physical local CornerMart purchase', () => {
  it('checks out exact goods into a portable shopping bag instead of teleporting pantry stock', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'local physical purchase test');
    const pantryBefore = { ...sim.getState().player.pantry };

    const result = sim.placeGroceryOrder([{ sku: 'noodles_cup', qty: 2 }], 'pickup', sim.clock.getTotalMinutes());
    expect(result.success).toBe(true);

    const orderId = (result.data as { orderId: string }).orderId;
    const bagId = `shopping-bag:${orderId}`;
    const physical = sim.getPhysicalWorldState();
    expect(sim.getState().player.pantry).toEqual(pantryBefore);
    expect(physical.items[bagId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
    expect(physical.containers[bagId]).toBeDefined();
    expect(Object.values(physical.items)
      .filter((item) => item.location.kind === 'container' && item.location.containerInstanceId === bagId)
      .map((item) => item.instanceId))
      .toEqual([
        `pickup-item:${orderId}:noodles_cup:0`,
        `pickup-item:${orderId}:noodles_cup:1`,
      ]);
  });

  it('keeps insufficient-cash checkout atomic for cash and physical ownership/location', () => {
    const sim = new SimulationEngine();
    const cashBefore = sim.getState().player.cash;
    const physicalBefore = sim.getPhysicalWorldState();

    const result = sim.placeGroceryOrder([{ sku: 'grocery_feast', qty: 9 }], 'pickup', sim.clock.getTotalMinutes());

    expect(result.success).toBe(false);
    expect(sim.getState().player.cash).toBe(cashBefore);
    expect(sim.getPhysicalWorldState()).toEqual(physicalBefore);
    expect(sim.delivery.getState().orders).toEqual([]);
  });

  it('carries the paid bag home as one container and preserves exact contents across save/reload', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'local bag persistence test');
    const result = sim.placeGroceryOrder([{ sku: 'grocery_bag', qty: 1 }], 'pickup', sim.clock.getTotalMinutes());
    const orderId = (result.data as { orderId: string }).orderId;
    const bagId = `shopping-bag:${orderId}`;
    const contentId = `pickup-item:${orderId}:grocery_bag:0`;

    sim.transferPhysicalItem(bagId, { kind: 'worldAnchor', anchorId: 'room104:table' });
    const restored = new SimulationEngine(sim.exportSnapshot());
    const physical = restored.getPhysicalWorldState();

    expect(physical.items[bagId]?.location).toEqual({ kind: 'worldAnchor', anchorId: 'room104:table' });
    expect(physical.items[contentId]?.location).toEqual({ kind: 'container', containerInstanceId: bagId });
    expect(restored.openPhysicalContainer(bagId).map((item) => item.instanceId)).toEqual([contentId]);
  });
});
