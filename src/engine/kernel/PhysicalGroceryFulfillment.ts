import { PLAYER_INVENTORY_CONTAINER_ID } from '../PhysicalItemBridge';
import { GROCERY_SKUS, type DeliveryOrder, type Fulfillment, type PlaceDeliveryOptions } from '../DeliveryEngine';
import { resolvePlaceDeliveryTarget } from '../physical/PhysicalContextRuntime';
import { GENERATED_PLACE_SERVICE_POLICIES } from '../worldContent.generated';
import {
  DELIVERY_PARCEL_DEFINITION_ID,
  PHYSICAL_RUNTIME_GRAPH,
  SHOPPING_BAG_DEFINITION_ID,
  type MaterialWorldRuntime,
} from './MaterialWorldRuntime';
import type { CoreDomainOwners } from './CoreDomainOwners';
import type { GroceryOrderResult } from './GroceryDeliveryCoordination';

type GroceryOwners = Pick<
  CoreDomainOwners,
  'clock' | 'economy' | 'needs' | 'delivery' | 'world' | 'telemetry'
>;

/**
 * Physical fulfillment policy over the single canonical DeliveryEngine,
 * Economy, Needs, World and MaterialWorld owners.
 *
 * Home pickup creates a carried bag (not pantry credit); courier delivery
 * defers payment/order lifecycle to the shared GroceryDeliveryCoordination
 * and materializes the parcel only through DeliveryEngine's arrival hook.
 * This module has NO second order queue, cash store or physical item state.
 */
export class PhysicalGroceryFulfillment {
  constructor(
    private readonly owners: GroceryOwners,
    private readonly material: MaterialWorldRuntime,
    private readonly readDeliveryPlace: () => string | null,
    private readonly placeCanonicalDelivery: (
      items: Array<{ sku: string; qty: number }>,
      fulfillment: Fulfillment,
      atMinute: number,
      options: PlaceDeliveryOptions,
    ) => GroceryOrderResult,
    private readonly advanceGameMinutes: (minutes: number, reason: string) => void,
  ) {}

  public bindArrivalHandler(): void {
    this.owners.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
  }

  private materializeDeliveryParcel(order: DeliveryOrder): boolean {
    if (!order.deliveryTarget) {
      throw new Error(`Delivery order ${order.id} has no explicit authored target.`);
    }

    const parcelId = `parcel:${order.id}`;
    this.material.materializeGroceryContainer(
      order,
      parcelId,
      DELIVERY_PARCEL_DEFINITION_ID,
      { kind: 'worldAnchor', anchorId: order.deliveryTarget.anchorId },
      'order-item',
    );
    try { this.owners.world.setFlag(`delivery_arrived_${order.id}`, true); } catch {}
    try {
      this.owners.telemetry.logEvent('economy', 'order_delivered', this.owners.clock.getTotalMinutes(), {
        orderId: order.id,
        parcelId,
        placeId: order.deliveryTarget.placeId,
        deliveryTargetSlotId: order.deliveryTarget.slotId,
      });
    } catch {}
    return true;
  }

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
  ): GroceryOrderResult {
    const { clock, economy, needs, delivery, telemetry } = this.owners;
    if (fulfillment !== 'pickup') {
      const placeId = this.readDeliveryPlace();
      if (!placeId) {
        return { success: false, error: 'No canonical delivery place is available.' };
      }
      const target = resolvePlaceDeliveryTarget(
        placeId, GENERATED_PLACE_SERVICE_POLICIES, PHYSICAL_RUNTIME_GRAPH,
      );
      if (!target.ok) {
        return {
          success: false,
          error: `Delivery is unavailable here (${target.reason}).`,
        };
      }
      return this.placeCanonicalDelivery(rawItems, fulfillment, nowMinute, {
        deliveryTarget: {
          placeId, slotId: target.slotId, anchorId: target.location.anchorId,
        },
      });
    }

    const items = (rawItems || [])
      .filter((item) => item && GROCERY_SKUS[item.sku] && Number.isFinite(item.qty) && item.qty >= 1)
      .map((item) => ({ sku: item.sku, qty: Math.min(9, Math.floor(item.qty)) }));
    if (items.length === 0) return { success: false, error: 'Cart is empty.' };

    const total = items.reduce((sum, item) => sum + GROCERY_SKUS[item.sku]!.price * item.qty, 0);
    if (!economy.canAfford(total)) {
      return { success: false, error: `Cannot afford $${total.toFixed(2)} order.` };
    }
    if (needs.getState().energy < 20) {
      return { success: false, error: 'Too tired for a store run (need 20% energy).' };
    }

    const order = delivery.recordPickup(items, total, clock.getTotalMinutes());
    const bagId = `shopping-bag:${order.id}`;
    this.material.materializeGroceryContainer(
      order,
      bagId,
      SHOPPING_BAG_DEFINITION_ID,
      { kind: 'container', containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID },
      'pickup-item',
    );
    economy.spendCash(total, 'CornerMart pickup');
    this.advanceGameMinutes(30, 'CornerMart pickup run');
    needs.consumeEnergy(5);
    telemetry.logEvent('economy', 'order_pickup', clock.getTotalMinutes(), {
      orderId: order.id, total, bagId,
    });
    return {
      success: true,
      data: {
        orderId: order.id,
        etaMinute: clock.getTotalMinutes(),
        summary: 'Picked up from CornerMart — shopping bag is being carried.',
      },
    };
  }
}
