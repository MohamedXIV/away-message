import type { SimulationState as TransportSimulationState, SimulationAction, ActionResult, HardwareState } from '../types';
import type { Fulfillment } from '../DeliveryEngine';
import { createEmptyComputerSetup, createEmptyDisplaySetup } from '../hardware/state';
import { CoreSimulationRuntime } from './CoreSimulationRuntime';
import { NpcComputerSimulationRuntime } from './NpcComputerSimulationRuntime';
import { PhysicalSimulationRuntime, type LiveSimulationState, type InitialSimulationState } from './PhysicalSimulationRuntime';
import {
  deriveActorSemantics, projectLifeInfluences,
  type ActorSemanticView, type SemanticInfluenceView,
} from '../semantic/ActorSemantics';

import type {
  SimulationActorRead,
  SimulationChange,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationMessengerRead,
  SimulationWorldRead,
} from './SimulationPublication';
export type {
  SimulationActorRead,
  SimulationChange,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationMessengerRead,
  SimulationWorldRead,
} from './SimulationPublication';
export type { LiveSimulationState } from './PhysicalSimulationRuntime';

/**
 * Exactly one production simulation entrypoint. Composes domain owners and
 * coordinators without executable inheritance or a shadow world store.
 */
export class SimulationKernel {
  private readonly core: CoreSimulationRuntime;
  private readonly npc: NpcComputerSimulationRuntime;
  private readonly physical: PhysicalSimulationRuntime;
  private readonly subscribers = new Set<(state: Readonly<LiveSimulationState>) => void>();
  private readonly changeSubscribers = new Set<(change: Readonly<SimulationChange>) => void>();
  private revision = 0;
  private hydrating = false;
  private simulationBoundaryDepth = 0;
  private publicationPending = false;

  constructor(initialState?: InitialSimulationState) {
    const computer = initialState?.computer ?? createEmptyComputerSetup();
    const display = initialState?.display ?? createEmptyDisplaySetup();
    const installedSoftware = initialState && Object.prototype.hasOwnProperty.call(initialState, 'installedSoftware')
      ? initialState.installedSoftware : [];
    const normalizedInitial: InitialSimulationState = {
      ...initialState,
      hardware: {
        ...(initialState?.hardware ?? ({} as HardwareState)),
        computer,
        display,
      },
      os: initialState?.os ?? { currentOsId: null, installedPatchIds: [] },
      installedSoftware,
    };

    this.core = new CoreSimulationRuntime({
      dispatchAction: (action) => this.dispatchAction(action),
      advanceGameMinutes: (minutes, reason) => this.advanceGameMinutes(minutes, reason),
      placeGroceryOrder: (items, fulfillment, minute) => this.placeGroceryOrder(items, fulfillment, minute),
      publishState: () => this.notifySubscribers(),
    }, normalizedInitial);
    this.npc = new NpcComputerSimulationRuntime(this.core, {
      getState: () => this.getState(),
      advanceGameMinutes: (minutes, reason) => this.advanceGameMinutes(minutes, reason),
      dispatchAction: (action) => this.dispatchAction(action),
      invalidate: () => this.invalidateStateCache(),
    }, initialState);
    this.physical = new PhysicalSimulationRuntime(this.core, this.npc, {
      advanceGameMinutes: (minutes, reason) => this.advanceGameMinutes(minutes, reason),
      dispatchAction: (action) => this.dispatchAction(action),
    }, initialState);
  }

  public get clock() { return this.core.clock; }
  public get events() { return this.core.events; }
  public get economy() { return this.core.economy; }
  public get needs() { return this.core.needs; }
  public get hardware() { return this.core.hardware; }
  public get os() { return this.core.os; }
  public get pulse() { return this.core.pulse; }
  public get myplace() { return this.core.myplace; }
  public get vfs() { return this.core.vfs; }
  public get downloads() { return this.core.downloads; }
  public get delivery() { return this.core.delivery; }
  public get software() { return this.core.software; }
  public get social() { return this.core.social; }
  public get telemetry() { return this.core.telemetry; }
  public get world() { return this.core.world; }
  public get environment() { return this.core.environment; }
  public get mood() { return this.core.mood; }
  public get gameContext() { return this.core.gameContext; }
  public get inventory() { return this.npc.inventory; }

