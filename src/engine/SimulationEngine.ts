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
import {
  advanceVenueActivities,
  cloneVenueRuntimeState,
  evaluateVenueService,
  hydrateVenueRuntimeState,
  resolveIntentToVenueActivity,
  setVenueRoleAssignment as setVenueRoleAssignmentState,
  startVenueActivity,
  type ResolveVenueActivityResult,
  type StartVenueActivityResult,
  type VenueActivityInstance,
  type VenueRoleAssignment,
  type VenueRuntimeState,
  type VenueServiceAvailability,
} from './venue/VenueOperations';
import { GENERATED_VENUE_DEFINITIONS } from './venue/GeneratedVenueDefinitions';
import type { SimulationState as TransportSimulationState } from './types';
import { ResidenceTenancy, type ResidenceState } from './ResidenceTenancy';
import {
  commitHousingOffer,
  resolveStarterHousingOffer,
} from './residence/HousingProgression';
import {
  GENERATED_CONTAINERS,
  GENERATED_HOUSING_OFFERS,
  GENERATED_ITEMS,
  GENERATED_OBJECT_PLACEMENTS,
  GENERATED_PHYSICAL_OBJECT_DEFS,
  GENERATED_PLACE_SERVICE_POLICIES,
  GENERATED_PLACEMENT_SLOTS,
  GENERATED_PLACES,
} from './worldContent.generated';
import {
  InnerVoiceEngine,
  emptyInnerVoicePersistedState,
  type InnerVoicePersistedState,
  type InnerVoiceUiState,
  type InspectThoughtRequest,
  type ThoughtIntent,
  type ThoughtTrigger,
} from './innerVoice/index';
import { type ScenarioRuntimeState } from './scenario/ScenarioState';
import {
  ScenarioDirector,
  type ScenarioHookOpportunity,
  type ScenarioObservation,
} from './scenario/ScenarioDirector';
import type { ScenarioDefinition, ScenarioInstance, ScenarioLifecycle } from './scenario/types';
import { projectScenarios, type ScenarioProjection } from './scenario/ScenarioProjection';
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

