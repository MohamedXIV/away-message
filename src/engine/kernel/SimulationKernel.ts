import type { SimulationState as TransportSimulationState, SimulationAction, ActionResult, HardwareState, MessageRecord } from '../types';
import type { Fulfillment } from '../DeliveryEngine';
import { INSTALLER_SOFTWARE_IDS } from '../InstallerFileCatalog';
import { inspectTextArchive } from './ZipArchiveCommands';
import { DOWNLOAD_CATALOG } from '../../internet/sites/DownloadHubCatalog';
import type { MyPlaceProfile } from '../MyPlaceEngine';
import type { BuddyCharacter, BuddyPresence, BuddyMetVia } from '../types';
import type { CharacterDefinition } from '../CharacterEngine';
import type { OsRelease, OsFamily } from '../OsCatalog';
import { pickOsTemplate, templateToRelease } from '../../ai/osReleaseTemplates';
import { generateNewcomer, type NewcomerResult } from '../CharacterDirector';
import type { CharacterArchetype } from '../types';
import { ProceduralDirector, type DirectorGenerateOptions } from '../ProceduralDirector';
import { buildRecentNpcMail, buildRentMailHistory, buildWeeklyNpcThreads, buildWeeklyWeatherThread, npcThreadWeek } from '../BoardDirector';
import { getWeatherForDay, gameDayName } from '../WeatherEngine';
import { locationLabel } from '../AppointmentDirector';
import { createEmptyComputerSetup, createEmptyDisplaySetup } from '../hardware/state';

