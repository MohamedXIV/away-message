import {
  SimulationState,
  SimulationAction,
  ActionResult,
  Appointment,
} from '../types';
import { GameClock } from '../GameClock';
import { EventBus } from '../EventBus';
import { EconomyEngine } from '../EconomyEngine';
import { PlayerNeedsEngine } from '../PlayerNeedsEngine';
import { HardwareEngine } from '../HardwareEngine';
import { FileSystemEngine } from '../FileSystemEngine';
import { DownloadManager } from '../DownloadManager';
import {
  DeliveryEngine,
  type Fulfillment,
  type PlaceDeliveryOptions,
} from '../DeliveryEngine';
import { SoftwareRegistry } from '../SoftwareRegistry';
import { SocialEngine } from '../SocialEngine';
import { TelemetryEngine } from '../TelemetryEngine';
import { WorldEventsEngine } from '../WorldEventsEngine';
import { EnvironmentEngine } from '../EnvironmentEngine';
import { MoodEngine } from '../MoodEngine';
import type { GameContextReadApi } from '../GameContext';

import { OsEngine } from '../OsEngine';
import { PulseEngine } from '../PulseEngine';
import { MyPlaceEngine } from '../MyPlaceEngine';






import { pulseHasFeature, getAllPulseReleases } from '../PulseCatalog';

import { createCoreDomainOwners, type CoreDomainOwners } from './CoreDomainOwners';
import { TimeAdvancement } from './TimeAdvancement';
import { projectCoreState } from './CoreStateProjection';
import { JobBoardCoordination } from './JobBoardCoordination';
import { GroceryDeliveryCoordination } from './GroceryDeliveryCoordination';
import { MyPlaceSocialCycle } from './MyPlaceSocialCycle';
import { RentCoordination } from './RentCoordination';
import { AppointmentCoordination } from './AppointmentCoordination';
import { SocialPresenceCycle } from './SocialPresenceCycle';
import { RelationshipContinuity } from './RelationshipContinuity';
import { NpcSocialLifeCycle } from './NpcSocialLifeCycle';
import { ProceduralWorldCycle } from './ProceduralWorldCycle';
import type { CharacterDefinition } from '../CharacterEngine';
import type { BuddyMetVia } from '../types';
import { PlayerContactCoordination } from './PlayerContactCoordination';
import { CityActivityCoordination } from './CityActivityCoordination';
import { DesktopStorageCommands } from './DesktopStorageCommands';
import { SocialInteractionCommands } from './SocialInteractionCommands';
import { WorldNarrativeCommands } from './WorldNarrativeCommands';
import { PlayerActionRuntime } from './PlayerActionRuntime';

export interface CoreRuntimePorts {
  dispatchAction(action: SimulationAction): ActionResult;
  advanceGameMinutes(minutes: number, reason?: string): void;
  placeGroceryOrder(items: Array<{ sku: string; qty: number }>, fulfillment: Fulfillment, nowMinute: number): ActionResult;
  publishState(): void;
  commitAutoDiscoveredNewcomer(
    buddy: CharacterDefinition, introText: string, metVia: BuddyMetVia, day: number,
  ): boolean;
}

export class CoreSimulationRuntime {
  public readonly clock!: GameClock;
  public readonly events!: EventBus;
  public readonly economy!: EconomyEngine;
  public readonly needs!: PlayerNeedsEngine;
  public readonly hardware!: HardwareEngine;
  public readonly os!: OsEngine;
  public readonly pulse!: PulseEngine;
  public readonly myplace!: MyPlaceEngine;
  public readonly vfs!: FileSystemEngine;
  public readonly downloads!: DownloadManager;
  public readonly delivery!: DeliveryEngine;
  public readonly software!: SoftwareRegistry;
  public readonly social!: SocialEngine;
  public readonly telemetry!: TelemetryEngine;
  public readonly world!: WorldEventsEngine;
  public readonly environment!: EnvironmentEngine;
  public readonly mood!: MoodEngine;
  public readonly gameContext!: GameContextReadApi;
  private readonly timeAdvancement: TimeAdvancement;
  private readonly coreOwners: CoreDomainOwners;
  private readonly jobBoard: JobBoardCoordination;
  private readonly groceryDelivery: GroceryDeliveryCoordination;
  private readonly myplaceSocial: MyPlaceSocialCycle;
  private readonly rentCoordination: RentCoordination;
  private readonly appointmentCoordination: AppointmentCoordination;
  private readonly socialPresence: SocialPresenceCycle;
  private readonly relationshipContinuity: RelationshipContinuity;
  private readonly npcSocialLife: NpcSocialLifeCycle;
  private readonly proceduralWorld: ProceduralWorldCycle;
  private readonly playerContacts: PlayerContactCoordination;
  private readonly cityActivity: CityActivityCoordination;
  private readonly desktopCommands: DesktopStorageCommands;
  private readonly socialCommands: SocialInteractionCommands;
  private readonly worldCommands: WorldNarrativeCommands;
  private readonly playerActions: PlayerActionRuntime;

