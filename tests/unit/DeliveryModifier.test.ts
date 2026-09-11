import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { deliveryEtaMinutes } from '../../src/engine/DeliveryEngine';

/**
 * RED-first TDD for #46 requirement 6: the delivery consumer reads the
 * courier_backlog modifier through its own domain API. WorldEventsEngine
 * never moves or completes a parcel itself.
 */
describe('Delivery event-modifier consumer (#46)', () => {
  const items = [{ sku: 'noodles_cup', qty: 1 }];

  it('6. consumer reads the modifier through its own domain API', () => {
    const sim = new SimulationEngine();
    const nowMinute = 4 * 1440;
    sim.world.triggerEventById('city_canal_festival', nowMinute);

    const active = sim.world.queryActiveModifiers({ domain: 'delivery', atMinute: nowMinute });
    expect(active).toHaveLength(1);

    const before = sim.exportSnapshot();
    const result = sim.placeGroceryOrder(items, 'delivery', nowMinute);
    expect(result.success).toBe(true);

    const orderId = result.data?.orderId;
    expect(orderId).toBeDefined();
    const stored = sim.delivery.getState().orders.find((o) => o.id === orderId);
    expect(stored).toBeDefined();
    // Delivery authority owns readyMinute: deterministic base + bounded backlog extra.
    const baseEta = deliveryEtaMinutes(orderId!);
    expect(stored?.readyMinute).toBe(nowMinute + baseEta + 360);
    expect(result.data?.etaMinute).toBe(nowMinute + baseEta + 360);

    // The event engine itself wrote nothing into delivery state.
    expect(Object.keys(before)).toContain('deliveries');
    expect(before.deliveries.orders).toHaveLength(0);
  });

  it('orders placed while the festival is inactive carry no extra', () => {
    const sim = new SimulationEngine();
    const nowMinute = 100;
    const result = sim.placeGroceryOrder(items, 'delivery', nowMinute);
    expect(result.success).toBe(true);
    const stored = sim.delivery.getState().orders.find((o) => o.id === result.data?.orderId);
    expect(stored?.readyMinute).toBe(nowMinute + deliveryEtaMinutes(result.data!.orderId));
  });

  it('backlog extra is bounded even for stacked modifiers', () => {
    const sim = new SimulationEngine();
    sim.world.triggerEventById('city_canal_festival', 4 * 1440);
    const result = sim.placeGroceryOrder(items, 'delivery', 4 * 1440 + 10);
    expect(result.success).toBe(true);
    const extra = result.data!.etaMinute - (4 * 1440 + 10) - deliveryEtaMinutes(result.data!.orderId);
    expect(extra).toBeGreaterThanOrEqual(0);
    expect(extra).toBeLessThanOrEqual(720);
  });
});
