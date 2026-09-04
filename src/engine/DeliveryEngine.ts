// src/engine/DeliveryEngine.ts
// P6 physical orders — groceries bought online arrive by courier (2–24h,
// deterministic per order) or by self pickup (30-min trip + energy).
// No AI, no randomness: ETAs are hashes, completion is checked on time advance.

export type Fulfillment = 'pickup' | 'delivery';

export interface GrocerySku {
  sku: string;
  label: string;
  price: number;
  pantry: 'noodles' | 'groceries';
  qty: number;
}

/** CornerMart catalog — the physical line (hardware stays instant-license). */
export const GROCERY_SKUS: Record<string, GrocerySku> = {
  noodles_cup: { sku: 'noodles_cup', label: 'Spicy Cup Noodles', price: 2, pantry: 'noodles', qty: 1 },
  noodle_6pack: { sku: 'noodle_6pack', label: 'Noodle 6-Pack', price: 10, pantry: 'noodles', qty: 6 },
  grocery_bag: { sku: 'grocery_bag', label: 'Grocery Bag (rice, beans, eggs)', price: 8, pantry: 'groceries', qty: 1 },
  grocery_feast: { sku: 'grocery_feast', label: 'Feast Box (party groceries)', price: 20, pantry: 'groceries', qty: 3 },
};

export interface OrderItem {
  sku: string;
  qty: number;
}

export interface DeliveryOrder {
  id: string;
  items: OrderItem[];
  total: number;
  fulfillment: Fulfillment;
  placedMinute: number;
  /** Minute the courier arrives (delivery) or the trip ends (pickup, completed inline). */
  readyMinute: number;
  status: 'transit' | 'done';
}

export interface DeliveryEngineState {
  orders: DeliveryOrder[];
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Courier ETA: 2h + up to 22h deterministic jitter (2–24h window). */
export function deliveryEtaMinutes(orderId: string): number {
  return 120 + (hashText(`courier:${orderId}`) % (22 * 60));
}

let orderCounter = 0;

export class DeliveryEngine {
  private orders: DeliveryOrder[] = [];

  constructor(initialState?: DeliveryEngineState) {
    if (initialState?.orders) {
      this.orders = initialState.orders
        .filter((o) => o && typeof o.id === 'string' && Array.isArray(o.items))
        .map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) }))
        .slice(-10);
    }
  }

  public getState(): DeliveryEngineState {
    return { orders: this.orders.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) })) };
  }

  /** Create a delivery order (pickup trips complete inline — use placePickup instead). */
  public placeDelivery(items: OrderItem[], total: number, nowMinute: number): DeliveryOrder {
    const id = `ord_${nowMinute.toString(36)}_${(orderCounter++).toString(36)}${hashText(items.map((i) => `${i.sku}x${i.qty}`).join(',')).toString(36)}`;
    const order: DeliveryOrder = {
      id,
      items: items.map((i) => ({ ...i })),
      total,
      fulfillment: 'delivery',
      placedMinute: nowMinute,
      readyMinute: nowMinute + deliveryEtaMinutes(id),
      status: 'transit',
    };
    this.orders.push(order);
    this.orders = this.orders.slice(-10);
    return { ...order };
  }

  /** Record an instantly-completed pickup trip (for the parcels history). */
  public recordPickup(items: OrderItem[], total: number, nowMinute: number): DeliveryOrder {
    const order: DeliveryOrder = {
      id: `pick_${nowMinute.toString(36)}_${(orderCounter++).toString(36)}`,
      items: items.map((i) => ({ ...i })),
      total,
      fulfillment: 'pickup',
      placedMinute: nowMinute,
      readyMinute: nowMinute,
      status: 'done',
    };
    this.orders.push(order);
    this.orders = this.orders.slice(-10);
    return { ...order };
  }

  /** Complete due courier orders. Returns completed ones for pantry crediting. */
  public completeDue(nowMinute: number): DeliveryOrder[] {
    const done: DeliveryOrder[] = [];
    for (const order of this.orders) {
      if (order.status === 'transit' && order.fulfillment === 'delivery' && nowMinute >= order.readyMinute) {
        order.status = 'done';
        done.push({ ...order, items: order.items.map((i) => ({ ...i })) });
      }
    }
    return done;
  }
}
