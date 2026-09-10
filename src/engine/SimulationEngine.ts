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
import { GROCERY_SKUS, type DeliveryOrder } from './DeliveryEngine';
import { PHYSICAL_ITEM_CATALOG } from './hardware/catalog';
import type { SimulationState as TransportSimulationState } from './types';
import { GENERATED_CONTAINERS, GENERATED_ITEMS } from './worldContent.generated';

export * from './SimulationEngineLegacyFacade';

export type LiveSimulationState = LegacyLiveSimulationState & {
  physicalWorld: PhysicalWorldState;
};

type InitialSimulationState = Partial<TransportSimulationState> & {
  physicalWorld?: PhysicalWorldState;
};

const DELIVERY_PARCEL_DEFINITION_ID = 'delivery_parcel';
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

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.physicalWorldState = this.hydratePhysicalWorld(initialState?.physicalWorld);
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

  private materializeDeliveryParcel(order: DeliveryOrder): boolean {
    const physicalItems = this.physicalItems();
    const parcelId = `parcel:${order.id}`;
    const skuOrdinals = new Map<string, number>();
    const contents = order.items.flatMap((line) => {
      const start = skuOrdinals.get(line.sku) ?? 0;
      skuOrdinals.set(line.sku, start + line.qty);
      return Array.from({ length: line.qty }, (_, offset) => ({
        instanceId: `order-item:${order.id}:${line.sku}:${start + offset}`,
        definitionId: groceryDefinitionId(line.sku),
        location: { kind: 'container' as const, containerInstanceId: parcelId },
      }));
    });

    physicalItems.materializeBatch({
      containers: [{ instanceId: parcelId, definitionId: DELIVERY_PARCEL_DEFINITION_ID }],
      items: [
        {
          instanceId: parcelId,
          definitionId: DELIVERY_PARCEL_DEFINITION_ID,
          location: { kind: 'worldAnchor', anchorId: DELIVERY_ANCHOR_ID },
        },
        ...contents,
      ],
    });
    this.physicalWorldState = physicalItems.getState();

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

  public override getState(): Readonly<LiveSimulationState> {
    return {
      ...super.getState(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
    };
  }

  public override exportSnapshot(): LiveSimulationState {
    return {
      ...super.exportSnapshot(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
    };
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const persisted = (snapshot as TransportSimulationState & { physicalWorld?: PhysicalWorldState })
      .physicalWorld;
    super.loadSnapshot(snapshot);
    this.physicalWorldState = this.hydratePhysicalWorld(persisted);
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
  }
}
