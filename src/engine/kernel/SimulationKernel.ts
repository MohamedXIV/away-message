import type { SimulationState as TransportSimulationState, SimulationAction, ActionResult, HardwareState } from '../types';
import type { Fulfillment } from '../DeliveryEngine';
import { createEmptyComputerSetup, createEmptyDisplaySetup } from '../hardware/state';
import { CoreSimulationRuntime } from './CoreSimulationRuntime';
import { resolvePcBootState } from './ComputerOwnershipRuntime';
import { getPhysicalCatalogItem } from '../hardware/catalog';
import { NpcComputerSimulationRuntime } from './NpcComputerSimulationRuntime';
import { PhysicalSimulationRuntime, type LiveSimulationState, type InitialSimulationState } from './PhysicalSimulationRuntime';
import {
  deriveActorSemantics, projectLifeInfluences,
  type ActorSemanticView, type SemanticInfluenceView,
} from '../semantic/ActorSemantics';

import { domainFromEmission } from './SimulationPublication';
import type {
  ObservedSimulationDomain,
  SimulationActorRead,
  SimulationAppRead,
  SimulationShopRead,
  SimulationWebsiteRead,
  SimulationPulseProfileRead,
  SimulationChromeRead,
  SimulationDesktopRead,
  SimulationDirectoryRead,
  SimulationFileRead,
  SimulationChange,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationPlayerStatusRead,
  SimulationMessengerRead,
  SimulationPresenceRead,
  SimulationWorldRead,
  SimulationSituationRead,
  SimulationResidenceRead,
  SimulationJobBoardRead,
  SimulationTransitRead,
  SimulationCafeGuestRead,
} from './SimulationPublication';
export type {
  SimulationActorRead,
  SimulationAppRead,
  SimulationShopRead,
  SimulationWebsiteRead,
  SimulationPulseProfileRead,
  SimulationChromeRead,
  SimulationDesktopRead,
  SimulationDirectoryRead,
  SimulationFileRead,
  SimulationChange,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationPlayerStatusRead,
  SimulationMessengerRead,
  SimulationPresenceRead,
  SimulationWorldRead,
  SimulationSituationRead,
  SimulationResidenceRead,
  SimulationJobBoardRead,
  SimulationTransitRead,
  SimulationCafeGuestRead,
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
  /** Ephemeral event provenance between atomic publication boundaries. */
  private readonly observedDomains = new Set<ObservedSimulationDomain>();
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
      advanceGameMinutes: (minutes, reason) => this.advanceGameMinutes(minutes, reason),
      dispatchAction: (action) => this.dispatchAction(action),
      invalidate: () => this.invalidateStateCache(),
    }, initialState);
    this.physical = new PhysicalSimulationRuntime(this.core, this.npc, {
      advanceGameMinutes: (minutes, reason) => this.advanceGameMinutes(minutes, reason),
      dispatchAction: (action) => this.dispatchAction(action),
    }, initialState);
    // The same shared EventBus is the event source of truth; no polling or
    // snapshot comparisons. Observations are proof of emitted domains only.
    this.events.observeEmissions((event) => {
      const domain = domainFromEmission(event);
      if (domain) this.observedDomains.add(domain);
    });
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
      return this.purchaseStoreItem(action.storeId, action.skuId);
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
    // A presentation-only Inner Voice update must not advance unrelated
    // gameplay Mood state. If any other source event was observed, preserve
    // the normal reconciliation for that combined atomic boundary.
    const voiceOnly = this.observedDomains.size === 1 && this.observedDomains.has('innerVoice');
    if (!voiceOnly) this.mood.publishIfChanged();
    this.invalidateStateCache();
    const observed = [...this.observedDomains].sort();
    this.observedDomains.clear();
    const change: SimulationChange = {
      revision: ++this.revision,
      atMinute: this.clock.getTotalMinutes(),
      // Conservatively retain 'unknown' until no silent domain writer exists.
      changedDomains: [...observed, 'unknown'],
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

  /**
   * Explicit publication boundary for direct legacy UI domain commands that
   * do not go through dispatchAction. This is NOT a state write or snapshot;
   * it delivers one revision to bounded readers and full state only to
   * remaining legacy subscribers. Callers must invoke after the mutation.
   */
  public publishExternalChange(changedDomains: readonly ObservedSimulationDomain[] = []): void {
    // Caller must name only owners it has just mutated. This augments
    // source events and remains conservative: 'unknown' is still retained
    // until every silent writer is covered.
    for (const domain of changedDomains) this.observedDomains.add(domain);
    this.notifySubscribers();
  }

  /**
   * Source-backed publication for composed owner writes that emit no EventBus
   * event. Hold nested action/event notifications (notably shop checkout cash
   * spending) until the owner has committed. Never publish a failed operation.
   * This is a notification boundary, not a second source of state authority.
   */
  private publishOwnerMutation<T>(
    domains: readonly ObservedSimulationDomain[],
    operation: () => T,
    committed: (result: T) => boolean = () => true,
  ): T {
    const before = this.clock.getTotalMinutes();
    return this.withinBoundary(() => {
      const result = operation();
      if (committed(result)) this.publishExternalChange(domains);
      return result;
    }, before);
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
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      paused: this.clock.isPaused(),
      cash: this.economy.getCash(),
      socialBattery: this.needs.getSocialBattery(),
      activeView: this.core.getActiveView(),
    };
  }

  /** Owner-backed status for residence and city UI; never merges full PlayerState. */
  public getPlayerStatusRead(): SimulationPlayerStatusRead {
    return {
      revision: this.revision,
      needs: this.needs.getSnapshot(),
      rent: this.economy.getRentStatus(),
    };
  }

  /** Small viewport inputs for Phaser/React — no physical object graph. */
  public getWorldRead(): SimulationWorldRead {
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      activeView: this.core.getActiveView(),
      residencePlaceId: this.physical.getCurrentResidencePlaceId(),
      playerLocation: this.economy.getLocation(),
      environment: this.environment.getCurrentSnapshot(),
      pcBootState: resolvePcBootState({ computer: this.hardware.getComputerState(), inventory: this.inventory.getState(), os: this.os.getState() }),
      metInPerson: !!this.world.getFlag('met_in_person'),
    };
  }

  /** Public Situation: only triggered world events, bounded source-backed modifiers. */
  /** Bounded player tenancy and offers, with affordability owned by Housing. */
  public getResidenceRead(): SimulationResidenceRead {
    return {
      revision: this.revision,
      tenancy: this.getResidenceState(),
      offers: this.getHousingOffers(),
    };
  }

  /** Capped, player-safe public job board. Never expose a private roster/name. */
  public getJobBoardRead(): SimulationJobBoardRead {
    return {
      revision: this.revision,
      jobs: this.getJobBoard().slice(0, 32).map(({ gig, pending }) => {
        const contact = this.social.getBuddyWithRole(gig.contactRole);
        return {
          gigId: gig.id,
          title: gig.title,
          blurb: gig.blurb,
          pay: gig.pay,
          durationMin: gig.durationMin,
          minEnergy: gig.minEnergy,
          contactName: contact && this.social.isKnown(contact.id)
            ? contact.displayName : gig.contactRole,
          pending,
        };
      }),
    };
  }

  /** Only the currently committed player trip; never a global NPC mobility snapshot. */
  public getTransitRead(): SimulationTransitRead {
    const atMinute = this.clock.getTotalMinutes();
    const travel = this.getActiveTravel();
    if (!travel) return { revision: this.revision, atMinute, active: null };
    const currentLeg = travel.plan.legs[travel.currentLegIndex] ?? null;
    return {
      revision: this.revision,
      atMinute,
      active: {
        status: travel.status,
        originPlaceId: travel.plan.originPlaceId,
        destinationPlaceId: travel.plan.destinationPlaceId,
        currentLegIndex: travel.currentLegIndex,
        currentLeg: currentLeg ? { ...currentLeg } : null,
        arriveAtMinute: travel.plan.arriveAtMinute,
        minutesRemaining: Math.max(0, travel.plan.arriveAtMinute - atMinute),
      },
    };
  }

  /**
   * Factual in-person guest: Social owns knowledge and reach, NPC movement
   * owns the current physical place. Online status is not location evidence.
   */
  public getCafeGuestRead(placeId: string, requestedActorId?: string): SimulationCafeGuestRead {
    const candidates = requestedActorId
      ? [this.social.getBuddy(requestedActorId)]
      : this.social.getBuddies();
    let guest: SimulationCafeGuestRead['guest'] = null;
    let bestFamiliarity = -Infinity;
    for (const candidate of candidates) {
      if (!candidate || candidate.reach !== 'local' || !this.social.isKnown(candidate.id)) continue;
      const location = this.npc.getNpcPlaceState(candidate.id);
      if (location.status !== 'at_place' || location.placeId !== placeId) continue;
      const semantics = this.getActorSemanticView(candidate.id);
      if (!semantics || semantics.connection !== 'known' || !semantics.canMeetInPerson.allowed) continue;
      const familiarity = this.social.getRelationships(candidate.id)?.familiarity ?? 0;
      if (guest && familiarity <= bestFamiliarity) continue;
      guest = { actorId: candidate.id, displayName: candidate.displayName };
      bestFamiliarity = familiarity;
    }
    return { revision: this.revision, placeId, guest };
  }

  public getSituationRead(): SimulationSituationRead {
    const atMinute = this.clock.getTotalMinutes();
    const visibleEvents = this.world.getTriggeredEvents();
    const visibleIds = new Set(visibleEvents.map(event => event.id));
    const influences = this.world.queryActiveModifiers({ atMinute })
      .filter(modifier => visibleIds.has(modifier.sourceEventId))
      .slice(0, 32)
      .map(modifier => ({ ...modifier, ...(modifier.targetIds
        ? { targetIds: [...modifier.targetIds] } : {}) }));
    return {
      revision: this.revision,
      atMinute,
      activeEventIds: [...new Set(influences.map(modifier => modifier.sourceEventId))].slice(0, 16),
      influences,
    };
  }

  /** Selected actor read is player-safe; never reveal other actors' learned facts. */
  public getPlayerActorRead(actorId: string): SimulationActorRead | null {
    const actor = this.getActorSemanticView(actorId);
    if (!actor || actor.connection === 'unknown') return null;
    const learned = this.world.getKnownSemanticContextForSubject('player', actorId);
    const visibleEventIds = new Set(this.world.getTriggeredEvents().map(event => event.id));
    const influences = this.getActorLifeInfluences(actorId)
      .filter(influence => visibleEventIds.has(influence.sourceEventId));
    return {
      revision: this.revision, actor,
      playerKnowledge: learned,
      influences,
    };
  }

  public getDirectoryRead(path: string): SimulationDirectoryRead {
    const capacity = this.vfs.getDiskCapacity();
    return {
      revision: this.revision,
      path: this.vfs.normalizePath(path),
      files: this.vfs.listDirectoryMetadata(path),
      ...capacity,
      freeDiskBytes: this.vfs.getFreeDiskBytes(),
    };
  }

  public getFileRead(path: string): SimulationFileRead {
    return { revision: this.revision, file: path ? this.vfs.readFile(path) ?? null : null };
  }

  /** The desktop app ecosystem reads only Hardware, OS and Software owners. */
  public getAppRead(): SimulationAppRead {
    const computer = this.hardware.getComputerState();
    return {
      revision: this.revision,
      hardware: this.hardware.getState(),
      computer: { assembled: computer.assembled, poweredOn: computer.poweredOn },
      os: this.os.getState(),
      installedSoftware: this.software.getInstalledSoftware(),
      downloads: this.downloads.getState().tasks.slice(-256),
    };
  }

  public getPulseProfileRead(actorId: string): SimulationPulseProfileRead {
    const playerActor = this.getPlayerActorRead(actorId);
    // A profile lookup is not evidence that the player knows this identity.
    // Keep owner-private knowledge and memories behind the same semantic gate.
    if (!playerActor) return {
      revision: this.revision,
      buddyKnowledge: [],
      worldEvents: [],
      photoMemories: [],
      semantics: null,
      influences: [],
    };
    const buddyKnowledge = this.world.getBuddyKnowledge(actorId).slice(-8);
    const eventIds = new Set(buddyKnowledge.map(k => k.eventId));
    return {
      revision: this.revision,
      buddyKnowledge,
      worldEvents: this.world.getTriggeredEvents().filter(event => eventIds.has(event.id))
        .map(event => ({ ...event })),
      photoMemories: this.social.getCoreMemories(actorId).filter(memory => memory.kind === 'shared_photo')
        .slice(-12),
      semantics: playerActor?.actor ?? null,
      influences: playerActor?.influences ?? [],
    };
  }

  public getWebsiteRead(): SimulationWebsiteRead {
    const flags = this.world.getPublicFlags();
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      cash: this.economy.getCash(),
      narrativeFlags: { ...flags },
      world: {
        flags,
        appointments: [],
        windowObservationHistory: [],
        triggeredEvents: this.world.getTriggeredEvents().slice(-256).map(event => ({ ...event })),
        buddyKnowledge: {},
      },
      myplace: this.myplace.getState(),
    };
  }

  public getShopRead(): SimulationShopRead {
    const inventory = this.inventory.getShopSummary();
    return {
      revision: this.revision,
      cash: this.economy.getCash(),
      hardware: this.hardware.getState(),
      osVersion: this.os.getCurrentOsId(),
      ...inventory,
    };
  }

  /** File-body-free desktop read. Only visible shortcut metadata crosses UI. */
  public getDesktopRead(): SimulationDesktopRead {
    const inventory = this.inventory.getState();
    const computer = this.hardware.getComputerState();
    const os = this.os.getState();
    const desktopFiles = this.vfs.listDirectory('C:/Desktop').slice(0, 256).map(
      ({ id, name, path, parentPath, kind, appAssociation }) => ({
        id, name, path, parentPath, kind, appAssociation,
      }),
    );
    return {
      revision: this.revision,
      osVersion: os.currentOsId ?? null,
      pcBootState: resolvePcBootState({ computer, inventory, os }),
      monitor: this.hardware.getDisplayState().monitor,
      bootMediaItems: inventory.items.filter(item =>
        getPhysicalCatalogItem(item.catalogItemId)?.media?.type === 'os_installer'
        && (item.location === 'inventory' || item.location === 'room_package' || item.location === 'inserted')
      ).map(item => ({ ...item })),
      desktopFiles,
    };
  }

  /** Desktop chrome and Pulse tray use only domain-scoped, serializable reads. */
  public getChromeRead(): SimulationChromeRead {
    const hardware = this.hardware.getState();
    const unread = this.social.getUnreadTraySummary(4, true);
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      osVersion: this.os.getCurrentOsId(),
      pulseVersion: this.pulse.getState().currentPulseId,
      pulseInstalled: this.software.getInstalledSoftware().some(
        sw => String(sw.appId).includes('pulse'),
      ),
      connectionType: hardware.connectionType,
      connectionSpeedKbps: hardware.connectionSpeedKbps,
      activeDownloadCount: this.downloads.getState().tasks.filter(
        task => task.status === 'downloading',
      ).length,
      unreadCount: unread.unreadCount,
      unreadPreviews: unread.previews,
    };
  }

  public getPresenceRead(): SimulationPresenceRead {
    return { revision: this.revision, presence: this.social.getPresenceSummary() };
  }

  public getMessengerRead(maxContacts = 32): SimulationMessengerRead {
    return {
      revision: this.revision,
      contacts: this.social.getMessengerSummary(maxContacts),
      unreadCounts: this.social.getConversationUnreadCounts(500, true),
    };
  }

  public getConversationRead(actorId: string, offset = 0, limit = 30): SimulationConversationRead {
    // An arbitrary/guessed actor ID is NOT authorization to read their
    // transcript. Source-owned learned handles are the Pulse discovery gate.
    // Keep full canonical histories for future contact unlock and Save Log.
    if (!this.social.isKnown(actorId)) {
      return { revision: this.revision, conversationId: actorId, messages: [], total: 0, hasOlder: false };
    }
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
    const before = this.npc.getActorSpatialProjection(args[0]);
    return this.publishOwnerMutation(['transit'],
      () => this.npc.relocateActorSpatially(...args),
      (after) => JSON.stringify(before) !== JSON.stringify(after));
  }

  public clearActorSpatialForTravel(...args: Parameters<NpcComputerSimulationRuntime['clearActorSpatialForTravel']>): ReturnType<NpcComputerSimulationRuntime['clearActorSpatialForTravel']> {
    const before = this.npc.getActorSpatialProjection(args[0]);
    return this.publishOwnerMutation(['transit'],
      () => this.npc.clearActorSpatialForTravel(...args),
      () => before !== null && this.npc.getActorSpatialProjection(args[0]) === null);
  }

  public relocateActorToGeneratedPlaceEntry(...args: Parameters<NpcComputerSimulationRuntime['relocateActorToGeneratedPlaceEntry']>): ReturnType<NpcComputerSimulationRuntime['relocateActorToGeneratedPlaceEntry']> {
    const before = this.npc.getActorSpatialProjection(args[0]);
    return this.publishOwnerMutation(['transit'],
      () => this.npc.relocateActorToGeneratedPlaceEntry(...args),
      (success) => success && JSON.stringify(before) !== JSON.stringify(this.npc.getActorSpatialProjection(args[0])));
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

  /**
   * PC ownership commands can write silent Inventory and OS owner state even
   * when Hardware emits no event. Diff only those small canonical owner roots;
   * all nested time/economy publications remain one atomic revision.
   */
  private publishComputerMutation<T extends { success: boolean }>(action: () => T): T {
    const beforeMinute = this.clock.getTotalMinutes();
    const beforeInventory = JSON.stringify(this.inventory.getState());
    const hardwareKey = () => JSON.stringify({
      computer: this.hardware.getComputerState(), display: this.hardware.getDisplayState(),
    });
    const beforeHardware = hardwareKey();
    const beforeOs = JSON.stringify(this.os.getState());
    return this.withinBoundary(() => {
      const result = action();
      if (result.success) {
        const domains: ObservedSimulationDomain[] = [];
        if (beforeInventory !== JSON.stringify(this.inventory.getState())) domains.push('inventory');
        if (beforeHardware !== hardwareKey()) domains.push('hardware');
        if (beforeOs !== JSON.stringify(this.os.getState())) domains.push('os');
        if (domains.length > 0) this.publishExternalChange(domains);
      }
      return result;
    }, beforeMinute);
  }

  public setComputerPower(...args: Parameters<NpcComputerSimulationRuntime['setComputerPower']>): ReturnType<NpcComputerSimulationRuntime['setComputerPower']> {
    return this.publishComputerMutation(() => this.npc.setComputerPower(...args));
  }

  public installOwnedHardwareAtHome(...args: Parameters<NpcComputerSimulationRuntime['installOwnedHardwareAtHome']>): ReturnType<NpcComputerSimulationRuntime['installOwnedHardwareAtHome']> {
    return this.publishComputerMutation(() => this.npc.installOwnedHardwareAtHome(...args));
  }

  public insertOwnedMediaAtHome(...args: Parameters<NpcComputerSimulationRuntime['insertOwnedMediaAtHome']>): ReturnType<NpcComputerSimulationRuntime['insertOwnedMediaAtHome']> {
    return this.publishComputerMutation(() => this.npc.insertOwnedMediaAtHome(...args));
  }

  public ejectOwnedMediaAtHome(...args: Parameters<NpcComputerSimulationRuntime['ejectOwnedMediaAtHome']>): ReturnType<NpcComputerSimulationRuntime['ejectOwnedMediaAtHome']> {
    return this.publishComputerMutation(() => this.npc.ejectOwnedMediaAtHome(...args));
  }

  public prepareOsInstallFromInsertedMedia(...args: Parameters<NpcComputerSimulationRuntime['prepareOsInstallFromInsertedMedia']>): ReturnType<NpcComputerSimulationRuntime['prepareOsInstallFromInsertedMedia']> {
    return this.npc.prepareOsInstallFromInsertedMedia(...args);
  }

  public commitOsInstall(...args: Parameters<NpcComputerSimulationRuntime['commitOsInstall']>): ReturnType<NpcComputerSimulationRuntime['commitOsInstall']> {
    return this.publishComputerMutation(() => this.npc.commitOsInstall(...args));
  }

  public purchaseStoreItem(...args: Parameters<NpcComputerSimulationRuntime['purchaseStoreItem']>): ReturnType<NpcComputerSimulationRuntime['purchaseStoreItem']> {
    return this.publishComputerMutation(() => this.npc.purchaseStoreItem(...args));
  }

  public setupComputerAtHome(...args: Parameters<NpcComputerSimulationRuntime['setupComputerAtHome']>): ReturnType<NpcComputerSimulationRuntime['setupComputerAtHome']> {
    return this.publishComputerMutation(() => this.npc.setupComputerAtHome(...args));
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
    const before = this.clock.getTotalMinutes();
    return this.withinBoundary(() => {
      const result = this.physical.moveResidenceToOffer(...args);
      // The tenancy owner is a silent writer. Mark the changed domain
      // BEFORE the outer atomic boundary publishes source-event changes.
      if (result.success) {
        this.observedDomains.add('residence');
        // ResidenceCoordination can update tenancy without an engine-level
        // event; request exactly one publication after the outer boundary.
        this.notifySubscribers();
      }
      return result;
    }, before);
  }

  /** First-entry materialization is an explicit command, never a getter side effect. */
  public initializePhysicalShop(...args: Parameters<PhysicalSimulationRuntime['initializePhysicalShop']>): ReturnType<PhysicalSimulationRuntime['initializePhysicalShop']> {
    return this.publishOwnerMutation(['physical', 'shop'], () => this.physical.initializePhysicalShop(...args),
      (initialized) => initialized);
  }

  public getPhysicalShopState(...args: Parameters<PhysicalSimulationRuntime['getPhysicalShopState']>): ReturnType<PhysicalSimulationRuntime['getPhysicalShopState']> {
    return this.physical.getPhysicalShopState(...args);
  }

  public getPhysicalShopCashierCapabilities(...args: Parameters<PhysicalSimulationRuntime['getPhysicalShopCashierCapabilities']>): ReturnType<PhysicalSimulationRuntime['getPhysicalShopCashierCapabilities']> {
    return this.physical.getPhysicalShopCashierCapabilities(...args);
  }

  public takePhysicalShopItem(...args: Parameters<PhysicalSimulationRuntime['takePhysicalShopItem']>): ReturnType<PhysicalSimulationRuntime['takePhysicalShopItem']> {
    return this.publishOwnerMutation(['physical', 'shop'], () => this.physical.takePhysicalShopItem(...args));
  }

  public returnPhysicalShopItem(...args: Parameters<PhysicalSimulationRuntime['returnPhysicalShopItem']>): ReturnType<PhysicalSimulationRuntime['returnPhysicalShopItem']> {
    return this.publishOwnerMutation(['physical', 'shop'], () => this.physical.returnPhysicalShopItem(...args));
  }

  public checkoutPhysicalShop(...args: Parameters<PhysicalSimulationRuntime['checkoutPhysicalShop']>): ReturnType<PhysicalSimulationRuntime['checkoutPhysicalShop']> {
    return this.publishOwnerMutation(['physical', 'shop'], () => this.physical.checkoutPhysicalShop(...args), (result) => result.success);
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
    return this.publishOwnerMutation(['venue'], () => this.physical.setVenueRoleAssignment(...args));
  }

  public getVenueServiceAvailability(...args: Parameters<PhysicalSimulationRuntime['getVenueServiceAvailability']>): ReturnType<PhysicalSimulationRuntime['getVenueServiceAvailability']> {
    return this.physical.getVenueServiceAvailability(...args);
  }

  public resolveVenueActivityIntent(...args: Parameters<PhysicalSimulationRuntime['resolveVenueActivityIntent']>): ReturnType<PhysicalSimulationRuntime['resolveVenueActivityIntent']> {
    return this.physical.resolveVenueActivityIntent(...args);
  }

  public startVenueActivityFromIntent(...args: Parameters<PhysicalSimulationRuntime['startVenueActivityFromIntent']>): ReturnType<PhysicalSimulationRuntime['startVenueActivityFromIntent']> {
    return this.publishOwnerMutation(['venue'], () => this.physical.startVenueActivityFromIntent(...args), (result) => result.ok);
  }

  public startCurrentVenueActivity(...args: Parameters<PhysicalSimulationRuntime['startCurrentVenueActivity']>): ReturnType<PhysicalSimulationRuntime['startCurrentVenueActivity']> {
    return this.publishOwnerMutation(['venue'], () => this.physical.startCurrentVenueActivity(...args), (result) => result.ok);
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
    return this.publishOwnerMutation(['physical'], () => this.physical.movePhysicalObject(...args));
  }

  public detachPhysicalObject(...args: Parameters<PhysicalSimulationRuntime['detachPhysicalObject']>): ReturnType<PhysicalSimulationRuntime['detachPhysicalObject']> {
    return this.publishOwnerMutation(['physical'], () => this.physical.detachPhysicalObject(...args));
  }

  public transferPhysicalItem(...args: Parameters<PhysicalSimulationRuntime['transferPhysicalItem']>): ReturnType<PhysicalSimulationRuntime['transferPhysicalItem']> {
    return this.publishOwnerMutation(['physical'], () => this.physical.transferPhysicalItem(...args));
  }

  public openPhysicalContainer(...args: Parameters<PhysicalSimulationRuntime['openPhysicalContainer']>): ReturnType<PhysicalSimulationRuntime['openPhysicalContainer']> {
    return this.publishOwnerMutation(['physical'], () => this.physical.openPhysicalContainer(...args));
  }

  public setActiveTravel(...args: Parameters<PhysicalSimulationRuntime['setActiveTravel']>): ReturnType<PhysicalSimulationRuntime['setActiveTravel']> {
    const result = this.physical.setActiveTravel(...args);
    // A direct owner setter has no source event. Its caller already owns
    // the explicit publication boundary; annotate the next revision.
    this.observedDomains.add('transit');
    return result;
  }

  public getActiveTravel(...args: Parameters<PhysicalSimulationRuntime['getActiveTravel']>): ReturnType<PhysicalSimulationRuntime['getActiveTravel']> {
    return this.physical.getActiveTravel(...args);
  }

  public startTravel(...args: Parameters<PhysicalSimulationRuntime['startTravel']>): ReturnType<PhysicalSimulationRuntime['startTravel']> {
    return this.publishOwnerMutation(['transit'], () => this.physical.startTravel(...args), (result) => result.success);
  }

  public getScenarioState(...args: Parameters<PhysicalSimulationRuntime['getScenarioState']>): ReturnType<PhysicalSimulationRuntime['getScenarioState']> {
    return this.physical.getScenarioState(...args);
  }

  public initializeScenarios(...args: Parameters<PhysicalSimulationRuntime['initializeScenarios']>): ReturnType<PhysicalSimulationRuntime['initializeScenarios']> {
    // Initialization can record attempted definitions even if no thread binds.
    const before = JSON.stringify(this.physical.getScenarioState());
    return this.publishOwnerMutation(['scenario'], () => this.physical.initializeScenarios(...args),
      () => JSON.stringify(this.physical.getScenarioState()) !== before);
  }

  public getScenarioHookOpportunities(...args: Parameters<PhysicalSimulationRuntime['getScenarioHookOpportunities']>): ReturnType<PhysicalSimulationRuntime['getScenarioHookOpportunities']> {
    return this.physical.getScenarioHookOpportunities(...args);
  }

  public getScenarioProjection(...args: Parameters<PhysicalSimulationRuntime['getScenarioProjection']>): ReturnType<PhysicalSimulationRuntime['getScenarioProjection']> {
    return this.physical.getScenarioProjection(...args);
  }

  public consumeScenarioHook(...args: Parameters<PhysicalSimulationRuntime['consumeScenarioHook']>): ReturnType<PhysicalSimulationRuntime['consumeScenarioHook']> {
    const before = JSON.stringify(this.physical.getScenarioState());
    return this.publishOwnerMutation(['scenario'], () => this.physical.consumeScenarioHook(...args),
      () => JSON.stringify(this.physical.getScenarioState()) !== before);
  }

  public setScenarioLifecycle(...args: Parameters<PhysicalSimulationRuntime['setScenarioLifecycle']>): ReturnType<PhysicalSimulationRuntime['setScenarioLifecycle']> {
    const before = JSON.stringify(this.physical.getScenarioState());
    return this.publishOwnerMutation(['scenario'], () => this.physical.setScenarioLifecycle(...args),
      () => JSON.stringify(this.physical.getScenarioState()) !== before);
  }

  public getInnerVoiceEngine(...args: Parameters<PhysicalSimulationRuntime['getInnerVoiceEngine']>): ReturnType<PhysicalSimulationRuntime['getInnerVoiceEngine']> {
    return this.physical.getInnerVoiceEngine(...args);
  }

  public getInnerVoiceState(...args: Parameters<PhysicalSimulationRuntime['getInnerVoiceState']>): ReturnType<PhysicalSimulationRuntime['getInnerVoiceState']> {
    return this.physical.getInnerVoiceState(...args);
  }

  /** The voice's small presentation queue is not part of its persisted cooldowns. */
  private innerVoicePublicationKey(): string {
    const voice = this.physical.getInnerVoiceEngine();
    return JSON.stringify({
      saved: voice.getPersistedState(),
      activeId: voice.peekActive()?.id ?? null,
      queued: voice.getQueueLength(),
    });
  }

  public requestInnerThought(...args: Parameters<PhysicalSimulationRuntime['requestInnerThought']>): ReturnType<PhysicalSimulationRuntime['requestInnerThought']> {
    const before = this.innerVoicePublicationKey();
    return this.publishOwnerMutation(['innerVoice'], () => this.physical.requestInnerThought(...args),
      () => this.innerVoicePublicationKey() !== before);
  }

  public requestInspectThought(...args: Parameters<PhysicalSimulationRuntime['requestInspectThought']>): ReturnType<PhysicalSimulationRuntime['requestInspectThought']> {
    const before = this.innerVoicePublicationKey();
    return this.publishOwnerMutation(['innerVoice'], () => this.physical.requestInspectThought(...args),
      () => this.innerVoicePublicationKey() !== before);
  }

  public dismissInnerThought(...args: Parameters<PhysicalSimulationRuntime['dismissInnerThought']>): ReturnType<PhysicalSimulationRuntime['dismissInnerThought']> {
    const before = this.innerVoicePublicationKey();
    return this.publishOwnerMutation(['innerVoice'], () => this.physical.dismissInnerThought(...args),
      () => this.innerVoicePublicationKey() !== before);
  }
}
