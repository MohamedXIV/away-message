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
  type LiveSimulationState as LegacyLiveSimulationState,
} from './SimulationEngineLegacyFacade';
import { PLAYER_INVENTORY_CONTAINER_ID } from './PhysicalItemBridge';
import type {
  ItemInstance,
  PhysicalItemLocation,
  PhysicalWorldState,
} from './PhysicalItemEngine';
import { GROCERY_SKUS, type DeliveryOrder, type Fulfillment } from './DeliveryEngine';
import type {
  PhysicalShopFixtureDefinition,
  PhysicalShopState,
} from './PhysicalShopEngine';
import { PhysicalShopSessionRuntime } from './kernel/PhysicalShopSessionRuntime';
import type { PhysicalShopCheckoutResult } from './PhysicalShopCheckout';
import type {
  ContextRequirement,
  ContextRequirementResult,
  PhysicalObjectRuntimeState,
  ReachableAffordance,
} from './physical/PhysicalContextRuntime';
import { resolvePlaceDeliveryTarget } from './physical/PhysicalContextRuntime';
import { parseActiveTravel } from './transit/ActiveTravel';
import { ActiveTravelRuntime } from './kernel/ActiveTravelRuntime';
import { MaterialWorldRuntime, PHYSICAL_RUNTIME_GRAPH, resolveGeneratedPlaceId, DELIVERY_PARCEL_DEFINITION_ID, SHOPPING_BAG_DEFINITION_ID } from './kernel/MaterialWorldRuntime';
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

import { GENERATED_PLACE_SERVICE_POLICIES } from './worldContent.generated';
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

export class SimulationEngine extends LegacySimulationEngine {
  private readonly residenceCoordination: ResidenceCoordination;
  private readonly material: MaterialWorldRuntime;

  private readonly physicalShop: PhysicalShopSessionRuntime;
  private readonly venueRuntime: VenueOperationsRuntime;
  private readonly activeTravel: ActiveTravelRuntime;
  /** Single composed owner for authored Scenario instances and presentation-only Inner Voice. */
  private readonly story: StoryExperienceRuntime;

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.residenceCoordination = new ResidenceCoordination(
      { economy: this.economy, clock: this.clock, telemetry: this.telemetry },
      () => this.material.reanchorOwnedItems(),
      initialState?.residence,
      initialState?.starterHousingOfferId,
    );
    this.material = new MaterialWorldRuntime(
      () => this.inventory.getState(),
      () => this.currentResidenceOwnedItemAnchorId(),
      initialState?.physicalWorld,
      initialState?.physicalObjects,
    );
    this.venueRuntime = new VenueOperationsRuntime(
      { clock: this.clock, events: this.events },
      (actorId) => this.getActorSpatialProjection(actorId)?.membership.placeId ?? null,
      (spaceId, requirements) => this.resolvePhysicalContextRequirements(spaceId, requirements),
      (actorId) => this.getCharacterIntent(actorId),
      initialState?.venueOperations,
    );

