// Composition-owned material world, housing, venue, physical shops,
// committed travel, Scenario and Inner Voice.
//
// The root SimulationKernel coordinates persistence and publication; these
// domain owners retain their sole authoritative state and lifecycle.

import type { EncounterCandidate, EncounterDecision } from '../encounters';
import { CoreSimulationRuntime } from './CoreSimulationRuntime';
import { NpcComputerSimulationRuntime } from './NpcComputerSimulationRuntime';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../PhysicalItemBridge';
import type {
  ItemInstance,
  PhysicalItemLocation,
  PhysicalWorldState,
} from '../PhysicalItemEngine';
import type { Fulfillment } from '../DeliveryEngine';
import type {
  PhysicalShopFixtureDefinition,
  PhysicalShopState,
} from '../PhysicalShopEngine';
import { PhysicalShopSessionRuntime } from './PhysicalShopSessionRuntime';
import type { PhysicalShopCheckoutResult } from '../PhysicalShopCheckout';
import type {
  ContextRequirement,
  ContextRequirementResult,
  PhysicalObjectRuntimeState,
  ReachableAffordance,
} from '../physical/PhysicalContextRuntime';
import { resolvePlaceDeliveryTarget } from '../physical/PhysicalContextRuntime';
import { parseActiveTravel } from '../transit/ActiveTravel';
import { ActiveTravelRuntime } from './ActiveTravelRuntime';
import { MaterialWorldRuntime, PHYSICAL_RUNTIME_GRAPH, resolveGeneratedPlaceId } from './MaterialWorldRuntime';
import { PhysicalGroceryFulfillment } from './PhysicalGroceryFulfillment';
import type { ActiveTravelState, TravelPlan } from '../transit/types';
import type { CharacterIntent } from '../life/types';
import type {
  ResolveVenueActivityResult,
  StartVenueActivityResult,
  VenueActivityInstance,
  VenueRoleAssignment,
  VenueRuntimeState,
  VenueServiceAvailability,
} from '../venue/VenueOperations';
import { VenueOperationsRuntime } from './VenueOperationsRuntime';
import type { SimulationState as TransportSimulationState } from '../types';
import type { SimulationState as CanonicalSimulationState } from '../types/index';
import type { ResidenceState } from '../ResidenceTenancy';
import { ResidenceCoordination } from './ResidenceCoordination';

import { GENERATED_PLACE_SERVICE_POLICIES } from '../worldContent.generated';
import {
  InnerVoiceEngine,
  type InnerVoicePersistedState,
  type InnerVoiceUiState,
  type InspectThoughtRequest,
  type ThoughtIntent,
  type ThoughtTrigger,
} from '../innerVoice/index';
import { type ScenarioRuntimeState } from '../scenario/ScenarioState';
import { StoryExperienceRuntime } from './StoryExperienceRuntime';
import type {
  ScenarioHookOpportunity,
  ScenarioObservation,
} from '../scenario/ScenarioDirector';
import type { ScenarioDefinition, ScenarioInstance, ScenarioLifecycle } from '../scenario/types';
import type { ScenarioProjection } from '../scenario/ScenarioProjection';
import { GENERATED_SCENARIOS } from '../scenarioContent.generated';

export type LiveSimulationState = CanonicalSimulationState & {
  physicalWorld: PhysicalWorldState;
  physicalObjects: PhysicalObjectRuntimeState;
  physicalShops: Record<string, PhysicalShopState>;
  venueOperations: VenueRuntimeState;
  activeTravel: ActiveTravelState | null;
  scenarios: ScenarioRuntimeState;
};

export type InitialSimulationState = Partial<TransportSimulationState> & {
  physicalWorld?: PhysicalWorldState;
  physicalObjects?: PhysicalObjectRuntimeState;
  physicalShops?: Record<string, PhysicalShopState>;
  activeTravel?: ActiveTravelState | null;
  starterHousingOfferId?: string;
  /** Optional deterministic new-save Scenario selection seed. Persisted bindings prevent rerolls. */
  scenarioSeed?: string;
};

export interface PhysicalRuntimePorts {
  advanceGameMinutes(minutes: number, reason?: string): void;
  dispatchAction(action: import('../types').SimulationAction): import('../types').ActionResult;
}

