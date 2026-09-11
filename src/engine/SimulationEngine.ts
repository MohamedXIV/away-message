// Canonical simulation facade with the universal physical-world persistence seam.
//
// The established v6 PC/OS facade remains byte-for-byte in
// SimulationEngineLegacyFacade.ts. This thin layer owns #18's new persisted
// physical root so the material-world migration cannot rewrite unrelated
// gameplay coordination.

import {
  SimulationEngine as LegacySimulationEngine,
  type LiveSimulationState as LegacyLiveSimulationState,
} from './SimulationEngineLegacyFacade';
import {
  bridgeOwnedInventoryIntoPhysicalWorld,
  PLAYER_INVENTORY_CONTAINER_ID,
} from './PhysicalItemBridge';
import {
  PhysicalItemEngine,
  type ItemInstance,
  type PhysicalContainerDefinition,
  type PhysicalItemDefinition,
  type PhysicalItemLocation,
  type PhysicalWorldState,
} from './PhysicalItemEngine';
import { GROCERY_SKUS, type DeliveryOrder, type Fulfillment } from './DeliveryEngine';
import { PHYSICAL_ITEM_CATALOG } from './hardware/catalog';
import type { SimulationState as TransportSimulationState } from './types';
import { GENERATED_CONTAINERS, GENERATED_ITEMS } from './worldContent.generated';
import {
  InnerVoiceEngine,
  emptyInnerVoicePersistedState,
  type InnerVoicePersistedState,
  type InnerVoiceUiState,
  type InspectThoughtRequest,
  type ThoughtIntent,
  type ThoughtTrigger,
} from './innerVoice/index';

export * from './SimulationEngineLegacyFacade';

export type LiveSimulationState = LegacyLiveSimulationState & {
  physicalWorld: PhysicalWorldState;
};

type InitialSimulationState = Partial<TransportSimulationState> & {
  physicalWorld?: PhysicalWorldState;
};

const DELIVERY_PARCEL_DEFINITION_ID = 'delivery_parcel';
const SHOPPING_BAG_DEFINITION_ID = 'corner_mart_shopping_bag';
const DELIVERY_ANCHOR_ID = 'room104:delivery';
const CORNER_MART_ITEM_KIND = 'corner-mart-item';

function groceryDefinitionId(sku: string): string {
  return `corner-mart:${sku}`;
}

const PHYSICAL_ITEM_DEFINITIONS: Readonly<Record<string, PhysicalItemDefinition>> =
  Object.fromEntries([
    ...GENERATED_ITEMS.map((item) => [
      item.id,
      {
        id: item.id,
        kind: item.kind,
        portable: item.portable,
        volume: item.volume,
      } satisfies PhysicalItemDefinition,
    ] as const),
    ...Object.values(PHYSICAL_ITEM_CATALOG).map((item) => [
      item.id,
      {
        id: item.id,
        kind: item.kind,
        portable: true,
        volume: 1,
      } satisfies PhysicalItemDefinition,
    ] as const),
    [
      DELIVERY_PARCEL_DEFINITION_ID,
      {
        id: DELIVERY_PARCEL_DEFINITION_ID,
        kind: 'container',
        portable: true,
        volume: 1,
      } satisfies PhysicalItemDefinition,
    ] as const,
    [
      SHOPPING_BAG_DEFINITION_ID,
      {
        id: SHOPPING_BAG_DEFINITION_ID,
        kind: 'container',
        portable: true,
        volume: 1,
      } satisfies PhysicalItemDefinition,
    ] as const,
    ...Object.keys(GROCERY_SKUS).map((sku) => [
      groceryDefinitionId(sku),
      {
        id: groceryDefinitionId(sku),
        kind: CORNER_MART_ITEM_KIND,
        portable: true,
        volume: 1,
      } satisfies PhysicalItemDefinition,
    ] as const),
  ]);

const PHYSICAL_CONTAINER_DEFINITIONS: Readonly<Record<string, PhysicalContainerDefinition>> =
  Object.fromEntries([
    ...GENERATED_CONTAINERS.map((container) => [
      container.id,
      {
        id: container.id,
        capacity: container.capacity,
        allowedItemKinds: container.allowedItemKinds,
      } satisfies PhysicalContainerDefinition,
    ] as const),
    [
      'player_inventory',
      {
        id: 'player_inventory',
        capacity: Number.MAX_SAFE_INTEGER,
        allowedItemKinds: [],
      } satisfies PhysicalContainerDefinition,
    ] as const,
    [
      DELIVERY_PARCEL_DEFINITION_ID,
      {
        id: DELIVERY_PARCEL_DEFINITION_ID,
        capacity: 64,
        allowedItemKinds: [CORNER_MART_ITEM_KIND],
      } satisfies PhysicalContainerDefinition,
    ] as const,
    [
      SHOPPING_BAG_DEFINITION_ID,
      {
        id: SHOPPING_BAG_DEFINITION_ID,
        capacity: 64,
        allowedItemKinds: [CORNER_MART_ITEM_KIND],
      } satisfies PhysicalContainerDefinition,
    ] as const,
  ]);