    this.physicalShop = new PhysicalShopSessionRuntime(
      this.material,
      {
        canAfford: (amount) => this.economy.canAfford(amount),
        spendCash: (amount, reason) => this.dispatchAction({
          type: 'PLAYER_SPEND_CASH', amount, reason,
        }),
      },
      initialState?.physicalShops,
    );
    this.activeTravel = new ActiveTravelRuntime(
      { clock: this.clock, economy: this.economy, telemetry: this.telemetry },
      (actorId) => this.clearActorSpatialForTravel(actorId),
      (actorId, placeId) => this.relocateActorToGeneratedPlaceEntry(actorId, placeId),
      (action) => this.dispatchAction(action),
      (playerTravel) => super.collectEncounterCandidates(playerTravel),
      (playerTravel) => super.decideEncounter(playerTravel),
      initialState?.activeTravel,
    );
    this.story = new StoryExperienceRuntime(
      { clock: this.clock, social: this.social },
      initialState?.scenarios,
      initialState?.scenarioSeed ?? 'default',
      (initialState as TransportSimulationState | undefined)?.innerVoice ?? null,
    );
    this.delivery.setArrivalHandler((order) => this.materializeDeliveryParcel(order));
    this.events.on('time:tick', () => {
      this.activeTravel.synchronizeActiveTravel();
      this.venueRuntime.synchronizeVenueActivities();
    });
    this.events.on('time:jump', () => {
      this.activeTravel.synchronizeActiveTravel();
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

  public getPhysicalShopState(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): PhysicalShopState {
    return this.physicalShop.getPhysicalShopState(storeId, worldSeed, fixtures);
  }

  public getPhysicalShopCashierCapabilities(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): { talk: true; checkout: boolean } {
    return this.physicalShop.getPhysicalShopCashierCapabilities(storeId, worldSeed, fixtures);
  }

  public takePhysicalShopItem(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    instanceId: string,
    destinationContainerInstanceId = PLAYER_INVENTORY_CONTAINER_ID,
  ): ItemInstance {
    return this.physicalShop.takePhysicalShopItem(
      storeId, worldSeed, fixtures, instanceId, destinationContainerInstanceId,
    );
  }

  public returnPhysicalShopItem(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    instanceId: string,
  ): ItemInstance {
    return this.physicalShop.returnPhysicalShopItem(storeId, worldSeed, fixtures, instanceId);
  }

  public checkoutPhysicalShop(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    pricesByDefinitionId: Readonly<Record<string, number>>,
  ): PhysicalShopCheckoutResult {
    return this.physicalShop.checkoutPhysicalShop(storeId, worldSeed, fixtures, pricesByDefinitionId);
  }

  private materializeGroceryContainer(
    order: DeliveryOrder,
    containerId: string,
    containerDefinitionId: string,
    shellLocation: PhysicalItemLocation,
    itemIdPrefix: string,
  ): void {
    this.material.materializeGroceryContainer(
      order, containerId, containerDefinitionId, shellLocation, itemIdPrefix,
    );
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
    return this.material.getPhysicalWorldState();
  }

  public getPhysicalObjectState(): PhysicalObjectRuntimeState {
    return this.material.getPhysicalObjectState();
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
    return this.material.getReachablePhysicalAffordances(spaceId);
  }

  public resolvePhysicalContextRequirements(
    spaceId: string,
    requirements: readonly ContextRequirement[],
  ): ContextRequirementResult {
    return this.material.resolvePhysicalContextRequirements(spaceId, requirements);
  }

  public movePhysicalObject(instanceId: string, targetSlotId: string): void {
    this.material.movePhysicalObject(instanceId, targetSlotId);
  }

  public detachPhysicalObject(instanceId: string): void {
    this.material.detachPhysicalObject(instanceId);
  }

  public transferPhysicalItem(
    instanceId: string,
    destination: PhysicalItemLocation,
  ): ItemInstance {
    return this.material.transferPhysicalItem(instanceId, destination);
  }

  public openPhysicalContainer(
    containerInstanceId: string,
    destinationContainerInstanceId: string = PLAYER_INVENTORY_CONTAINER_ID,
  ): ItemInstance[] {
    return this.material.openPhysicalContainer(
      containerInstanceId, destinationContainerInstanceId,
    );
  }

  public setActiveTravel(state: ActiveTravelState | null): void {
    this.activeTravel.setActiveTravel(state);
  }

  public getActiveTravel(): ActiveTravelState | null {
    return this.activeTravel.getActiveTravel();
  }

  public override collectEncounterCandidates(): EncounterCandidate[] {
    return this.activeTravel.collectEncounterCandidates();
  }

  public override decideEncounter(): EncounterDecision {
    return this.activeTravel.decideEncounter();
  }

  public startTravel(
    actorId: string,
    plan: TravelPlan,
    purposeRef?: string,
  ): { success: boolean; data?: ActiveTravelState; error?: string } {
    return this.activeTravel.startTravel(actorId, plan, purposeRef);
  }

  public override getState(): Readonly<LiveSimulationState> {
    return {
      ...super.getState(),
      physicalWorld: this.getPhysicalWorldState(),
      physicalObjects: this.getPhysicalObjectState(),
      physicalShops: this.physicalShop.getState(),
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
      physicalWorld: this.getPhysicalWorldState(),
      physicalObjects: this.getPhysicalObjectState(),
      physicalShops: this.physicalShop.getState(),
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
    this.material.loadState(persistedPhysicalWorld, persistedPhysicalObjects as PhysicalObjectRuntimeState);
    this.venueRuntime.loadState(persistedVenueOperations as VenueRuntimeState);
    this.physicalShop.loadState(persistedPhysicalShops);
    this.activeTravel.loadState(persistedActiveTravel);
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