  /** #187: bounded, non-persisted semantics over the one Social/Life authority. */
  public getActorSemanticView(actorId: string, focused = false): ActorSemanticView | null {
    const actor = this.social.getBuddy(actorId);
    if (!actor) return null;
    return deriveActorSemantics({
      actor,
      condition: this.social.getActorCondition(actor.id)!,
      relationship: this.social.getRelationships(actor.id),
      relationshipStage: this.social.getRelationshipStage(actor.id),
      presence: this.social.getPresence(actor.id),
      knownToPlayer: this.social.isKnown(actor.id),
      pressure: this.npc.npcLife.peekNpcPressure(actor.id),
      lifeFidelity: this.getFidelityTier(actor.id),
      focused,
    });
  }

  /** Inspector/owner-facing provenance; #172 will shape player-safe UI projections. */
  public getActorLifeInfluences(actorId: string): SemanticInfluenceView[] {
    if (!this.social.getBuddy(actorId)) return [];
    return projectLifeInfluences(this.world.queryActiveModifiers({
      domain: 'life', targetId: actorId, atMinute: this.clock.getTotalMinutes(),
    }));
  }

  /**
   * Hold notification until all canonical time owners, including NPC mobility,
   * have settled. A subscriber must never observe an in-between time snapshot.
   */
  private withinBoundary<T>(action: () => T, beforeMinute: number): T {
    this.simulationBoundaryDepth++;
    try {
      return action();
    } finally {
      try {
        this.npc.settleAfterTime(beforeMinute);
      } finally {
        this.simulationBoundaryDepth--;
        if (this.simulationBoundaryDepth === 0 && this.publicationPending) {
          this.publicationPending = false;
          this.notifySubscribers();
        }
      }
    }
  }

  public advanceRealTime(deltaRealSeconds: number): void {
    const before = this.clock.getTotalMinutes();
    this.withinBoundary(() => this.core.advanceRealTime(deltaRealSeconds), before);
  }

  public advanceGameMinutes(minutes: number, reason?: string): void {
    const before = this.clock.getTotalMinutes();
    if (minutes > 0) this.npc.primeNpcMobility();
    this.withinBoundary(() => this.core.advanceGameMinutes(minutes, reason), before);
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    if (action.type === 'STORE_PURCHASE_ITEM') {
      return this.npc.purchaseStoreItem(action.storeId, action.skuId);
    }
    if (action.type === 'HARDWARE_UPGRADE_OS') {
      return { success: false, error: 'Legacy OS upgrades are retired. Buy, insert, and boot from owned setup media instead.' };
    }
    const before = this.clock.getTotalMinutes();
    return this.withinBoundary(() => this.core.dispatchAction(action), before);
  }

  private invalidateStateCache(): void {
    if (this.core) this.core.invalidateStateCache();
  }

  private notifySubscribers(): void {
    if (this.hydrating || !this.physical) return;
    if (this.simulationBoundaryDepth > 0) {
      this.publicationPending = true;
      return;
    }
    // Reconcile derived mood exactly at the authoritative publication boundary,
    // never during getState() or a current-format snapshot read.
    this.mood.publishIfChanged();
    this.invalidateStateCache();
    const change: SimulationChange = {
      revision: ++this.revision,
      atMinute: this.clock.getTotalMinutes(),
      changedDomains: ['unknown'],
    };
    for (const listener of this.changeSubscribers) {
      try { listener(change); }
      catch (err) { console.error('[SimulationKernel] Change subscriber error:', err); }
    }
    // Legacy full-state consumers must be migrated under #172. Change-only
    // subscriptions never pay for a broad snapshot by themselves.
    if (this.subscribers.size > 0) {
      const state = this.getState();
      for (const listener of this.subscribers) {
        try { listener(state); }
        catch (err) { console.error('[SimulationKernel] Subscriber error:', err); }
      }
    }
  }