  private activeView: 'pc' | 'room' | 'cafe' | 'work' | 'city' = 'room';
  private _cachedState: Readonly<SimulationState> | null = null;
  private _cachedStateVersion = -1;
  private _stateVersion = 0;

  constructor(private readonly ports: CoreRuntimePorts, initialState?: Partial<SimulationState>) {
    // One canonical set of domain owners for the composed production kernel.
    // This runtime is a coordinator, never a second simulation state writer.
    const owners = createCoreDomainOwners(initialState);
    this.coreOwners = owners;
    this.jobBoard = new JobBoardCoordination(owners, () => this.notifySubscribers());
    this.myplaceSocial = new MyPlaceSocialCycle(owners, () => this.notifySubscribers());
    this.rentCoordination = new RentCoordination(owners, () => this.notifySubscribers());
    this.appointmentCoordination = new AppointmentCoordination(owners);
    this.socialPresence = new SocialPresenceCycle(owners);
    this.relationshipContinuity = new RelationshipContinuity(owners);
    this.npcSocialLife = new NpcSocialLifeCycle(owners);
    this.proceduralWorld = new ProceduralWorldCycle(
      owners,
      (buddy, introText, metVia, day) =>
        this.ports.commitAutoDiscoveredNewcomer(buddy, introText, metVia, day),
      () => this.notifySubscribers(),
    );
    this.groceryDelivery = new GroceryDeliveryCoordination(
      owners,
      (minutes, reason) => this.ports.advanceGameMinutes(minutes, reason),
      () => this.notifySubscribers(),
    );
    this.events = owners.events;
    this.clock = owners.clock;
    this.needs = owners.needs;
    this.economy = owners.economy;
    this.hardware = owners.hardware;
    this.vfs = owners.vfs;
    this.world = owners.world;
    this.environment = owners.environment;
    this.mood = owners.mood;
    this.gameContext = owners.gameContext;
    this.os = owners.os;
    this.pulse = owners.pulse;
    this.myplace = owners.myplace;
    this.downloads = owners.downloads;
    this.delivery = owners.delivery;
    this.software = owners.software;
    this.social = owners.social;
    this.telemetry = owners.telemetry;

    this.activeView = initialState?.activeView
      ?? (this.hardware.getState().hasComputer ? 'pc' : 'room');
    this.timeAdvancement = new TimeAdvancement(owners, {
      currentView: () => this.activeView,
      processDeliveries: () => this.processDeliveries(),
      processJobReplies: () => this.processJobReplies(),
      sweepBusyLeaveLines: (atMinute) => this.socialPresence.sweepBusyLeaveLines(atMinute),
      scheduleDailyProfileUpdate: (mode, day, atMinute) =>
        this.myplaceSocial.scheduleDailyProfileUpdate(mode, day, atMinute),
      processNewDay: (day) => this.proceduralWorld.processNewDay(day),
      publishState: () => this.notifySubscribers(),
    });
    this.playerContacts = new PlayerContactCoordination(
      owners,
      (action) => this.ports.dispatchAction(action),
      () => this.notifySubscribers(),
    );
    this.cityActivity = new CityActivityCoordination(
      owners,
      (minutes, reason) => this.ports.advanceGameMinutes(minutes, reason),
      () => this.notifySubscribers(),
    );
    this.desktopCommands = new DesktopStorageCommands(owners, () => this.notifySubscribers());
    this.socialCommands = new SocialInteractionCommands(
      owners, this.playerContacts, this.relationshipContinuity,
      () => this.notifySubscribers(),
    );
    this.worldCommands = new WorldNarrativeCommands(owners, () => this.notifySubscribers());
    this.playerActions = new PlayerActionRuntime(owners, {
      desktopCommands: this.desktopCommands,
      socialCommands: this.socialCommands,
      worldCommands: this.worldCommands,
      rentCoordination: this.rentCoordination,
      jobBoard: this.jobBoard,
      cityActivity: this.cityActivity,
    }, {
      getActiveView: () => this.activeView,
      setActiveView: (view) => { this.activeView = view; },
      advanceGameMinutes: (minutes, reason) => this.ports.advanceGameMinutes(minutes, reason),
      notifySubscribers: () => this.notifySubscribers(),
      processDeliveries: () => this.processDeliveries(),
      processJobReplies: () => this.processJobReplies(),
      placeGroceryOrder: (items, fulfillment, minute) => this.ports.placeGroceryOrder(items, fulfillment, minute),
    });
    this.registerInternalEventHandlers();
  }

