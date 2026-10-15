import { bridgeOwnedInventoryIntoPhysicalWorld, PLAYER_INVENTORY_CONTAINER_ID } from '../PhysicalItemBridge';
import {
  PhysicalItemEngine,
  type ItemInstance,
  type PhysicalContainerDefinition,
  type PhysicalItemDefinition,
  type PhysicalItemLocation,
  type PhysicalWorldState,
} from '../PhysicalItemEngine';
import type { DeliveryOrder } from '../DeliveryEngine';
import { GROCERY_SKUS } from '../DeliveryEngine';
import {
  bridgePhysicalObjectContainers,
  clonePhysicalObjectRuntimeState,
  detachPhysicalObject as detachRuntimePhysicalObject,
  getReachableAffordances,
  hydratePhysicalObjectRuntimeState,
  movePhysicalObject as moveRuntimePhysicalObject,
  resolveContextRequirements,
  type ContextRequirement,
  type ContextRequirementResult,
  type PhysicalObjectRuntimeState,
  type PhysicalRuntimeGraph,
  type ReachableAffordance,
} from '../physical/PhysicalContextRuntime';
import { PHYSICAL_ITEM_CATALOG } from '../hardware/catalog';
import {
  GENERATED_CONTAINERS,
  GENERATED_ITEMS,
  GENERATED_OBJECT_PLACEMENTS,
  GENERATED_PHYSICAL_OBJECT_DEFS,
  GENERATED_PLACEMENT_SLOTS,
  GENERATED_PLACES,
} from '../worldContent.generated';
import type { PlayerInventoryState } from '../types';

export const DELIVERY_PARCEL_DEFINITION_ID = 'delivery_parcel';
export const SHOPPING_BAG_DEFINITION_ID = 'corner_mart_shopping_bag';
const CORNER_MART_ITEM_KIND = 'corner-mart-item';

export const PHYSICAL_RUNTIME_GRAPH: PhysicalRuntimeGraph = {
  objectDefs: GENERATED_PHYSICAL_OBJECT_DEFS,
  slots: GENERATED_PLACEMENT_SLOTS,
  placements: GENERATED_OBJECT_PLACEMENTS,
};

export function resolveGeneratedPlaceId(rawId: string): string | null {
  const direct = GENERATED_PLACES.find((place) => place.id === rawId);
  if (direct) return direct.id;
  return GENERATED_PLACES.find((place) => place.legacyIds?.includes(rawId))?.id ?? null;
}

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

export function clonePhysicalWorld(state: PhysicalWorldState): PhysicalWorldState {
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


/**
 * Canonical authority for item instances, containers and physical object
 * placements. Financial truth, inventory ownership and home tenancy remain in
 * their existing owners; this runtime only bridges them during hydration.
 * PhysicalShopEngine remains a transaction over this single item authority.
 */
export class MaterialWorldRuntime {
  private state: PhysicalWorldState;
  private objects: PhysicalObjectRuntimeState;

  constructor(
    private readonly readInventory: () => PlayerInventoryState,
    private readonly readOwnedHomeAnchor: () => string,
    initialWorld?: PhysicalWorldState,
    initialObjects?: PhysicalObjectRuntimeState,
  ) {
    this.objects = hydratePhysicalObjectRuntimeState(initialObjects, PHYSICAL_RUNTIME_GRAPH);
    this.state = this.hydratePhysicalWorld(initialWorld);
  }

  public loadState(world?: PhysicalWorldState, objects?: PhysicalObjectRuntimeState): void {
    this.objects = hydratePhysicalObjectRuntimeState(objects, PHYSICAL_RUNTIME_GRAPH);
    this.state = this.hydratePhysicalWorld(world);
  }

  public reanchorOwnedItems(): void {
    this.state = this.hydratePhysicalWorld(this.currentPhysicalWorld());
  }

  /** The return value is an isolated snapshot, not another writable state. */
  public commitWorld(next: PhysicalWorldState): void {
    this.state = clonePhysicalWorld(next);
  }

  private hydratePhysicalWorld(persisted?: PhysicalWorldState): PhysicalWorldState {
    const owned = bridgeOwnedInventoryIntoPhysicalWorld(
      persisted ? clonePhysicalWorld(persisted) : emptyPhysicalWorld(),
      this.readInventory(),
      this.readOwnedHomeAnchor(),
    );
    return bridgePhysicalObjectContainers(
      owned,
      this.objects,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }


  private currentPhysicalWorld(): PhysicalWorldState {
    return this.state ?? emptyPhysicalWorld();
  }

  public physicalItems(): PhysicalItemEngine {
    return new PhysicalItemEngine(
      this.currentPhysicalWorld(),
      PHYSICAL_ITEM_DEFINITIONS,
      PHYSICAL_CONTAINER_DEFINITIONS,
    );
  }


  public materializeGroceryContainer(
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
    this.state = physicalItems.getState();
  }


  public getPhysicalWorldState(): PhysicalWorldState {
    return clonePhysicalWorld(this.currentPhysicalWorld());
  }

  public getPhysicalObjectState(): PhysicalObjectRuntimeState {
    return clonePhysicalObjectRuntimeState(this.objects);
  }


  public getReachablePhysicalAffordances(spaceId: string): ReachableAffordance[] {
    return getReachableAffordances(
      spaceId,
      this.objects,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  public resolvePhysicalContextRequirements(
    spaceId: string,
    requirements: readonly ContextRequirement[],
  ): ContextRequirementResult {
    return resolveContextRequirements({
      spaceId,
      objectState: this.objects,
      graph: PHYSICAL_RUNTIME_GRAPH,
      physicalWorld: this.currentPhysicalWorld(),
      itemDefinitions: PHYSICAL_ITEM_DEFINITIONS,
      playerInventoryContainerId: PLAYER_INVENTORY_CONTAINER_ID,
      requirements,
    });
  }

  public movePhysicalObject(instanceId: string, targetSlotId: string): void {
    this.objects = moveRuntimePhysicalObject(
      this.objects,
      instanceId,
      targetSlotId,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  public detachPhysicalObject(instanceId: string): void {
    this.objects = detachRuntimePhysicalObject(
      this.objects,
      instanceId,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  public transferPhysicalItem(
    instanceId: string,
    destination: PhysicalItemLocation,
  ): ItemInstance {
    const physicalItems = this.physicalItems();
    const transferred = physicalItems.transfer(instanceId, destination);
    this.state = physicalItems.getState();
    return transferred;
  }

  public openPhysicalContainer(
    containerInstanceId: string,
    destinationContainerInstanceId: string = PLAYER_INVENTORY_CONTAINER_ID,
  ): ItemInstance[] {
    const physicalItems = this.physicalItems();
    const moved = physicalItems.unpackContainer(containerInstanceId, destinationContainerInstanceId);
    this.state = physicalItems.getState();
    return moved;
  }


}