  public getRevision(): number { return this.revision; }

  /** #172: Worker-serializable revision channel, no broad snapshot read. */
  public subscribeChanges(listener: (change: Readonly<SimulationChange>) => void): () => void {
    this.changeSubscribers.add(listener);
    listener({ revision: this.revision, atMinute: this.clock.getTotalMinutes(), changedDomains: ['unknown'] });
    return () => { this.changeSubscribers.delete(listener); };
  }

  /** Bounded read from canonical owners; never assembles CoreStateProjection. */
  public getHudProjection(): SimulationHudProjection {
    const player = this.economy.getState();
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      paused: this.clock.isPaused(),
      cash: player.cash,
      socialBattery: player.socialBattery,
      activeView: this.core.getActiveView(),
    };
  }

  /** Small viewport inputs for Phaser/React — no physical object graph. */
  public getWorldRead(): SimulationWorldRead {
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      activeView: this.core.getActiveView(),
      residencePlaceId: this.physical.getCurrentResidencePlaceId(),
      playerLocation: this.economy.getState().location,
      environment: this.environment.getCurrentSnapshot(),
    };
  }

  /** Selected actor read is player-safe; never reveal NPC-private facts. */
  public getPlayerActorRead(actorId: string): SimulationActorRead | null {
    const actor = this.getActorSemanticView(actorId);
    if (!actor || actor.connection === 'unknown') return null;
    const learned = this.world.getActorSemanticKnowledge('player');
    return {
      revision: this.revision, actor,
      playerKnowledge: learned,
    };
  }

  public getMessengerRead(maxContacts = 32): SimulationMessengerRead {
    return { revision: this.revision, contacts: this.social.getMessengerSummary(maxContacts) };
  }

  public getConversationRead(actorId: string, offset = 0, limit = 30): SimulationConversationRead {
    return { revision: this.revision, ...this.social.getConversationPage(actorId, offset, limit) };
  }

  public subscribe(listener: (state: Readonly<LiveSimulationState>) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => { this.subscribers.delete(listener); };
  }

  public getState(): Readonly<LiveSimulationState> {
    return {
      ...this.core.getState(),
      hardware: this.hardware.getState(),
      computer: this.hardware.getComputerState(),
      display: this.hardware.getDisplayState(),
      inventory: this.inventory.getState(),
      os: this.os.getState(),
      installedSoftware: this.software.getInstalledSoftware(),
      npcLives: this.npc.getNpcLivesState(),
      npcMobility: this.npc.getNpcMobilityState(),
      actorSpatialPositions: this.npc.getActorSpatialPositions(),
      encounters: this.npc.getEncounterDirectorState(),
      physicalWorld: this.physical.getPhysicalWorldState(),
      physicalObjects: this.physical.getPhysicalObjectState(),
      physicalShops: this.physical.getAllPhysicalShopStates(),
      venueOperations: this.physical.getVenueRuntimeState(),
      activeTravel: this.physical.getActiveTravel(),
      scenarios: this.physical.getScenarioState(),
      residence: this.physical.getResidenceState(),
      innerVoice: this.physical.getInnerVoiceState(),
    } as Readonly<LiveSimulationState>;
  }

  public exportSnapshot(): LiveSimulationState {
    this.invalidateStateCache();
    return JSON.parse(JSON.stringify(this.getState())) as LiveSimulationState;
  }

  public loadSnapshot(snapshot: TransportSimulationState): void {
    const computer = snapshot.computer ?? createEmptyComputerSetup();
    const display = snapshot.display ?? createEmptyDisplaySetup();
    this.hydrating = true;
    try {
      this.core.loadSnapshot({ ...snapshot, hardware: { ...snapshot.hardware, computer, display } });
      this.software.loadState(snapshot.installedSoftware ?? []);
      this.npc.loadState(snapshot);
      this.physical.loadState(snapshot);
    } finally {
      this.hydrating = false;
    }
    this.notifySubscribers();
  }

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
    _deliveryOptions?: import('../DeliveryEngine').PlaceDeliveryOptions,
  ) {
    return this.physical.placeGroceryOrder(rawItems, fulfillment, nowMinute);
  }

  public isPulse6(...args: Parameters<CoreSimulationRuntime['isPulse6']>): ReturnType<CoreSimulationRuntime['isPulse6']> {
    return this.core.isPulse6(...args);
  }

  public getReceptionHint(...args: Parameters<CoreSimulationRuntime['getReceptionHint']>): ReturnType<CoreSimulationRuntime['getReceptionHint']> {
    return this.core.getReceptionHint(...args);
  }

  public handleMeetupChat(...args: Parameters<CoreSimulationRuntime['handleMeetupChat']>): ReturnType<CoreSimulationRuntime['handleMeetupChat']> {
    return this.core.handleMeetupChat(...args);
  }

  public travelTo(...args: Parameters<CoreSimulationRuntime['travelTo']>): ReturnType<CoreSimulationRuntime['travelTo']> {
    return this.core.travelTo(...args);
  }

  public getJobBoard(...args: Parameters<CoreSimulationRuntime['getJobBoard']>): ReturnType<CoreSimulationRuntime['getJobBoard']> {
    return this.core.getJobBoard(...args);
  }

  public doCityOuting(...args: Parameters<CoreSimulationRuntime['doCityOuting']>): ReturnType<CoreSimulationRuntime['doCityOuting']> {
    return this.core.doCityOuting(...args);
  }

  public generateProceduralEventsNow(...args: Parameters<CoreSimulationRuntime['generateProceduralEventsNow']>): ReturnType<CoreSimulationRuntime['generateProceduralEventsNow']> {
    return this.core.generateProceduralEventsNow(...args);
  }

  public getPcBootState(...args: Parameters<NpcComputerSimulationRuntime['getPcBootState']>): ReturnType<NpcComputerSimulationRuntime['getPcBootState']> {
    return this.npc.getPcBootState(...args);
  }

  public getLifeSnapshot(...args: Parameters<NpcComputerSimulationRuntime['getLifeSnapshot']>): ReturnType<NpcComputerSimulationRuntime['getLifeSnapshot']> {
    return this.npc.getLifeSnapshot(...args);
  }

  public getCharacterObligations(...args: Parameters<NpcComputerSimulationRuntime['getCharacterObligations']>): ReturnType<NpcComputerSimulationRuntime['getCharacterObligations']> {
    return this.npc.getCharacterObligations(...args);
  }

  public getCharacterIntent(...args: Parameters<NpcComputerSimulationRuntime['getCharacterIntent']>): ReturnType<NpcComputerSimulationRuntime['getCharacterIntent']> {
    return this.npc.getCharacterIntent(...args);
  }

  public getNpcLivesState(...args: Parameters<NpcComputerSimulationRuntime['getNpcLivesState']>): ReturnType<NpcComputerSimulationRuntime['getNpcLivesState']> {
    return this.npc.getNpcLivesState(...args);
  }

  public getNpcPressure(...args: Parameters<NpcComputerSimulationRuntime['getNpcPressure']>): ReturnType<NpcComputerSimulationRuntime['getNpcPressure']> {
    return this.npc.getNpcPressure(...args);
  }

  public getPersonalGoals(...args: Parameters<NpcComputerSimulationRuntime['getPersonalGoals']>): ReturnType<NpcComputerSimulationRuntime['getPersonalGoals']> {
    return this.npc.getPersonalGoals(...args);
  }

  public getFidelityTier(...args: Parameters<NpcComputerSimulationRuntime['getFidelityTier']>): ReturnType<NpcComputerSimulationRuntime['getFidelityTier']> {
    return this.npc.getFidelityTier(...args);
  }

  public getNpcMobilityState(...args: Parameters<NpcComputerSimulationRuntime['getNpcMobilityState']>): ReturnType<NpcComputerSimulationRuntime['getNpcMobilityState']> {
    return this.npc.getNpcMobilityState(...args);
  }

  public getActorSpatialPositions(...args: Parameters<NpcComputerSimulationRuntime['getActorSpatialPositions']>): ReturnType<NpcComputerSimulationRuntime['getActorSpatialPositions']> {
    return this.npc.getActorSpatialPositions(...args);
  }

  public getActorSpatialProjection(...args: Parameters<NpcComputerSimulationRuntime['getActorSpatialProjection']>): ReturnType<NpcComputerSimulationRuntime['getActorSpatialProjection']> {
    return this.npc.getActorSpatialProjection(...args);
  }

  public relocateActorSpatially(...args: Parameters<NpcComputerSimulationRuntime['relocateActorSpatially']>): ReturnType<NpcComputerSimulationRuntime['relocateActorSpatially']> {
    return this.npc.relocateActorSpatially(...args);
  }

  public clearActorSpatialForTravel(...args: Parameters<NpcComputerSimulationRuntime['clearActorSpatialForTravel']>): ReturnType<NpcComputerSimulationRuntime['clearActorSpatialForTravel']> {
    return this.npc.clearActorSpatialForTravel(...args);
  }

  public relocateActorToGeneratedPlaceEntry(...args: Parameters<NpcComputerSimulationRuntime['relocateActorToGeneratedPlaceEntry']>): ReturnType<NpcComputerSimulationRuntime['relocateActorToGeneratedPlaceEntry']> {
    return this.npc.relocateActorToGeneratedPlaceEntry(...args);
  }

  public getNpcTrip(...args: Parameters<NpcComputerSimulationRuntime['getNpcTrip']>): ReturnType<NpcComputerSimulationRuntime['getNpcTrip']> {
    return this.npc.getNpcTrip(...args);
  }

  public getNpcPlaceState(...args: Parameters<NpcComputerSimulationRuntime['getNpcPlaceState']>): ReturnType<NpcComputerSimulationRuntime['getNpcPlaceState']> {
    return this.npc.getNpcPlaceState(...args);
  }

  public getNpcCoLocation(...args: Parameters<NpcComputerSimulationRuntime['getNpcCoLocation']>): ReturnType<NpcComputerSimulationRuntime['getNpcCoLocation']> {
    return this.npc.getNpcCoLocation(...args);
  }

  public getEncounterDirectorState(...args: Parameters<NpcComputerSimulationRuntime['getEncounterDirectorState']>): ReturnType<NpcComputerSimulationRuntime['getEncounterDirectorState']> {
    return this.npc.getEncounterDirectorState(...args);
  }

  public collectEncounterCandidates(...args: Parameters<PhysicalSimulationRuntime['collectEncounterCandidates']>): ReturnType<PhysicalSimulationRuntime['collectEncounterCandidates']> {
    return this.physical.collectEncounterCandidates(...args);
  }

  public decideEncounter(...args: Parameters<PhysicalSimulationRuntime['decideEncounter']>): ReturnType<PhysicalSimulationRuntime['decideEncounter']> {
    return this.physical.decideEncounter(...args);
  }

  public setComputerPower(...args: Parameters<NpcComputerSimulationRuntime['setComputerPower']>): ReturnType<NpcComputerSimulationRuntime['setComputerPower']> {
    return this.npc.setComputerPower(...args);
  }

  public installOwnedHardwareAtHome(...args: Parameters<NpcComputerSimulationRuntime['installOwnedHardwareAtHome']>): ReturnType<NpcComputerSimulationRuntime['installOwnedHardwareAtHome']> {
    return this.npc.installOwnedHardwareAtHome(...args);
  }

  public insertOwnedMediaAtHome(...args: Parameters<NpcComputerSimulationRuntime['insertOwnedMediaAtHome']>): ReturnType<NpcComputerSimulationRuntime['insertOwnedMediaAtHome']> {
    return this.npc.insertOwnedMediaAtHome(...args);
  }

  public ejectOwnedMediaAtHome(...args: Parameters<NpcComputerSimulationRuntime['ejectOwnedMediaAtHome']>): ReturnType<NpcComputerSimulationRuntime['ejectOwnedMediaAtHome']> {
    return this.npc.ejectOwnedMediaAtHome(...args);
  }

  public prepareOsInstallFromInsertedMedia(...args: Parameters<NpcComputerSimulationRuntime['prepareOsInstallFromInsertedMedia']>): ReturnType<NpcComputerSimulationRuntime['prepareOsInstallFromInsertedMedia']> {
    return this.npc.prepareOsInstallFromInsertedMedia(...args);
  }

  public commitOsInstall(...args: Parameters<NpcComputerSimulationRuntime['commitOsInstall']>): ReturnType<NpcComputerSimulationRuntime['commitOsInstall']> {
    return this.npc.commitOsInstall(...args);
  }

  public purchaseStoreItem(...args: Parameters<NpcComputerSimulationRuntime['purchaseStoreItem']>): ReturnType<NpcComputerSimulationRuntime['purchaseStoreItem']> {
    return this.npc.purchaseStoreItem(...args);
  }

  public setupComputerAtHome(...args: Parameters<NpcComputerSimulationRuntime['setupComputerAtHome']>): ReturnType<NpcComputerSimulationRuntime['setupComputerAtHome']> {
    return this.npc.setupComputerAtHome(...args);
  }

  public getResidenceState(...args: Parameters<PhysicalSimulationRuntime['getResidenceState']>): ReturnType<PhysicalSimulationRuntime['getResidenceState']> {
    return this.physical.getResidenceState(...args);
  }

  public getCurrentResidencePlaceId(...args: Parameters<PhysicalSimulationRuntime['getCurrentResidencePlaceId']>): ReturnType<PhysicalSimulationRuntime['getCurrentResidencePlaceId']> {
    return this.physical.getCurrentResidencePlaceId(...args);
  }

  public getHousingOffers(...args: Parameters<PhysicalSimulationRuntime['getHousingOffers']>): ReturnType<PhysicalSimulationRuntime['getHousingOffers']> {
    return this.physical.getHousingOffers(...args);
  }

  public moveResidenceToOffer(...args: Parameters<PhysicalSimulationRuntime['moveResidenceToOffer']>): ReturnType<PhysicalSimulationRuntime['moveResidenceToOffer']> {
    return this.physical.moveResidenceToOffer(...args);
  }

  public getPhysicalShopState(...args: Parameters<PhysicalSimulationRuntime['getPhysicalShopState']>): ReturnType<PhysicalSimulationRuntime['getPhysicalShopState']> {
    return this.physical.getPhysicalShopState(...args);
  }

  public getPhysicalShopCashierCapabilities(...args: Parameters<PhysicalSimulationRuntime['getPhysicalShopCashierCapabilities']>): ReturnType<PhysicalSimulationRuntime['getPhysicalShopCashierCapabilities']> {
    return this.physical.getPhysicalShopCashierCapabilities(...args);
  }

  public takePhysicalShopItem(...args: Parameters<PhysicalSimulationRuntime['takePhysicalShopItem']>): ReturnType<PhysicalSimulationRuntime['takePhysicalShopItem']> {
    return this.physical.takePhysicalShopItem(...args);
  }

  public returnPhysicalShopItem(...args: Parameters<PhysicalSimulationRuntime['returnPhysicalShopItem']>): ReturnType<PhysicalSimulationRuntime['returnPhysicalShopItem']> {
    return this.physical.returnPhysicalShopItem(...args);
  }

  public checkoutPhysicalShop(...args: Parameters<PhysicalSimulationRuntime['checkoutPhysicalShop']>): ReturnType<PhysicalSimulationRuntime['checkoutPhysicalShop']> {
    return this.physical.checkoutPhysicalShop(...args);
  }

  public getPhysicalWorldState(...args: Parameters<PhysicalSimulationRuntime['getPhysicalWorldState']>): ReturnType<PhysicalSimulationRuntime['getPhysicalWorldState']> {
    return this.physical.getPhysicalWorldState(...args);
  }

  public getPhysicalObjectState(...args: Parameters<PhysicalSimulationRuntime['getPhysicalObjectState']>): ReturnType<PhysicalSimulationRuntime['getPhysicalObjectState']> {
    return this.physical.getPhysicalObjectState(...args);
  }

  public getVenueRuntimeState(...args: Parameters<PhysicalSimulationRuntime['getVenueRuntimeState']>): ReturnType<PhysicalSimulationRuntime['getVenueRuntimeState']> {
    return this.physical.getVenueRuntimeState(...args);
  }

  public setVenueRoleAssignment(...args: Parameters<PhysicalSimulationRuntime['setVenueRoleAssignment']>): ReturnType<PhysicalSimulationRuntime['setVenueRoleAssignment']> {
    return this.physical.setVenueRoleAssignment(...args);
  }

  public getVenueServiceAvailability(...args: Parameters<PhysicalSimulationRuntime['getVenueServiceAvailability']>): ReturnType<PhysicalSimulationRuntime['getVenueServiceAvailability']> {
    return this.physical.getVenueServiceAvailability(...args);
  }

  public resolveVenueActivityIntent(...args: Parameters<PhysicalSimulationRuntime['resolveVenueActivityIntent']>): ReturnType<PhysicalSimulationRuntime['resolveVenueActivityIntent']> {
    return this.physical.resolveVenueActivityIntent(...args);
  }

  public startVenueActivityFromIntent(...args: Parameters<PhysicalSimulationRuntime['startVenueActivityFromIntent']>): ReturnType<PhysicalSimulationRuntime['startVenueActivityFromIntent']> {
    return this.physical.startVenueActivityFromIntent(...args);
  }

  public startCurrentVenueActivity(...args: Parameters<PhysicalSimulationRuntime['startCurrentVenueActivity']>): ReturnType<PhysicalSimulationRuntime['startCurrentVenueActivity']> {
    return this.physical.startCurrentVenueActivity(...args);
  }

  public getActiveVenueActivity(...args: Parameters<PhysicalSimulationRuntime['getActiveVenueActivity']>): ReturnType<PhysicalSimulationRuntime['getActiveVenueActivity']> {
    return this.physical.getActiveVenueActivity(...args);
  }

  public getReachablePhysicalAffordances(...args: Parameters<PhysicalSimulationRuntime['getReachablePhysicalAffordances']>): ReturnType<PhysicalSimulationRuntime['getReachablePhysicalAffordances']> {
    return this.physical.getReachablePhysicalAffordances(...args);
  }

  public resolvePhysicalContextRequirements(...args: Parameters<PhysicalSimulationRuntime['resolvePhysicalContextRequirements']>): ReturnType<PhysicalSimulationRuntime['resolvePhysicalContextRequirements']> {
    return this.physical.resolvePhysicalContextRequirements(...args);
  }

  public movePhysicalObject(...args: Parameters<PhysicalSimulationRuntime['movePhysicalObject']>): ReturnType<PhysicalSimulationRuntime['movePhysicalObject']> {
    return this.physical.movePhysicalObject(...args);
  }

  public detachPhysicalObject(...args: Parameters<PhysicalSimulationRuntime['detachPhysicalObject']>): ReturnType<PhysicalSimulationRuntime['detachPhysicalObject']> {
    return this.physical.detachPhysicalObject(...args);
  }

  public transferPhysicalItem(...args: Parameters<PhysicalSimulationRuntime['transferPhysicalItem']>): ReturnType<PhysicalSimulationRuntime['transferPhysicalItem']> {
    return this.physical.transferPhysicalItem(...args);
  }

  public openPhysicalContainer(...args: Parameters<PhysicalSimulationRuntime['openPhysicalContainer']>): ReturnType<PhysicalSimulationRuntime['openPhysicalContainer']> {
    return this.physical.openPhysicalContainer(...args);
  }

  public setActiveTravel(...args: Parameters<PhysicalSimulationRuntime['setActiveTravel']>): ReturnType<PhysicalSimulationRuntime['setActiveTravel']> {
    return this.physical.setActiveTravel(...args);
  }

  public getActiveTravel(...args: Parameters<PhysicalSimulationRuntime['getActiveTravel']>): ReturnType<PhysicalSimulationRuntime['getActiveTravel']> {
    return this.physical.getActiveTravel(...args);
  }

  public startTravel(...args: Parameters<PhysicalSimulationRuntime['startTravel']>): ReturnType<PhysicalSimulationRuntime['startTravel']> {
    return this.physical.startTravel(...args);
  }

  public getScenarioState(...args: Parameters<PhysicalSimulationRuntime['getScenarioState']>): ReturnType<PhysicalSimulationRuntime['getScenarioState']> {
    return this.physical.getScenarioState(...args);
  }

  public initializeScenarios(...args: Parameters<PhysicalSimulationRuntime['initializeScenarios']>): ReturnType<PhysicalSimulationRuntime['initializeScenarios']> {
    return this.physical.initializeScenarios(...args);
  }

  public getScenarioHookOpportunities(...args: Parameters<PhysicalSimulationRuntime['getScenarioHookOpportunities']>): ReturnType<PhysicalSimulationRuntime['getScenarioHookOpportunities']> {
    return this.physical.getScenarioHookOpportunities(...args);
  }

  public getScenarioProjection(...args: Parameters<PhysicalSimulationRuntime['getScenarioProjection']>): ReturnType<PhysicalSimulationRuntime['getScenarioProjection']> {
    return this.physical.getScenarioProjection(...args);
  }

  public consumeScenarioHook(...args: Parameters<PhysicalSimulationRuntime['consumeScenarioHook']>): ReturnType<PhysicalSimulationRuntime['consumeScenarioHook']> {
    return this.physical.consumeScenarioHook(...args);
  }

  public setScenarioLifecycle(...args: Parameters<PhysicalSimulationRuntime['setScenarioLifecycle']>): ReturnType<PhysicalSimulationRuntime['setScenarioLifecycle']> {
    return this.physical.setScenarioLifecycle(...args);
  }

  public getInnerVoiceEngine(...args: Parameters<PhysicalSimulationRuntime['getInnerVoiceEngine']>): ReturnType<PhysicalSimulationRuntime['getInnerVoiceEngine']> {
    return this.physical.getInnerVoiceEngine(...args);
  }

  public getInnerVoiceState(...args: Parameters<PhysicalSimulationRuntime['getInnerVoiceState']>): ReturnType<PhysicalSimulationRuntime['getInnerVoiceState']> {
    return this.physical.getInnerVoiceState(...args);
  }

  public requestInnerThought(...args: Parameters<PhysicalSimulationRuntime['requestInnerThought']>): ReturnType<PhysicalSimulationRuntime['requestInnerThought']> {
    return this.physical.requestInnerThought(...args);
  }

  public requestInspectThought(...args: Parameters<PhysicalSimulationRuntime['requestInspectThought']>): ReturnType<PhysicalSimulationRuntime['requestInspectThought']> {
    return this.physical.requestInspectThought(...args);
  }

  public dismissInnerThought(...args: Parameters<PhysicalSimulationRuntime['dismissInnerThought']>): ReturnType<PhysicalSimulationRuntime['dismissInnerThought']> {
    return this.physical.dismissInnerThought(...args);
  }
}