function emptyPhysicalWorld(): PhysicalWorldState {
  return {
    items: {},
    containers: {
      [PLAYER_INVENTORY_CONTAINER_ID]: {
        instanceId: PLAYER_INVENTORY_CONTAINER_ID,
        definitionId: 'player_inventory',
      },
    },
  };
}

function clonePhysicalWorld(state: PhysicalWorldState): PhysicalWorldState {
  return {
    items: Object.fromEntries(
      Object.entries(state.items).map(([id, item]) => [
        id,
        { ...item, location: { ...item.location } },
      ]),
    ),
    containers: Object.fromEntries(
      Object.entries(state.containers).map(([id, container]) => [id, { ...container }]),
    ),
  };
}

export class SimulationEngine extends LegacySimulationEngine {
  private physicalWorldState: PhysicalWorldState | null = null;
  /** Player Inner Voice rules gate (#23). Owns cooldown/notable-history only. */
  private readonly innerVoice: InnerVoiceEngine;

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.physicalWorldState = this.hydratePhysicalWorld(initialState?.physicalWorld);
    this.innerVoice = new InnerVoiceEngine(
      (initialState as TransportSimulationState | undefined)?.innerVoice ?? null,
    );
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
  }

  private hydratePhysicalWorld(persisted?: PhysicalWorldState): PhysicalWorldState {
    return bridgeOwnedInventoryIntoPhysicalWorld(
      persisted ? clonePhysicalWorld(persisted) : emptyPhysicalWorld(),
      this.inventory.getState(),
    );
  }

  private currentPhysicalWorld(): PhysicalWorldState {
    // Defensive only for superclass construction: once our constructor returns,
    // physicalWorldState is always initialized through hydratePhysicalWorld().
    return this.physicalWorldState ?? emptyPhysicalWorld();
  }

  private physicalItems(): PhysicalItemEngine {
    return new PhysicalItemEngine(
      this.currentPhysicalWorld(),
      PHYSICAL_ITEM_DEFINITIONS,
      PHYSICAL_CONTAINER_DEFINITIONS,
    );
  }

  private materializeGroceryContainer(
    order: DeliveryOrder,
    containerId: string,
    containerDefinitionId: string,
    shellLocation: PhysicalItemLocation,
    itemIdPrefix: string,
  ): void {
    const physicalItems = this.physicalItems();
    const skuOrdinals = new Map<string, number>();
    const contents = order.items.flatMap((line) => {
      const start = skuOrdinals.get(line.sku) ?? 0;
      skuOrdinals.set(line.sku, start + line.qty);
      return Array.from({ length: line.qty }, (_, offset) => ({
        instanceId: `${itemIdPrefix}:${order.id}:${line.sku}:${start + offset}`,
        definitionId: groceryDefinitionId(line.sku),
        location: { kind: 'container' as const, containerInstanceId: containerId },
      }));
    });

    physicalItems.materializeBatch({
      containers: [{ instanceId: containerId, definitionId: containerDefinitionId }],
      items: [
        {
          instanceId: containerId,
          definitionId: containerDefinitionId,
          location: shellLocation,
        },
        ...contents,
      ],
    });
    this.physicalWorldState = physicalItems.getState();
  }

  private materializeDeliveryParcel(order: DeliveryOrder): boolean {
    const parcelId = `parcel:${order.id}`;
    this.materializeGroceryContainer(
      order,
      parcelId,
      DELIVERY_PARCEL_DEFINITION_ID,
      { kind: 'worldAnchor', anchorId: DELIVERY_ANCHOR_ID },
      'order-item',
    );

    // Keep the established arrival traces, but they now mean parcel arrival,
    // not pantry teleportation. These are best-effort after the physical commit.
    try { this.world.setFlag(`delivery_arrived_${order.id}`, true); } catch {}
    try {
      this.telemetry.logEvent('economy', 'order_delivered', this.clock.getTotalMinutes(), {
        orderId: order.id,
        parcelId,
      });
    } catch {}
    return true;
  }

  public override placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
  ) {
    if (fulfillment !== 'pickup') {
      return super.placeGroceryOrder(rawItems, fulfillment, nowMinute);
    }

    const items = (rawItems || [])
      .filter((item) => item && GROCERY_SKUS[item.sku] && Number.isFinite(item.qty) && item.qty >= 1)
      .map((item) => ({ sku: item.sku, qty: Math.min(9, Math.floor(item.qty)) }));
    if (items.length === 0) return { success: false, error: 'Cart is empty.' };

    const total = items.reduce((sum, item) => sum + GROCERY_SKUS[item.sku]!.price * item.qty, 0);
    if (!this.economy.canAfford(total)) {
      return { success: false, error: `Cannot afford $${total.toFixed(2)} order.` };
    }
    if (this.economy.getState().energy < 20) {
      return { success: false, error: 'Too tired for a store run (need 20% energy).' };
    }

    // The order ID is the stable purchase identity. All validation that can reject
    // checkout happens before cash, order history, or physical ownership changes.
    const order = this.delivery.recordPickup(items, total, this.clock.getTotalMinutes());
    const bagId = `shopping-bag:${order.id}`;
    this.materializeGroceryContainer(
      order,
      bagId,
      SHOPPING_BAG_DEFINITION_ID,
      { kind: 'container', containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID },
      'pickup-item',
    );

    this.economy.spendCash(total, 'CornerMart pickup');
    this.advanceGameMinutes(30, 'CornerMart pickup run');
    this.economy.consumeEnergy(5);
    this.telemetry.logEvent('economy', 'order_pickup', this.clock.getTotalMinutes(), {
      orderId: order.id,
      total,
      bagId,
    });

    return {
      success: true,
      data: {
        orderId: order.id,
        etaMinute: this.clock.getTotalMinutes(),
        summary: 'Picked up from CornerMart — shopping bag is being carried.',
      },
    };
  }

  public getPhysicalWorldState(): PhysicalWorldState {
    return clonePhysicalWorld(this.currentPhysicalWorld());
  }

  public transferPhysicalItem(
    instanceId: string,
    destination: PhysicalItemLocation,
  ): ItemInstance {
    const physicalItems = this.physicalItems();
    const transferred = physicalItems.transfer(instanceId, destination);
    this.physicalWorldState = physicalItems.getState();
    return transferred;
  }

  public openPhysicalContainer(
    containerInstanceId: string,
    destinationContainerInstanceId: string = PLAYER_INVENTORY_CONTAINER_ID,
  ): ItemInstance[] {
    const physicalItems = this.physicalItems();
    const moved = physicalItems.unpackContainer(containerInstanceId, destinationContainerInstanceId);
    this.physicalWorldState = physicalItems.getState();
    return moved;
  }

  public override getState(): Readonly<LiveSimulationState> {
    return {
      ...super.getState(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
      innerVoice: this.innerVoice.getPersistedState(),
    };
  }

  public override exportSnapshot(): LiveSimulationState {
    return {
      ...super.exportSnapshot(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
      innerVoice: this.innerVoice.getPersistedState(),
    };
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const persisted = (snapshot as TransportSimulationState & { physicalWorld?: PhysicalWorldState })
      .physicalWorld;
    super.loadSnapshot(snapshot);
    this.physicalWorldState = this.hydratePhysicalWorld(persisted);
    this.innerVoice.hydrate(snapshot.innerVoice ?? emptyInnerVoicePersistedState());
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
  }

  // ---- Player Inner Voice public API (#23) ----
  // Rule-governed thought requests. These never mutate gameplay state;
  // they only read the caller-provided knowledge view and advance the
  // voice's own cooldown/notable-history.

  public getInnerVoiceEngine(): InnerVoiceEngine {
    return this.innerVoice;
  }

  public getInnerVoiceState(): InnerVoicePersistedState {
    return this.innerVoice.getPersistedState();
  }

  public requestInnerThought(
    trigger: ThoughtTrigger,
    nowMinute?: number,
    ui?: InnerVoiceUiState,
  ): ThoughtIntent | null {
    return this.innerVoice.request(trigger, nowMinute ?? this.clock.getTotalMinutes(), ui);
  }

  public requestInspectThought(
    request: InspectThoughtRequest,
    nowMinute?: number,
  ): ThoughtIntent | null {
    return this.innerVoice.requestInspect(request, nowMinute ?? this.clock.getTotalMinutes());
  }

  public dismissInnerThought(): void {
    this.innerVoice.dismissActive();
  }
}