import { CoreSimulationRuntime } from './CoreSimulationRuntime';
import { MAX_MINUTE_ACCURATE_ADVANCE, type MinuteAdvanceGranularity } from './TimeAdvancement';
import { resolvePcBootStateFromOwnerStatus } from './ComputerOwnershipRuntime';
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
  SimulationInstallerRead,
  SimulationArchiveRead,
  SimulationShopRead,
  SimulationWebsiteRead,
  SimulationMyPlacePageRead,
  SimulationNightBoardRead,
  SimulationPulseProfileRead,
  SimulationChromeRead,
  SimulationDesktopRead,
  SimulationInstalledProgramsRead,
  SimulationDirectoryRead,
  SimulationFileRead,
  SimulationChange,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationPlayerStatusRead,
  SimulationWeatherBuddyRead,
  SimulationLabInspectorRead,
  SimulationMessengerRead,
  SimulationPulseContactsRead,
  SimulationPresenceRead,
  SimulationMailboxRead,
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
  SimulationMyPlacePageRead,
  SimulationNightBoardRead,
  SimulationPulseProfileRead,
  SimulationChromeRead,
  SimulationDesktopRead,
  SimulationDirectoryRead,
  SimulationFileRead,
  SimulationChange,
  SimulationConversationRead,
  SimulationHudProjection,
  SimulationPlayerStatusRead,
  SimulationWeatherBuddyRead,
  SimulationLabInspectorRead,
  SimulationMessengerRead,
  SimulationPulseContactsRead,
  SimulationPresenceRead,
  SimulationMailboxRead,
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
  /** Discard pending Lab AI decisions if another save is loaded. */
  private snapshotEpoch = 0;

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
      commitAutoDiscoveredNewcomer: (buddy, introText, metVia, day) =>
        this.commitAutoDiscoveredNewcomer(buddy, introText, metVia, day),
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

  /**
   * Coarse is the existing constant-boundary world-time contract for long
   * activities. Minute fidelity is explicit and reproduces N normal
   * one-minute calls exactly, including intermediate domain events.
   * It is deliberately limited: never turn a multi-day time skip into
   * 1,440 expensive NPC passes by accident.
   */
  public advanceGameMinutes(
    minutes: number,
    reason?: string,
    granularity: MinuteAdvanceGranularity = 'coarse',
  ): void {
    if (granularity !== 'coarse' && granularity !== 'minute') {
      throw new Error('Invalid time advance granularity');
    }
    if (granularity === 'minute') {
      if (!Number.isSafeInteger(minutes) || minutes < 0 ||
          minutes > MAX_MINUTE_ACCURATE_ADVANCE) {
        throw new RangeError('Minute-accurate advance must be an integer from 0 to 60');
      }
      for (let step = 0; step < minutes; step += 1) {
        // Keep real per-minute publications and event ordering identical to
        // individually submitted one-minute commands. No shadow timer/cache.
        this.advanceGameMinutes(1, reason, 'coarse');
      }
      return;
    }
    const before = this.clock.getTotalMinutes();
    if (minutes > 0) this.npc.primeNpcMobility();
    this.withinBoundary(() => this.core.advanceGameMinutes(minutes, reason), before);
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    if (action.type === 'STORE_PURCHASE_ITEM') {
      return this.purchaseStoreItem(action.storeId, action.skuId);
    }
    if (action.type === 'SOFTWARE_INSTALL_FROM_DOWNLOAD') {
      const read = this.getInstallerRead(action.filePath);
      if (!read.ready || !read.preview || !read.softwareId) {
        return { success: false, error: read.reason || 'Installer unavailable.' };
      }
      if (!read.preview.compatibilityResult.isCompatible) {
        return { success: false, error: 'Software incompatible with current system specifications.' };
      }
      const before = this.clock.getTotalMinutes();
      return this.withinBoundary(() => this.core.dispatchAction({
        type: 'SOFTWARE_INSTALL', softwareId: read.softwareId!,
        selectedOptions: action.selectedOptions,
      }), before);
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
    // A malicious/buggy first subscriber must not rewrite the delivery for
    // later subscribers. Frozen plain objects remain Worker-serializable.
    const change: SimulationChange = Object.freeze({
      revision: ++this.revision,
      atMinute: this.clock.getTotalMinutes(),
      // Conservatively retain 'unknown' until no silent domain writer exists.
      changedDomains: Object.freeze([...observed, 'unknown'] as const),
    });
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
    listener(Object.freeze({
      revision: this.revision,
      atMinute: this.clock.getTotalMinutes(),
      changedDomains: Object.freeze(['unknown'] as const),
    }));
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
      moodBand: this.mood.getCurrentSnapshot().band,
    };
  }

  /** Owner-backed five-day outlook, capped at five forecast entries. */
  public getWeatherBuddyRead(): SimulationWeatherBuddyRead {
    return {
      revision: this.revision,
      current: this.environment.getCurrentSnapshot(),
      forecast: this.environment.getForecast({
        atMinute: this.clock.getTotalMinutes() + 1440,
        count: 5,
      }),
    };
  }

  /**
   * Developer Lab view only. All body/status data comes from owner reads,
   * while private relationship diagnostics stay within a 16-actor page.
   * Never publish these private fields as a general player-facing projection.
   */
  public getLabInspectorRead(actorPage = 0, meetingPage = 0): SimulationLabInspectorRead {
    const day = this.clock.getTime().day;
    const actorStart = Number.isFinite(actorPage) ? Math.max(0, Math.trunc(actorPage)) * 16 : 0;
    const meetingStart = Number.isFinite(meetingPage) ? Math.max(0, Math.trunc(meetingPage)) * 16 : 0;
    const roster = this.social.getLabRosterRead(actorStart, 16);
    const appointments = this.world.getLabAppointmentRead(day, meetingStart, 16);
    const needs = this.needs.getSnapshot();
    const rent = this.economy.getRentStatus();
    return {
      revision: this.revision,
      day,
      currentOsId: this.os.getCurrentOsId(),
      eventCounts: this.world.getLabEventCounts(),
      roster,
      actors: roster.page.map(buddy => ({
        ...buddy,
        relationship: this.social.getRelationships(buddy.id) ?? null,
        stage: this.social.getRelationshipStage(buddy.id),
        dailyMood: this.social.getDailyMood(buddy.id, day),
        memories: this.social.getCoreMemories(buddy.id),
        promises: this.social.getOpenPromises(buddy.id),
        sharp: String(this.world.getFlag(`sharp_${buddy.id}`) || ''),
        affinityText: this.social.buildAffinityContext(buddy.id),
      })),
      appointments,
      body: {
        energy: needs.energy,
        hunger: needs.hunger,
        health: needs.health,
        sleepDebt: needs.sleepDebt,
        maxEnergy: needs.effectiveMaxEnergy,
        cash: this.economy.getCash(),
        ...rent,
        rentOverdue: !!this.world.getFlag('rent_overdue'),
      },
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
      pcBootState: resolvePcBootStateFromOwnerStatus(
        this.hardware.getComputerBootStatus(),
        this.os.getCurrentOsId(),
        () => this.inventory.hasUnassembledComputerItems(),
      ),
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
        const contactName = this.social.getPublicJobContactName(gig.contactRole);
        return {
          gigId: gig.id,
          title: gig.title,
          blurb: gig.blurb,
          pay: gig.pay,
          durationMin: gig.durationMin,
          minEnergy: gig.minEnergy,
          contactName,
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
    const candidates = this.social.getKnownLocalCafeCandidatesRead(requestedActorId);
    let guest: SimulationCafeGuestRead['guest'] = null;
    let bestFamiliarity = -Infinity;
    for (const candidate of candidates) {
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
    // World.queryActiveModifiers already joins against canonical triggered
    // events. A second full sorted event list adds no visibility gate.
    const influences = this.world.queryActiveModifiers({ atMinute })
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
    // World modifier provenance is drawn exclusively from triggered events.
    const influences = this.getActorLifeInfluences(actorId);
    return {
      revision: this.revision, actor,
      playerKnowledge: learned,
      influences,
    };
  }

  /** Fixed-size directory page: one extra metadata record detects a next page. */
  public getDirectoryRead(path: string, offset = 0, limit = 64): SimulationDirectoryRead {
    const start = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
    const size = Number.isFinite(limit) ? Math.max(1, Math.min(64, Math.trunc(limit))) : 64;
    const page = this.vfs.listDirectoryMetadata(path, size + 1, start);
    const capacity = this.vfs.getDiskCapacity();
    return {
      revision: this.revision,
      path: this.vfs.normalizePath(path),
      offset: start,
      hasMore: page.length > size,
      files: page.slice(0, size),
      ...capacity,
      freeDiskBytes: this.vfs.getFreeDiskBytes(),
    };
  }

  public getArchiveRead(path: string): SimulationArchiveRead {
    const result = inspectTextArchive(this.vfs, path);
    return { revision: this.revision, archivePath: path, ready: result.ready,
      reason: result.reason, entries: result.entries.map(({name,sizeBytes,crc32})=>({name,sizeBytes,crc32})) };
  }

  public getFileRead(path: string): SimulationFileRead {
    return { revision: this.revision, file: path ? this.vfs.readFileForDisplay(path) ?? null : null };
  }

  /** The desktop app ecosystem reads only Hardware, OS and Software owners. */
  /** One immutable preflight against canonical VFS and completed download provenance. */
  public getInstallerRead(filePath: string): SimulationInstallerRead {
    const reply = (reason: string | null, softwareId: string | null = null,
      preview: SimulationInstallerRead['preview'] = null): SimulationInstallerRead => ({
      revision: this.revision, filePath, softwareId, ready: reason === null, reason, preview,
    });
    if (typeof filePath !== 'string' ||
      !/^C:\/Downloads\/[a-z0-9._-]{1,80}\.exe$/i.test(filePath)) {
      return reply('Installer must be an executable in C:/Downloads.');
    }
    const name = filePath.slice('C:/Downloads/'.length);
    const softwareId = INSTALLER_SOFTWARE_IDS[name.toLowerCase()];
    if (!softwareId) return reply('This is not an authored software installer.');
    const file = this.vfs.readFile(filePath);
    if (!file || file.kind !== 'installer') {
      return reply('Completed installer file is not present in Downloads.', softwareId);
    }
    // Proof is a specific owner-created transfer, not a matching filename
    // in the bounded recent-download UI page (which may have rolled off).
    const receipt = file.metadata?.downloadTaskId;
    const transfer = typeof receipt === 'string' ? this.downloads.getTask(receipt) : undefined;
    if (!transfer || transfer.status !== 'complete' ||
      transfer.targetDirectory !== 'C:/Downloads' || transfer.fileKind !== 'installer' ||
      transfer.fileName !== name || transfer.sourceUrl !== 'http://downloadhub.local/files/' + name ||
      transfer.totalBytes !== file.sizeBytes || file.metadata?.author !== transfer.sourceId) {
      return reply('No matching completed DownloadHub transfer owns this file.', softwareId);
    }
    const published = DOWNLOAD_CATALOG.find(item =>
      item.id === transfer.sourceId &&
      item.downloadUrl === transfer.sourceUrl &&
      item.fileSizeBytes === transfer.totalBytes);
    if (!published) {
      return reply('Download does not match the published authored software package.', softwareId);
    }
    try {
      return reply(null, softwareId, this.software.previewInstaller(softwareId));
    } catch (cause) {
      return reply(cause instanceof Error ? cause.message : 'Installer preview unavailable.', softwareId);
    }
  }

  public getAppRead(): SimulationAppRead {
    return {
      revision: this.revision,
      hardware: this.hardware.getState(),
      computer: this.hardware.getComputerBootStatus(),
      os: this.os.getState(),
      installedSoftware: this.software.getInstalledSoftware(),
      downloads: this.downloads.getRecentTasks(256),
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
      worldEvents: this.world.getTriggeredEventsForIds(eventIds),
      photoMemories: this.social.getCoreMemories(actorId).filter(memory => memory.kind === 'shared_photo')
        .slice(-12),
      semantics: playerActor?.actor ?? null,
      influences: playerActor?.influences ?? [],
    };
  }

  /**
   * Player profile and guestbook writes are canonical MyPlace owner mutations.
   * Keep UI events and owner changes in one revision; never rely on a React
   * local redraw to hide an unannounced simulation change.
   */
  public updateMyPlaceProfile(patch: Partial<MyPlaceProfile>): boolean {
    return this.publishOwnerMutation(['myplace'],
      () => this.myplace.updateUserProfile(patch), changed => changed);
  }

  public postMyPlaceComment(username: string, text: string): boolean {
    return this.publishOwnerMutation(['myplace'],
      () => this.myplace.addGuestbookComment(
        username, this.myplace.getUserProfile().username, text, this.clock.getTotalMinutes(),
      ), changed => changed);
  }

  /** Apply the site upgrade and its world news in one atomic boundary. */
  public updateMyPlaceRelease(targetId: string): ReturnType<typeof this.myplace.updateTo> {
    return this.publishOwnerMutation(['myplace', 'world'], () => {
      const day = this.clock.getTime().day;
      const minute = this.clock.getTotalMinutes();
      const result = this.myplace.updateTo(targetId, day, minute);
      if (result.success && result.release) {
        const target = result.release;
        this.world.injectProceduralEvents([{
          id: `myplace_${target.version}`.replace(/[^a-z0-9_]/g, '_'),
          title: target.displayName,
          description: target.changelog.join(' • '),
          category: 'site_launch',
          triggerDay: day,
          knowledgePrompt: `${target.displayName} is live — ${target.blurb}`,
          siteUrl: 'http://myplace.local/',
        }]);
      }
      return result;
    }, result => result.success);
  }

  /** Read only the page currently displayed by the real MyPlace site. */
  /** Offline preview from the canonical Worker world. No world mutation,
   * AI/network access, or main-thread snapshot is needed. */
  public previewLabProceduralEvents(options: DirectorGenerateOptions):
    ReturnType<ProceduralDirector['generateNextBatch']> {
    return new ProceduralDirector(this.world).generateNextBatch(
      this.clock.getTime().day, this.clock.getTotalMinutes(),
      { ...options, useAI: false, inject: false },
    );
  }

  /**
   * AI Lab stages its asynchronous world batch before writing the owner.
   * Generation never leaks a stale response across a loaded save, and
   * duplicate/invalid event IDs cannot fabricate a revision.
   */
  public async generateProceduralEvents(options: DirectorGenerateOptions = {}):
    Promise<Awaited<ReturnType<ProceduralDirector['generateNextBatch']>>> {
    const epoch = this.snapshotEpoch;
    const generated = await new ProceduralDirector(this.world).generateNextBatch(
      this.clock.getTime().day, this.clock.getTotalMinutes(), { ...options, inject: false },
    );
    if (epoch !== this.snapshotEpoch) {
      return { ...generated, events: [], injectedIds: [] };
    }
    const injectedIds = this.commitLabProceduralEvents(generated.events);
    const accepted = new Set(injectedIds);
    return {
      ...generated,
      injectedIds,
      events: generated.events.filter(event => accepted.has(event.id)),
    };
  }

  /** A manually previewed or AI-generated batch is an idempotent source write. */
  public commitLabProceduralEvents(
    events: Parameters<typeof this.world.injectProceduralEvents>[0],
  ): string[] {
    return this.publishOwnerMutation(['world'],
      () => this.world.injectProceduralEvents(events), ids => ids.length > 0);
  }

  /**
   * Offline OS Lab preview is a pure, deterministic view over the canonical
   * world day. Never choose an OS build with RNG or register at preview time.
   * Lab IDs are namespaced by seed/day/family so old authored release IDs
   * (for example Orion_6.1) cannot be overwritten by a generated variant.
   */
  public previewOfflineLabOsRelease(seed: string, family: OsFamily): OsRelease {
    const day = this.clock.getTime().day;
    const template = pickOsTemplate(seed, family, day);
    const release = templateToRelease(template, day + 2);
    const input = `${seed}:${family}:${day}:${template.version}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash = Math.imul(hash ^ input.charCodeAt(i), 16777619) >>> 0;
    }
    release.id = `${release.id}_lab_${hash.toString(36)}` as OsRelease['id'];
    release.isProcedural = true;
    return release;
  }

  /**
   * Derive an offline newcomer entirely from Worker-owned social truth.
   * Preview never registers an actor or sends a message. A later inject must
   * recompute after its revision precondition; no client-supplied actor bodies.
   */
  public async previewOfflineLabNewcomer(
    seed: string,
    metVia: Extract<BuddyMetVia, 'nightboard' | 'myplace' | 'pulse-room' | 'work'>,
    archetype?: CharacterArchetype,
  ): Promise<NewcomerResult> {
    const buddies = this.social.getBuddies();
    return generateNewcomer({
      seed, metVia, archetype, day: this.clock.getTime().day, useAI: false,
    }, {
      existingIds: buddies.map(actor => actor.id),
      existingHandles: buddies.map(actor => actor.handle),
    });
  }

  /** Lab registration and the matching world announcement are one commit. */
  public registerLabOsRelease(release: OsRelease): OsRelease {
    return this.publishOwnerMutation(['os', 'world'], () => {
      const added = this.os.registerProceduralRelease(release);
      this.world.injectProceduralEvents([{
        id: `os_${release.id}`.replace(/[^a-z0-9_]/g, '_'),
        title: release.displayName,
        description: release.changelog.join(' • '),
        category: 'os_release',
        triggerDay: release.releaseDay,
        knowledgePrompt: `${release.displayName} is out — ${release.blurb ?? ''} Needs ${release.requirements.minRamMB}MB RAM.`,
        siteUrl: 'http://orionsoft.local/',
      }]);
      return added;
    });
  }

  public getMyPlacePageRead(requestedUsername = ''): SimulationMyPlacePageRead {
    const userProfile = this.myplace.getUserProfile();
    const username = requestedUsername || userProfile.username;
    const candidate = username === userProfile.username ? userProfile : this.myplace.getNpcProfile(username) ?? null;
    const locked = !!candidate && username !== userProfile.username
      && candidate.visibility === 'friendsOnly'
      && !candidate.top8.some(friend => friend.handle === userProfile.username);
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      currentMyPlaceId: this.myplace.getCurrentMyPlaceId(),
      locked,
      userProfile,
      profile: locked && candidate
        ? {
            username: candidate.username,
            displayName: candidate.displayName,
            headline: '',
            bio: '',
            interests: [],
            songTitle: '',
            avatarGlyph: '👤',
            top8: [],
            glitterIntensity: 0,
            visibility: 'friendsOnly',
          }
        : candidate,
      guestbook: locked ? [] : this.myplace.getGuestbook(username),
    };
  }

  /**
   * Public NightBoard authored threads: the UI receives only this/previous
   * week's displayed posts, not every Social identity and affinity pair.
   */
  public getNightBoardRead(): SimulationNightBoardRead {
    const day = this.clock.getTime().day;
    const buddies = this.social.getNightBoardAuthorsRead(500);
    const affinity = (a: string, b: string): number => this.social.getAffinity(a, b);
    const titles = this.world.getPublicWebsiteFeed(256).triggeredEvents.map(event => event.title);
    const week = npcThreadWeek(day);
    const weeks = [week - 1, week].filter(value => value >= 0);
    const threads = weeks.flatMap(value =>
      buildWeeklyNpcThreads(value * 7 + 1, buddies, affinity, titles));
    for (const value of weeks) {
      const wx = buildWeeklyWeatherThread(value * 7 + 1, buddies, getWeatherForDay, gameDayName, affinity);
      if (wx) threads.push(wx);
    }
    return { revision: this.revision, threads };
  }

  public getWebsiteRead(): SimulationWebsiteRead {
    const feed = this.world.getPublicWebsiteFeed(256);
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      cash: this.economy.getCash(),
      narrativeFlags: this.world.getPublicFlags(),
      world: { triggeredEvents: feed.triggeredEvents },
      pendingEventCount: feed.pendingEventCount,
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
    const osVersion = this.os.getCurrentOsId();
    const slots = this.hardware.getRamSlotSummary();
    const ownedRamItems = this.inventory.getLooseRamItems(32);
    const desktopFiles = this.vfs.listDirectoryMetadata('C:/Desktop', 256).map(
      ({ id, name, path, parentPath, kind, appAssociation }) => ({
        id, name, path, parentPath, kind, appAssociation,
      }),
    );
    return {
      revision: this.revision,
      osVersion,
      pcBootState: resolvePcBootStateFromOwnerStatus(
        this.hardware.getComputerBootStatus(),
        osVersion,
        () => this.inventory.hasUnassembledComputerItems(),
      ),
      monitor: this.hardware.getDisplayState().monitor,
      bootMediaItems: this.inventory.getBootMediaItems(256),
      ownedRamItems,
      ramSlotsUsed: slots.used,
      ramSlotCapacity: slots.capacity,
      osInstallation: this.os.getInstallProgress(),
      desktopFiles,
      installedApps: this.software.getInstalledSoftware().slice(0, 64).map(
        ({ appId, name, version }) => ({ appId, name, version }),
      ),
    };
  }

  /** The installed-program picker is a separate, capped owner projection.
   * Never send hardware, downloads or the software registry graph to the UI.
   */
  public getInstalledProgramsRead(): SimulationInstalledProgramsRead {
    return {
      revision: this.revision,
      programs: this.software.getInstalledSoftware().slice(0, 64).map(program => ({
        id: program.id,
        appId: program.appId,
        name: program.name,
        version: program.version,
        installedBytes: program.installedBytes,
        isPortable: program.isPortable,
        isAdware: program.isAdware,
        installPath: program.installPath,
      })),
    };
  }

  /** Desktop chrome and Pulse tray use only domain-scoped, serializable reads. */
  public getChromeRead(): SimulationChromeRead {
    const network = this.hardware.getNetworkSummary();
    const unread = this.social.getUnreadTraySummary(4, true);
    return {
      revision: this.revision,
      time: { ...this.clock.getTime() },
      osVersion: this.os.getCurrentOsId(),
      pulseVersion: this.pulse.getState().currentPulseId,
      pulseInstalled: this.software.hasInstalledAppIdContaining('pulse'),
      connectionType: network.connectionType,
      connectionSpeedKbps: network.connectionSpeedKbps,
      activeDownloadCount: this.downloads.getActiveDownloadCount(),
      unreadCount: unread.unreadCount,
      unreadPreviews: unread.previews,
    };
  }

  /** Mailbox only needs the most recent player-known NPC letters and parcel
   * receipts; day-loop / roster walks never execute in the React render.
   */
  public getMailboxRead(): SimulationMailboxRead {
    const today = this.clock.getTime().day;
    const buddies = this.social.getKnownMailboxBuddies();
    const knownIds = new Set(buddies.map(buddy => buddy.id));
    const mailContext = {
      buddies: buddies.map(buddy => ({
        id: buddy.id,
        displayName: buddy.displayName,
        handle: buddy.handle,
        archetype: buddy.archetype,
        stage: buddy.stage,
        status: buddy.status,
      })),
      sharps: buddies.map(buddy => {
        const state = this.world.getFlag(`sharp_${buddy.id}`);
        const stateDay = this.world.getFlag(`sharp_${buddy.id}_day`);
        return {
          buddyId: buddy.id,
          state: typeof state === 'string' ? state : '',
          stateDay: typeof stateDay === 'number' ? stateDay : 0,
        };
      }),
      meetings: this.world.getAppointments()
        .filter(appointment => knownIds.has(appointment.characterId))
        .map(appointment => ({
          buddyId: appointment.characterId,
          targetDay: appointment.targetDay,
          status: appointment.status,
          npcShowed: appointment.npcShowed,
          playerShowed: appointment.playerShowed,
          locationLabel: locationLabel(appointment.locationId),
        })),
    };
    const npcMails = buildRecentNpcMail(mailContext, today, 10);
    const landlordId = buddies.find(buddy =>
      buddy.roles?.includes('landlord') && buddy.status !== 'gone' && buddy.status !== 'blocked',
    )?.id;
    // Rent notices survive payment and retain their existing mailbox priority.
    for (const rent of buildRentMailHistory(this.world.getFlags(), landlordId)) {
      if (!npcMails.some(mail => mail.key === rent.key)) npcMails.push(rent);
    }

    return {
      revision: this.revision,
      npcMails: npcMails.slice(-12),
      orders: this.delivery.getMailboxReceiptRead(),
    };
  }

  public getPresenceRead(): SimulationPresenceRead {
    // A player's Pulse presence feed may not reveal unknown NPC identities or
    // away text; internal Social owner state remains intact for simulation.
    return { revision: this.revision, presence: this.social.getPresenceSummary(true) };
  }

  /** One authoritative read receipt; rejected/duplicate opens stay silent. */
  /**
   * Commit a real Pulse room turn to the canonical NPC affinity graph.
   * A room may touch many symmetric pairs (plus directed address bonuses);
   * the room must publish one social revision only if at least one owner cap
   * or affinity changed. Keep SocialEngine's original daily cap/rules intact.
   */
  public commitPulseRoomTurn(
    responderIds: string[],
    day: number,
    points: number,
    directedPairs: ReadonlyArray<readonly [string, string]> = [],
  ): number {
    return this.publishOwnerMutation(['social'], () => {
      // Match the actual room rule: a solo responder has no group affinity.
      if (responderIds.length < 2) return 0;
      let bumped = this.social.bumpRoomAffinity(responderIds, day, points);
      for (const [from, to] of directedPairs) {
        bumped += this.social.bumpRoomAffinity([from, to], day, 1);
      }
      return bumped;
    }, bumped => bumped > 0);
  }

  /**
   * Pulse presence is a canonical Social owner write, not a UI redraw.
   * Identical presets and repeated Clear requests never publish revisions.
   */
  public setPlayerPresence(presence: BuddyPresence): boolean {
    const current = this.social.getPresence('player');
    if (current?.status === presence.status &&
      current.awayMessage === presence.awayMessage &&
      current.customAwayMessage === presence.customAwayMessage) return false;
    return this.publishOwnerMutation(['social'], () => {
      this.social.setPlayerPresence(presence);
      return true;
    });
  }

  /**
   * Shared Pulse/Cafe text rules produce semantic ledger intents. Commit the
   * canonical promises in one owner boundary; the UI never mutates Social
   * directly after its already-published outbound message.
   */
  public commitPulseChatLedger(
    buddyId: string,
    promises: Array<{ text: string; dueDayOffset?: number }>,
    completed: boolean,
    day: number,
  ): boolean {
    return this.publishOwnerMutation(['social'], () => {
      let changed = false;
      for (const intent of promises) {
        const dueDay = intent.dueDayOffset !== undefined ? day + intent.dueDayOffset : undefined;
        if (this.social.addPromise(buddyId, intent.text, day, dueDay)) changed = true;
      }
      if (completed) {
        const first = this.social.getOpenPromises(buddyId)[0];
        if (first && this.social.resolvePromise(buddyId, first.id, true, day)) changed = true;
      }
      return changed;
    }, changed => changed);
  }

  public markConversationAsRead(actorId: string, accountId?: string): boolean {
    if (!this.social.isKnown(actorId) || (accountId && !this.social.hasPulseBuddy(accountId, actorId))) return false;
    return this.publishOwnerMutation(
      ['social'],
      () => this.social.markAsRead(actorId, accountId),
      changed => changed,
    );
  }

  /**
   * One bounded player-facing Pulse buddy list. Only learned identities,
   * authored recall suggestions and numeric public-room totals leave Social.
   * Static room membership rules are an explicit argument; the engine never
   * imports or owns the React site's room catalog.
   */
  public getPulseContactsRead(
    rooms: ReadonlyArray<{
      id: string;
      participantIds: readonly string[];
      participantRoles: readonly string[];
    }> = [],
  ): SimulationPulseContactsRead {
    return { revision: this.revision, ...this.social.getPulseDirectoryRead(rooms) };
  }

  /** Accounts are real save-owned digital identities, not browser-local buddy filters. */
  public openPulseAccount(accountId: string): boolean {
    return this.publishOwnerMutation(['social'], () => this.social.openPulseAccount(accountId), changed => changed);
  }

  public addPulseBuddy(accountId: string, actorId: string): boolean {
    return this.publishOwnerMutation(['social'], () => this.social.addPulseBuddy(accountId, actorId), changed => changed);
  }

  public getMessengerRead(maxContacts = 32, accountId?: string): SimulationMessengerRead {
    const contacts = this.social.getMessengerSummary(maxContacts, accountId);
    return {
      revision: this.revision,
      contacts,
      unreadCounts: accountId
        ? Object.fromEntries(contacts.map(contact => [contact.actorId, contact.unread]))
        : this.social.getConversationUnreadCounts(500, true),
      availableBuddies: accountId ? this.social.getAvailablePulseBuddies(accountId) : [],
    };
  }

  /**
   * Worker-only offline-safe Pulse fallback. Player sends already pass through
   * the canonical Social gate; this is called only after a successful send.
   * No fake React transcript, private actor data or second Social authority.
   * Human/AI conversation quality remains a separate #223 acceptance task.
   */
  public replyToWorkerPulseMessage(buddyId: string, playerText: string): boolean {
    const actor = this.getPlayerActorRead(buddyId)?.actor;
    if (!actor?.canChatNow.allowed) return false;
    const buddy = this.social.getBuddy(buddyId);
    if (!buddy) return false;
    const written = playerText.trim().toLowerCase();
    const voice = buddy.archetype ?? 'regular';
    const seed = `${buddyId}:${this.clock.getTotalMinutes()}:${this.social.getConversationPage(buddyId, 0, 1).total}`;
    let lines: string[];
    if (/\b(hi|hey|hello|yo|sup)\b/.test(written)) {
      lines = voice === 'student' ? ['heyyy! how has your day been?', 'oh hi!! what are you up to?']
        : voice === 'trader' ? ['hey. what is on your mind?', 'hey, just checking in. what is up?']
        : ['hey :) how has your day been?', 'oh hi! anything interesting going on?'];
    } else if (/\b(how are you|how's it going|you okay)\b/.test(written)) {
      lines = ['a little tired, but glad to see your message. what about you?', 'been a long day lol. how are things with you?'];
    } else if (written.includes('?')) {
      lines = voice === 'nightowl'
        ? ["not totally sure. i might look into it tonight.", "that's a good question. give me a minute to think."]
        : voice === 'trader'
          ? ["i'd need to check before saying for sure.", "not sure yet. what's your take?"]
          : ["hmm, i'm not sure yet. what do you think?", "i'm curious too. tell me more?"];
    } else {
      lines = voice === 'student'
        ? ['omg really? tell me more!', 'lol i know what you mean. what happened next?']
        : voice === 'artist'
          ? ["i can picture that, actually. what was it like?", "that's interesting. i've been thinking about something similar."]
          : voice === 'trader'
            ? ['interesting. what happened after that?', 'got it. tell me more.']
            : voice === 'nightowl'
              ? ['huh. that gives me something to think about.', 'i hear you. tell me a bit more?']
              : ["yeah, i get what you mean. what happened next?", "i'm listening. tell me more?"];
    }
    let hash = 2166136261;
    for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    const text = lines[hash % lines.length]!;
    return this.dispatchAction({
      type: 'SOCIAL_RECEIVE_MESSAGE', buddyId, text,
      tags: ['worker_pulse', 'offline_template'],
    }).success;
  }

  public getConversationRead(actorId: string, offset = 0, limit = 30, accountId?: string): SimulationConversationRead {
    // An arbitrary/guessed actor ID is NOT authorization to read their
    // transcript. Source-owned learned handles are the Pulse discovery gate.
    // Keep full canonical histories for future contact unlock and Save Log.
    if (!this.social.isKnown(actorId) || (accountId && !this.social.hasPulseBuddy(accountId, actorId))) {
      return { revision: this.revision, conversationId: actorId, messages: [], total: 0, hasOlder: false };
    }
    return { revision: this.revision, ...this.social.getConversationPage(actorId, offset, limit, accountId) };
  }

  /** Async cold pages pass through the SAME player-known contact gate. */
  public async getConversationReadAsync(actorId: string, offset = 0, limit = 30, accountId?: string): Promise<SimulationConversationRead> {
    if (!this.social.isKnown(actorId) || (accountId && !this.social.hasPulseBuddy(accountId, actorId))) {
      return { revision: this.revision, conversationId: actorId, messages: [], total: 0, hasOlder: false };
    }
    const revision = this.revision;
    const page = await this.social.getConversationPageAsync(actorId, offset, limit, accountId);
    // Never publish a stale after-await view if contact access or world changes.
    if (revision !== this.revision || !this.social.isKnown(actorId)
      || (accountId && !this.social.hasPulseBuddy(accountId, actorId))) {
      throw new Error('Conversation changed during cold read');
    }
    return { revision, ...page };
  }

  /** Explicit user-initiated complete Save Log export; never let a guessed
   * contact ID bypass the player-known gate or an await race disclose it. */
  public async getConversationLogAsync(actorId: string): Promise<MessageRecord[]> {
    if (!this.social.isKnown(actorId)) return [];
    const revision = this.revision;
    const messages = await this.social.getMessagesAsync(actorId);
    if (revision !== this.revision || !this.social.isKnown(actorId)) {
      throw new Error('Conversation changed during log export');
    }
    return messages;
  }

  /**
   * Atomically commit an auto-discovered newcomer, its MyPlace stub and
   * public world trace. Rejected duplicates must not synthesize revisions.
   */
  public commitAutoDiscoveredNewcomer(
    buddy: CharacterDefinition, introText: string, metVia: BuddyMetVia, day: number,
  ): boolean {
    return this.publishOwnerMutation(['social', 'world', 'myplace'], () => {
      if (this.social.getBuddy(buddy.id)) return false;
      const result = this.core.dispatchAction({
        type: 'SOCIAL_ADD_BUDDY', buddy, introText,
      });
      if (!result.success) return false;
      if (metVia === 'nightboard') {
        try {
          this.world.injectProceduralEvents([{
            id: `met_${buddy.id}`.replace(/[^a-z0-9_]/g, '_').slice(0, 40),
            title: `New voice on NightBoard: ${buddy.displayName}`,
            description: `${buddy.displayName} (${buddy.handle}) showed up asking about the canal hum thread.`,
            category: 'city_news',
            triggerDay: day,
            triggerHour: 22,
            knowledgePrompt: `A newcomer (${buddy.displayName}) appeared on NightBoard and added you on Pulse.`,
            siteUrl: 'http://nightboard.local/',
          }]);
        } catch { /* Public trace is best-effort; retain the admitted NPC. */ }
      }
      this.world.setFlag('newcomer_last_day', day);
      return true;
    }, committed => committed);
  }

  public subscribe(listener: (state: Readonly<LiveSimulationState>) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => { this.subscribers.delete(listener); };
  }

  public getState(): Readonly<LiveSimulationState> {
    return this.assembleState(this.core.getState());
  }

  private assembleState(coreState: Readonly<TransportSimulationState>): Readonly<LiveSimulationState> {
    return {
      ...coreState,
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

  /** Full history is read explicitly, never on a revision/UI publication.
   * A mutation or load across an await invalidates the complete export.
   */
  public async exportSnapshotAsync(): Promise<LiveSimulationState> {
    const revision = this.revision;
    const epoch = this.snapshotEpoch;
    const conversations = await this.social.exportConversationsAsync();
    if (revision !== this.revision || epoch !== this.snapshotEpoch) {
      throw new Error('Simulation changed during async snapshot export; retry the save');
    }
    const coreState = this.core.getStateForConversationExport(conversations);
    return JSON.parse(JSON.stringify(this.assembleState(coreState))) as LiveSimulationState;
  }

  /** Only rebind a cold prefix when its *originating* slot was overwritten. */
  public rebindColdConversationReader(
    slotId: string, reader: (id: string, pageIndex: number) => Promise<import('../types').MessageRecord[] | null>,
  ): void {
    this.social.rebindColdConversations(slotId, reader);
  }

  public loadSnapshot(snapshot: TransportSimulationState): void {
    this.snapshotEpoch++;
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
    // A cancelled meeting returns null despite changing canonical World and
    // Social truth. Detect actual appointment updates, not just the return
    // value, and publish the single source-backed boundary for both paths.
    const before = JSON.stringify(this.world.getAppointments());
    return this.publishOwnerMutation(['world', 'social', 'player'],
      () => this.core.handleMeetupChat(...args),
      () => before !== JSON.stringify(this.world.getAppointments()));
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

  /** Legacy store shape delegates to the same canonical commit path. */
  public async generateProceduralEventsNow(
    options?: { maxEvents?: number; useAI?: boolean },
  ): Promise<import('../types').GlobalEvent[]> {
    const batch = await this.generateProceduralEvents(options);
    return batch.events;
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

  /**
   * Change physical scope only. Identity, relationships, memories, handles and
   * conversations stay untouched; becoming remote also evicts every local
   * trip, settled place and XYZ position from the movement owner.
   */
  public setActorReach(actorId: string, reach: 'local' | 'remote'): ActionResult<BuddyCharacter> {
    const current = this.social.getBuddy(actorId);
    if (!current) return { success: false, error: `Buddy not found: ${actorId}` };
    const currentReach = current.reach === 'remote' ? 'remote' : 'local';
    if (currentReach === reach) return { success: true, data: current };
    try {
      const updated = this.publishOwnerMutation(['social', 'transit'], () => {
        const next = this.social.setBuddyReach(actorId, reach);
        if (!next) throw new Error(`Buddy not found: ${actorId}`);
        if (reach === 'remote') {
          this.npc.movement.clearActorLocalPresence(next.id);
          // Venue role records stay venue-owned; service checks already see an
          // unknown local place, so they are inert until normal venue cleanup.
        }
        return next;
      });
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
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

  public startOsInstall(...args: Parameters<NpcComputerSimulationRuntime['startOsInstall']>): ReturnType<NpcComputerSimulationRuntime['startOsInstall']> {
    return this.publishComputerMutation(() => this.npc.startOsInstall(...args));
  }

  public advanceOsInstall(): ReturnType<NpcComputerSimulationRuntime['advanceOsInstall']> {
    return this.publishComputerMutation(() => this.npc.advanceOsInstall());
  }

  public cancelOsInstall(): ReturnType<NpcComputerSimulationRuntime['cancelOsInstall']> {
    return this.publishComputerMutation(() => this.npc.cancelOsInstall());
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
