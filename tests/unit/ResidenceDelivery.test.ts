import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Residence delivery routing (#86)', () => {
  it('does not materialize a home parcel at Room 104 when the current residence has no delivery capability', () => {
    const seed = new SimulationEngine({ player: { cash: 500 } } as any);
    const snapshot = seed.exportSnapshot() as any;
    snapshot.residence = {
      currentResidencePlaceId: 'place_a1',
      tenancyId: 'tenancy:test-a1',
      moveInMinute: snapshot.time.totalMinutes,
      currentRent: 125,
    };

    const engine = new SimulationEngine(snapshot);
    const now = engine.getState().time.totalMinutes;
    const placed = engine.placeGroceryOrder([{ sku: 'noodles_cup', qty: 1 }], 'delivery', now) as any;
    expect(placed.success).toBe(true);

    const orders = engine.getState().delivery.orders;
    const order = orders[orders.length - 1]!;
    engine.advanceTime(Math.max(0, order.readyMinute - now));

    const state = engine.getState() as any;
    const parcel = Object.values(state.physicalWorld.items).find(
      (item: any) => item.instanceId === `parcel:${order.id}`,
    ) as any;

    expect(engine.resolveCurrentHomePlaceId()).toBe('place_a1');
    expect(parcel).toBeUndefined();
  });
});
