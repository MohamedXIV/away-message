// Canonical simulation facade with the universal physical-world persistence seam.
//
// The established v6 PC/OS facade remains byte-for-byte in
// SimulationEngineLegacyFacade.ts. This thin layer owns #18's new persisted
// physical root so the material-world migration cannot rewrite unrelated
// gameplay coordination.

import {
  SimulationEngine as LegacySimulationEngine,
  type EncounterCandidate,
  type EncounterDecision,
  type EncounterPlayerTransitRead,
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
import {
  PhysicalShopEngine,
  type PhysicalShopFixtureDefinition,
  type PhysicalShopState,
} from './PhysicalShopEngine';
import {
  checkoutPhysicalShop as commitPhysicalShopCheckout,
  type PhysicalShopCheckoutResult,
} from './PhysicalShopCheckout';
import {
  bridgePhysicalObjectContainers,
  clonePhysicalObjectRuntimeState,
  detachPhysicalObject as detachRuntimePhysicalObject,
  getReachableAffordances,
  hydratePhysicalObjectRuntimeState,
  movePhysicalObject as moveRuntimePhysicalObject,
  resolveContextRequirements,
  resolvePlaceDeliveryTarget,
  type ContextRequirement,
  type ContextRequirementResult,
  type PhysicalObjectRuntimeState,
  type PhysicalRuntimeGraph,
  type ReachableAffordance,
} from './physical/PhysicalContextRuntime';
import { PHYSICAL_ITEM_CATALOG } from './hardware/catalog';
import {
  commitTravelPlan as createActiveTravel,
  activeTravelLegWindows,
  parseActiveTravel,
  travelStateAtMinute,
} from './transit/ActiveTravel';
import type { ActiveTravelState, TravelPlan } from './transit/types';
import type { CharacterIntent } from './life/types';
import type {
  ResolveVenueActivityResult,
  StartVenueActivityResult,
  VenueActivityInstance,
  VenueRoleAssignment,
  VenueRuntimeState,
  VenueServiceAvailability,
} from './venue/VenueOperations';
import { VenueOperationsRuntime } from './kernel/VenueOperationsRuntime';
import type { SimulationState as TransportSimulationState } from './types';
import type { ResidenceState } from './ResidenceTenancy';
import { ResidenceCoordination } from './kernel/ResidenceCoordination';

import {
  GENERATED_CONTAINERS,
  GENERATED_ITEMS,
  GENERATED_OBJECT_PLACEMENTS,
  GENERATED_PHYSICAL_OBJECT_DEFS,
  GENERATED_PLACE_SERVICE_POLICIES,
  GENERATED_PLACEMENT_SLOTS,
  GENERATED_PLACES,
} from './worldContent.generated';
import {
  InnerVoiceEngine,
  type InnerVoicePersistedState,
  type InnerVoiceUiState,
  type InspectThoughtRequest,
  type ThoughtIntent,
  type ThoughtTrigger,
} from './innerVoice/index';
import { type ScenarioRuntimeState } from './scenario/ScenarioState';
import { StoryExperienceRuntime } from './kernel/StoryExperienceRuntime';
import type {
  ScenarioHookOpportunity,
  ScenarioObservation,
} from './scenario/ScenarioDirector';
import type { ScenarioDefinition, ScenarioInstance, ScenarioLifecycle } from './scenario/types';
import type { ScenarioProjection } from './scenario/ScenarioProjection';
import { GENERATED_SCENARIOS } from './scenarioContent.generated';

export * from './SimulationEngineLegacyFacade';

export type LiveSimulationState = LegacyLiveSimulationState & {
  physicalWorld: PhysicalWorldState;
  physicalObjects: PhysicalObjectRuntimeState;
  physicalShops: Record<string, PhysicalShopState>;
  venueOperations: VenueRuntimeState;
  activeTravel: ActiveTravelState | null;
  scenarios: ScenarioRuntimeState;
};

type InitialSimulationState = Partial<TransportSimulationState> & {
  physicalWorld?: PhysicalWorldState;
  physicalObjects?: PhysicalObjectRuntimeState;
  physicalShops?: Record<string, PhysicalShopState>;
  activeTravel?: ActiveTravelState | null;
  starterHousingOfferId?: string;
  /** Optional deterministic new-save Scenario selection seed. Persisted bindings prevent rerolls. */
  scenarioSeed?: string;
};

const DELIVERY_PARCEL_DEFINITION_ID = 'delivery_parcel';
const SHOPPING_BAG_DEFINITION_ID = 'corner_mart_shopping_bag';
const CORNER_MART_ITEM_KIND = 'corner-mart-item';

const PHYSICAL_RUNTIME_GRAPH: PhysicalRuntimeGraph = {
  objectDefs: GENERATED_PHYSICAL_OBJECT_DEFS,
  slots: GENERATED_PLACEMENT_SLOTS,
  placements: GENERATED_OBJECT_PLACEMENTS,
};

function resolveGeneratedPlaceId(rawId: string): string | null {
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

function clonePhysicalShopStates(
  states: Readonly<Record<string, PhysicalShopState>>,
): Record<string, PhysicalShopState> {
  return Object.fromEntries(
    Object.entries(states).map(([storeId, state]) => [
      storeId,
      {
        stockBySlot: { ...state.stockBySlot },
        ownershipByItemId: { ...state.ownershipByItemId },
        originalSlotByItemId: { ...state.originalSlotByItemId },
      },
    ]),
  );
}

function cloneActiveTravel(state: ActiveTravelState): ActiveTravelState {
  return parseActiveTravel(structuredClone(state));
}

export class SimulationEngine extends LegacySimulationEngine {
  private readonly residenceCoordination: ResidenceCoordination;
  private physicalWorldState: PhysicalWorldState | null = null;
  private physicalObjectState: PhysicalObjectRuntimeState = { objects: {} };
  private physicalShopStates: Record<string, PhysicalShopState> = {};
  private readonly venueRuntime: VenueOperationsRuntime;
  private activeTravelState: ActiveTravelState | null = null;
  /** Single composed owner for authored Scenario instances and presentation-only Inner Voice. */
  private readonly story: StoryExperienceRuntime;

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.residenceCoordination = new ResidenceCoordination(
      { economy: this.economy, clock: this.clock, telemetry: this.telemetry },
      () => {
        this.physicalWorldState = this.hydratePhysicalWorld(this.currentPhysicalWorld());
      },
      initialState?.residence,
      initialState?.starterHousingOfferId,
    );
    this.physicalObjectState = hydratePhysicalObjectRuntimeState(
      initialState?.physicalObjects,
      PHYSICAL_RUNTIME_GRAPH,
    );
    this.venueRuntime = new VenueOperationsRuntime(
      { clock: this.clock, events: this.events },
      (actorId) => this.getActorSpatialProjection(actorId)?.membership.placeId ?? null,
      (spaceId, requirements) => this.resolvePhysicalContextRequirements(spaceId, requirements),
      (actorId) => this.getCharacterIntent(actorId),
      initialState?.venueOperations,
    );
    this.physicalWorldState = this.hydratePhysicalWorld(initialState?.physicalWorld);
    this.physicalShopStates = clonePhysicalShopStates(initialState?.physicalShops ?? {});
    this.activeTravelState = initialState?.activeTravel ? cloneActiveTravel(initialState.activeTravel) : null;
    this.story = new StoryExperienceRuntime(
      { clock: this.clock, social: this.social },
      initialState?.scenarios,
      initialState?.scenarioSeed ?? 'default',
      (initialState as TransportSimulationState | undefined)?.innerVoice ?? null,
    );
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
    this.events.on('time:tick', () => {
      this.synchronizeActiveTravel();
      this.venueRuntime.synchronizeVenueActivities();
    });
    this.events.on('time:jump', () => {
      this.synchronizeActiveTravel();
      this.venueRuntime.synchronizeVenueActivities();
    });
  }

  private currentResidenceOwnedItemAnchorId(): string {
    const target = resolvePlaceDeliveryTarget(
      this.getCurrentResidencePlaceId(),
      GENERATED_PLACE_SERVICE_POLICIES,
      PHYSICAL_RUNTIME_GRAPH,
    );
    if (!target.ok) {
      throw new Error(
        `Current residence '${this.getCurrentResidencePlaceId()}' has no authored owned-item/delivery anchor (${target.reason}).`,
      );
    }
    return target.location.anchorId;
  }

  private hydratePhysicalWorld(persisted?: PhysicalWorldState): PhysicalWorldState {
    const owned = bridgeOwnedInventoryIntoPhysicalWorld(
      persisted ? clonePhysicalWorld(persisted) : emptyPhysicalWorld(),
      this.inventory.getState(),
      this.currentResidenceOwnedItemAnchorId(),
    );
    return bridgePhysicalObjectContainers(
      owned,
      this.physicalObjectState,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  public getResidenceState(): ResidenceState {
    return this.residenceCoordination.getResidenceState();
  }

  public getCurrentResidencePlaceId(): string {
    return this.residenceCoordination.getCurrentResidencePlaceId();
  }

  public getHousingOffers(): ReturnType<ResidenceCoordination['getHousingOffers']> {
    return this.residenceCoordination.getHousingOffers();
  }

  public moveResidenceToOffer(offerId: string): { success: boolean; error?: string } {
    return this.residenceCoordination.moveResidenceToOffer(offerId);
  }

  private currentDeliveryPlaceId(): string | null {
    const spatialPlaceId = this.getActorSpatialProjection('player')?.membership.placeId;
    if (spatialPlaceId) return spatialPlaceId;
    const legacyLocation = this.economy.getLocation();
    if (legacyLocation === 'home') return this.residenceCoordination.resolveHomePlaceId();
    return resolveGeneratedPlaceId(legacyLocation);
  }

  private currentPhysicalWorld(): PhysicalWorldState {
    return this.physicalWorldState ?? emptyPhysicalWorld();
  }

  private physicalItems(): PhysicalItemEngine {
    return new PhysicalItemEngine(
      this.currentPhysicalWorld(),
      PHYSICAL_ITEM_DEFINITIONS,
      PHYSICAL_CONTAINER_DEFINITIONS,
    );
  }

  private openPhysicalShop(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): { shop: PhysicalShopEngine; physicalItems: PhysicalItemEngine } {
    const physicalItems = this.physicalItems();
    const shop = new PhysicalShopEngine({
      storeId,
      worldSeed,
      physicalItems,
      fixtures,
      persistedState: this.physicalShopStates[storeId],
    });
    this.commitPhysicalShopSession(storeId, shop, physicalItems);
    return { shop, physicalItems };
  }

  private commitPhysicalShopSession(
    storeId: string,
    shop: PhysicalShopEngine,
    physicalItems: PhysicalItemEngine,
  ): void {
    this.physicalWorldState = physicalItems.getState();
    this.physicalShopStates = {
      ...this.physicalShopStates,
      [storeId]: shop.getState(),
    };
  }

  public getPhysicalShopState(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): PhysicalShopState {
    return this.openPhysicalShop(storeId, worldSeed, fixtures).shop.getState();
  }

  public getPhysicalShopCashierCapabilities(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): { talk: true; checkout: boolean } {
    return this.openPhysicalShop(storeId, worldSeed, fixtures).shop.getCashierCapabilities();
  }

  public takePhysicalShopItem(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    instanceId: string,
    destinationContainerInstanceId: string = PLAYER_INVENTORY_CONTAINER_ID,
  ): ItemInstance {
    const { shop, physicalItems } = this.openPhysicalShop(storeId, worldSeed, fixtures);
    shop.take(instanceId, destinationContainerInstanceId);
    this.commitPhysicalShopSession(storeId, shop, physicalItems);
    return physicalItems.getItem(instanceId);
  }

  public returnPhysicalShopItem(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    instanceId: string,
  ): ItemInstance {
    const { shop, physicalItems } = this.openPhysicalShop(storeId, worldSeed, fixtures);
    shop.returnToStock(instanceId);
    this.commitPhysicalShopSession(storeId, shop, physicalItems);
    return physicalItems.getItem(instanceId);
  }

  public checkoutPhysicalShop(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    pricesByDefinitionId: Readonly<Record<string, number>>,
  ): PhysicalShopCheckoutResult {
    const { shop, physicalItems } = this.openPhysicalShop(storeId, worldSeed, fixtures);
    const result = commitPhysicalShopCheckout(this, shop, pricesByDefinitionId);
    this.commitPhysicalShopSession(storeId, shop, physicalItems);
    return result;
  }

  private synchronizeActiveTravel(): void {
    const current = this.activeTravelState;
    if (!current || current.status !== 'active') return;

    const resolved = travelStateAtMinute(current, this.clock.getTotalMinutes());
    if (
      resolved.status === current.status &&
      resolved.currentLegIndex === current.currentLegIndex
    ) {
      return;
    }

    const arrivedNow = resolved.status === 'arrived';
    this.activeTravelState = {
      ...current,
      ...resolved,
    };

    if (arrivedNow) {
      this.relocateActorToGeneratedPlaceEntry(current.actorId, current.plan.destinationPlaceId);
      try {
        this.telemetry.logEvent('world', 'travel_arrived', this.clock.getTotalMinutes(), {
          actorId: current.actorId,
          destinationPlaceId: current.plan.destinationPlaceId,
          purposeRef: current.purposeRef ?? null,
        });
      } catch {}
    }
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
    if (!order.deliveryTarget) {
      throw new Error(`Delivery order ${order.id} has no explicit authored target.`);
    }

    const parcelId = `parcel:${order.id}`;
    this.materializeGroceryContainer(
      order,
      parcelId,
      DELIVERY_PARCEL_DEFINITION_ID,
      { kind: 'worldAnchor', anchorId: order.deliveryTarget.anchorId },
      'order-item',
    );

    try { this.world.setFlag(`delivery_arrived_${order.id}`, true); } catch {}
    try {
      this.telemetry.logEvent('economy', 'order_delivered', this.clock.getTotalMinutes(), {
        orderId: order.id,
        parcelId,
        placeId: order.deliveryTarget.placeId,
        deliveryTargetSlotId: order.deliveryTarget.slotId,
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
      const placeId = this.currentDeliveryPlaceId();
      if (!placeId) {
        return { success: false, error: 'No canonical delivery place is available.' };
      }

      const target = resolvePlaceDeliveryTarget(
        placeId,
        GENERATED_PLACE_SERVICE_POLICIES,
        PHYSICAL_RUNTIME_GRAPH,
      );
      if (!target.ok) {
        return {
          success: false,
          error: `Delivery is unavailable here (${target.reason}).`,
        };
      }

      return super.placeGroceryOrder(rawItems, fulfillment, nowMinute, {
        deliveryTarget: {
          placeId,
          slotId: target.slotId,
          anchorId: target.location.anchorId,
        },
      });
    }

    const items = (rawItems || [])
      .filter((item) => item && GROCERY_SKUS[item.sku] && Number.isFinite(item.qty) && item.qty >= 1)
      .map((item) => ({ sku: item.sku, qty: Math.min(9, Math.floor(item.qty)) }));
    if (items.length === 0) return { success: false, error: 'Cart is empty.' };

    const total = items.reduce((sum, item) => sum + GROCERY_SKUS[item.sku]!.price * item.qty, 0);
    if (!this.economy.canAfford(total)) {
      return { success: false, error: `Cannot afford $${total.toFixed(2)} order.` };
    }
    if (this.needs.getState().energy < 20) {
      return { success: false, error: 'Too tired for a store run (need 20% energy).' };
    }

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
    this.needs.consumeEnergy(5);
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

  public getPhysicalObjectState(): PhysicalObjectRuntimeState {
    return clonePhysicalObjectRuntimeState(this.physicalObjectState);
  }

  public getVenueRuntimeState(): VenueRuntimeState {
    return this.venueRuntime.getVenueRuntimeState();
  }

  public setVenueRoleAssignment(assignment: VenueRoleAssignment): void {
    this.venueRuntime.setVenueRoleAssignment(assignment);
  }

  public getVenueServiceAvailability(serviceId: string): VenueServiceAvailability {
    return this.venueRuntime.getVenueServiceAvailability(serviceId);
  }

  public resolveVenueActivityIntent(intent: CharacterIntent): ResolveVenueActivityResult {
    return this.venueRuntime.resolveVenueActivityIntent(intent);
  }

  public startVenueActivityFromIntent(intent: CharacterIntent): StartVenueActivityResult {
    return this.venueRuntime.startVenueActivityFromIntent(intent);
  }

  public startCurrentVenueActivity(actorId: string): StartVenueActivityResult {
    return this.venueRuntime.startCurrentVenueActivity(actorId);
  }

  public getActiveVenueActivity(actorId: string): VenueActivityInstance | null {
    return this.venueRuntime.getActiveVenueActivity(actorId);
  }

  public getReachablePhysicalAffordances(spaceId: string): ReachableAffordance[] {
    return getReachableAffordances(
      spaceId,
      this.physicalObjectState,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  public resolvePhysicalContextRequirements(
    spaceId: string,
    requirements: readonly ContextRequirement[],
  ): ContextRequirementResult {
    return resolveContextRequirements({
      spaceId,
      objectState: this.physicalObjectState,
      graph: PHYSICAL_RUNTIME_GRAPH,
      physicalWorld: this.currentPhysicalWorld(),
      itemDefinitions: PHYSICAL_ITEM_DEFINITIONS,
      playerInventoryContainerId: PLAYER_INVENTORY_CONTAINER_ID,
      requirements,
    });
  }

  public movePhysicalObject(instanceId: string, targetSlotId: string): void {
    this.physicalObjectState = moveRuntimePhysicalObject(
      this.physicalObjectState,
      instanceId,
      targetSlotId,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  public detachPhysicalObject(instanceId: string): void {
    this.physicalObjectState = detachRuntimePhysicalObject(
      this.physicalObjectState,
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

  public setActiveTravel(state: ActiveTravelState | null): void {
    this.activeTravelState = state ? cloneActiveTravel(state) : null;
  }

  public getActiveTravel(): ActiveTravelState | null {
    return this.activeTravelState ? cloneActiveTravel(this.activeTravelState) : null;
  }

  /**
   * Live player wait/ride leg for #47 transit overlap, derived from the
   * player's own committed journey. Walk legs and settled/arrived travel
   * yield null (no transit candidacy). Pure read.
   */
  private currentPlayerTransit(): EncounterPlayerTransitRead | null {
    const travel = this.getActiveTravel();
    if (!travel || travel.status !== 'active') return null;
    const resolved = travelStateAtMinute(travel, this.clock.getTotalMinutes());
    if (resolved.status !== 'active') return null;
    const window = activeTravelLegWindows(travel)[resolved.currentLegIndex];
    const leg = travel.plan.legs[resolved.currentLegIndex];
    if (!window || !leg || leg.kind === 'walk') return null;
    if (leg.kind === 'wait') {
      return { kind: 'wait', stopId: leg.stopId, windowStart: window.startMinute, windowEnd: window.endMinute };
    }
    return {
      kind: 'bus',
      lineId: leg.lineId,
      fromStopId: leg.fromStopId,
      toStopId: leg.toStopId,
      boardMinute: window.startMinute,
      windowStart: window.startMinute,
      windowEnd: window.endMinute,
    };
  }

  public override collectEncounterCandidates(): EncounterCandidate[] {
    return super.collectEncounterCandidates(this.currentPlayerTransit());
  }

  public override decideEncounter(): EncounterDecision {
    return super.decideEncounter(this.currentPlayerTransit());
  }

  public startTravel(
    actorId: string,
    plan: TravelPlan,
    purposeRef?: string,
  ): { success: boolean; data?: ActiveTravelState; error?: string } {
    if (this.activeTravelState?.status === 'active') {
      return { success: false, error: 'An active journey is already in progress.' };
    }
    if (!Number.isFinite(plan.fare) || plan.fare < 0) {
      return { success: false, error: 'Travel fare is invalid.' };
    }
    if (actorId === 'player' && !this.economy.canAfford(plan.fare)) {
      return { success: false, error: `Cannot afford $${plan.fare.toFixed(2)} travel fare.` };
    }

    const committed = createActiveTravel(
      actorId,
      plan,
      this.clock.getTotalMinutes(),
      purposeRef,
    );

    this.activeTravelState = committed;
    if (actorId === 'player') {
      const fareResult = this.dispatchAction({
        type: 'PLAYER_SPEND_CASH',
        amount: plan.fare,
        reason: 'Transit fare',
      });
      if (!fareResult.success) {
        this.activeTravelState = null;
        return { success: false, error: fareResult.error ?? `Cannot afford $${plan.fare.toFixed(2)} travel fare.` };
      }
    }

    this.clearActorSpatialForTravel(actorId);

    try {
      this.telemetry.logEvent('world', 'travel_departed', this.clock.getTotalMinutes(), {
        actorId,
        originPlaceId: plan.originPlaceId,
        destinationPlaceId: plan.destinationPlaceId,
        fare: plan.fare,
        purposeRef: purposeRef ?? null,
      });
    } catch {}

    return { success: true, data: cloneActiveTravel(committed) };
  }

  public override getState(): Readonly<LiveSimulationState> {
    return {
      ...super.getState(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
      physicalObjects: this.getPhysicalObjectState(),
      physicalShops: clonePhysicalShopStates(this.physicalShopStates),
      venueOperations: this.getVenueRuntimeState(),
      activeTravel: this.getActiveTravel(),
      scenarios: this.story.getScenarioState(),
      residence: this.getResidenceState(),
      innerVoice: this.story.getInnerVoiceState(),
    };
  }

  public override exportSnapshot(): LiveSimulationState {
    return {
      ...super.exportSnapshot(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
      physicalObjects: this.getPhysicalObjectState(),
      physicalShops: clonePhysicalShopStates(this.physicalShopStates),
      venueOperations: this.getVenueRuntimeState(),
      activeTravel: this.getActiveTravel(),
      scenarios: this.story.getScenarioState(),
      residence: this.getResidenceState(),
      innerVoice: this.story.getInnerVoiceState(),
    };
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const extendedSnapshot = snapshot as TransportSimulationState & {
      physicalWorld?: PhysicalWorldState;
      physicalObjects?: unknown;
      physicalShops?: Record<string, PhysicalShopState>;
      venueOperations?: unknown;
      activeTravel?: unknown;
      residence?: ResidenceState;
      scenarios?: ScenarioRuntimeState;
    };
    const persistedPhysicalWorld = extendedSnapshot.physicalWorld;
    const persistedPhysicalObjects = extendedSnapshot.physicalObjects;
    const persistedPhysicalShops = extendedSnapshot.physicalShops;
    const persistedVenueOperations = extendedSnapshot.venueOperations;
    const persistedActiveTravel = extendedSnapshot.activeTravel == null
      ? null
      : parseActiveTravel(extendedSnapshot.activeTravel);
    const persistedResidence = extendedSnapshot.residence;
    const persistedScenarios = extendedSnapshot.scenarios;

    super.loadSnapshot(snapshot);
    this.residenceCoordination.loadState(persistedResidence);
    this.physicalObjectState = hydratePhysicalObjectRuntimeState(
      persistedPhysicalObjects,
      PHYSICAL_RUNTIME_GRAPH,
    );
    this.venueRuntime.loadState(persistedVenueOperations as VenueRuntimeState);
    this.physicalWorldState = this.hydratePhysicalWorld(persistedPhysicalWorld);
    this.physicalShopStates = clonePhysicalShopStates(persistedPhysicalShops ?? {});
    this.activeTravelState = persistedActiveTravel;
    // Hydrate only the persisted authored bindings and presentation history.
    this.story.loadState(persistedScenarios, snapshot.innerVoice);
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
  }

  public getScenarioState(): ScenarioRuntimeState {
    return this.story.getScenarioState();
  }

  public initializeScenarios(
    definitions: readonly ScenarioDefinition[],
    seed = 'default',
    maxInstances = 3,
  ): ScenarioInstance[] {
    return this.story.initializeScenarios(definitions, seed, maxInstances);
  }

  public getScenarioHookOpportunities(
    observation: ScenarioObservation,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): ScenarioHookOpportunity[] {
    return this.story.getScenarioHookOpportunities(observation, definitions);
  }

  public getScenarioProjection(
    observation: ScenarioObservation,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): ScenarioProjection[] {
    return this.story.getScenarioProjection(observation, definitions);
  }

  public consumeScenarioHook(
    instanceId: string,
    hookId: string,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): boolean {
    return this.story.consumeScenarioHook(instanceId, hookId, definitions);
  }

  public setScenarioLifecycle(instanceId: string, lifecycle: ScenarioLifecycle): boolean {
    return this.story.setScenarioLifecycle(instanceId, lifecycle);
  }

  public getInnerVoiceEngine(): InnerVoiceEngine {
    return this.story.getInnerVoiceEngine();
  }

  public getInnerVoiceState(): InnerVoicePersistedState {
    return this.story.getInnerVoiceState();
  }

  public requestInnerThought(
    trigger: ThoughtTrigger,
    nowMinute?: number,
    ui?: InnerVoiceUiState,
  ): ThoughtIntent | null {
    return this.story.requestInnerThought(trigger, nowMinute, ui);
  }

  public requestInspectThought(
    request: InspectThoughtRequest,
    nowMinute?: number,
  ): ThoughtIntent | null {
    return this.story.requestInspectThought(request, nowMinute);
  }

  public dismissInnerThought(): void {
    this.story.dismissInnerThought();
  }

}