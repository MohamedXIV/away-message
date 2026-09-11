import {
  SimulationState,
  SimulationAction,
  ActionResult,
  Appointment,
} from './types';
import { GameClock } from './GameClock';
import { EventBus } from './EventBus';
import { EconomyEngine } from './EconomyEngine';
import { HardwareEngine } from './HardwareEngine';
import { FileSystemEngine } from './FileSystemEngine';
import { DownloadManager } from './DownloadManager';
import { DeliveryEngine, GROCERY_SKUS, type Fulfillment } from './DeliveryEngine';
import { SoftwareRegistry } from './SoftwareRegistry';
import { SocialEngine } from './SocialEngine';
import { TelemetryEngine } from './TelemetryEngine';
import { WorldEventsEngine } from './WorldEventsEngine';
import { totalDeliveryBacklogExtra } from './WorldModifiers';
import { OsEngine } from './OsEngine';
import { PulseEngine } from './PulseEngine';
import { MyPlaceEngine, CORE_PROFILE_ALIASES } from './MyPlaceEngine';
import { validatePersistedBuddy } from './CharacterEngine';
import { generateNewcomer, shouldAutoDiscover, NEWCOMER_METVIA_ROTATION } from './CharacterDirector';
import { STRAINED_ANNOYANCE, DISTANT_ANNOYANCE, GONE_ANNOYANCE, traitCompatibility } from './SocialEngine';
import { pickConfrontLine, pickFarewellLine, pickReturnLine, pickInitiativeText, pickRsvpLine, pickStoodUpLine, pickMeetingApologyLine, pickShiftWrapLine, pickGigWrapLine, pickArchiveWrapLine, pickGuestbookLine, pickGuestbookReplyLine, pickTop8NewsLine, pickOutingMayaLine, pickOutingNoraLine, pickRentReminderLine, pickRentSternLine, pickRentNudgeLine, pickRentThanksLine, pickJobAcceptLine, pickJobRejectLine, pickLeaveLine, pickMediationAskLine, pickMediationThanks, pickMyplaceUpdateLine, pickContactLine, pickContactBounce, pickBackstoryReintro, pickRuninSpot, pickRuninVerb, classifyScheduleBlock, AGENDA_LABELS, rollSeeded100, pickSeeded, spreadSeed, resolveArchetype } from './characterTemplates';
import { parseMeetupProposal, isMeetupCancelText, decideRsvp, decideNpcShow, appointmentRoll, locationLabel, LOCATION_SLOTS, pickCoopDetail, SHIFT_WAGE } from './AppointmentDirector';
import { getWeatherForDay, isSevereWeather, isWetWeather, shiftWageBonus } from './WeatherEngine';
import { OUTINGS, isValidOutingId, isOutingOpen, outingHoursLabel, mayaDinerEncounter, noraCanalEncounter, buildLaundromatRumor, MIN_OUTING_ENERGY, type OutingId } from './OutingDirector';
import { GIGS, jobRoll, replyDelayMinutes, decideApplication } from './JobDirector';
import {
  classifyPlayerTone,
  receptionForBoldAct,
  receptionHintFor,
  isApology,
  pickInnerVoice,
  batteryCostForOuting,
  BATTERY_LUKEWARM_EXTRA,
  BATTERY_WARM_REFUND,
  BATTERY_WARM_BONUS,
  BATTERY_APOLOGY_REWARD,
  BATTERY_NEW_APPOINTMENT,
} from './PlayerActs';
import { CITY_NODES, isCityNodeId, quoteTravel, walkEnergyCost, rollStreetEncounter, BUS_FARE, type CityNodeId, type TravelMode } from './CityMap';
import { pulseHasFeature, getAllPulseReleases } from './PulseCatalog';
import { CORE_BY_ID, CORE_IDS, buddyWithRole, isRegistryBuddy } from './coreBuddies';

export class SimulationEngine {
  public readonly clock!: GameClock;
  public readonly events!: EventBus;
  public readonly economy!: EconomyEngine;
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

  private activeView: 'pc' | 'room' | 'cafe' | 'work' | 'city' = 'room';
  private subscribers: Set<(state: Readonly<SimulationState>) => void> = new Set();
  private _procGenPending = false;
  private _procGenLastDay = 0;
  private _cachedState: Readonly<SimulationState> | null = null;
  private _cachedStateVersion = -1;
  private _stateVersion = 0;

