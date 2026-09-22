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
  physicalObjects: PhysicalObjectRuntimeState;
  venueOperations: VenueRuntimeState;
  activeTravel: ActiveTravelState | null;
};

type InitialSimulationState = Partial<TransportSimulationState> & {
  physicalWorld?: PhysicalWorldState;
  physicalObjects?: PhysicalObjectRuntimeState;
  activeTravel?: ActiveTravelState | null;
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

function cloneActiveTravel(state: ActiveTravelState): ActiveTravelState {
  return parseActiveTravel(structuredClone(state));
}

export class SimulationEngine extends LegacySimulationEngine {
  private physicalWorldState: PhysicalWorldState | null = null;
  private physicalObjectState: PhysicalObjectRuntimeState = { objects: {} };
  private venueState: VenueRuntimeState = { roleAssignments: {}, activities: {} };
  private activeTravelState: ActiveTravelState | null = null;
  /** Player Inner Voice rules gate (#23). Owns cooldown/notable-history only. */
  private readonly innerVoice: InnerVoiceEngine;

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.physicalObjectState = hydratePhysicalObjectRuntimeState(
      initialState?.physicalObjects,
      PHYSICAL_RUNTIME_GRAPH,
    );
    this.venueState = hydrateVenueRuntimeState(
      initialState?.venueOperations,
      GENERATED_VENUE_DEFINITIONS,
    );
    this.physicalWorldState = this.hydratePhysicalWorld(initialState?.physicalWorld);
    this.activeTravelState = initialState?.activeTravel ? cloneActiveTravel(initialState.activeTravel) : null;
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

  private hydratePhysicalWorld(persisted?: PhysicalWorldState): PhysicalWorldState {
    const owned = bridgeOwnedInventoryIntoPhysicalWorld(
      persisted ? clonePhysicalWorld(persisted) : emptyPhysicalWorld(),
      this.inventory.getState(),
    );
    return bridgePhysicalObjectContainers(
      owned,
      this.physicalObjectState,
      PHYSICAL_RUNTIME_GRAPH,
    );
  }

  private currentDeliveryPlaceId(): string | null {
    const spatialPlaceId = this.getActorSpatialProjection('player')?.membership.placeId;
    if (spatialPlaceId) return spatialPlaceId;
    return resolveGeneratedPlaceId(this.economy.getLocation());
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
    if (this.economy.getState().energy < 20) {
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
      venueOperations: this.getVenueRuntimeState(),
      activeTravel: this.getActiveTravel(),
      innerVoice: this.innerVoice.getPersistedState(),
    };
  }

  public override exportSnapshot(): LiveSimulationState {
    return {
      ...super.exportSnapshot(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
      physicalObjects: this.getPhysicalObjectState(),
      venueOperations: this.getVenueRuntimeState(),
      activeTravel: this.getActiveTravel(),
      innerVoice: this.innerVoice.getPersistedState(),
    };
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const extendedSnapshot = snapshot as TransportSimulationState & {
      physicalWorld?: PhysicalWorldState;
      physicalObjects?: unknown;
      venueOperations?: unknown;
      activeTravel?: unknown;
    };
    const persistedPhysicalWorld = extendedSnapshot.physicalWorld;
    const persistedPhysicalObjects = extendedSnapshot.physicalObjects;
    const persistedVenueOperations = extendedSnapshot.venueOperations;
    const persistedActiveTravel = extendedSnapshot.activeTravel == null
      ? null
      : parseActiveTravel(extendedSnapshot.activeTravel);

    super.loadSnapshot(snapshot);
    this.physicalObjectState = hydratePhysicalObjectRuntimeState(
      persistedPhysicalObjects,
      PHYSICAL_RUNTIME_GRAPH,
    );
    this.venueState = hydrateVenueRuntimeState(
      persistedVenueOperations,
      GENERATED_VENUE_DEFINITIONS,
    );
    this.physicalWorldState = this.hydratePhysicalWorld(persistedPhysicalWorld);
    this.activeTravelState = persistedActiveTravel;
    this.innerVoice.hydrate(snapshot.innerVoice ?? emptyInnerVoicePersistedState());
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
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