  private registerInternalEventHandlers(): void {
    this.events.on('mood:changed', () => {
      this._stateVersion++;
      this._cachedState = null;
    });

    this.events.on('time:day_changed', ({ newDay }) => {
      this.economy.handleDayTransition(newDay);
      const needsDay = this.needs.handleDayTransition();
      if (needsDay.emergencyFoodNeeded) {
        if (this.economy.spendCash(4, `Late-night chips (too hungry to sleep, Day ${newDay})`)) {
          this.needs.applyEmergencyFoodRelief();
        } else {
          this.needs.applyEmergencyFoodFailure();
        }
      }
      // P3 daily relationship pass: overdue promises + distant returns (rules only, no AI)
      this.relationshipContinuity.processRelationshipDaily(newDay);
      // P5 daily meeting pass: RSVP for tomorrow + resolve the past (rules only, no AI)
      this.processAppointmentsDaily(newDay);
      // P5.4 daily MyPlace life: Top 8 re-rank + guestbook notes and replies (rules only)
      this.myplaceSocial.processDay(newDay);
      // P6.4 daily rent ladder: reminders, warnings, overdue nudges (rules only)
      this.processRentDaily(newDay);
      // Character Lives daily pass: agenda planning, NPC run-ins, romance, mediation asks (rules only)
      this.npcSocialLife.processDay(newDay);
      // Social battery: a quiet yesterday repays solitude (rules only)
      this.socialPresence.processPlayerBatteryDaily(newDay);
    });

    this.events.on('economy:cash_changed', ({ newCash }) => {
      this.telemetry.updateCashBounds(newCash);
    });

    // Unified roster: world attitudes + MyPlace pages follow SocialEngine registrations.
    this.world.setBuddyProvider(() =>
      this.social.getBuddies().map((b) => ({ id: b.id, archetype: b.archetype }))
    );
    // Core buddies never pass through registerBuddy — stub their pages up front
    // (procedural ones are stubbed by the handler below as they arrive).
    for (const buddy of this.social.getBuddies()) this.myplaceSocial.ensureMyPlaceStub(buddy);
    this.events.on('social:buddy_registered', ({ buddy }: any) => {
      try {
        this.world.ensureAttitudesForBuddy(buddy.id, this.clock.getTotalMinutes());
      } catch { /* attitudes are best-effort */ }
      this.myplaceSocial.ensureMyPlaceStub(buddy);
    });

    // Keep PulseEngine in sync when Pulse is installed via SoftwareRegistry
    this.events.on('software:installed' as any, ({ software }: any) => {
      if (software?.appId === 'app.pulse' || software?.appId === 'app.pulse_messenger' || String(software?.appId).includes('pulse')) {
        const version = String(software.version || '');
        // Try to find a PulseRelease matching this version
        try {
          const all = getAllPulseReleases() as Array<{ id: string; version: string }>;
          const match = all.find((r) => r.version === version) || all.find((r) => r.id.includes(version.replace('.', '_')));
          if (match) {
            this.pulse.syncInstalledVersion(match.version);
          }
        } catch {}
      }
    });

    // Invalidate state cache and notify subscribers when hardware or power changes
    this.events.on('hardware:upgraded' as any, () => {
      this.notifySubscribers();
    });
    this.events.on('hardware:power_changed' as any, () => {
      this.notifySubscribers();
    });
    this.events.on('hardware:disc_inserted' as any, () => {
      this.notifySubscribers();
    });
    this.events.on('hardware:disc_ejected' as any, () => {
      this.notifySubscribers();
    });
    this.events.on('hardware:os_migrated' as any, () => {
      this.notifySubscribers();
    });
  }

  /** Bounded read for OS/HUD; no whole CoreState projection. */
  public getActiveView(): 'pc' | 'room' | 'cafe' | 'work' | 'city' {
    return this.activeView;
  }

  public getState(): Readonly<SimulationState> {
    // Reads never reconcile/publish derived mood. The write-time publication
    // boundary handles mood expiry/events; queries only project existing truth.
    // Cheap cache: if version hasn't changed, return same object reference to keep getSnapshot stable
    if (this._cachedState && this._cachedStateVersion === this._stateVersion) {
      return this._cachedState;
    }
    const newState = projectCoreState(this.coreOwners, this.activeView);
    this._cachedState = newState;
    this._cachedStateVersion = this._stateVersion;
    return newState;
  }