function fallbackResidenceState(): ResidenceState {
  const offer =
    GENERATED_HOUSING_OFFERS.find((candidate) => candidate.starterDefault)
    ?? GENERATED_HOUSING_OFFERS.find((candidate) => candidate.starterEligible && candidate.available)
    ?? GENERATED_HOUSING_OFFERS[0];
  if (!offer) throw new Error('Generated world has no authored housing offer for residence recovery.');
  return {
    currentResidencePlaceId: offer.placeId,
    tenancyId: `starter:${offer.id}`,
    moveInMinute: 0,
    currentRent: offer.monthlyRent,
  };
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
  private readonly residence: ResidenceTenancy;
  private physicalWorldState: PhysicalWorldState | null = null;
  private physicalObjectState: PhysicalObjectRuntimeState = { objects: {} };
  private physicalShopStates: Record<string, PhysicalShopState> = {};
  private venueState: VenueRuntimeState = { roleAssignments: {}, activities: {} };
  private activeTravelState: ActiveTravelState | null = null;
  private readonly scenarioDirector: ScenarioDirector;
  /** Player Inner Voice rules gate (#23). Owns cooldown/notable-history only. */
  private readonly innerVoice: InnerVoiceEngine;

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.residence = new ResidenceTenancy(initialState?.residence);
    if (!initialState?.residence) {
      const starterOffer = resolveStarterHousingOffer(
        GENERATED_HOUSING_OFFERS,
        this.economy.getCash(),
        initialState?.starterHousingOfferId,
      );
      const committed = commitHousingOffer({
        offer: starterOffer,
        residence: this.residence,
        tenancyId: `starter:${starterOffer.id}`,
        moveInMinute: this.clock.getTotalMinutes(),
        spendMoveInCost: (amount) => this.economy.spendCash(amount, 'Starter residence move-in'),
        setRecurringRentAmount: (amount) => this.economy.setRecurringRentAmount(amount),
      });
      if (!committed.ok) {
        throw new Error(`Could not commit starter residence '${starterOffer.id}': ${committed.reason}.`);
      }
    }
    this.physicalObjectState = hydratePhysicalObjectRuntimeState(
      initialState?.physicalObjects,
      PHYSICAL_RUNTIME_GRAPH,
    );
    this.venueState = hydrateVenueRuntimeState(
      initialState?.venueOperations,
      GENERATED_VENUE_DEFINITIONS,
    );
    this.physicalWorldState = this.hydratePhysicalWorld(initialState?.physicalWorld);
    this.physicalShopStates = clonePhysicalShopStates(initialState?.physicalShops ?? {});
    this.activeTravelState = initialState?.activeTravel ? cloneActiveTravel(initialState.activeTravel) : null;
    this.scenarioDirector = new ScenarioDirector(this.social, initialState?.scenarios);
    // Generated authored scenarios are selected only for a true new save. Loading a
    // persisted Scenario state must never silently add newly-authored definitions.
    if (initialState?.scenarios === undefined) {
      this.scenarioDirector.initialize(GENERATED_SCENARIOS, {
        seed: initialState?.scenarioSeed ?? 'default',
        atMinute: this.clock.getTotalMinutes(),
        maxInstances: 3,
      });
    }
    this.innerVoice = new InnerVoiceEngine(
      (initialState as TransportSimulationState | undefined)?.innerVoice ?? null,
    );
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
    this.events.on('time:tick', () => {
      this.synchronizeActiveTravel();
      this.synchronizeVenueActivities();
    });
    this.events.on('time:jump', () => {
      this.synchronizeActiveTravel();
      this.synchronizeVenueActivities();
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
    const state = this.residence.getState();
    if (!state) throw new Error('Simulation has no current residence tenancy.');
    return state;
  }

  public getCurrentResidencePlaceId(): string {
    return this.getResidenceState().currentResidencePlaceId;
  }

  public getHousingOffers(): Array<{
    id: string;
    placeId: string;
    placeName: string;
    available: boolean;
    monthlyRent: number;
    moveInCost: number;
    starterEligible: boolean;
    starterDefault: boolean;
    current: boolean;
    affordable: boolean;
  }> {
    const currentPlaceId = this.getCurrentResidencePlaceId();
    const cash = this.economy.getCash();
    return GENERATED_HOUSING_OFFERS
      .map((offer) => ({
        ...offer,
        placeName: GENERATED_PLACES.find((place) => place.id === offer.placeId)?.name ?? offer.placeId,
        current: offer.placeId === currentPlaceId,
        affordable: offer.moveInCost <= cash,
      }))
      .sort((a, b) => a.monthlyRent - b.monthlyRent || a.id.localeCompare(b.id));
  }

  public moveResidenceToOffer(offerId: string): { success: boolean; error?: string } {
    const offer = GENERATED_HOUSING_OFFERS.find((candidate) => candidate.id === offerId);
    if (!offer) return { success: false, error: `Unknown housing offer '${offerId}'.` };
    if (offer.placeId === this.getCurrentResidencePlaceId()) {
      return { success: false, error: 'That residence is already your current home.' };
    }

    const beforeCash = this.economy.getCash();
    const committed = commitHousingOffer({
      offer,
      residence: this.residence,
      tenancyId: `tenancy:${offer.id}:${this.clock.getTotalMinutes()}`,
      moveInMinute: this.clock.getTotalMinutes(),
      spendMoveInCost: (amount) => this.economy.spendCash(amount, 'Residence move-in'),
      setRecurringRentAmount: (amount) => this.economy.setRecurringRentAmount(amount),
    });
    if (!committed.ok) {
      const error = committed.reason === 'unaffordable'
        ? `Cannot afford the ${offer.moveInCost.toFixed(0)} move-in cost.`
        : committed.reason === 'unavailable'
          ? 'That residence is not currently available.'
          : 'That residence is already active.';
      return { success: false, error };
    }

    // Reproject player-owned inventory into the new home's authored anchor.
    // Property fixtures remain with their authored spaces.
    this.physicalWorldState = this.hydratePhysicalWorld(this.currentPhysicalWorld());

    try {
      this.telemetry.logEvent('world', 'residence_changed', this.clock.getTotalMinutes(), {
        offerId: offer.id,
        placeId: offer.placeId,
        moveInCost: beforeCash - this.economy.getCash(),
        monthlyRent: offer.monthlyRent,
      });
    } catch {}
    return { success: true };
  }

  private currentDeliveryPlaceId(): string | null {
    const spatialPlaceId = this.getActorSpatialProjection('player')?.membership.placeId;
    if (spatialPlaceId) return spatialPlaceId;
    const legacyLocation = this.economy.getLocation();
    if (legacyLocation === 'home') return this.residence.resolveHomePlaceId();
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

  private venueActorPlaceIds(extraActorIds: readonly string[] = []): Record<string, string | null> {
    const actorIds = new Set<string>(extraActorIds);
    for (const assignment of Object.values(this.venueState.roleAssignments)) {
      actorIds.add(assignment.actorId);
    }
    for (const activity of Object.values(this.venueState.activities)) {
      if (activity.status === 'active') actorIds.add(activity.actorId);
    }

    return Object.fromEntries(
      [...actorIds].sort().map((actorId) => [
        actorId,
        this.getActorSpatialProjection(actorId)?.membership.placeId ?? null,
      ]),
    );
  }

  private synchronizeVenueActivities(): void {
    const advanced = advanceVenueActivities(
      this.venueState,
      this.clock.getTotalMinutes(),
      GENERATED_VENUE_DEFINITIONS,
    );
    this.venueState = advanced.state;
    for (const command of advanced.completed) {
      this.events.emit('venue:activity_completed', command);
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
    return cloneVenueRuntimeState(this.venueState);
  }

  public setVenueRoleAssignment(assignment: VenueRoleAssignment): void {
    this.venueState = setVenueRoleAssignmentState(
      this.venueState,
      assignment,
      GENERATED_VENUE_DEFINITIONS,
    );
  }

  public getVenueServiceAvailability(serviceId: string): VenueServiceAvailability {
    const service = GENERATED_VENUE_DEFINITIONS.services.find(
      (candidate) => candidate.id === serviceId,
    );
    if (!service) return { available: false, blockers: ['unknown_service'] };

    return evaluateVenueService({
      serviceId,
      definitions: GENERATED_VENUE_DEFINITIONS,
      state: this.venueState,
      actorPlaceIds: this.venueActorPlaceIds(),
      contextResult: this.resolvePhysicalContextRequirements(
        service.spaceId,
        service.contextRequirements,
      ),
    });
  }

  public resolveVenueActivityIntent(intent: CharacterIntent): ResolveVenueActivityResult {
    return resolveIntentToVenueActivity({
      intent,
      actorPlaceId:
        this.getActorSpatialProjection(intent.actorId)?.membership.placeId ?? null,
      definitions: GENERATED_VENUE_DEFINITIONS,
      state: this.venueState,
      actorPlaceIds: this.venueActorPlaceIds([intent.actorId]),
      resolveContext: (spaceId, requirements) =>
        this.resolvePhysicalContextRequirements(spaceId, requirements),
    });
  }

  public startVenueActivityFromIntent(intent: CharacterIntent): StartVenueActivityResult {
    const resolved = this.resolveVenueActivityIntent(intent);
    if (!resolved.ok) return { ok: false, reason: resolved.reason };

    const started = startVenueActivity(
      this.venueState,
      resolved.proposal,
      GENERATED_VENUE_DEFINITIONS,
      this.clock.getTotalMinutes(),
    );
    if (started.ok) this.venueState = started.state;
    return started;
  }

  public startCurrentVenueActivity(actorId: string): StartVenueActivityResult {
    const intent = this.getCharacterIntent(actorId);
    if (!intent) return { ok: false, reason: 'no_character_intent' };
    return this.startVenueActivityFromIntent(intent);
  }

  public getActiveVenueActivity(actorId: string): VenueActivityInstance | null {
    const state = this.getVenueRuntimeState();
    return (
      Object.values(state.activities)
        .filter((activity) => activity.actorId === actorId && activity.status === 'active')
        .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null
    );
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
      scenarios: this.scenarioDirector.getState(),
      residence: this.getResidenceState(),
      innerVoice: this.innerVoice.getPersistedState(),
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
      scenarios: this.scenarioDirector.getState(),
      residence: this.getResidenceState(),
      innerVoice: this.innerVoice.getPersistedState(),
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
    this.residence.restore(persistedResidence ?? fallbackResidenceState());
    this.physicalObjectState = hydratePhysicalObjectRuntimeState(
      persistedPhysicalObjects,
      PHYSICAL_RUNTIME_GRAPH,
    );
    this.venueState = hydrateVenueRuntimeState(
      persistedVenueOperations,
      GENERATED_VENUE_DEFINITIONS,
    );
    this.physicalWorldState = this.hydratePhysicalWorld(persistedPhysicalWorld);
    this.physicalShopStates = clonePhysicalShopStates(persistedPhysicalShops ?? {});
    this.activeTravelState = persistedActiveTravel;
    this.scenarioDirector.hydrate(persistedScenarios);
    this.scenarioDirector.initialize(GENERATED_SCENARIOS, {
      seed: 'default',
      atMinute: this.clock.getTotalMinutes(),
      maxInstances: 3,
    });
    this.innerVoice.hydrate(snapshot.innerVoice ?? emptyInnerVoicePersistedState());
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
  }

  public getScenarioState(): ScenarioRuntimeState {
    return this.scenarioDirector.getState();
  }

  /** Test/tooling seam for authored definitions; production new saves use the generated registry. */
  public initializeScenarios(
    definitions: readonly ScenarioDefinition[],
    seed = 'default',
    maxInstances = 3,
  ): ScenarioInstance[] {
    return this.scenarioDirector.initialize(definitions, {
      seed,
      atMinute: this.clock.getTotalMinutes(),
      maxInstances,
    });
  }

  public getScenarioHookOpportunities(
    observation: ScenarioObservation,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): ScenarioHookOpportunity[] {
    return this.scenarioDirector.getAvailableHooks(definitions, observation);
  }

  public getScenarioProjection(
    observation: ScenarioObservation,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): ScenarioProjection[] {
    const opportunities = this.scenarioDirector.getAvailableHooks(definitions, observation);
    return projectScenarios(
      definitions,
      this.scenarioDirector.getState(),
      this.social,
      opportunities,
    );
  }

  public consumeScenarioHook(
    instanceId: string,
    hookId: string,
    definitions: readonly ScenarioDefinition[] = GENERATED_SCENARIOS,
  ): boolean {
    return this.scenarioDirector.consumeHook(definitions, instanceId, hookId);
  }

  public setScenarioLifecycle(instanceId: string, lifecycle: ScenarioLifecycle): boolean {
    return this.scenarioDirector.setLifecycle(instanceId, lifecycle);
  }

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