  constructor(initialState?: Partial<SimulationState>) {
    this.events = new EventBus();
    this.clock = new GameClock({
      initialDay: initialState?.time?.day ?? 1,
      initialHour: initialState?.time?.hour ?? 8,
      initialMinute: initialState?.time?.minute ?? 0,
    });
    this.economy = new EconomyEngine(this.events, initialState?.player);
    this.hardware = new HardwareEngine(this.events, initialState?.hardware);
    this.vfs = new FileSystemEngine(this.events, initialState?.vfs);
    // World before OS so Os can sync from world
    const worldInitial = (initialState as any)?.world ?? (initialState as any)?.narrative;
    this.world = new WorldEventsEngine(this.events, worldInitial);
    // OsEngine is core — sync with hardware osVersion
    const osInitial = (initialState as any)?.os ?? { currentOsId: initialState?.hardware?.osVersion };
    this.os = new OsEngine(this.events, { currentOsId: osInitial.currentOsId ?? initialState?.hardware?.osVersion, ...(osInitial as object) });
    // PulseEngine — mirrors OsEngine for the IM client
    const pulseInitial = (initialState as any)?.pulse ?? { currentPulseId: 'pulse_5.2' };
    this.pulse = new PulseEngine(this.events, pulseInitial);
    // MyPlaceEngine — heavy, versioned like Orion OS
    const myplaceInitial = (initialState as any)?.myplace;
    this.myplace = new MyPlaceEngine(this.events, myplaceInitial);
    // Keep hardware.osVersion in sync with OsEngine (source of truth)
    (this.hardware as any).state.osVersion = this.os.getCurrentOsId();
    // Restore any procedural OS releases that were world-generated (for old saves)
    try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, this.clock.getTime().day); } catch {}
    this.downloads = new DownloadManager(
      {
        eventBus: this.events,
        vfs: this.vfs,
        getConnectionSpeedKbps: () => this.hardware.getState().connectionSpeedKbps,
      },
      initialState?.downloads ? { tasks: initialState.downloads, maxConcurrentBrowser: 1, maxConcurrentFlashFetch: 4 } : undefined
    );
    // P6 CornerMart parcels (persisted order history)
    this.delivery = new DeliveryEngine((initialState as any)?.deliveries);
    this.software = new SoftwareRegistry(
      this.events,
      this.vfs,
      {
        getOsVersion: () => this.os.getCurrentOsId() as any,
        getRamMb: () => this.hardware.getState().ramMB,
        getCpuTier: () => this.hardware.getState().cpuTier,
      },
      initialState?.installedSoftware
    );
    this.social = new SocialEngine(this.events, initialState?.social);
    this.telemetry = new TelemetryEngine(
      this.events,
      initialState?.telemetry?.stats,
      initialState?.telemetry?.logs
    );

    // Rehydrate world events that may have been due before load
    try {
      this.world.checkAndTriggerEvents(this.clock.getTotalMinutes(), this.clock.getTime().day);
      this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, this.clock.getTime().day);
    } catch {}
    this.activeView = initialState?.activeView ?? (this.hardware.getState().hasComputer ? 'pc' : 'room');

    this.registerInternalEventHandlers();
  }

  private registerInternalEventHandlers(): void {
    this.events.on('time:day_changed', ({ newDay }) => {
      this.economy.handleDayTransition(newDay);
      // P3 daily relationship pass: overdue promises + distant returns (rules only, no AI)
      this.processRelationshipDaily(newDay);
      // P5 daily meeting pass: RSVP for tomorrow + resolve the past (rules only, no AI)
      this.processAppointmentsDaily(newDay);
      // P5.4 daily MyPlace life: Top 8 re-rank + guestbook notes and replies (rules only)
      this.refreshTop8Periodic(newDay);
      this.processGuestbookDaily(newDay);
      // P6.4 daily rent ladder: reminders, warnings, overdue nudges (rules only)
      this.processRentDaily(newDay);
      // Character Lives daily pass: agenda planning, NPC run-ins, romance, mediation asks (rules only)
      this.processCharacterLivesDaily(newDay);
      // Social battery: a quiet yesterday repays solitude (rules only)
      this.processPlayerBatteryDaily(newDay);
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
    for (const buddy of this.social.getBuddies()) this.ensureMyPlaceStub(buddy);
    this.events.on('social:buddy_registered', ({ buddy }: any) => {
      try {
        this.world.ensureAttitudesForBuddy(buddy.id, this.clock.getTotalMinutes());
      } catch { /* attitudes are best-effort */ }
      this.ensureMyPlaceStub(buddy);
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
            (this.pulse as any).currentPulseId = match.id;
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

  public getState(): Readonly<SimulationState> {
    // Cheap cache: if version hasn't changed, return same object reference to keep getSnapshot stable
    if (this._cachedState && this._cachedStateVersion === this._stateVersion) {
      return this._cachedState;
    }
    const vfsState = this.vfs.getState();
    const downloadState = this.downloads.getState();
    const deliveryState = this.delivery.getState();
    const worldState = this.world.getState();
    const osState = this.os.getState();
    const pulseState = this.pulse.getState();
    const myplaceState = this.myplace.getState();
    // Sync hardware osVersion to OsEngine truth
    const hwState = this.hardware.getState();
    if ((hwState as any).osVersion !== osState.currentOsId) {
      (this.hardware as any).state.osVersion = osState.currentOsId;
    }

    // Sandbox world state is canonical; narrative is deprecated alias (kept with buddyKnowledge for compat)
    const narrativeAlias = {
      activeBeatId: null as string | null,
      completedBeats: [] as string[],
      flags: { ...worldState.flags },
      appointments: worldState.appointments.map((a) => ({ ...a })),
      windowObservationHistory: [...worldState.windowObservationHistory],
      triggeredEvents: [...worldState.triggeredEvents],
      buddyKnowledge: { ...worldState.buddyKnowledge },
    };

    const newState: Readonly<SimulationState> = {
      version: 1,
      time: this.clock.getTime(),
      player: this.economy.getState(),
      hardware: this.hardware.getState(),
      os: osState,
      pulse: pulseState,
      myplace: myplaceState,
      vfs: vfsState,
      downloads: downloadState.tasks,
      deliveries: deliveryState,
      installedSoftware: this.software.getInstalledSoftware(),
      social: this.social.getState(),
      world: worldState,
      narrative: narrativeAlias,
      telemetry: {
        stats: this.telemetry.getStats(),
        logs: [...this.telemetry.getLogs()],
      },
      activeView: this.activeView,
    };
    this._cachedState = newState;
    this._cachedStateVersion = this._stateVersion;
    return newState;
  }

  public advanceRealTime(deltaRealSeconds: number): void {
    if (deltaRealSeconds <= 0 || this.clock.isPaused()) return;

    this.telemetry.recordPlayTime(deltaRealSeconds, this.activeView);
    const tickResult = this.clock.tickRealTime(deltaRealSeconds);

    if (tickResult.elapsedMinutes > 0) {
      const currentMinutes = this.clock.getTotalMinutes();
      this.downloads.advanceTime(tickResult.elapsedMinutes, currentMinutes);
      this.economy.advanceTime(tickResult.elapsedMinutes); // P6.1 hunger rises with time
      this.processDeliveries(); // P6 courier arrivals
      this.processJobReplies(); // P6 job board replies land here too
      this.social.updatePresence(currentMinutes);
      this.sweepBusyLeaveLines(currentMinutes); // Character Lives polite goodbyes
      this.world.checkAndTriggerEvents(currentMinutes, tickResult.time.day);
      try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, tickResult.time.day); } catch {}
      try { this.myplace.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents() } as any, tickResult.time.day, currentMinutes); } catch {}
      // MyPlace NPCs may change their profile and then message you about it (governed)
      if (tickResult.dayChanged) {
        void this.myplace.maybeUpdateRandomNpcProfile(tickResult.time.day, currentMinutes).then((res) => {
          if (res) {
            const link = `http://myplace.local/${res.username}`;
            // Voice follows the announcer's temperament (rename-proof).
            const announcer = Object.values(CORE_BY_ID).find((b) => b.myplace === res.username);
            const traits = announcer ? this.social.getTraits(announcer.id) : { shyness: 50, discipline: 50 };
            const text = pickMyplaceUpdateLine(traits.shyness, traits.discipline, link);
            try { this.social.sendMessage(res.username, res.username, 'player', text, currentMinutes, false, ['myplace_update']); } catch {}
            this.maybeCoCommentProfileUpdate(res.username, tickResult.time.day, currentMinutes);
            try { this.events.emit('social:message_received' as any, { message: { senderId: res.username, text } }); } catch {}
            this.maybeCoCommentProfileUpdate(res.username, tickResult.time.day, currentMinutes);
          }
        }).catch(() => {});
      }

      this.events.emit('time:tick', {
        time: tickResult.time,
        deltaMinutes: tickResult.elapsedMinutes,
      });

      if (tickResult.dayChanged) {
        const prevDay = tickResult.time.day - 1;
        this.events.emit('time:day_changed', {
          newDay: tickResult.time.day,
          previousDay: prevDay,
          time: tickResult.time,
        });
        this.maybeScheduleProceduralGeneration();
        this.maybeAutoDiscoverNewcomer(tickResult.time.day);
      }

      this.notifySubscribers();
    }
  }

  public advanceGameMinutes(minutes: number, reason?: string): void {
    if (minutes <= 0) return;

    const jumpResult = this.clock.advanceMinutes(minutes);
    const currentMinutes = this.clock.getTotalMinutes();
    this.downloads.advanceTime(minutes, currentMinutes);
    this.economy.advanceTime(minutes); // P6.1 hunger rises with time
    this.processDeliveries(); // P6 courier arrivals
    this.processJobReplies(); // P6 job board replies land here (never instant)
    this.social.updatePresence(currentMinutes);
    this.sweepBusyLeaveLines(currentMinutes); // Character Lives polite goodbyes
    this.world.checkAndTriggerEvents(currentMinutes, jumpResult.newTime.day);
    try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, jumpResult.newTime.day); } catch {}
    try { this.myplace.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents() } as any, jumpResult.newTime.day, currentMinutes); } catch {}
    if (jumpResult.dayChanged) {
      void this.myplace.maybeUpdateRandomNpcProfile(jumpResult.newTime.day, currentMinutes).then((res) => {
        if (res) {
          const link = `http://myplace.local/${res.username}`;
          // Voice follows the announcer's temperament (rename-proof).
          const announcer = Object.values(CORE_BY_ID).find((b) => b.myplace === res.username);
          const traits = announcer ? this.social.getTraits(announcer.id) : { shyness: 50, discipline: 50 };
          const text = pickMyplaceUpdateLine(traits.shyness, traits.discipline, link);
          try { this.social.sendMessage(res.username, res.username, 'player', text, currentMinutes, false, ['myplace_update']); } catch {}
        }
      }).catch(() => {});
    }

    this.events.emit('time:jump', {
      jumpMinutes: minutes,
      time: jumpResult.newTime,
      reason,
    });

    if (jumpResult.dayChanged) {
      this.events.emit('time:day_changed', {
        newDay: jumpResult.newTime.day,
        previousDay: jumpResult.previousTime.day,
        time: jumpResult.newTime,
      });
      this.maybeScheduleProceduralGeneration();
      this.maybeAutoDiscoverNewcomer(jumpResult.newTime.day);
    }

    this.notifySubscribers();
  }

  // Governed procedural queue — keeps 2-3 future days filled. Throttled, non-blocking, template fallback if AI unavailable.
  private maybeScheduleProceduralGeneration(): void {
    const pending = this.world.getPendingEvents().length;
    if (pending >= 3) return;
    const currentDay = this.clock.getTime().day;
    if (this._procGenPending || this._procGenLastDay === currentDay) return;
    this._procGenPending = true;
    this._procGenLastDay = currentDay;
    const totalMinutes = this.clock.getTotalMinutes();
    // Fire-and-forget, never blocks simulation
    import('./ProceduralDirector')
      .then(({ ProceduralDirector }) => {
        const dir = new ProceduralDirector(this.world);
        return dir.generateNextBatch(currentDay, totalMinutes, { maxEvents: 2, useAI: true });
      })
      .catch(() => {})
      .finally(() => {
        this._procGenPending = false;
        // Notify so UI (CityWire) updates pending count
        try { this.notifySubscribers(); } catch {}
      });
  }

  /**
   * Sandbox auto-discovery: every few days a stranger can appear from the net
   * or work, register as a buddy, and say hi. Throttled + deterministic
   * (see shouldAutoDiscover); AI enriches when a key exists, templates otherwise.
   * Fire-and-forget — never blocks the simulation tick.
   */
  private maybeAutoDiscoverNewcomer(day: number): void {
    try {
      const lastRaw = this.world.getFlag('newcomer_last_day');
      const lastDay = typeof lastRaw === 'number' ? lastRaw : 0;
      if (!shouldAutoDiscover(day, lastDay)) return;
      const proceduralCount = this.social.getBuddies().filter((b) => b.isProcedural).length;
      const metVia = NEWCOMER_METVIA_ROTATION[proceduralCount % NEWCOMER_METVIA_ROTATION.length]!;
      const existingIds = this.social.getBuddies().map((b) => b.id);
      void generateNewcomer({ metVia, day, seed: `auto-day-${day}`, useAI: true }, { existingIds })
        .then((res) => {
          const added = this.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: res.definition, introText: res.introText });
          if (!added.success) return;
          // NightBoard meetings leave a public trace → auto thread via existing machinery
          if (metVia === 'nightboard') {
            try {
              this.world.injectProceduralEvents([{
                id: `met_${res.definition.id}`.replace(/[^a-z0-9_]/g, '_').slice(0, 40),
                title: `New voice on NightBoard: ${res.definition.displayName}`,
                description: `${res.definition.displayName} (${res.definition.handle}) showed up asking about the canal hum thread.`,
                category: 'city_news',
                triggerDay: day,
                triggerHour: 22,
                knowledgePrompt: `A newcomer (${res.definition.displayName}) appeared on NightBoard and added you on Pulse.`,
                siteUrl: 'http://nightboard.local/',
              }]);
            } catch { /* trace is best-effort */ }
          }
          this.world.setFlag('newcomer_last_day', day);
          this.notifySubscribers();
        })
        .catch(() => {});
    } catch { /* auto-discovery never breaks the tick */ }
  }

  // ==========================================
  // P3 — SHARP RELATIONSHIP EVENTS (governed, rules-only, template-voiced)
  // Ladder for sustained dismissiveness: confrontation → distant (7 days) → gone.
  // Core 4 are protected: they cap at a strained confrontation, they never leave.
  // Governor: a single active sharp event at a time (world flag 'sharp_active').
  // ==========================================

  private checkSharpRelationship(rawBuddyId: string, currentMinutes: number): void {
    try {
      const buddy = this.social.getBuddy(rawBuddyId);
      if (!buddy) return;
      const buddyId = buddy.id;
      const rels = this.social.getRelationships(buddyId);
      if (!rels) return;
      const day = this.clock.getTime().day;
      const strainedKey = `strained_${buddyId}`;
      const sharpKey = `sharp_${buddyId}`;
      const sharpState = this.world.getFlag(sharpKey);

      // Repair: strained flag set but annoyance cooled well below the line → silent repair
      if (this.world.getFlag(strainedKey) && rels.annoyance < STRAINED_ANNOYANCE - 10) {
        this.world.setFlag(strainedKey, false);
        if (this.world.getFlag('sharp_active') === buddyId) this.world.setFlag('sharp_active', '');
        if (sharpState === 'confronted') this.world.setFlag(sharpKey, '');
        this.telemetry.logEvent('social', 'relationship_repaired', currentMinutes, { buddyId });
        return;
      }
      if (rels.annoyance < STRAINED_ANNOYANCE) return;

      // Confrontation (once per strained episode)
      if (!this.world.getFlag(strainedKey)) {
        const active = this.world.getFlag('sharp_active');
        if (active && active !== buddyId && active !== '') return; // governor: wait your turn
        this.world.setFlag(strainedKey, true);
        this.world.setFlag(sharpKey, 'confronted');
        this.world.setFlag(`${sharpKey}_day`, day);
        if (!active || active === '') this.world.setFlag('sharp_active', buddyId);
        const text = pickConfrontLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp`);
        this.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'confrontation']);
        this.telemetry.logEvent('social', 'relationship_confrontation', currentMinutes, { buddyId, annoyance: rels.annoyance, witnesses: this.shiftWitnessAffinities(buddyId, -4) });
        return;
      }

      // Registry village characters cap at strained — they never walk away
      if (isRegistryBuddy(buddyId)) return;

      if (sharpState === 'confronted' && rels.annoyance >= DISTANT_ANNOYANCE) {
        const active = this.world.getFlag('sharp_active');
        if (active && active !== buddyId && active !== '') return;
        this.social.setBuddyStatus(buddyId, 'distant');
        this.world.setFlag(sharpKey, 'distant');
        this.world.setFlag(`${sharpKey}_day`, day);
        this.world.setFlag(`distant_${buddyId}_until`, day + 7);
        this.world.setFlag('sharp_active', buddyId);
        const text = pickFarewellLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp`);
        this.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'farewell']);
        this.telemetry.logEvent('social', 'buddy_distant', currentMinutes, { buddyId, witnesses: this.shiftWitnessAffinities(buddyId, -10) });
        return;
      }
      if (sharpState === 'distant' && rels.annoyance >= GONE_ANNOYANCE) {
        // Genuinely gone: stays in roster as epitaph (memories kept), presence forced dark
        this.social.setBuddyStatus(buddyId, 'gone');
        this.world.setFlag(sharpKey, 'gone');
        this.world.setFlag(`${sharpKey}_day`, day);
        if (this.world.getFlag('sharp_active') === buddyId) this.world.setFlag('sharp_active', '');
        const text = pickFarewellLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp:gone`);
        this.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'gone']);
        this.telemetry.logEvent('social', 'buddy_gone', currentMinutes, { buddyId, witnesses: this.shiftWitnessAffinities(buddyId, -10) });
      }
    } catch { /* sharp events never break the tick */ }
  }

  /** P3 daily pass: overdue promises break + distant buddies return. Rules only, no AI. */
  private processRelationshipDaily(newDay: number): void {
    const currentMinutes = this.clock.getTotalMinutes();
    try {
      const broken = this.social.checkPromiseDues(newDay);
      for (const { buddyId, promise } of broken) {
        const stage = this.social.getRelationshipStage(buddyId);
        // Only friend+ buddies complain out loud, and only once per day per buddy
        if ((stage === 'friend' || stage === 'close') && !this.world.getFlag(`promise_nag_${buddyId}_${newDay}`)) {
          this.world.setFlag(`promise_nag_${buddyId}_${newDay}`, true);
          const buddy = this.social.getBuddy(buddyId);
          const text = pickInitiativeText(resolveArchetype(buddyId, buddy?.archetype), 'promise_reminder', `${buddyId}:${newDay}:nag`, { promiseText: promise.text });
          this.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['promise', 'broken']);
        }
        this.telemetry.logEvent('social', 'promise_broken', currentMinutes, { buddyId, promiseId: promise.id, witnesses: this.shiftWitnessAffinities(buddyId, -4) });
      }
    } catch { /* promises never break the tick */ }
    try {
      for (const buddy of this.social.getBuddies()) {
        if (buddy.status !== 'distant') continue;
        const until = this.world.getFlag(`distant_${buddy.id}_until`);
        if (typeof until === 'number' && newDay < until) continue;
        this.social.setBuddyStatus(buddy.id, 'acquaintance');
        const rels = this.social.getRelationships(buddy.id);
        if (rels) this.social.adjustRelationship(buddy.id, { annoyance: 25, trust: Math.max(5, rels.trust - 10) });
        this.world.setFlag(`sharp_${buddy.id}`, 'returned');
        this.world.setFlag(`sharp_${buddy.id}_day`, newDay);
        this.world.setFlag(`strained_${buddy.id}`, false);
        if (this.world.getFlag('sharp_active') === buddy.id) this.world.setFlag('sharp_active', '');
        const text = pickReturnLine(resolveArchetype(buddy.id, buddy.archetype), `${buddy.id}:${newDay}:return`);
        this.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['sharp', 'return']);
        this.telemetry.logEvent('social', 'buddy_returned', currentMinutes, { buddyId: buddy.id, witnesses: this.shiftWitnessAffinities(buddy.id, 8) });
      }
    } catch { /* returns never break the tick */ }
  }

  /** P4 — the player's close friends notice what happens to their mutuals (affinity witness shift). */
  private shiftWitnessAffinities(targetId: string, delta: number): number {
    let count = 0;
    try {
      for (const buddy of this.social.getBuddies()) {
        if (buddy.id === targetId) continue;
        if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const stage = this.social.getRelationshipStage(buddy.id);
        if (stage !== 'friend' && stage !== 'close') continue;
        this.social.adjustAffinity(buddy.id, targetId, delta);
        count++;
      }
    } catch { /* witness shifts never break the tick */ }
    return count;
  }

  // ==========================================
  // CHARACTER LIVES — daily passes (rules-only, template-voiced)
  // NPCs live their own lives: plans, run-ins, romance, mediations, goodbyes.
  // The player is one character among many — never the center of a pass.
  // One active sharp/strained player event at a time still governs (see above);
  // NPC↔NPC life never triggers sharp events and never touches player dims
  // except through the governed mediation-exposure path.
  // ==========================================

  /** Daily pass fan-out, called from the day_changed handler. Never throws. */
  private processCharacterLivesDaily(newDay: number): void {
    try { this.ensureAgendaForDay(newDay); } catch { /* agenda never breaks the tick */ }
    try { this.ensureAgendaForDay(newDay + 1); } catch { /* planning ahead never breaks the tick */ }
    try { this.processNpcRunins(newDay); } catch { /* run-ins never break the tick */ }
    try { this.progressRomance(newDay); } catch { /* romance never breaks the tick */ }
    try { this.maybeRequestMediations(newDay); } catch { /* asks never break the tick */ }
    try { this.maybeReintroduceBackstories(newDay); } catch { /* re-intros never break the tick */ }
  }

  private buddyDisplayName(buddyId: string): string {
    try {
      return this.social.getBuddy(buddyId)?.displayName ?? buddyId;
    } catch { return buddyId; }
  }

  /** Schedule blocks for a buddy on a day (exact → weekly rotation → day 1, like presence). */
  private dayBlocks(buddyId: string, day: number): Array<{ startMinuteOfDay: number; endMinuteOfDay: number; status: string; awayMessage: string }> {
    const buddy = this.social.getBuddy(buddyId);
    if (!buddy) return [];
    const weeklyDay = ((day - 1) % 7) + 1;
    return buddy.schedule[day] ?? buddy.schedule[weeklyDay] ?? buddy.schedule[1] ?? [];
  }

  /**
   * Weekly-fill planning: buddies with an empty day get 0–2 social/errand items
   * in free (online/away, non-sleep/work) windows. Seeded by (buddy, day);
   * spontaneity raises the odds. Never overwrites hand-set items.
   */
  private ensureAgendaForDay(day: number): void {
    const safeDay = Math.max(1, Math.floor(day) || 1);
    for (const buddy of this.social.getBuddies()) {
      if (!SimulationEngine.isBuddyAvailable(buddy)) continue;
      if (this.social.getAgenda(buddy.id, safeDay).length > 0) continue;
      const free = this.dayBlocks(buddy.id, safeDay).filter(
        (b) => (b.status === 'online' || b.status === 'away') && !classifyScheduleBlock(b.awayMessage)
      );
      if (free.length === 0) continue;
      const traits = this.social.getTraits(buddy.id);
      if (rollSeeded100(`${buddy.id}:agenda:${safeDay}`) >= 30 + traits.spontaneity * 0.35) continue;
      const count = rollSeeded100(`${buddy.id}:agenda:${safeDay}:count`) < traits.spontaneity * 0.3 ? 2 : 1;
      const fresh: Array<{ kind: 'social' | 'errand'; label: string; day: number; startMinute: number; endMinute: number }> = [];
      for (let i = 0; i < count; i++) {
        const window = pickSeeded(free, `${buddy.id}:agenda:${safeDay}:win:${i}`);
        const span = Math.max(1, window.endMinuteOfDay - window.startMinuteOfDay - 30);
        const start = window.startMinuteOfDay + (spreadSeed(`${buddy.id}:agenda:${safeDay}:at:${i}`) % span);
        const end = Math.min(window.endMinuteOfDay, start + 45 + (spreadSeed(`${buddy.id}:agenda:${safeDay}:len:${i}`) % 45));
        const kind = rollSeeded100(`${buddy.id}:agenda:${safeDay}:kind:${i}`) < 55 ? 'social' as const : 'errand' as const;
        const label = pickSeeded(AGENDA_LABELS[kind], `${buddy.id}:agenda:${safeDay}:what:${i}`);
        fresh.push({ kind, label, day: safeDay, startMinute: start, endMinute: end });
      }
      const merged = [...this.social.getAgenda(buddy.id), ...fresh.map((f, i) => ({ id: `ag_${safeDay}_${buddy.id}_${i}`, ...f }))];
      this.social.setAgenda(buddy.id, merged);
    }
  }

  /** True when both buddies share a non-offline window of >= 30 minutes that day. */
  private schedulesOverlap(a: string, b: string, day: number): boolean {
    const blocksA = this.dayBlocks(a, day).filter((x) => x.status !== 'offline');
    const blocksB = this.dayBlocks(b, day).filter((x) => x.status !== 'offline');
    for (const x of blocksA) {
      for (const y of blocksB) {
        const overlap = Math.min(x.endMinuteOfDay, y.endMinuteOfDay) - Math.max(x.startMinuteOfDay, y.startMinuteOfDay);
        if (overlap >= 30) return true;
      }
    }
    return false;
  }

  /** Pick the NPC↔NPC action from bond state (seeded; rules only). */
  private pickNpcAction(a: string, b: string, day: number): string {
    const out = this.social.getNpcBond(a, b);
    const back = this.social.getNpcBond(b, a);
    const roll = rollSeeded100(`runinact:${a}:${b}:${day}`);
    const hot = Math.max(out.dims.annoyance, back.dims.annoyance) >= 50
      || Math.max(out.dims.resentment, back.dims.resentment) >= 40;
    if (hot) return roll < 50 ? 'argument' : 'cold_shoulder';
    const involved = out.romance !== 'none' || back.romance !== 'none';
    if (involved) return roll < 45 ? 'deep_talk' : roll < 75 ? 'shared_activity' : 'warm_chat';
    const mutualWarm = out.dims.affection >= 20 && back.dims.affection >= 20
      && out.dims.attraction >= 15 && back.dims.attraction >= 15;
    if (mutualWarm && !this.social.isDatingAnyone(a) && !this.social.isDatingAnyone(b)) {
      return roll < 40 ? 'flirt' : 'deep_talk';
    }
    if (roll < 10) return 'support_crisis';
    if (roll < 25) return 'small_favor';
    if (roll < 50) return 'deep_talk';
    if (roll < 75) return 'shared_activity';
    return 'warm_chat';
  }

  /**
   * NPC↔NPC run-ins: overlapping schedules + seeded lottery (spontaneity and
   * warmth raise the odds). Max 3/day, 1/pair/day. Applies the fixed delta
   * table both directions, logs a witness line, and runs the mediation
   * exposure check for the pair.
   */
  private processNpcRunins(day: number): void {
    const ids = this.social.getBuddies().filter(SimulationEngine.isBuddyAvailable).map((b) => b.id).sort();
    if (ids.length < 2) return;
    const currentMinutes = this.clock.getTotalMinutes();
    const done = new Set(
      this.social.getNpcSocialLog(day).map((l) => [l.firstId, l.secondId].sort().join('__'))
    );
    let run = 0;
    for (let i = 0; i < ids.length && run < 3; i++) {
      for (let j = i + 1; j < ids.length && run < 3; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = [a, b].sort().join('__');
        if (done.has(key)) continue;
        if (!this.schedulesOverlap(a, b, day)) continue;
        const ta = this.social.getTraits(a);
        const tb = this.social.getTraits(b);
        const p = Math.min(55, 15 + ((ta.spontaneity + tb.spontaneity) / 2) * 0.3 + ((ta.warmth + tb.warmth) / 2) * 0.1);
        if (rollSeeded100(`runin:${key}:${day}`) >= p) continue;
        const action = this.pickNpcAction(a, b, day);
        this.social.applyNpcSocialAction(a, b, action, day);
        this.social.applyNpcSocialAction(b, a, action, day);
        const spot = pickRuninSpot(`${key}:${day}`);
        const verb = pickRuninVerb(action, `${key}:${day}`);
        this.social.logNpcInteraction({
          day,
          firstId: a,
          secondId: b,
          location: spot,
          line: `${this.buddyDisplayName(a)} and ${this.buddyDisplayName(b)} ${verb} at ${spot}.`,
        });
        this.social.checkMediationExposure(a, b, day);
        // Certain pairs compare notes about the player too (silent convergence).
        if (this.social.getPlayerRead(a).certainty >= 40 && this.social.getPlayerRead(b).certainty >= 40) {
          if (rollSeeded100(`align:${key}:${day}`) < 30) this.social.alignPlayerReads(a, b, day);
        }
        this.telemetry.logEvent('social', 'npc_runin', currentMinutes, { a, b, action });
        done.add(key);
        run++;
      }
    }
  }

  /**
   * Cozy romance ladder (non-explicit, informal): mutual warmth + trait
   * compatibility → crush → dating (one partner at a time); festering
   * resentment/annoyance → split. Crushes form quietly; datings and splits
   * leave witness lines.
   */
  private progressRomance(day: number): void {
    const ids = this.social.getBuddies().filter(SimulationEngine.isBuddyAvailable).map((b) => b.id).sort();
    const currentMinutes = this.clock.getTotalMinutes();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const compat = traitCompatibility(this.social.getTraits(a), this.social.getTraits(b));
        for (const [x, y] of [[a, b], [b, a]] as Array<[string, string]>) {
          const out = this.social.getNpcBond(x, y);
          if (out.romance === 'none') {
            if (compat >= 55 && out.dims.affection >= 25 && out.dims.attraction >= 15
              && out.dims.annoyance < 40 && out.dims.resentment < 20) {
              this.social.setNpcRomance(x, y, 'crush', day);
              this.telemetry.logEvent('social', 'npc_crush', currentMinutes, { from: x, to: y });
            }
            continue;
          }
          if (out.romance === 'crush') {
            const back = this.social.getNpcBond(y, x);
            const mutual = back.dims.affection >= 40 && back.romance !== 'none';
            if (out.dims.affection >= 45 && out.dims.comfort >= 45 && out.dims.trust >= 40 && mutual
              && out.dims.annoyance < 40 && out.dims.resentment < 20
              && !this.social.isDatingAnyone(x) && !this.social.isDatingAnyone(y)) {
              this.social.setNpcRomance(x, y, 'dating', day);
              this.social.setNpcRomance(y, x, 'dating', day);
              this.social.logNpcInteraction({
                day,
                firstId: x,
                secondId: y,
                location: pickRuninSpot(`romance:${x}:${y}:${day}`),
                line: `${this.buddyDisplayName(x)} and ${this.buddyDisplayName(y)} are seeing each other now.`,
              });
              this.telemetry.logEvent('social', 'npc_dating', currentMinutes, { a: x, b: y });
            } else if (out.dims.affection < 10) {
              this.social.setNpcRomance(x, y, 'none', day);
            }
            continue;
          }
          // dating: split when the bond festers (strained-level pain ends informal ties)
          const cur = this.social.getNpcBond(x, y);
          if (cur.romance !== 'none' && (cur.dims.resentment >= 50 || cur.dims.annoyance >= 60)) {
            const wasDating = cur.romance === 'dating';
            this.social.setNpcRomance(x, y, 'none', day);
            if (wasDating) this.social.setNpcRomance(y, x, 'none', day);
            this.social.logNpcInteraction({
              day,
              firstId: x,
              secondId: y,
              location: 'around town',
              line: `${this.buddyDisplayName(x)} and ${this.buddyDisplayName(y)} split up.`,
            });
            this.telemetry.logEvent('social', 'npc_split', currentMinutes, { a: x, b: y });
          }
        }
      }
    }
  }

  /**
   * Backstory re-introductions: people from before day 1 say hello again on
   * days 1–3 (max 2/day, once each) — and meeting them IS learning them.
   * Strangers never re-introduce. Empty-start rosters stay silent.
   */
  private maybeReintroduceBackstories(day: number): void {
    if (day < 1 || day > 3) return;
    const currentMinutes = this.clock.getTotalMinutes();
    let said = 0;
    for (const buddy of this.social.getBuddies()) {
      if (said >= 2) break;
      if (!SimulationEngine.isBuddyAvailable(buddy)) continue;
      const story = buddy.backstory;
      if (!story || story.relationship === 'stranger') continue;
      if (this.social.isKnown(buddy.id)) continue;
      if (this.world.getFlag(`reintro_${buddy.id}`)) continue;
      if (story.relationship !== 'close' && story.relationship !== 'friend'
        && story.relationship !== 'acquaintance' && story.relationship !== 'estranged') continue;
      const text = pickBackstoryReintro(story.relationship, `${buddy.id}:${day}`, buddy.displayName);
      this.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['reintro', 'backstory']);
      this.social.learnHandle(buddy.id, buddy.handle);
      this.world.setFlag(`reintro_${buddy.id}`, true);
      this.telemetry.logEvent('social', 'backstory_reintro', currentMinutes, { buddyId: buddy.id });
      said++;
    }
  }

  /**
   * Add a contact by typed handle (rules only). Resolves roster handles and
   * active backstory candidates; dead/changed handles bounce with a note and
   * an immortal memory. Accepted strangers introduce themselves (handle learned
   * both ways); declined strangers stay strangers. Costs 2 battery.
   */
  private addContactByHandle(rawHandle: string, currentMinutes: number): { success: boolean; error?: string; data?: unknown } {
    const handle = String(rawHandle || '').trim().slice(0, 40);
    if (!handle) return { success: false, error: 'Type a Pulse ID first.' };
    const day = this.clock.getTime().day;
    const lower = handle.toLowerCase();
    const buddy = this.social.getBuddies().find((b) => b.handle.toLowerCase() === lower);
    let candidate: { buddyId: string; status: string } | null = null;
    if (!buddy) {
      for (const b of this.social.getBuddies()) {
        const hit = (b.backstory?.candidates ?? []).find((c) => c.handle.toLowerCase() === lower);
        if (hit) {
          candidate = { buddyId: b.id, status: hit.status };
          break;
        }
      }
    }
    const target = buddy ?? (candidate ? this.social.getBuddy(candidate.buddyId) : undefined);
    if (!target) return { success: false, error: `No Pulse ID '${handle}' exists. Check the spelling.` };
    if (this.social.getKnownHandles(target.id).some((h) => h.toLowerCase() === lower)) {
      return { success: true, data: { buddyId: target.id, already: true } };
    }
    if (candidate && candidate.status !== 'active') {
      const text = pickContactBounce(candidate.status === 'changed' ? 'changed' : 'dead', `${target.id}:${day}`);
      this.social.addCoreMemory(target.id, {
        text: `Tried old handle "${handle}" — dead ID (day ${day}).`,
        kind: 'fact',
        day,
      });
      return { success: false, error: text };
    }
    if (this.economy.getSocialBattery() < 2) {
      return { success: false, error: pickInnerVoice('blocked', `add:${target.id}:${day}`) };
    }
    if (this.world.getFlag(`contactadd_${target.id}_${day}`)) {
      return { success: false, error: 'You already reached out today. Give it a day.' };
    }
    this.world.setFlag(`contactadd_${target.id}_${day}`, true);
    this.economy.spendSocialBattery(2);
    // Rules decide: close/friend always accept; others roll on warmth vs shyness.
    const stage = this.social.getRelationshipStage(target.id);
    const traits = this.social.getTraits(target.id);
    const roll = rollSeeded100(`contact:${target.id}:${day}:${handle.length}`);
    const accepted = stage === 'close' || stage === 'friend'
      || roll < 10 + traits.warmth * 0.3 - traits.shyness * 0.2 + (target.backstory && target.backstory.relationship !== 'stranger' ? 25 : 0);
    if (!accepted) {
      this.social.sendMessage(target.id, target.id, 'player', pickContactLine('decline', `${target.id}:${day}`), currentMinutes, false, ['contact', 'declined']);
      this.telemetry.logEvent('social', 'contact_declined', currentMinutes, { buddyId: target.id });
      this.notifySubscribers();
      return { success: true, data: { buddyId: target.id, accepted: false } };
    }
    this.social.learnHandle(target.id, target.handle);
    this.social.sendMessage(target.id, target.id, 'player', pickContactLine('accept', `${target.id}:${day}`), currentMinutes, false, ['contact', 'accepted']);
    this.telemetry.logEvent('social', 'contact_added', currentMinutes, { buddyId: target.id });
    this.notifySubscribers();
    return { success: true, data: { buddyId: target.id, accepted: true } };
  }

  /**
   * Player-initiated NightBoard meet (rules-throttled newcomer source for the
   * unbounded online roster). Costs 6 battery, once per day. The meeting
   * itself is async (AI-or-template intro) — the dispatch only starts it.
   */
  private meetOnNightBoard(currentMinutes: number): { success: boolean; error?: string; data?: unknown } {
    const day = this.clock.getTime().day;
    if (this.world.getFlag(`nbmeet_${day}`)) {
      return { success: false, error: 'You already went looking tonight. Try again tomorrow.' };
    }
    if (this.economy.getSocialBattery() < 6) {
      return { success: false, error: pickInnerVoice('blocked', `nbmeet:${day}`) };
    }
    this.economy.spendSocialBattery(6);
    this.world.setFlag(`nbmeet_${day}`, true);
    const metVia = NEWCOMER_METVIA_ROTATION[this.social.getBuddies().filter((b) => b.isProcedural).length % NEWCOMER_METVIA_ROTATION.length]!;
    const existingIds = this.social.getBuddies().map((b) => b.id);
    void generateNewcomer({ metVia, day, seed: `nbmeet-day-${day}`, useAI: true }, { existingIds })
      .then((res) => {
        const added = this.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: res.definition, introText: res.introText });
        if (added.success) this.notifySubscribers();
      })
      .catch(() => {});
    this.telemetry.logEvent('social', 'nightboard_meet', currentMinutes, { day });
    this.notifySubscribers();
    return { success: true, data: { day } };
  }

  /**
   * Mediation asks: warm buddies occasionally ask the player to introduce them,
   * strengthen a fraying tie, or share what someone is like. One ask per buddy
   * per 4 days, max 2 asks/day. The ask arrives as a DM; the player answers
   * via MEDIATION_RESPOND (UI follow-up dispatches it).
   */
  private maybeRequestMediations(day: number): void {
    const currentMinutes = this.clock.getTotalMinutes();
    const buddies = this.social.getBuddies().filter(SimulationEngine.isBuddyAvailable).sort((x, y) => x.id.localeCompare(y.id));
    let asked = 0;
    for (const buddy of buddies) {
      if (asked >= 2) break;
      const last = this.world.getFlag(`medask_${buddy.id}`);
      if (typeof last === 'number' && day - last < 4) continue;
      // Nobody asks favors of someone they read as disloyal.
      if (this.social.getPlayerRead(buddy.id).beliefs.loyalty < 20) continue;
      const traits = this.social.getTraits(buddy.id);
      if (rollSeeded100(`medask:${buddy.id}:${day}`) >= 8 + traits.warmth * 0.08) continue;
      const others = buddies.filter((o) => o.id !== buddy.id);
      if (others.length === 0) continue;
      const roll = rollSeeded100(`medkind:${buddy.id}:${day}`);
      let kind: 'introduce' | 'strengthen' | 'ask_about' = 'ask_about';
      let target = pickSeeded(others, `medwho:${buddy.id}:${day}`);
      if (roll < 35) {
        const strained = others.find((o) => this.social.getNpcBond(buddy.id, o.id).dims.annoyance >= 15);
        if (!strained) continue;
        kind = 'strengthen';
        target = strained;
      } else if (roll < 70) {
        const strangers = others.filter((o) => this.social.getNpcBond(buddy.id, o.id).dims.familiarity < 20);
        if (strangers.length === 0) continue;
        kind = 'introduce';
        target = pickSeeded(strangers, `medwho:${buddy.id}:${day}`);
      }
      const record = this.social.requestMediation(buddy.id, target.id, kind, day);
      if (!record) continue;
      this.world.setFlag(`medask_${buddy.id}`, day);
      const text = pickMediationAskLine(kind, `${buddy.id}:${day}`, this.buddyDisplayName(target.id));
      this.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['mediation', record.id]);
      this.telemetry.logEvent('social', 'mediation_requested', currentMinutes, { requester: buddy.id, target: target.id, kind });
      asked++;
    }
  }

  // ==========================================
  // SOCIAL BATTERY — the introvert protagonist's meter (rules-only accounting)
  // Every player send costs; bold sends cost more and are judged at send time
  // (stage gate + seeded reception roll). Outcomes land immediately: warmth
  // refunds, awkwardness stings, rejection drains to zero and demands an
  // apology before that buddy hears another word. The AI only paraphrases
  // the stored reception hint — it never prices or judges.
  // ==========================================

  /**
   * Gate a player DM (pure rules; called before the message is stored).
   * { ok:false } carries an inner-voice line for the UI notice.
   * The 'scripted' tag (authored dialogue choices) bypasses the gate so
   * pre-battery story beats can never stall on an empty meter.
   */
  private gatePlayerMessage(rawBuddyId: string, text: string, tags?: string[]): { ok: boolean; error?: string } {
    const buddy = this.social.getBuddy(rawBuddyId);
    if (!buddy) return { ok: true }; // system paths without a buddy stay ungated
    if ((tags ?? []).includes('scripted')) return { ok: true };
    const buddyId = buddy.id;
    const day = this.clock.getTime().day;
    const apologizeKey = `must_apologize_${buddyId}`;
    // Owed apology: only an apology gets through (and it heals a little).
    if (this.world.getFlag(apologizeKey)) {
      if (!isApology(text)) {
        return { ok: false, error: pickInnerVoice('must_apologize', `${buddyId}:${day}`) };
      }
      this.world.setFlag(apologizeKey, false);
      this.economy.rechargeSocialBattery(BATTERY_APOLOGY_REWARD);
      this.social.applySocialAction(buddyId, 'apologize');
      // Owning it reads loyal and kind.
      this.social.observePlayerTrait(buddyId, { loyalty: 65, warmth: 60 }, day);
      return { ok: true };
    }
    const assessment = classifyPlayerTone(text);
    if (this.economy.getSocialBattery() < assessment.upfrontCost) {
      return { ok: false, error: pickInnerVoice('blocked', `${buddyId}:${day}`) };
    }
    this.economy.spendSocialBattery(assessment.upfrontCost);
    // Every line teaches the buddy something: tone first, brevity second.
    if (assessment.tone === 'warm') {
      this.social.observePlayerTrait(buddyId, { warmth: 80 }, day);
    } else if (assessment.tone === 'cold') {
      this.social.observePlayerTrait(buddyId, { warmth: 15 }, day);
    } else if (assessment.boldness > 0) {
      this.social.observePlayerTrait(buddyId, { spontaneity: 75, warmth: 70 }, day);
    } else {
      this.social.observePlayerTrait(buddyId, {
        shyness: text.length < 25 ? 75 : text.length > 120 ? 35 : 55,
        warmth: 55,
      }, day);
    }
    if (assessment.boldness > 0) {
      const rels = this.social.getRelationships(buddyId);
      const reception = receptionForBoldAct({
        buddyId,
        stage: this.social.getRelationshipStage(buddyId),
        dims: rels ?? {
          familiarity: 0, trust: 0, comfort: 0, respect: 0, annoyance: 0,
          affection: 0, attraction: 0, suspicion: 0, resentment: 0,
        },
        traits: this.social.getTraits(buddyId),
        day,
        seed: `${text.length}:${text.slice(0, 12)}`,
      }, assessment.boldness);
      this.world.setFlag(`reception_${buddyId}_${day}`, reception);
      if (reception === 'warm') {
        this.economy.rechargeSocialBattery(BATTERY_WARM_REFUND + BATTERY_WARM_BONUS);
      } else if (reception === 'lukewarm') {
        // Short of the sting: spendSocialBattery leaves the balance (lenient).
        this.economy.spendSocialBattery(BATTERY_LUKEWARM_EXTRA);
      } else {
        this.economy.drainSocialBattery();
        this.world.setFlag(apologizeKey, true);
        this.telemetry.logEvent('social', 'bold_rejected', this.clock.getTotalMinutes(), { buddyId, tone: assessment.tone, reception });
      }
    }
    return { ok: true };
  }

  /** True when the installed Pulse release is the 6.x generation (colors, motion). */
  public isPulse6(): boolean {
    try {
      return pulseHasFeature(this.pulse.getCurrentPulseId(), 'buddy-colors');
    } catch { return false; }
  }

  /** Prompt direction for a bold player line sent today (rules-stored, AI paraphrases). */
  public getReceptionHint(rawBuddyId: string, day: number): string {    try {
      const buddy = this.social.getBuddy(rawBuddyId);
      if (!buddy) return '';
      const outcome = this.world.getFlag(`reception_${buddy.id}_${Math.max(1, Math.floor(day) || 1)}`);
      if (outcome !== 'warm' && outcome !== 'lukewarm' && outcome !== 'reject' && outcome !== 'offlimits') return '';
      return receptionHintFor(outcome, buddy.displayName);
    } catch { return ''; }
  }

  /** Daily battery pass: a quiet yesterday (no player messages) repays solitude. */
  private processPlayerBatteryDaily(newDay: number): void {
    try {
      if (this.world.getFlag(`quietrecharge_${newDay}`)) return;
      if (!this.social.didPlayerWriteOnDay(newDay - 1)) {
        this.economy.rechargeSocialBattery(10);
        this.telemetry.logEvent('social', 'battery_solitude', this.clock.getTotalMinutes(), { day: newDay });
      }
      this.world.setFlag(`quietrecharge_${newDay}`, true);
    } catch { /* recharge never breaks the tick */ }
  }

  /**
   * Polite goodbyes: when a sleep/work block is active and the player was in
   * touch recently (<= 90 min), the buddy sends one leave line, once per day.
   * Called after every presence update — never from chat paths.
   */  private sweepBusyLeaveLines(currentMinutes: number): void {
    const day = Math.floor(currentMinutes / 1440) + 1;
    for (const buddy of this.social.getBuddies()) {
      if (!SimulationEngine.isBuddyAvailable(buddy)) continue;
      if (this.world.getFlag(`leave_${buddy.id}_${day}`)) continue;
      const pres = this.social.getPresence(buddy.id);
      if (!pres || pres.status !== 'offline') continue;
      const kind = classifyScheduleBlock(pres.awayMessage);
      if (!kind) continue;
      const last = this.social.getLastActivityMinute(buddy.id);
      if (last <= 0 || currentMinutes - last > 90) continue;
      const traits = this.social.getTraits(buddy.id);
      const text = pickLeaveLine(kind, traits.shyness, `${buddy.id}:${day}`);
      this.social.sendMessage(buddy.id, buddy.id, 'player', text, currentMinutes, false, ['leave', kind]);
      this.world.setFlag(`leave_${buddy.id}_${day}`, true);
    }
  }

  // ==========================================
  // P5 — LIVE MEETINGS (RSVP + show/resolve, rules-only, template-voiced)
  // Appointments emerge from natural chat ("lets meet at the cafe tomorrow").
  // NPCs confirm/decline the day before, then show or flake by rules;
  // outcomes move dims + immortal memories + feed the sharp/gossip machinery.
  // ==========================================

  private static isOpenAppointment(a: Appointment, fromDay: number): boolean {
    const st = a.status ?? 'scheduled';
    return (st === 'scheduled' || st === 'confirmed') && a.targetDay >= fromDay;
  }

  /**
   * Parse a player chat line for meetup proposals or cancellations.
   * Called from Pulse after the promise ledger. Never throws, never double-books.
   */
  public handleMeetupChat(rawBuddyId: string, text: string, day: number): Appointment | null {
    try {
      const buddy = this.social.getBuddy(rawBuddyId);
      if (!buddy) return null;
      const buddyId = buddy.id;
      if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') return null;
      const safeDay = Math.max(1, Math.floor(day) || 1);
      const open = this.world.getAppointments().filter((a) => a.characterId === buddyId && SimulationEngine.isOpenAppointment(a, safeDay));
      if (isMeetupCancelText(text)) {
        const target = open[open.length - 1];
        if (!target) return null;
        this.world.updateAppointment(target.id, { status: 'cancelled' });
        this.social.addCoreMemory(buddyId, {
          text: `Cancelled ${locationLabel(target.locationId)} plans, Day ${safeDay}.`,
          kind: 'fact',
          day: safeDay,
        });
        // Cancelling reads flaky and a little disloyal.
        this.social.observePlayerTrait(buddyId, { discipline: 35, loyalty: 45 }, safeDay);
        this.telemetry.logEvent('social', 'appointment_cancelled', this.clock.getTotalMinutes(), { buddyId, appointmentId: target.id });
        return null;
      }
      const proposal = parseMeetupProposal(text);
      if (!proposal) return null;
      // Drained: no new plans (existing commitments are still honored).
      if (this.economy.getSocialBattery() <= 0) return null;
      if (open.length > 0) return null; // one open plan per buddy
      const slot = LOCATION_SLOTS[proposal.locationId];
      const targetDay = safeDay + proposal.dayOffset;
      const appt = this.world.scheduleAppointment({
        id: `appt_${buddyId}_${targetDay}_${slot.start}`.slice(0, 60),
        characterId: buddyId,
        locationId: proposal.locationId,
        targetDay,
        startMinute: slot.start,
        endMinute: slot.end,
        description: `Meet ${buddy.displayName} at ${locationLabel(proposal.locationId)}`,
        status: 'scheduled',
      });
      this.telemetry.logEvent('social', 'appointment_scheduled', this.clock.getTotalMinutes(), { buddyId, appointmentId: appt.id, location: proposal.locationId, targetDay });
      // Making plans costs presence too (the introvert pays to commit).
      this.economy.spendSocialBattery(BATTERY_NEW_APPOINTMENT);
      // Near-term plans (tonight/tomorrow) get an immediate answer; farther plans
      // are answered by the daily pass. Either way the NPC replies exactly once.
      if (targetDay <= safeDay + 1) this.runRsvpPass(safeDay, [appt], targetDay <= safeDay ? 'tonight' : 'tomorrow');
      return appt;
    } catch { return null; }
  }

  /** NPC confirm/decline pass. Daily: answers farther-future plans not yet answered. Rules only. */
  private runRsvpPass(newDay: number, only?: Appointment[], dayRef?: string): void {
    try {
      const minutes = this.clock.getTotalMinutes();
      const due = (only ?? this.world.getAppointments()).filter((a) => {
        if (a.status !== undefined && a.status !== 'scheduled') return false;
        if (a.rsvp) return false;
        if (only) return true;
        return a.targetDay > newDay;
      });
      for (const appt of due) {
        const buddy = this.social.getBuddy(appt.characterId);
        if (!buddy || buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const stage = this.social.getRelationshipStage(buddy.id);
        const mood = this.social.getDailyMood(buddy.id, newDay);
        const rsvp = decideRsvp({ stage, mood, roll: appointmentRoll(`${appt.id}:rsvp`) });
        const label = locationLabel(appt.locationId);
        const ref = dayRef ?? (appt.targetDay === newDay + 1 ? 'tomorrow' : `on day ${appt.targetDay}`);
        if (rsvp === 'no') {
          this.world.updateAppointment(appt.id, { rsvp: 'no', status: 'cancelled' });
          this.social.sendMessage(buddy.id, buddy.id, 'player', pickRsvpLine('no', appt.id, label, ref), minutes, false, ['appointment', 'rsvp']);
          this.telemetry.logEvent('social', 'appointment_declined', minutes, { buddyId: buddy.id, appointmentId: appt.id });
        } else {
          this.world.updateAppointment(appt.id, { rsvp, status: 'confirmed' });
          this.social.sendMessage(buddy.id, buddy.id, 'player', pickRsvpLine(rsvp, appt.id, label, ref), minutes, false, ['appointment', 'rsvp']);
          this.telemetry.logEvent('social', 'appointment_confirmed', minutes, { buddyId: buddy.id, appointmentId: appt.id, rsvp });
        }
      }
    } catch { /* RSVP never breaks the tick */ }
  }

  /** Resolve past-due meetings: happened / stood-up / flaked / mutual miss. Rules only. */
  private resolveDueAppointments(newDay: number): void {
    try {
      const minutes = this.clock.getTotalMinutes();
      const due = this.world.getAppointments().filter((a) => {
        const st = a.status ?? 'scheduled';
        return (st === 'scheduled' || st === 'confirmed') && a.targetDay < newDay;
      });
      for (const appt of due) {
        const buddy = this.social.getBuddy(appt.characterId);
        if (!buddy) { this.world.updateAppointment(appt.id, { status: 'cancelled' }); continue; }
        const label = locationLabel(appt.locationId);
        const name = buddy.displayName;
        const playerShowed = this.didPlayerAttend(appt, buddy.id);
        const stage = this.social.getRelationshipStage(buddy.id);
        const mood = this.social.getDailyMood(buddy.id, appt.targetDay);
        const npcShowed = buddy.status !== 'distant' && buddy.status !== 'gone' && buddy.status !== 'blocked'
          && decideNpcShow({ rsvp: appt.rsvp, stage, mood, roll: appointmentRoll(`${appt.id}:show`) });
        if (npcShowed && playerShowed) {
          this.world.updateAppointment(appt.id, { status: 'happened', isCompleted: true, npcShowed: true, playerShowed: true });
          // P5.2 co-op enrichment: joint work pays more (dims x2 + wage/flavor), cafe stays intimate
          // P6 gig shifts ride the same path (marked by gig_ id prefix, any contact)
          const isShift = appt.locationId === 'work' && (buddy.id === CORE_IDS.RYAN || buddy.archetype === 'coworker' || appt.id.startsWith('gig_'));
          const isArchive = appt.locationId === 'archive';
          if (isShift || isArchive) {
            const detail = pickCoopDetail(appt.id, isShift ? 'shift' : 'archive');
            const action = isShift ? 'work_camaraderie' : 'intellectual_curiosity';
            this.social.applySocialAction(buddy.id, action);
            this.social.applySocialAction(buddy.id, action);
            // P6.2 heat waves pay +$6 (thirsty town, busy cart); P6 gig shifts pay their wage
            if (isShift) this.economy.earnCash((appt.wageOverride ?? SHIFT_WAGE) + shiftWageBonus(getWeatherForDay(appt.targetDay).condition), `Side shift with ${name}`);
            this.social.addCoreMemory(buddy.id, {
              text: isShift
                ? `Worked a side shift with ${name}, Day ${appt.targetDay}: ${detail}.`
                : `Indexed the archive with ${name}, Day ${appt.targetDay}: ${detail}.`,
              kind: 'shared_moment',
              day: appt.targetDay,
            });
            const wrap = appt.id.startsWith('gig_')
              ? pickGigWrapLine(appt.id, detail)
              : isShift ? pickShiftWrapLine(appt.id, detail) : pickArchiveWrapLine(appt.id, detail);
            this.social.sendMessage(buddy.id, buddy.id, 'player', wrap, minutes, false, ['appointment', isShift ? 'shift' : 'archive']);
            this.telemetry.logEvent('social', 'appointment_happened', minutes, { buddyId: buddy.id, appointmentId: appt.id, coop: isShift ? 'shift' : 'archive' });
          } else {
            this.social.applySocialAction(buddy.id, appt.locationId === 'cafe' ? 'vulnerable_share' : 'work_camaraderie');
            this.social.addCoreMemory(buddy.id, { text: `Met ${name} at ${label}, Day ${appt.targetDay}.`, kind: 'shared_moment', day: appt.targetDay });
            this.telemetry.logEvent('social', 'appointment_happened', minutes, { buddyId: buddy.id, appointmentId: appt.id });
          }
        } else if (npcShowed && !playerShowed) {
          // P6.2 severe weather (fog/storm) is a legitimate excuse: missed, but no hard feelings
          const excused = isSevereWeather(getWeatherForDay(appt.targetDay).condition);
          if (excused) {
            this.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: true, playerShowed: false });
            this.social.addCoreMemory(buddy.id, { text: `Severe weather kept you from ${label}, Day ${appt.targetDay}. No hard feelings.`, kind: 'fact', day: appt.targetDay });
            this.telemetry.logEvent('social', 'appointment_excused', minutes, { buddyId: buddy.id, appointmentId: appt.id });
          } else {
            this.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: true, playerShowed: false });
            this.social.applySocialAction(buddy.id, 'dismissive');
            this.social.addCoreMemory(buddy.id, { text: `Stood up ${name} at ${label}, Day ${appt.targetDay}.`, kind: 'fact', day: appt.targetDay });
            this.social.sendMessage(buddy.id, buddy.id, 'player', pickStoodUpLine(appt.id, label), minutes, false, ['appointment', 'missed']);
            this.telemetry.logEvent('social', 'appointment_missed', minutes, { buddyId: buddy.id, appointmentId: appt.id });
          }
        } else if (!npcShowed && playerShowed) {
          this.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: false, playerShowed: true });
          this.social.applySocialAction(buddy.id, 'dismissive');
          this.social.addCoreMemory(buddy.id, { text: `${name} flaked on ${label}, Day ${appt.targetDay}.`, kind: 'fact', day: appt.targetDay });
          this.social.sendMessage(buddy.id, buddy.id, 'player', pickMeetingApologyLine(appt.id, label), minutes, false, ['appointment', 'apology']);
          this.telemetry.logEvent('social', 'appointment_flaked', minutes, { buddyId: buddy.id, appointmentId: appt.id });
        } else {
          this.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: false, playerShowed: false });
          this.telemetry.logEvent('social', 'appointment_missed', minutes, { buddyId: buddy.id, appointmentId: appt.id, bothAbsent: true });
        }
      }
    } catch { /* resolution never breaks the tick */ }
  }

  /** Player attendance: cafe/work = visited the view that day; lobby = DM'd; archive = real joint effort (2+ DMs). */
  private didPlayerAttend(appt: Appointment, buddyId: string): boolean {
    if (appt.locationId === 'cafe' || appt.locationId === 'work') {
      return this.world.getFlag(`visited_${appt.locationId}_${appt.targetDay}`) === true;
    }
    try {
      const playerMsgs = this.social.getMessages(buddyId).filter((m) => m.senderId === 'player' && m.day === appt.targetDay);
      return appt.locationId === 'archive' ? playerMsgs.length >= 2 : playerMsgs.length >= 1;
    } catch { return false; }
  }

  /** P5.4 co-comment: when an NPC refreshes their page, a mutual friend may sign the guestbook. */
  private maybeCoCommentProfileUpdate(username: string, day: number, currentMinutes: number): void {
    try {
      if (appointmentRoll(`${username}:${day}:gbco`) >= 50) return;
      const owner = this.social.getBuddies().find((b) =>
        b.handle === username || b.id === username
        || CORE_PROFILE_ALIASES[b.id] === username || CORE_PROFILE_ALIASES[b.handle] === username);
      const candidates = this.social.getBuddies().filter((b) => {
        if (owner && b.id === owner.id) return false;
        if (b.status === 'distant' || b.status === 'gone' || b.status === 'blocked') return false;
        const stage = this.social.getRelationshipStage(b.id);
        return stage === 'friend' || stage === 'close';
      });
      if (candidates.length === 0) return;
      const commenter = candidates[appointmentRoll(`${username}:${day}:gbco2`) % candidates.length]!;
      const ownerProfile = this.myplace.getNpcProfile(username);
      const authorKey = this.resolveProfileUsername(commenter) ?? commenter.handle;
      this.myplace.addGuestbookComment(username, authorKey, pickGuestbookLine(`${username}:${day}:gbco`, ownerProfile?.displayName ?? username), currentMinutes);
      this.telemetry.logEvent('social', 'myplace_guestbook', currentMinutes, { from: commenter.id, to: username });
    } catch { /* co-comments never break the tick */ }
  }

  /** P5.4 stub MyPlace pages for a buddy (myplace username when known, else handle/id). */
  private ensureMyPlaceStub(buddy: { handle?: string; id: string; displayName: string; archetype?: any; backstory?: { label?: string; bioSeed?: string } }): void {
    try {
      // One page per buddy: prefer the registry myplace username so links stay canonical.
      const username = CORE_BY_ID[buddy.id]?.myplace || buddy.handle || buddy.id;
      this.myplace.ensureNpcProfile({
        username,
        displayName: buddy.displayName,
        archetype: buddy.archetype,
        backstory: buddy.backstory ?? CORE_BY_ID[buddy.id]?.backstory ?? undefined,
      });
      // Also index by raw id so MyPlace routing works with either key
      if (buddy.handle && buddy.handle !== buddy.id) {
        this.myplace.ensureNpcProfile({
          username: buddy.id,
          displayName: buddy.displayName,
          archetype: buddy.archetype,
          backstory: buddy.backstory ?? CORE_BY_ID[buddy.id]?.backstory ?? undefined,
        });
      }
    } catch { /* MyPlace stub is best-effort */ }
  }

  /** P5 daily pass: RSVP for tomorrow + resolve the past. Rules only, no AI. */
  private processAppointmentsDaily(newDay: number): void {
    this.runRsvpPass(newDay);
    this.resolveDueAppointments(newDay);
  }

  // ==========================================
  // P7 — CITY TRAVEL (location sim: walk/bus, encounters, gating)
  // One-way legs; the map UI chains them. Arrival raises visited_* flags
  // (meetings keep working). Outings/room/work actions gate on location.
  // ==========================================

  /** Where an outing must happen (null = anywhere/legacy). */
  private static outingHomeNode(outingId: string): CityNodeId | null {
    if (outingId === 'diner_soup' || outingId === 'diner_platter' || outingId === 'diner_pie') return 'diner';
    if (outingId === 'canal_walk') return 'canal';
    if (outingId === 'laundromat') return 'laundry';
    return null;
  }

  private static requireLocation(have: CityNodeId, want: CityNodeId): string | null {
    if (have === want) return null;
    return `You're at ${CITY_NODES[have].name} — travel to ${CITY_NODES[want].name} first.`;
  }

  public travelTo(rawTo: unknown, rawMode: unknown, options?: { ignoreFatigue?: boolean }): ActionResult & { data?: { summary: string; encounter?: string; minutes: number; cost: number } } {
    try {
      if (!isCityNodeId(rawTo)) return { success: false, error: `Unknown destination.` };
      const to: CityNodeId = rawTo;
      const mode: TravelMode = rawMode === 'bus' ? 'bus' : 'walk';
      const from = this.economy.getLocation();
      if (from === to) return { success: true, data: { summary: `Already at ${CITY_NODES[to].name}.`, minutes: 0, cost: 0 } };
      const day = this.clock.getTime().day;
      const weather = getWeatherForDay(day);
      if (to === 'canal' && weather.condition === 'storm') {
        return { success: false, error: 'Canal walkway closed in the storm. Come back after the front passes.' };
      }
      const quote = quoteTravel(from, to, mode, isWetWeather(weather.condition));
      if (quote.busUsed && !this.economy.canAfford(BUS_FARE)) {
        return { success: false, error: `Bus fare is $${BUS_FARE.toFixed(2)} — walk it instead?` };
      }
      const walkCost = quote.mode === 'walk' ? walkEnergyCost(quote.minutes) : 0;
      // P7 leniency: the auto-trip home never strands the player, whatever the legs feel like
      if (!options?.ignoreFatigue && this.economy.getState().energy < 10 && walkCost > 0) {
        return { success: false, error: 'Too tired to walk there (need 10% energy). Take the bus or rest.' };
      }
      if (quote.busUsed) this.economy.spendCash(BUS_FARE, `Bus to ${CITY_NODES[to].name}`);
      this.advanceGameMinutes(quote.minutes, `Travel: ${CITY_NODES[from].name} → ${CITY_NODES[to].name} (${quote.mode})`);
      if (walkCost > 0) this.economy.consumeEnergy(walkCost);
      this.economy.setLocation(to);
      // Arrival counts for meetings (same flags the legacy views raise)
      if (to === 'cafe' || to === 'cart') {
        try { this.world.setFlag(`visited_${to === 'cafe' ? 'cafe' : 'work'}_${day}`, true); } catch { /* attendance is best-effort */ }
      }
      // One street encounter per trip (deterministic, capped by design)
      let encounterText: string | undefined;
      try {
        const candidates = this.social.getBuddies()
          .filter((b) => b.status !== 'distant' && b.status !== 'gone' && b.status !== 'blocked')
          .map((b) => ({ id: b.id, name: b.displayName }));
        const encounter = rollStreetEncounter(from, to, day, isWetWeather(weather.condition), candidates);
        if (encounter && encounter.kind !== 'quiet') {
          if (encounter.cashDelta !== 0) this.economy.earnCash(encounter.cashDelta, 'Street find');
          if (encounter.energyDelta !== 0) {
            if (encounter.energyDelta < 0) this.economy.consumeEnergy(-encounter.energyDelta);
            else this.economy.restoreEnergy(encounter.energyDelta);
          }
          if (encounter.familiarityBuddyId) {
            const rels = this.social.getRelationships(encounter.familiarityBuddyId);
            if (rels) this.social.adjustRelationship(encounter.familiarityBuddyId, { familiarity: Math.min(100, rels.familiarity + 3) });
          }
          encounterText = encounter.text;
          this.telemetry.logEvent('room', 'street_encounter', this.clock.getTotalMinutes(), { kind: encounter.kind, from, to });
        }
      } catch { /* encounters never break travel */ }
      const route = quote.path.map((n) => CITY_NODES[n].name).join(' → ');
      this.telemetry.logEvent('room', 'travel', this.clock.getTotalMinutes(), { from, to, mode: quote.mode, minutes: quote.minutes });
      this.notifySubscribers();
      return {
        success: true,
        data: {
          summary: `${route} (${quote.minutes}m${quote.busUsed ? `, bus $${BUS_FARE.toFixed(2)}` : ', on foot'}) — now at ${CITY_NODES[to].name}.`,
          encounter: encounterText,
          minutes: quote.minutes,
          cost: quote.cost,
        },
      };
    } catch {
      return { success: false, error: 'Travel failed.' };
    }
  }

  // ==========================================
  // P6 — JOB BOARD (apply now, hear back in 4–10h, never instant)
  // Acceptance creates a real next-day work appointment (gig wage honored);
  // rejection is a kind Pulse note with zero penalty. State in world flags.
  // ==========================================

  /** Job board for UI: gigs + pending/resolved status per gig. */
  public getJobBoard(): Array<{ gig: import('./JobDirector').Gig; pending: boolean; appliedMinute: number }> {
    try {
      return Object.values(GIGS).map((gig) => {
        const applied = this.world.getFlag(`jobapp_${gig.id}`);
        const done = this.world.getFlag(`jobapp_${gig.id}_done`);
        const pending = typeof applied === 'number' && applied > 0 && !done;
        return { gig, pending, appliedMinute: pending ? (applied as number) : 0 };
      });
    } catch { return []; }
  }

  private applyForGig(gigId: string): ActionResult {
    try {
      const gig = GIGS[gigId];
      if (!gig) return { success: false, error: `Unknown gig: ${gigId}` };
      const applied = this.world.getFlag(`jobapp_${gigId}`);
      const done = this.world.getFlag(`jobapp_${gigId}_done`);
      if (typeof applied === 'number' && applied > 0 && !done) {
        return { success: false, error: 'Already applied — waiting to hear back.' };
      }
      if (this.economy.getState().energy < gig.minEnergy) {
        return { success: false, error: `Too tired to take ${gig.title} (need ${gig.minEnergy}% energy to apply).` };
      }
      const now = this.clock.getTotalMinutes();
      this.world.setFlag(`jobapp_${gigId}`, now);
      this.world.setFlag(`jobapp_${gigId}_done`, false);
      this.telemetry.logEvent('economy', 'job_applied', now, { gigId });
      this.notifySubscribers();
      return { success: true };
    } catch {
      return { success: false, error: 'Application failed.' };
    }
  }

  /** Resolve due applications: accept → appointment + note; reject → kind note. */
  private processJobReplies(): void {
    try {
      const now = this.clock.getTotalMinutes();
      const day = this.clock.getTime().day;
      for (const gig of Object.values(GIGS)) {
        const applied = this.world.getFlag(`jobapp_${gig.id}`);
        const done = this.world.getFlag(`jobapp_${gig.id}_done`);
        if (typeof applied !== 'number' || applied <= 0 || done) continue;
        if (now < applied + replyDelayMinutes(gig.id, applied)) continue;
        const holder = buddyWithRole(gig.contactRole);
        const contact = holder ? this.social.getBuddy(holder.id) : undefined;
        const gone = !contact || contact.status === 'distant' || contact.status === 'gone' || contact.status === 'blocked';
        const stage = contact ? this.social.getRelationshipStage(contact.id) : 'stranger';
        const { accepted, odds } = decideApplication({
          baseOdds: gig.baseOdds, contactStage: stage, contactGone: gone, roll: jobRoll(`job:${gig.id}:${applied}`),
        });
        this.world.setFlag(`jobapp_${gig.id}_done`, true);
        if (accepted && contact) {
          const targetDay = day + 1;
          this.world.scheduleAppointment({
            id: `gig_${gig.id}_${targetDay}_${applied % 1000}`.slice(0, 60),
            characterId: contact.id,
            locationId: 'work',
            targetDay,
            startMinute: 9 * 60,
            endMinute: Math.min(9 * 60 + gig.durationMin, 12 * 60),
            description: `${gig.title} (job board, $${gig.pay})`,
            status: 'confirmed',
            rsvp: 'yes',
            wageOverride: gig.pay,
            origin: { kind: 'job', id: gig.id },
          });
          this.social.sendMessage(contact.id, contact.id, 'player', pickJobAcceptLine(`${gig.id}:${day}`, gig.title, 'tomorrow'), now, false, ['job', 'accepted']);
          this.telemetry.logEvent('economy', 'job_accepted', now, { gigId: gig.id, odds });
        } else if (contact) {
          this.social.sendMessage(contact.id, contact.id, 'player', pickJobRejectLine(`${gig.id}:${day}`, gig.title), now, false, ['job', 'rejected']);
          this.telemetry.logEvent('economy', 'job_rejected', now, { gigId: gig.id, odds });
        }
      }
    } catch { /* job replies never break the tick */ }
  }

  // ==========================================
  // P6 — CORNERMART ORDERS (pickup trip vs 2–24h courier, rules-only)
  // Pickup: 30-min errand + a little energy, pantry now. Delivery: free but
  // slow (deterministic ETA); completion credits the pantry + notifies.
  // ==========================================

  public placeGroceryOrder(
    rawItems: Array<{ sku: string; qty: number }>,
    fulfillment: Fulfillment,
    nowMinute: number
  ): ActionResult & { data?: { orderId: string; etaMinute: number; summary: string } } {
    try {
      const items = (rawItems || [])
        .filter((i) => i && GROCERY_SKUS[i.sku] && Number.isFinite(i.qty) && i.qty >= 1)
        .map((i) => ({ sku: i.sku, qty: Math.min(9, Math.floor(i.qty)) }));
      if (items.length === 0) return { success: false, error: 'Cart is empty.' };
      const total = items.reduce((sum, i) => sum + GROCERY_SKUS[i.sku]!.price * i.qty, 0);
      if (!this.economy.canAfford(total)) {
        return { success: false, error: `Cannot afford $${total.toFixed(2)} order.` };
      }
      if (fulfillment === 'pickup') {
        if (this.economy.getState().energy < 20) {
          return { success: false, error: 'Too tired for a store run (need 20% energy).' };
        }
        this.economy.spendCash(total, 'CornerMart pickup');
        this.advanceGameMinutes(30, 'CornerMart pickup run');
        this.economy.consumeEnergy(5);
        for (const item of items) {
          const sku = GROCERY_SKUS[item.sku]!;
          this.economy.addPantry(sku.pantry, sku.qty * item.qty);
        }
        const order = this.delivery.recordPickup(items, total, this.clock.getTotalMinutes());
        this.telemetry.logEvent('economy', 'order_pickup', this.clock.getTotalMinutes(), { orderId: order.id, total });
        this.notifySubscribers();
        return { success: true, data: { orderId: order.id, etaMinute: this.clock.getTotalMinutes(), summary: 'Picked up from CornerMart — pantry stocked.' } };
      }
      this.economy.spendCash(total, 'CornerMart delivery');
      // World-event courier backlog (#46): the event engine only publishes the
      // semantic effect; DeliveryEngine owns readyMinute via placeDelivery.
      let backlogExtra = 0;
      try {
        backlogExtra = totalDeliveryBacklogExtra(
          this.world.queryActiveModifiers({ domain: 'delivery', atMinute: nowMinute }),
        );
      } catch { backlogExtra = 0; }
      const order = this.delivery.placeDelivery(items, total, nowMinute, { etaExtraMinutes: backlogExtra });
      this.telemetry.logEvent('economy', 'order_placed', nowMinute, { orderId: order.id, total, etaMinute: order.readyMinute });
      this.notifySubscribers();
      const etaH = Math.round((order.readyMinute - nowMinute) / 60);
      return { success: true, data: { orderId: order.id, etaMinute: order.readyMinute, summary: `Courier on the way — about ${etaH}h. Check Mailbox parcels.` } };
    } catch {
      return { success: false, error: 'Order failed.' };
    }
  }

  /** Credit arrived courier orders to the pantry (called from every time path). */
  private processDeliveries(): void {
    try {
      const now = this.clock.getTotalMinutes();
      const arrived = this.delivery.completeDue(now);
      for (const order of arrived) {
        for (const item of order.items) {
          const sku = GROCERY_SKUS[item.sku];
          if (sku) this.economy.addPantry(sku.pantry, sku.qty * item.qty);
        }
        this.world.setFlag(`delivery_arrived_${order.id}`, true);
        this.telemetry.logEvent('economy', 'order_delivered', now, { orderId: order.id });
      }
      if (arrived.length > 0) this.notifySubscribers();
    } catch { /* deliveries never break the tick */ }
  }

  // ==========================================
  // P6.4 — RENT LADDER (Henderson: remind → warn → pause downloads → thanks)
  // Lenient teeth: browsing works, new downloads nap until paid. Paper trail
  // goes to Mailbox via rentmail_* flags; Pulse carries the human voice.
  // ==========================================

  // Rent notes come from whoever holds the landlord role (rename-proof).
  // No landlord on the roster → the economy still ticks, the DM is skipped.
  // (Availability is NOT required — rent is owed even to a distant landlord.)
  private sendRentNote(text: string, tags: string[], currentMinutes: number, event: string, extra?: Record<string, unknown>): void {
    const holder = buddyWithRole('landlord');
    const landlord = holder ? this.social.getBuddy(holder.id) : undefined;
    if (!landlord) return;
    this.social.sendMessage(landlord.id, landlord.id, 'player', text, currentMinutes, false, ['rent', ...tags]);
    this.telemetry.logEvent('economy', event, currentMinutes, { buddyId: landlord.id, ...(extra ?? {}) });
  }

  private sendHendersonNote(text: string, tags: string[], currentMinutes: number, event: string, extra?: Record<string, unknown>): void {
    this.sendRentNote(text, tags, currentMinutes, event, extra);
  }

  /** Daily rent pass: gentle reminder → stern warning → overdue nudges. Rules only. */
  private processRentDaily(newDay: number): void {
    try {
      const minutes = this.clock.getTotalMinutes();
      const { rentDueDay: dueDay, rentPaid: paid, rentAmount: amount } = this.economy.getState();
      if (paid) {
        if (this.world.getFlag('rent_overdue')) this.world.setFlag('rent_overdue', false);
        return;
      }
      if (newDay === dueDay - 2 && !this.world.getFlag(`rent_reminded_${dueDay}`)) {
        this.world.setFlag(`rent_reminded_${dueDay}`, true);
        this.world.setFlag(`rentmail_due_${dueDay}`, Math.round(amount * 100));
        this.sendHendersonNote(pickRentReminderLine(`${dueDay}`, amount, dueDay), ['reminder'], minutes, 'rent_reminded', { dueDay });
      } else if (newDay === dueDay && !this.world.getFlag(`rent_warned_${dueDay}`)) {
        this.world.setFlag(`rent_warned_${dueDay}`, true);
        this.sendHendersonNote(pickRentSternLine(`${dueDay}`, amount, dueDay), ['warning'], minutes, 'rent_warned', { dueDay });
      } else if (newDay > dueDay) {
        // Catch-up for multi-day jumps: stamp the paper trail silently
        // (messages stay current-rung only — no backdated nag spam)
        if (!this.world.getFlag(`rent_reminded_${dueDay}`)) this.world.setFlag(`rent_reminded_${dueDay}`, true);
        if (!this.world.getFlag(`rentmail_due_${dueDay}`)) this.world.setFlag(`rentmail_due_${dueDay}`, Math.round(amount * 100));
        if (!this.world.getFlag('rent_overdue')) {
          this.world.setFlag('rent_overdue', true);
          this.world.setFlag(`rentmail_overdue_${dueDay}`, Math.round(amount * 100));
        }
        if (!this.world.getFlag(`rent_nudge_${newDay}`)) {
          this.world.setFlag(`rent_nudge_${newDay}`, true);
          this.sendHendersonNote(pickRentNudgeLine(`${newDay}`, amount), ['nudge'], minutes, 'rent_nudged', { dueDay });
        }
      }
    } catch { /* rent never breaks the tick */ }
  }

  // ==========================================
  // P6.3 — CITY OUTINGS (diner / canal / laundromat, rules-only)
  // Deterministic encounters feed memories + dims + Pulse messages;
  // the laundromat returns a rumor in the action result (UI notice).
  // ==========================================

  private static isBuddyAvailable(buddy: { status?: string } | undefined): boolean {
    return !!buddy && buddy.status !== 'distant' && buddy.status !== 'gone' && buddy.status !== 'blocked';
  }

  public doCityOuting(rawOutingId: string): ActionResult & { data?: { summary: string; encounterBuddyId?: string; rumor?: string } } {
    try {
      if (!isValidOutingId(rawOutingId)) return { success: false, error: `Unknown outing: ${rawOutingId}` };
      const outingId: OutingId = rawOutingId;
      const spec = OUTINGS[outingId];
      // P7 gating: outings happen where they happen
      const homeNode = SimulationEngine.outingHomeNode(outingId);
      if (homeNode) {
        const err = SimulationEngine.requireLocation(this.economy.getLocation(), homeNode);
        if (err) return { success: false, error: err };
      }
      const day = this.clock.getTime().day;
      const hour = this.clock.getTime().hour;
      const minutes = this.clock.getTotalMinutes();
      const player = this.economy.getState();
      if (player.energy < MIN_OUTING_ENERGY) {
        return { success: false, error: `Too tired to head out (need ${MIN_OUTING_ENERGY}% energy). Rest first.` };
      }
      if (spec.cost > 0 && !this.economy.canAfford(spec.cost)) {
        return { success: false, error: `Cannot afford ${spec.label} ($${spec.cost.toFixed(2)}).` };
      }
      // Social battery: going out costs presence (~1 per 6 minutes out).
      const outingBattery = batteryCostForOuting(spec.minutes);
      if (this.economy.getSocialBattery() < outingBattery) {
        return { success: false, error: pickInnerVoice('outing', `${outingId}:${day}`) };
      }
      // P6 the city keeps time — closed places fail honestly (UI gates too)
      if (!isOutingOpen(outingId, hour)) {
        return { success: false, error: `${spec.label} is closed now (open ${outingHoursLabel(outingId)}).` };
      }
      const weather = getWeatherForDay(day);
      if (outingId === 'canal_walk' && weather.condition === 'storm') {
        return { success: false, error: 'Canal storm outside — the walkway is closed. Come back after the front passes.' };
      }
      if (spec.cost > 0) this.economy.spendCash(spec.cost, `City outing (${spec.label})`);
      this.economy.spendSocialBattery(outingBattery);
      this.advanceGameMinutes(spec.minutes, `City outing: ${spec.label}`);
      if (spec.energyDelta < 0) this.economy.consumeEnergy(-spec.energyDelta);
      else this.economy.restoreEnergy(spec.energyDelta);
      this.economy.addHunger(spec.hungerDelta);
      this.economy.addHealth(spec.healthDelta);

      // Encounters (deterministic per day; buddies must be present and available).
      // Whoever holds the role shows up — voice pool follows temperament, not identity.
      if (outingId === 'diner_soup' || outingId === 'diner_platter' || outingId === 'diner_pie') {
        const staffer = buddyWithRole('diner-staff');
        const maya = staffer ? this.social.getBuddy(staffer.id) : undefined;
        if (SimulationEngine.isBuddyAvailable(maya) && maya && mayaDinerEncounter(hour, day)) {
          const buddyId = maya.id;
          this.social.applySocialAction(buddyId, 'remembered_detail');
          this.social.addCoreMemory(buddyId, { text: `Ran into ${maya.displayName} working the diner, Day ${day}.`, kind: 'shared_moment', day });
          // Face to face: you learn their handle on the spot.
          this.social.learnHandle(buddyId, maya.handle);
          // Showing up in person reads spontaneous.
          this.social.observePlayerTrait(buddyId, { spontaneity: 70 }, day);
          const shy = this.social.getTraits(buddyId).shyness >= 60;
          const line = shy ? pickOutingNoraLine(`${outingId}:${day}`) : pickOutingMayaLine(`${outingId}:${day}`);
          this.social.sendMessage(buddyId, buddyId, 'player', line, this.clock.getTotalMinutes(), false, ['outing', 'diner']);
          this.telemetry.logEvent('social', 'outing_encounter', minutes, { buddyId, outing: outingId });
          this.notifySubscribers();
          return { success: true, data: { summary: `Hearty ${spec.label} at the diner — and ${maya.displayName} was on shift!`, encounterBuddyId: buddyId } };
        }
        this.telemetry.logEvent('room', 'outing_diner', minutes, { outing: outingId });
        this.notifySubscribers();
        return { success: true, data: { summary: `Hearty ${spec.label} at the diner. Quiet tables, good coffee.` } };
      }
      if (outingId === 'canal_walk') {
        const regular = buddyWithRole('canal-regular');
        const walker = regular ? this.social.getBuddy(regular.id) : undefined;
        const raining = isWetWeather(weather.condition);
        if (SimulationEngine.isBuddyAvailable(walker) && walker && noraCanalEncounter(hour, day, raining)) {
          const buddyId = walker.id;
          this.social.applySocialAction(buddyId, 'intellectual_curiosity');
          this.social.addCoreMemory(buddyId, { text: `Walked the canal with ${walker.displayName}, Day ${day}${raining ? ' in the rain' : ''}.`, kind: 'shared_moment', day });
          // Face to face: you learn their handle on the spot.
          this.social.learnHandle(buddyId, walker.handle);
          // Showing up in person reads spontaneous.
          this.social.observePlayerTrait(buddyId, { spontaneity: 70 }, day);
          const shy = this.social.getTraits(buddyId).shyness >= 60;
          const line = shy ? pickOutingNoraLine(`${outingId}:${day}`) : pickOutingMayaLine(`${outingId}:${day}`);
          this.social.sendMessage(buddyId, buddyId, 'player', line, this.clock.getTotalMinutes(), false, ['outing', 'canal']);
          this.telemetry.logEvent('social', 'outing_encounter', minutes, { buddyId, outing: outingId });
          this.notifySubscribers();
          return { success: true, data: { summary: `Canal walk${raining ? ' in the rain' : ''} — crossed paths with ${walker.displayName}.`, encounterBuddyId: buddyId } };
        }
        this.telemetry.logEvent('room', 'outing_walk', minutes, { outing: outingId });
        this.notifySubscribers();
        return { success: true, data: { summary: `Canal walk${raining ? ' in the rain' : ''}. Cleared your head.` } };
      }
      // laundromat: rumor for the UI notice (no NPC message — dryers, not drama)
      const pairs = this.social.getBuddies()
        .filter((b) => SimulationEngine.isBuddyAvailable(b))
        .flatMap((a, i, list) => list.slice(i + 1).map((b) => ({ aName: a.displayName, bName: b.displayName, affinity: this.social.getAffinity(a.id, b.id) })));
      const titles = this.world.getTriggeredEvents().map((e) => e.title);
      const rumor = buildLaundromatRumor(pairs, titles, `${day}`);
      this.telemetry.logEvent('room', 'outing_laundromat', minutes, { rumor });
      this.notifySubscribers();
      return { success: true, data: { summary: 'Laundromat: warm dryers, folded clothes.', rumor } };
    } catch {
      return { success: false, error: 'Outing failed.' };
    }
  }

  // ==========================================
  // P5.4 — MYPLACE SOCIAL LIFE (Top 8 + guestbook, rules-only, template-voiced)
  // Top 8s re-rank from live C2 affinities every 3rd day; entries celebrate.
  // Guestbooks get NPC→NPC notes daily; owners reply to the player's notes.
  // ==========================================

  /**
   * Which profile page belongs to a buddy. Legacy rich profiles win over stubs:
   * alias (maya_x) → handle → id, so notes land where players actually look.
   */
  private resolveProfileUsername(buddy: { id: string; handle: string }): string | null {
    try {
      const alias = CORE_PROFILE_ALIASES[buddy.id] ?? CORE_PROFILE_ALIASES[buddy.handle];
      if (alias && this.myplace.getNpcProfile(alias)) return alias;
      if (this.myplace.getNpcProfile(buddy.handle)) return buddy.handle;
      if (this.myplace.getNpcProfile(buddy.id)) return buddy.id;
    } catch { /* resolution is best-effort */ }
    return null;
  }

  private static top8StageBonus(stage: string): number {
    if (stage === 'close') return 30;
    if (stage === 'friend') return 20;
    if (stage === 'acquaintance') return 10;
    if (stage === 'stranger') return 0;
    return -50; // strained: out of the running
  }

  /** Periodic Top 8 re-rank from live affinities (days 4, 7, 10, ...). Rules only. */
  private refreshTop8Periodic(newDay: number): void {
    if (newDay <= 1 || newDay % 3 !== 1) return;
    try {
      const minutes = this.clock.getTotalMinutes();
      for (const buddy of this.social.getBuddies()) {
        if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const profileKey = this.resolveProfileUsername(buddy);
        if (!profileKey) continue;
        const ranked = this.social.getBuddies()
          .filter((o) => o.id !== buddy.id && o.status !== 'distant' && o.status !== 'gone' && o.status !== 'blocked')
          .map((o) => ({
            buddy: o,
            score: this.social.getAffinity(buddy.id, o.id) + SimulationEngine.top8StageBonus(this.social.getRelationshipStage(o.id)),
          }))
          .sort((x, y) => y.score - x.score || (x.buddy.id < y.buddy.id ? -1 : 1))
          .slice(0, 8);
        const prevTop3 = String(this.world.getFlag(`top3_${profileKey}`) || '').split(',').filter(Boolean);
        const nextTop3 = ranked.slice(0, 3).map((s) => s.buddy.id);
        this.myplace.setNpcTop8(profileKey, ranked.map((s) => {
          const uname = this.resolveProfileUsername(s.buddy) ?? s.buddy.handle;
          const avatar = this.myplace.getNpcProfile(uname)?.avatarGlyph || '📷';
          return { handle: uname, name: s.buddy.displayName, avatar };
        }));
        this.world.setFlag(`top3_${profileKey}`, nextTop3.join(','));
        // Entries celebrate (positive-only news, one per day max)
        const entered = nextTop3.filter((id) => !prevTop3.includes(id));
        if (entered.length > 0 && !this.world.getFlag(`top8news_${newDay}`)) {
          const entering = this.social.getBuddy(entered[0]!);
          if (entering) {
            const stage = this.social.getRelationshipStage(entering.id);
            if (stage === 'friend' || stage === 'close') {
              this.world.setFlag(`top8news_${newDay}`, true);
              const rank = nextTop3.indexOf(entering.id) + 1;
              this.social.sendMessage(entering.id, entering.id, 'player', pickTop8NewsLine(`${profileKey}:${newDay}`, buddy.displayName, rank), minutes, false, ['myplace', 'top8']);
              this.telemetry.logEvent('social', 'myplace_top8_news', minutes, { buddyId: entering.id, owner: profileKey, rank });
            }
          }
        }
      }
    } catch { /* Top 8 never breaks the tick */ }
  }

  /** Daily guestbook life: NPC→NPC notes (max 2) + owner replies to yesterday's player notes (max 2). */
  private processGuestbookDaily(newDay: number): void {
    try {
      const minutes = this.clock.getTotalMinutes();
      const active = this.social.getBuddies().filter((b) => b.status !== 'distant' && b.status !== 'gone' && b.status !== 'blocked');
      if (active.length >= 2) {
        for (let slot = 0; slot < 2; slot++) {
          const writer = active[appointmentRoll(`${newDay}:gbw:${slot}`) % active.length]!;
          const others = active.filter((b) => b.id !== writer.id);
          if (others.length === 0) continue;
          const target = others[appointmentRoll(`${newDay}:gbt:${slot}`) % others.length]!;
          const targetKey = this.resolveProfileUsername(target);
          if (!targetKey) continue;
          // Guestbook culture is casual: any active, non-strained buddy signs
          if (this.social.getRelationshipStage(writer.id) === 'strained') continue;
          const writerKey = this.resolveProfileUsername(writer) ?? writer.handle;
          this.myplace.addGuestbookComment(targetKey, writerKey, pickGuestbookLine(`${targetKey}:${newDay}:${slot}`, target.displayName), minutes);
          this.telemetry.logEvent('social', 'myplace_guestbook', minutes, { from: writer.id, to: targetKey });
        }
      }
      let replies = 0;
      for (const buddy of this.social.getBuddies()) {
        if (replies >= 2) break;
        if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const key = this.resolveProfileUsername(buddy);
        if (!key) continue;
        const entries = this.myplace.getGuestbook(key);
        const playerNote = entries.find((e) => e.author === 'wanderer06' && Math.floor(e.minute / 1440) + 1 === newDay - 1);
        if (!playerNote) continue;
        const alreadyReplied = entries.some((e) => e.minute > playerNote.minute
          && (e.author === key || e.author === buddy.handle || e.author === buddy.id));
        if (alreadyReplied) continue;
        if (appointmentRoll(`${key}:${newDay}:gbreply`) >= 60) continue;
        this.myplace.addGuestbookComment(key, key, pickGuestbookReplyLine(`${key}:${newDay}`), minutes);
        replies++;
        this.telemetry.logEvent('social', 'myplace_guestbook_reply', minutes, { to: key });
      }
    } catch { /* guestbook never breaks the tick */ }
  }

  public async generateProceduralEventsNow(options?: { maxEvents?: number; useAI?: boolean }): Promise<import('./types').GlobalEvent[]> {
    const currentDay = this.clock.getTime().day;
    const totalMinutes = this.clock.getTotalMinutes();
    const { ProceduralDirector } = await import('./ProceduralDirector');
    const dir = new ProceduralDirector(this.world);
    const res = await dir.generateNextBatch(currentDay, totalMinutes, {
      maxEvents: options?.maxEvents ?? 2,
      useAI: options?.useAI ?? true,
    });
    this.notifySubscribers();
    return res.events;
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    const currentMinutes = this.clock.getTotalMinutes();

    switch (action.type) {
      case 'TIME_ADVANCE_MINUTES': {
        this.advanceGameMinutes(action.minutes, action.reason);
        return { success: true };
      }

      case 'TIME_SET_PAUSED': {
        this.clock.setPaused(action.paused);
        this.notifySubscribers();
        return { success: true };
      }

      case 'VIEW_SWITCH': {
        // P7: sitting at the PC/room from out in the city walks you home first (time charged)
        if ((action.view === 'pc' || action.view === 'room') && this.economy.getLocation() !== 'home') {
          const home = this.travelTo('home', 'walk', { ignoreFatigue: true });
          if (!home.success) return { success: false, error: home.error };
        }
        this.activeView = action.view;
        // P5: visiting cafe/work counts as showing up for that day's meetings there
        if (action.view === 'cafe' || action.view === 'work') {
          try { this.world.setFlag(`visited_${action.view}_${this.clock.getTime().day}`, true); } catch { /* attendance is best-effort */ }
        }
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_EARN_CASH': {
        this.economy.earnCash(action.amount, action.reason);
        this.telemetry.logEvent('economy', 'cash_earned', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_SPEND_CASH': {
        const ok = this.economy.spendCash(action.amount, action.reason);
        if (!ok) return { success: false, error: 'Insufficient funds.' };
        this.telemetry.logEvent('economy', 'cash_spent', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_WORK_SHIFT': {
        // P7 gating: shifts are worked at the food cart
        const cartErr = SimulationEngine.requireLocation(this.economy.getLocation(), 'cart');
        if (cartErr) return { success: false, error: cartErr };
        const shiftRes = this.economy.performWorkShift(action.durationMinutes, action.wage);
        if (!shiftRes.success) return { success: false, error: shiftRes.error };
        this.advanceGameMinutes(action.durationMinutes ?? 240, 'Work Shift');
        this.telemetry.logEvent('economy', 'shift_worked', currentMinutes, {
          wage: shiftRes.earnedWage,
          hours: shiftRes.hours,
        });
        return { success: true, data: shiftRes };
      }

      case 'PLAYER_PAY_RENT': {
        const rentRes = this.economy.payRent();
        if (!rentRes.success) return { success: false, error: rentRes.error };
        // P6.4 kindness restored: line unpaused + Henderson says thanks
        if (this.world.getFlag('rent_overdue')) this.world.setFlag('rent_overdue', false);
        try {
          this.sendHendersonNote(pickRentThanksLine(`paid${this.clock.getTime().day}`), ['thanks'], currentMinutes, 'rent_thanked', {});
        } catch { /* thanks is best-effort */ }
        this.telemetry.logEvent('economy', 'rent_paid', currentMinutes, {
          day: this.clock.getTime().day,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_PAY_INTERNET': {
        const netRes = this.economy.payInternetBill();
        if (!netRes.success) return { success: false, error: netRes.error };
        this.telemetry.logEvent('economy', 'internet_bill_paid', currentMinutes);
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_REST_OR_SLEEP': {
        const wakeHour = action.wakeHour ?? 8;
        const bedtimeHour = this.clock.getTime().hour; // P6.1 sleep quality needs bedtime
        const jump = this.clock.jumpToNextMorning(wakeHour, action.wakeMinute ?? 0);
        const hoursSlept = jump.elapsedMinutes / 60;
        this.economy.restOrSleep(hoursSlept, bedtimeHour);
        this.economy.advanceTime(jump.elapsedMinutes); // P6.1 you still get hungry overnight (slowly)
        this.processDeliveries(); // P6 couriers arrive while you sleep
        this.processJobReplies(); // P6 replies wait in the morning
        const newTotalMinutes = this.clock.getTotalMinutes();
        this.downloads.advanceTime(jump.elapsedMinutes, newTotalMinutes);
        this.social.updatePresence(newTotalMinutes);
        this.world.checkAndTriggerEvents(newTotalMinutes, jump.newTime.day);

        if (jump.dayChanged) {
          this.events.emit('time:day_changed', {
            newDay: jump.newTime.day,
            previousDay: jump.previousTime.day,
            time: jump.newTime,
          });
        }

        this.telemetry.logEvent('room', 'sleep', currentMinutes, {
          hoursSlept,
          wakeDay: jump.newTime.day,
        });
        // Social battery: a full night restores the introvert (+30, capped).
        this.economy.rechargeSocialBattery(30);
        this.notifySubscribers();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        // P7 gating: room comforts live in Room 104
        const roomErr = SimulationEngine.requireLocation(this.economy.getLocation(), 'home');
        if (roomErr) return { success: false, error: roomErr };
        const durations: Record<string, number> = {
          tea: 6,
          coffee: 5,
          meal: 15,
          groceries: 30,
          shower: 12,
          window: 4,
        };
        const dur = durations[action.activity] ?? 10;
        // P6.1 noodles cost pantry money now (broke → honest failure, not free food)
        if (action.activity === 'meal') {
          const res = this.economy.eatMeal('noodles');
          if (!res.success) return { success: false, error: res.error };
        }
        if (action.activity === 'groceries') {
          const res = this.economy.eatMeal('groceries');
          if (!res.success) return { success: false, error: res.error };
        }
        this.advanceGameMinutes(dur, `Room interaction: ${action.activity}`);
        if (action.activity === 'tea' || action.activity === 'coffee') {
          this.economy.restoreEnergy(5);
          // Quiet rituals repay the introvert a little (+3 tea/coffee, +2 window below)
          this.economy.rechargeSocialBattery(3);
        } else if (action.activity === 'meal' || action.activity === 'groceries') {
          // Energy already handled inside eatMeal; time still passes above
        } else if (action.activity === 'shower') {
          this.economy.showerBoost();
        } else if (action.activity === 'window') {
          this.telemetry.recordWindowObservation();
          this.world.addWindowObservation(`window_day${this.clock.getTime().day}_${this.clock.getTotalMinutes()}`);
          this.economy.rechargeSocialBattery(2);
        }
        this.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        return { success: true };
      }

      case 'PLAYER_CITY_OUTING': {
        return this.doCityOuting(action.outingId);
      }

      case 'TRAVEL_TO': {
        return this.travelTo((action as { to: unknown }).to, (action as { mode: unknown }).mode);
      }

      case 'JOB_APPLY': {
        return this.applyForGig(action.gigId);
      }

      case 'PLAYER_PLACE_ORDER': {
        return this.placeGroceryOrder(action.items, action.fulfillment, currentMinutes);
      }

      case 'HARDWARE_UPGRADE_RAM': {
        if (!this.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford RAM upgrade ($${action.cost.toFixed(2)}).` };
        }
        this.economy.spendCash(action.cost, 'RAM Upgrade');
        const upgraded = this.hardware.upgradeRam(action.ramMB);
        if (!upgraded) return { success: false, error: 'Failed to upgrade RAM.' };
        this.telemetry.logEvent('hardware', 'ram_upgraded', currentMinutes, {
          ramMB: action.ramMB,
          cost: action.cost,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_CONNECTION': {
        if (!this.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford Internet upgrade ($${action.cost.toFixed(2)}).`,
          };
        }
        this.economy.spendCash(action.cost, 'Internet Plan Upgrade');
        this.hardware.upgradeConnection(action.connectionType);
        this.telemetry.logEvent('hardware', 'connection_upgraded', currentMinutes, {
          connection: action.connectionType,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_OS': {
        if (!this.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford OS upgrade package ($${action.cost.toFixed(2)}).`,
          };
        }
        // Core OS engine handles all lineage, RAM/disk/stability, and multi-reboot realism
        const hwState = this.hardware.getState();
        const can = this.os.canInstall(action.targetOs as any, hwState as any, this.clock.getTime().day);
        if (!can.ok) return { success: false, error: can.reasons.join(' ') };
        const targetRel = can.release!;
        // Allocate disk upfront (heavy OS simulation)
        if (!this.hardware.allocateDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024)) {
          return { success: false, error: `Not enough disk for ${targetRel.displayName} (${targetRel.installSizeGB}GB required). Free some space.` };
        }
        this.economy.spendCash(action.cost, `OS Upgrade (${targetRel.displayName})`);
        const res = this.os.beginInstall(action.targetOs as any, hwState as any, this.clock.getTime().day, currentMinutes);
        if (!res.success) {
          // refund disk on failure
          this.hardware.freeDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024);
          return { success: false, error: res.error };
        }
        // Realistic time: copying + reboots + finalizing (OsEngine logs minutes in install, we simulate)
        const ramFactor = hwState.ramMB < 768 ? 1.6 : hwState.ramMB < 1024 ? 1.2 : 1.0;
        const installMinutes = Math.round((22 + targetRel.installSizeGB * 14) * ramFactor) + (res.rebootCount ?? 2) * 3;
        this.advanceGameMinutes(installMinutes, `OS Install: ${targetRel.displayName} + ${res.rebootCount ?? 2} reboots`);
        // Sync hardware osVersion truth
        (this.hardware as any).state.osVersion = this.os.getCurrentOsId();
        // OS overhead already modeled via OsEngine.getRamOverheadMB() — HardwareEngine.calculateRamPressure reads it via sync? Keep hardware ramOverhead minimal here
        this.telemetry.logEvent('hardware', 'os_upgraded', currentMinutes, {
          targetOs: action.targetOs,
          displayName: targetRel.displayName,
          installMinutes,
          reboots: res.rebootCount,
          log: this.os.getInstallLog().slice(-3).join(' | '),
        });
        this.notifySubscribers();
        return { success: true, data: { ...res, release: targetRel, installMinutes } };
      }

      case 'DOWNLOAD_START': {
        // P6.4 lenient teeth: overdue rent pauses NEW downloads (browsing still works)
        if (this.world.getFlag('rent_overdue')) {
          return { success: false, error: 'Download line paused by the front desk — settle Room 104 rent to resume.' };
        }
        try {
          const task = this.downloads.startDownload({
            sourceId: action.sourceId,
            sourceUrl: action.url,
            fileName: action.fileName,
            totalBytes: action.totalBytes,
            sourceMaxKbps: action.sourceMaxKbps,
            fileKind: action.fileKind,
            appAssociation: action.appAssociation,
            manager: action.manager,
            currentMinute: currentMinutes,
          });
          this.notifySubscribers();
          return { success: true, data: task };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'DOWNLOAD_PAUSE': {
        const ok = this.downloads.pauseDownload(action.taskId);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'DOWNLOAD_RESUME': {
        const ok = this.downloads.resumeDownload(action.taskId);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'DOWNLOAD_CANCEL': {
        const ok = this.downloads.cancelDownload(action.taskId);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'VFS_CREATE_FILE': {
        try {
          const file = this.vfs.createFile(action.file, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: file };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_DELETE_FILE': {
        const ok = this.vfs.deletePermanently(action.path);
        this.notifySubscribers();
        return { success: ok };
      }

      case 'VFS_MOVE_TRASH': {
        try {
          const trashed = this.vfs.moveToTrash(action.path, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: trashed };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_RESTORE_TRASH': {
        try {
          const restored = this.vfs.restoreFromTrash(action.trashPath, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: restored };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_EMPTY_TRASH': {
        const reclaimed = this.vfs.emptyTrash();
        this.notifySubscribers();
        return { success: true, data: { bytesReclaimed: reclaimed } };
      }

      case 'SOFTWARE_INSTALL': {
        try {
          const wizard = this.software.startInstallerWizard(action.softwareId);
          if (!wizard.compatibilityResult.isCompatible) {
            return {
              success: false,
              error: 'Software incompatible with current system specifications.',
            };
          }
          if (action.selectedOptions) {
            for (const [k, v] of Object.entries(action.selectedOptions)) {
              wizard.selectedOptions.acceptedBundledOffers[k] = v;
            }
          }
          const installed = this.software.completeInstallation(wizard.sessionId, currentMinutes);
          this.telemetry.logEvent('software', 'installed', currentMinutes, {
            softwareId: action.softwareId,
          });
          this.notifySubscribers();
          return { success: true, data: installed };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOFTWARE_UNINSTALL': {
        const ok = this.software.uninstallSoftware(action.installedId);
        this.telemetry.logEvent('software', 'uninstalled', currentMinutes, {
          installedId: action.installedId,
        });
        this.notifySubscribers();
        return { success: ok };
      }

      case 'SOCIAL_SEND_MESSAGE': {
        try {
          // Social battery gate (introvert meter): every send costs, bold sends
          // cost more, and an empty meter refuses (apologies always pass).
          const gate = this.gatePlayerMessage(action.buddyId, action.text, action.tags);
          if (!gate.ok) return { success: false, error: gate.error };
          const msg = this.social.sendMessage(
            action.buddyId,
            'player',
            action.buddyId,
            action.text,
            currentMinutes,
            false,
            action.tags,
            (action as any).imageUrl,
            (action as any).imagePrompt,
            (action as any).imageCaption
          );
          this.notifySubscribers();
          return { success: true, data: msg };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_RECEIVE_MESSAGE': {
        const msg = this.social.sendMessage(
          action.buddyId,
          action.buddyId,
          'player',
          action.text,
          action.timestampMinute ?? currentMinutes,
          action.deliveredAway ?? false,
          action.tags,
          (action as any).imageUrl,
          (action as any).imagePrompt,
          (action as any).imageCaption
        );
        this.notifySubscribers();
        return { success: true, data: msg };
      }

      case 'SOCIAL_APPLY_ACTION': {
        try {
          const rels = this.social.applySocialAction(action.buddyId, action.socialAction);
          // P3 sharp-event ladder: sustained dismissiveness has consequences (rules only)
          this.checkSharpRelationship(action.buddyId, currentMinutes);
          this.notifySubscribers();
          return { success: true, data: rels };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'MEDIATION_RESPOND': {
        try {
          const res = this.social.respondMediation(action.mediationId, action.choice, this.clock.getTime().day);
          if (!res) return { success: false, error: `Mediation not found or closed: ${action.mediationId}` };
          // A helped requester says thanks out loud (rules-picked line, capped by resolve-once).
          if (action.choice === 'help') {
            this.social.sendMessage(res.requesterId, res.requesterId, 'player', pickMediationThanks(`${res.id}:${res.resolvedDay ?? 1}`), currentMinutes, false, ['mediation', res.id]);
          }
          this.telemetry.logEvent('social', 'mediation_responded', currentMinutes, { mediationId: res.id, choice: action.choice, status: res.status });
          this.notifySubscribers();
          return { success: true, data: res };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'ADD_CONTACT': {
        try {
          return this.addContactByHandle(String((action as { handle?: unknown }).handle ?? ''), currentMinutes);
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'NIGHTBOARD_MEET': {
        try {
          return this.meetOnNightBoard(currentMinutes);
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_ADD_BUDDY': {
        try {
          const checked = validatePersistedBuddy(action.buddy);
          if (!checked.ok || !checked.definition) return { success: false, error: checked.error ?? 'Invalid buddy definition.' };
          const registered = this.social.registerBuddy(checked.definition);
          // P3 origin memory: every buddy remembers how you met (immortal, shown in prompts)
          const meetDay = this.clock.getTime().day;
          this.social.addCoreMemory(registered.id, {
            text: `First met on Day ${meetDay} via ${registered.metVia ?? 'intro'}.`,
            kind: 'first_meeting',
            day: meetDay,
          });
          // Free roster: meeting someone IS learning their handle (contacts are earned).
          this.social.learnHandle(registered.id, registered.handle);
          // 'social:buddy_registered' fans out to attitudes + MyPlace stub (see registerInternalEventHandlers)
          if (!action.silent) {
            const text = (action.introText?.trim() || `hey, i'm ${registered.displayName} — nice meeting you!`).slice(0, 500);
            this.social.sendMessage(registered.id, registered.id, 'player', text, currentMinutes, true, ['intro', 'newcomer']);
          }
          this.telemetry.logEvent('social', 'buddy_added', currentMinutes, {
            buddyId: registered.id,
            metVia: registered.metVia ?? 'intro',
            silent: !!action.silent,
          });
          this.notifySubscribers();
          return { success: true, data: registered };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_REMOVE_BUDDY': {
        try {
          const ok = this.social.removeBuddy(action.buddyId);
          if (!ok) return { success: false, error: `Buddy not found: ${action.buddyId}` };
          this.telemetry.logEvent('social', 'buddy_removed', currentMinutes, { buddyId: action.buddyId });
          this.notifySubscribers();
          return { success: true };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'WORLD_SET_FLAG': {
        this.world.setFlag(action.key, action.value);
        this.events.emit('world:flag_changed', { key: action.key, value: action.value });
        this.notifySubscribers();
        return { success: true };
      }

      case 'WORLD_TRIGGER_EVENT': {
        const evt = this.world.triggerEventById(action.eventId, currentMinutes);
        if (!evt) return { success: false, error: `Event not found or already triggered: ${action.eventId}` };
        this.notifySubscribers();
        return { success: true, data: evt };
      }

      case 'WORLD_ADD_OBSERVATION': {
        this.world.addWindowObservation(action.entry);
        this.notifySubscribers();
        return { success: true };
      }

      case 'WORLD_SCHEDULE_APPOINTMENT': {
        const appt = this.world.scheduleAppointment(action.appointment);
        this.events.emit('world:appointment_scheduled', { appointment: appt });
        this.notifySubscribers();
        return { success: true, data: appt };
      }

      // Deprecated narrative aliases — routed to world
      case 'NARRATIVE_TRIGGER_BEAT': {
        // No-op in sandbox: beats removed. Keep for compat, emit but don't store.
        this.events.emit('narrative:beat_triggered', { beatId: (action as any).beatId });
        this.notifySubscribers();
        return { success: true };
      }

      case 'NARRATIVE_SET_FLAG': {
        this.world.setFlag(action.key, action.value);
        this.events.emit('world:flag_changed', { key: action.key, value: action.value });
        this.notifySubscribers();
        return { success: true };
      }

      case 'NARRATIVE_SCHEDULE_APPOINTMENT': {
        const appt = this.world.scheduleAppointment(action.appointment);
        this.events.emit('world:appointment_scheduled', { appointment: appt });
        this.notifySubscribers();
        return { success: true, data: appt };
      }

      default:
        return { success: false, error: `Unhandled action: ${(action as any).type}` };
    }
  }

  public subscribe(listener: (state: Readonly<SimulationState>) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    this._stateVersion++;
    // Invalidate cache so next getState() rebuilds
    this._cachedState = null;
    const currentState = this.getState();
    for (const listener of this.subscribers) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[SimulationEngine] Subscriber error:', err);
      }
    }
  }

  public exportSnapshot(): SimulationState {
    // Bypass the getState() reference cache: direct sub-engine mutations
    // (tests, bridge writes) don't bump the version, and saves must be truth.
    this._cachedState = null;
    return JSON.parse(JSON.stringify(this.getState()));
  }

  public exportFullSnapshot(saveSlotId = 'slot_1', saveName?: string): import('../persistence/schema').FullSimulationSnapshot {
    const state = this.getState();
    const now = Date.now();
    const saveSlot: import('../persistence/schema').SaveSlotRecord = {
      id: saveSlotId,
      name: saveName || `Day ${state.time.day} • ${state.time.timeOfDay}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      day: state.time.day,
      totalMinutes: state.time.totalMinutes,
      clockState: {
        day: state.time.day,
        hour: state.time.hour,
        minute: state.time.minute,
        totalMinutes: state.time.totalMinutes,
        timeOfDay: state.time.timeOfDay,
        isPaused: this.clock.isPaused(),
      },
      playerState: {
        cash: state.player.cash,
        energy: state.player.energy,
        fatigue: state.player.fatigue,
        socialBattery: state.player.socialBattery ?? 100,
        rentDueDay: state.player.rentDueDay,
        rentAmount: state.player.rentAmount,
        rentPaid: state.player.rentPaid,
        consecutiveLateWarnings: 0,
      },
      hardwareState: {
        cpuTier: state.hardware.cpuTier,
        ramMB: state.hardware.ramMB,
        hddTotalGB: state.hardware.hddTotalGB,
        hddFreeGB: state.hardware.hddFreeGB,
        connectionType: state.hardware.connectionType,
        connectionSpeedKbps: state.hardware.connectionSpeedKbps,
        osVersion: state.os.currentOsId as any,
        theme: (this.os.getTheme() as any) || 'orion_4_8',
        wallpaper: 'default',
      },
      narrativeFlags: { ...state.world.flags },
      meta: { os: state.os, worldEvents: state.world.triggeredEvents.length },
    };
    // Build worldState records from world
    const worldState: import('../persistence/schema').NarrativeStateRecord[] = [
      { key: 'world_flags', value: state.world.flags, updatedAt: now },
      { key: 'world_appointments', value: state.world.appointments, updatedAt: now },
      { key: 'world_windowHistory', value: state.world.windowObservationHistory, updatedAt: now },
      { key: 'world_triggeredEvents', value: state.world.triggeredEvents, updatedAt: now },
      { key: 'world_buddyKnowledge', value: state.world.buddyKnowledge, updatedAt: now },
    ];
    const osState: import('../persistence/schema').NarrativeStateRecord[] = [
      { key: 'os_state', value: state.os, updatedAt: now },
      { key: 'os_pulse_state', value: state.pulse, updatedAt: now },
      { key: 'os_myplace_state', value: state.myplace, updatedAt: now },
    ];
    return {
      saveSlot,
      vfsFiles: Object.values(state.vfs.files).map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        parentPath: f.parentPath,
        kind: f.kind as any,
        sizeBytes: f.sizeBytes,
        content: f.content,
        appAssociation: f.appAssociation,
        metadata: f.metadata as any,
        createdAt: f.createdAtMinute,
        modifiedAt: f.modifiedAtMinute,
      })),
      downloads: state.downloads.map((d) => ({
        id: d.id,
        sourceId: d.sourceId,
        url: d.sourceUrl,
        fileName: d.fileName,
        destinationPath: `${d.targetDirectory}/${d.fileName}`,
        totalBytes: d.totalBytes,
        downloadedBytes: d.downloadedBytes,
        sourceMaxKbps: d.sourceMaxKbps,
        status: d.status as any,
        resumable: d.resumable,
        startedAt: d.startedAtMinute,
        completedAt: d.completedAtMinute,
      })),
      installedSoftware: state.installedSoftware.map((s) => ({
        appId: s.appId,
        version: s.version,
        installPath: s.installPath,
        occupiedSizeBytes: s.installedBytes,
        isPortable: s.isPortable,
        bundledComponents: [],
        registeredInAddRemove: !s.isPortable,
        desktopShortcut: s.shortcuts.length > 0,
        startMenuEntry: true,
        installedAt: s.installedAtMinute,
      })),
      messages: Object.entries(state.social.conversations).flatMap(([buddyId, msgs]) =>
        msgs.map((m) => ({
          id: m.id,
          buddyId,
          sender: m.senderId as any,
          text: m.text,
          timestamp: m.timestampMinute,
          day: m.day,
          isRead: m.isRead,
        })),
      ),
      relationships: Object.entries(state.social.relationships).map(([buddyId, r]) => ({
        buddyId,
        familiarity: r.familiarity,
        trust: r.trust,
        comfort: r.comfort,
        respect: r.respect,
        annoyance: r.annoyance,
        lastInteractionDay: state.time.day,
        unlockedNotes: [],
        flags: {},
      })),
      narrativeState: worldState,
      worldState,
      osState,
      telemetryLogs: state.telemetry.logs.map((l) => ({
        timestamp: l.timestampMinutes,
        gameDay: Math.floor(l.timestampMinutes / 1440) + 1,
        gameMinutes: l.timestampMinutes,
        eventType: `${l.category}:${l.action}`,
        payload: l.data ?? {},
      })),
      pulseState: undefined,
    };
  }

  public loadSnapshot(snapshot: SimulationState): void {
    this.clock.setTotalMinutes(snapshot.time.totalMinutes);
    this.economy.loadState(snapshot.player);
    this.hardware.loadState(snapshot.hardware);
    // OsEngine — load from dedicated os field or fallback to hardware osVersion
    const osSrc = (snapshot as any).os ?? { currentOsId: (snapshot as any).hardware?.osVersion };
    if (osSrc) {
      try { this.os.loadState(osSrc); } catch {}
      // Sync hardware
      const osId = this.os.getCurrentOsId();
      (this.hardware as any).state.osVersion = osId;
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
    this.notifySubscribers();
  }
}