  /** Authoritative time coordination is delegated to one TimeAdvancement owner. */
  public advanceRealTime(deltaRealSeconds: number): void {
    this.timeAdvancement.advanceRealTime(deltaRealSeconds);
  }

  public advanceGameMinutes(minutes: number, reason?: string): void {
    this.timeAdvancement.advanceGameMinutes(minutes, reason);
  }

  /**
   * Authored MyPlace voice is still part of Social coordination. Keep the
   * original realtime/jump presentation behavior until that owner is
   * replaced; it is never allowed to control the clock or domain scheduling.
   */
  // Governed procedural queue — keeps 2-3 future days filled. Throttled, non-blocking, template fallback if AI unavailable.
  // ==========================================
  // P3 — SHARP RELATIONSHIP EVENTS (governed, rules-only, template-voiced)
  // Ladder for sustained dismissiveness: confrontation → distant (7 days) → gone.
  // Any actor may progress through strained, distant, gone, or blocked lifecycle states.
  // Governor: a single active sharp event at a time (world flag 'sharp_active').
  // ==========================================

  // ==========================================
  // CHARACTER LIVES — daily passes (rules-only, template-voiced)
  // NPCs live their own lives: plans, run-ins, romance, mediations, goodbyes.
  // The player is one character among many — never the center of a pass.
  // One active sharp/strained player event at a time still governs (see above);
  // NPC↔NPC life never triggers sharp events and never touches player dims
  // except through the governed mediation-exposure path.
  // ==========================================

  /** Daily pass fan-out, called from the day_changed handler. Never throws. */
  /**
   * Add a contact by typed handle (rules only). Resolves roster handles and
   * active backstory candidates; dead/changed handles bounce with a note and
   * an immortal memory. Accepted strangers introduce themselves (handle learned
   * both ways); declined strangers stay strangers. Costs 2 battery.
   */
  /** True when the installed Pulse release is the 6.x generation (colors, motion). */
  public isPulse6(): boolean {
    try {
      return pulseHasFeature(this.pulse.getCurrentPulseId(), 'buddy-colors');
    } catch { return false; }
  }

  public getReceptionHint(rawBuddyId: string, day: number): string {
    return this.playerContacts.getReceptionHint(rawBuddyId, day);
  }

  /** Daily battery pass: a quiet yesterday (no player messages) repays solitude. */
  // ==========================================
  // P5 — LIVE MEETINGS (RSVP + show/resolve, rules-only, template-voiced)
  // Appointments emerge from natural chat ("lets meet at the cafe tomorrow").
  // NPCs confirm/decline the day before, then show or flake by rules;
  // outcomes move dims + immortal memories + feed the sharp/gossip machinery.
  // ==========================================

  public handleMeetupChat(
    rawBuddyId: string, text: string, day: number,
  ): Appointment | null {
    return this.appointmentCoordination.handleMeetupChat(rawBuddyId, text, day);
  }

  private processAppointmentsDaily(newDay: number): void {
    this.appointmentCoordination.processAppointmentsDaily(newDay);
  }

  // ==========================================
  // P7 — CITY TRAVEL (location sim: walk/bus, encounters, gating)
  // One-way legs; the map UI chains them. Arrival raises visited_* flags
  // (meetings keep working). Outings/room/work actions gate on location.
  // ==========================================

  /** Where an outing must happen (null = anywhere/legacy). */
  public travelTo(rawTo: unknown, rawMode: unknown, options?: { ignoreFatigue?: boolean }): ActionResult & { data?: { summary: string; encounter?: string; minutes: number; cost: number } } {
    return this.cityActivity.travelTo(rawTo, rawMode, options);
  }

  // ==========================================
  // P6 — JOB BOARD (apply now, hear back in 4–10h, never instant)
  // Acceptance creates a real next-day work appointment (gig wage honored);
  // rejection is a kind Pulse note with zero penalty. State in world flags.
  // ==========================================

  public getJobBoard(): Array<{
    gig: import('../JobDirector').Gig;
    pending: boolean;
    appliedMinute: number;
  }> {
    return this.jobBoard.getJobBoard();
  }

  private processJobReplies(): void {
    this.jobBoard.processJobReplies();
  }