/** Owns one material world, residence, shop, venue, travel and authored-story graph. */
export class PhysicalSimulationRuntime {
  private get clock() { return this.core.clock; }
  private get economy() { return this.core.economy; }
  private get telemetry() { return this.core.telemetry; }
  private get events() { return this.core.events; }
  private get needs() { return this.core.needs; }
  private get delivery() { return this.core.delivery; }
  private get world() { return this.core.world; }
  private get social() { return this.core.social; }
  private get inventory() { return this.npc.inventory; }
  private getActorSpatialProjection(actorId: string) { return this.npc.getActorSpatialProjection(actorId); }
  private getCharacterIntent(actorId: string) { return this.npc.getCharacterIntent(actorId); }
  private clearActorSpatialForTravel(actorId: string) { this.npc.clearActorSpatialForTravel(actorId); }
  private relocateActorToGeneratedPlaceEntry(actorId: string, placeId: string) {
    return this.npc.relocateActorToGeneratedPlaceEntry(actorId, placeId);
  }
  private advanceGameMinutes(minutes: number, reason?: string) {
    this.ports.advanceGameMinutes(minutes, reason);
  }
  private dispatchAction(action: import('../types').SimulationAction) {
    return this.ports.dispatchAction(action);
  }
  private readonly residenceCoordination: ResidenceCoordination;
  private readonly material: MaterialWorldRuntime;

  private readonly physicalShop: PhysicalShopSessionRuntime;
  private readonly physicalGrocery: PhysicalGroceryFulfillment;
  private readonly venueRuntime: VenueOperationsRuntime;
  private readonly activeTravel: ActiveTravelRuntime;
  /** Single composed owner for authored Scenario instances and presentation-only Inner Voice. */
  private readonly story: StoryExperienceRuntime;

  public constructor(
    private readonly core: CoreSimulationRuntime,
    private readonly npc: NpcComputerSimulationRuntime,
    private readonly ports: PhysicalRuntimePorts,
    initialState?: InitialSimulationState,
  ) {
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
      (playerTravel) => this.npc.collectEncounterCandidates(playerTravel),
      (playerTravel) => this.npc.decideEncounter(playerTravel),
      initialState?.activeTravel,
    );
    this.story = new StoryExperienceRuntime(
      { clock: this.clock, social: this.social },
      initialState?.scenarios,
      initialState?.scenarioSeed ?? 'default',
      (initialState as TransportSimulationState | undefined)?.innerVoice ?? null,
    );
    this.physicalGrocery = new PhysicalGroceryFulfillment(
      {
        clock: this.clock,
        economy: this.economy,
        needs: this.needs,
        delivery: this.delivery,
        world: this.world,
        telemetry: this.telemetry,
      },
      this.material,
      () => {
        const spatialPlaceId = this.getActorSpatialProjection('player')?.membership.placeId;
        if (spatialPlaceId) return spatialPlaceId;
        const legacyLocation = this.economy.getLocation();
        return legacyLocation === 'home'
          ? this.residenceCoordination.resolveHomePlaceId()
          : resolveGeneratedPlaceId(legacyLocation);
      },
      (items, fulfillment, minute, options) =>
        this.core.placeGroceryOrder(items, fulfillment, minute, options),
      (minutes, reason) => this.advanceGameMinutes(minutes, reason),
    );
    this.physicalGrocery.bindArrivalHandler();
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

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
  ) {
    return this.physicalGrocery.placeGroceryOrder(rawItems, fulfillment, nowMinute);
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

  public collectEncounterCandidates(): EncounterCandidate[] {
    return this.activeTravel.collectEncounterCandidates();
  }

  public decideEncounter(): EncounterDecision {
    return this.activeTravel.decideEncounter();
  }

  public startTravel(
    actorId: string,
    plan: TravelPlan,
    purposeRef?: string,
  ): { success: boolean; data?: ActiveTravelState; error?: string } {
    return this.activeTravel.startTravel(actorId, plan, purposeRef);
  }

  /** Only the composed root invokes hydration, after canonical Core/NPC owners. */
  public loadState(snapshot: TransportSimulationState): void {
    const extended = snapshot as TransportSimulationState & {
      physicalWorld?: PhysicalWorldState;
      physicalObjects?: unknown;
      physicalShops?: Record<string, PhysicalShopState>;
      venueOperations?: unknown;
      activeTravel?: unknown;
      residence?: ResidenceState;
      scenarios?: ScenarioRuntimeState;
    };
    this.residenceCoordination.loadState(extended.residence);
    this.material.loadState(extended.physicalWorld, extended.physicalObjects as PhysicalObjectRuntimeState);
    this.venueRuntime.loadState(extended.venueOperations as VenueRuntimeState);
    this.physicalShop.loadState(extended.physicalShops);
    this.activeTravel.loadState(
      extended.activeTravel == null ? null : parseActiveTravel(extended.activeTravel),
    );
    this.story.loadState(extended.scenarios, snapshot.innerVoice);
    this.physicalGrocery.bindArrivalHandler();
  }

  /** Canonical physical-shop owner projection (no secondary store). */
  public getAllPhysicalShopStates(): Record<string, PhysicalShopState> {
    return this.physicalShop.getState();
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