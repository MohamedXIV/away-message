import type { ActionResult } from '../types';
import {
  GROCERY_SKUS,
  type Fulfillment,
  type PlaceDeliveryOptions,
} from '../DeliveryEngine';
import { totalDeliveryBacklogExtra } from '../WorldModifiers';
import type { CoreDomainOwners } from './CoreDomainOwners';

type GroceryOwners = Pick<
  CoreDomainOwners,
  'clock' | 'economy' | 'needs' | 'delivery' | 'world' | 'telemetry'
>;

export type GroceryOrderResult = ActionResult & {
  data?: { orderId: string; etaMinute: number; summary: string };
};

/**
 * Coordinates CornerMart purchases without owning Economy, pantry, courier,
 * time, world events, or delivery state.
 *
 * DeliveryEngine still owns order status and physical arrival handling; the
 * simulation kernel owns advancing the game clock.
 */
export class GroceryDeliveryCoordination {
  constructor(
    private readonly owners: GroceryOwners,
    private readonly advanceGameMinutes: (minutes: number, reason: string) => void,
    private readonly publishState: () => void,
  ) {}

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
    deliveryOptions?: PlaceDeliveryOptions,
  ): GroceryOrderResult {
    try {
      const { clock, economy, needs, delivery, world, telemetry } = this.owners;
      const items = (rawItems || [])
        .filter((item) => item && GROCERY_SKUS[item.sku] && Number.isFinite(item.qty) && item.qty >= 1)
        .map((item) => ({ sku: item.sku, qty: Math.min(9, Math.floor(item.qty)) }));
      if (items.length === 0) return { success: false, error: 'Cart is empty.' };
      const total = items.reduce((sum, item) => sum + GROCERY_SKUS[item.sku]!.price * item.qty, 0);
      if (!economy.canAfford(total)) {
        return { success: false, error: `Cannot afford $${total.toFixed(2)} order.` };
      }

      if (fulfillment === 'pickup') {
        if (needs.getState().energy < 20) {
          return { success: false, error: 'Too tired for a store run (need 20% energy).' };
        }
        economy.spendCash(total, 'CornerMart pickup');
        this.advanceGameMinutes(30, 'CornerMart pickup run');
        needs.consumeEnergy(5);
        for (const item of items) {
          const sku = GROCERY_SKUS[item.sku]!;
          economy.addPantry(sku.pantry, sku.qty * item.qty);
        }
        const order = delivery.recordPickup(items, total, clock.getTotalMinutes());
        telemetry.logEvent('economy', 'order_pickup', clock.getTotalMinutes(), {
          orderId: order.id, total,
        });
        this.publishState();
        return {
          success: true,
          data: {
            orderId: order.id,
            etaMinute: clock.getTotalMinutes(),
            summary: 'Picked up from CornerMart — pantry stocked.',
          },
        };
      }

      economy.spendCash(total, 'CornerMart delivery');
      let backlogExtra = 0;
      try {
        backlogExtra = totalDeliveryBacklogExtra(
          world.queryActiveModifiers({ domain: 'delivery', atMinute: nowMinute }),
        );
      } catch {
        backlogExtra = 0;
      }
      const order = delivery.placeDelivery(items, total, nowMinute, {
        ...deliveryOptions,
        etaExtraMinutes: backlogExtra,
      });
      telemetry.logEvent('economy', 'order_placed', nowMinute, {
        orderId: order.id, total, etaMinute: order.readyMinute,
      });
      this.publishState();
      const etaH = Math.round((order.readyMinute - nowMinute) / 60);
      return {
        success: true,
        data: {
          orderId: order.id,
          etaMinute: order.readyMinute,
          summary: `Courier on the way — about ${etaH}h. Check Mailbox parcels.`,
        },
      };
    } catch {
      return { success: false, error: 'Order failed.' };
    }
  }

  /**
   * Called by TimeAdvancement only when canonical time moves. The physical
   * world's arrival handler executes inside DeliveryEngine first, preventing
   * duplicate pantry credits for materialized deliveries.
   */
  public processDeliveries(): void {
    try {
      const { clock, delivery, economy, world, telemetry } = this.owners;
      const now = clock.getTotalMinutes();
      const arrived = delivery.completeDue(now);
      for (const order of arrived) {
        for (const item of order.items) {
          const sku = GROCERY_SKUS[item.sku];
          if (sku) economy.addPantry(sku.pantry, sku.qty * item.qty);
        }
        world.setFlag(`delivery_arrived_${order.id}`, true);
        telemetry.logEvent('economy', 'order_delivered', now, { orderId: order.id });
      }
      if (arrived.length > 0) this.publishState();
    } catch {
      // Deliveries must never break the canonical simulation tick.
    }
  }
}