  // ==========================================
  // P6 — CORNERMART ORDERS (pickup trip vs 2–24h courier, rules-only)
  // Pickup: 30-min errand + a little energy, pantry now. Delivery: free but
  // slow (deterministic ETA); completion credits the pantry + notifies.
  // ==========================================

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number,
    deliveryOptions?: PlaceDeliveryOptions,
  ): ActionResult & { data?: { orderId: string; etaMinute: number; summary: string } } {
    return this.groceryDelivery.placeGroceryOrder(
      rawItems, fulfillment, nowMinute, deliveryOptions,
    );
  }

  private processDeliveries(): void {
    this.groceryDelivery.processDeliveries();
  }

  // ==========================================
  // P6.4 — RENT LADDER (role-driven property contact: remind → warn → pause downloads → thanks)
  // Lenient teeth: browsing works, new downloads nap until paid. Paper trail
  // goes to Mailbox via rentmail_* flags; Pulse carries the human voice.
  // ==========================================

  // Rent notes may use an available actor carrying the landlord role.
  // The economy and Mailbox paper trail remain authoritative even when no such
  // actor is currently available, so NPC lifecycle never blocks tenancy.
  private processRentDaily(newDay: number): void {
    this.rentCoordination.processRentDaily(newDay);
  }

  // ==========================================
  // P6.3 — CITY OUTINGS (diner / canal / laundromat, rules-only)
  // Deterministic encounters feed memories + dims + Pulse messages;
  // the laundromat returns a rumor in the action result (UI notice).
  // ==========================================

  public doCityOuting(rawOutingId: string): ActionResult & { data?: { summary: string; encounterBuddyId?: string; rumor?: string } } {
    return this.cityActivity.doCityOuting(rawOutingId);
  }

  // ==========================================
  // P5.4 — MYPLACE SOCIAL LIFE (Top 8 + guestbook, rules-only, template-voiced)
  // Top 8s re-rank from live C2 affinities every 3rd day; entries celebrate.
  // Guestbooks get NPC→NPC notes daily; owners reply to the player's notes.
  // ==========================================

  /**
   * Which profile page belongs to a buddy. Legacy rich profiles win over stubs:
   * profile alias → handle → id, so notes land where players actually look.
   */
  public dispatchAction(action: SimulationAction): ActionResult {
    return this.playerActions.dispatchAction(action);
  }

  public invalidateStateCache(): void {
    this._stateVersion++;
    this._cachedState = null;
  }

  private notifySubscribers(): void {
    this.invalidateStateCache();
    this.ports.publishState();
  }

  public exportSnapshot(): SimulationState {
    // Bypass the getState() reference cache: direct sub-engine mutations
    // (tests, bridge writes) don't bump the version, and saves must be truth.
    this._cachedState = null;
    return JSON.parse(JSON.stringify(this.getState()));
  }

  public loadSnapshot(snapshot: SimulationState): void {
    this.clock.setTotalMinutes(snapshot.time.totalMinutes);
    this.needs.loadState((snapshot as any).needs ?? snapshot.player);
    this.economy.loadState(snapshot.player);
    this.mood.loadState((snapshot as any).mood);
    this.hardware.loadState(snapshot.hardware);
    // OsEngine — load from dedicated os field or fallback to hardware osVersion
    const osSrc = (snapshot as any).os ?? { currentOsId: (snapshot as any).hardware?.osVersion };
    if (osSrc) {
      try { this.os.loadState(osSrc); } catch {}
    }
    // PulseEngine
    const pulseSrc = (snapshot as any).pulse ?? { currentPulseId: 'pulse_5.2' };
    if (pulseSrc) {
      try { this.pulse.loadState(pulseSrc); } catch {}
    }
    // MyPlaceEngine
    const myplaceSrc = (snapshot as any).myplace;
    if (myplaceSrc) {
      try { this.myplace.loadState(myplaceSrc); } catch {}
    }
    // Re-sync procedural OS/MyPlace from world after load (for saves that had world events)
    try {
      const worldSrc = (snapshot as any).world ?? (snapshot as any).narrative;
      if (worldSrc) {
        this.os.syncFromWorldState({ triggeredEvents: worldSrc.triggeredEvents ?? [], pendingEvents: [] } as any, this.clock.getTime().day);
        this.myplace.syncFromWorldState({ triggeredEvents: worldSrc.triggeredEvents ?? [] } as any, this.clock.getTime().day, this.clock.getTotalMinutes());
      }
    } catch {}
    this.vfs.restoreState(snapshot.vfs);
    this.downloads.restoreState({
      tasks: snapshot.downloads,
      maxConcurrentBrowser: 1,
      maxConcurrentFlashFetch: 4,
    });
    this.social.restoreState(snapshot.social);
    this.telemetry.loadState(snapshot.telemetry.stats, snapshot.telemetry.logs);
    const worldSrc = (snapshot as any).world ?? (snapshot as any).narrative;
    if (worldSrc) this.world.loadState(worldSrc);
    this.activeView = snapshot.activeView;
  }
}
