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
import { SoftwareRegistry } from './SoftwareRegistry';
import { SocialEngine } from './SocialEngine';
import { TelemetryEngine } from './TelemetryEngine';
import { WorldEventsEngine } from './WorldEventsEngine';
import { OsEngine } from './OsEngine';
import { PulseEngine } from './PulseEngine';
import { MyPlaceEngine } from './MyPlaceEngine';
import { validatePersistedBuddy } from './CharacterEngine';
import { generateNewcomer, shouldAutoDiscover, NEWCOMER_METVIA_ROTATION } from './CharacterDirector';
import { STRAINED_ANNOYANCE, DISTANT_ANNOYANCE, GONE_ANNOYANCE } from './SocialEngine';
import { pickConfrontLine, pickFarewellLine, pickReturnLine, pickInitiativeText, pickRsvpLine, pickStoodUpLine, pickMeetingApologyLine, resolveArchetype, isCoreBuddyId } from './characterTemplates';
import { parseMeetupProposal, isMeetupCancelText, decideRsvp, decideNpcShow, appointmentRoll, locationLabel, LOCATION_SLOTS } from './AppointmentDirector';

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
  public readonly software!: SoftwareRegistry;
  public readonly social!: SocialEngine;
  public readonly telemetry!: TelemetryEngine;
  public readonly world!: WorldEventsEngine;

  private activeView: 'pc' | 'room' | 'cafe' | 'work' = 'pc';
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
    this.activeView = initialState?.activeView ?? 'pc';

    this.registerInternalEventHandlers();
  }

  private registerInternalEventHandlers(): void {
    this.events.on('time:day_changed', ({ newDay }) => {
      this.economy.handleDayTransition(newDay);
      // P3 daily relationship pass: overdue promises + distant returns (rules only, no AI)
      this.processRelationshipDaily(newDay);
      // P5 daily meeting pass: RSVP for tomorrow + resolve the past (rules only, no AI)
      this.processAppointmentsDaily(newDay);
    });

    this.events.on('economy:cash_changed', ({ newCash }) => {
      this.telemetry.updateCashBounds(newCash);
    });

    // Unified roster: world attitudes + MyPlace pages follow SocialEngine registrations.
    this.world.setBuddyProvider(() =>
      this.social.getBuddies().map((b) => ({ id: b.id, archetype: b.archetype }))
    );
    this.events.on('social:buddy_registered', ({ buddy }: any) => {
      try {
        this.world.ensureAttitudesForBuddy(buddy.id, this.clock.getTotalMinutes());
      } catch { /* attitudes are best-effort */ }
      try {
        this.myplace.ensureNpcProfile({
          username: buddy.handle || buddy.id,
          displayName: buddy.displayName,
          archetype: buddy.archetype,
        });
        // Also index by raw id so MyPlace routing works with either key
        if (buddy.handle && buddy.handle !== buddy.id) {
          this.myplace.ensureNpcProfile({
            username: buddy.id,
            displayName: buddy.displayName,
            archetype: buddy.archetype,
          });
        }
      } catch { /* MyPlace stub is best-effort */ }
    });

    // Keep PulseEngine in sync when Pulse is installed via SoftwareRegistry
    this.events.on('software:installed' as any, ({ software }: any) => {
      if (software?.appId === 'app.pulse' || software?.appId === 'app.pulse_messenger' || String(software?.appId).includes('pulse')) {
        const version = String(software.version || '');
        // Try to find a PulseRelease matching this version
        try {
          const { getAllPulseReleases } = require('./PulseCatalog');
          const all = getAllPulseReleases() as Array<{ id: string; version: string }>;
          const match = all.find((r) => r.version === version) || all.find((r) => r.id.includes(version.replace('.', '_')));
          if (match) {
            (this.pulse as any).currentPulseId = match.id;
          }
        } catch {}
      }
    });
  }

  public getState(): Readonly<SimulationState> {
    // Cheap cache: if version hasn't changed, return same object reference to keep getSnapshot stable
    if (this._cachedState && this._cachedStateVersion === this._stateVersion) {
      return this._cachedState;
    }
    const vfsState = this.vfs.getState();
    const downloadState = this.downloads.getState();
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
      this.social.updatePresence(currentMinutes);
      this.world.checkAndTriggerEvents(currentMinutes, tickResult.time.day);
      try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, tickResult.time.day); } catch {}
      try { this.myplace.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents() } as any, tickResult.time.day, currentMinutes); } catch {}
      // MyPlace NPCs may change their profile and then message you about it (governed)
      if (tickResult.dayChanged) {
        void this.myplace.maybeUpdateRandomNpcProfile(tickResult.time.day, currentMinutes).then((res) => {
          if (res) {
            const link = `http://myplace.local/${res.username}`;
            const texts: Record<string, string> = {
              maya_x: `hey — i changed my MyPlace a bit, new bio and song. what do you think? ${link}`,
              tacocart_ryan: `yo changed my MyPlace — added some new stuff. check it? ${link} lmk`,
              nightowl87: `updated my MyPlace — new headline. does it read okay? ${link}`,
            };
            const text = texts[res.username] ?? `updated my MyPlace — ${res.profile.headline} ${link}`;
            try { this.social.sendMessage(res.username, res.username, 'player', text, currentMinutes, false, ['myplace_update']); } catch {}
            try { this.events.emit('social:message_received' as any, { message: { senderId: res.username, text } }); } catch {}
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
    this.social.updatePresence(currentMinutes);
    this.world.checkAndTriggerEvents(currentMinutes, jumpResult.newTime.day);
    try { this.os.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents(), pendingEvents: this.world.getPendingEvents() } as any, jumpResult.newTime.day); } catch {}
    try { this.myplace.syncFromWorldState({ triggeredEvents: this.world.getTriggeredEvents() } as any, jumpResult.newTime.day, currentMinutes); } catch {}
    if (jumpResult.dayChanged) {
      void this.myplace.maybeUpdateRandomNpcProfile(jumpResult.newTime.day, currentMinutes).then((res) => {
        if (res) {
          const link = `http://myplace.local/${res.username}`;
          const texts: Record<string, string> = {
            maya_x: `hey — i changed my MyPlace a bit, new bio and song. what do you think? ${link}`,
            tacocart_ryan: `yo changed my MyPlace — added some new stuff. check it? ${link} lmk`,
            nightowl87: `updated my MyPlace — new headline. does it read okay? ${link}`,
          };
          const text = texts[res.username] ?? `updated my MyPlace — ${res.profile.headline} ${link}`;
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
      const core = isCoreBuddyId(buddyId);
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
        if (!active || active === '') this.world.setFlag('sharp_active', buddyId);
        const text = pickConfrontLine(resolveArchetype(buddyId, buddy.archetype), `${buddyId}:${day}:sharp`);
        this.social.sendMessage(buddyId, buddyId, 'player', text, currentMinutes, false, ['sharp', 'confrontation']);
        this.telemetry.logEvent('social', 'relationship_confrontation', currentMinutes, { buddyId, annoyance: rels.annoyance, witnesses: this.shiftWitnessAffinities(buddyId, -4) });
        return;
      }
      if (core) return; // core buddies stay strained — they never walk away

      if (sharpState === 'confronted' && rels.annoyance >= DISTANT_ANNOYANCE) {
        const active = this.world.getFlag('sharp_active');
        if (active && active !== buddyId && active !== '') return;
        this.social.setBuddyStatus(buddyId, 'distant');
        this.world.setFlag(sharpKey, 'distant');
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
        this.telemetry.logEvent('social', 'appointment_cancelled', this.clock.getTotalMinutes(), { buddyId, appointmentId: target.id });
        return null;
      }
      const proposal = parseMeetupProposal(text);
      if (!proposal) return null;
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
          this.social.applySocialAction(buddy.id, appt.locationId === 'cafe' ? 'vulnerable_share' : 'work_camaraderie');
          this.social.addCoreMemory(buddy.id, { text: `Met ${name} at ${label}, Day ${appt.targetDay}.`, kind: 'shared_moment', day: appt.targetDay });
          this.telemetry.logEvent('social', 'appointment_happened', minutes, { buddyId: buddy.id, appointmentId: appt.id });
        } else if (npcShowed && !playerShowed) {
          this.world.updateAppointment(appt.id, { status: 'missed', isMissed: true, npcShowed: true, playerShowed: false });
          this.social.applySocialAction(buddy.id, 'dismissive');
          this.social.addCoreMemory(buddy.id, { text: `Stood up ${name} at ${label}, Day ${appt.targetDay}.`, kind: 'fact', day: appt.targetDay });
          this.social.sendMessage(buddy.id, buddy.id, 'player', pickStoodUpLine(appt.id, label), minutes, false, ['appointment', 'missed']);
          this.telemetry.logEvent('social', 'appointment_missed', minutes, { buddyId: buddy.id, appointmentId: appt.id });
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

  /** Player attendance: cafe/work = visited the view that day; lobby = DM'd that day. */
  private didPlayerAttend(appt: Appointment, buddyId: string): boolean {
    if (appt.locationId === 'cafe' || appt.locationId === 'work') {
      return this.world.getFlag(`visited_${appt.locationId}_${appt.targetDay}`) === true;
    }
    try {
      return this.social.getMessages(buddyId).some((m) => m.senderId === 'player' && m.day === appt.targetDay);
    } catch { return false; }
  }

  /** P5 daily pass: RSVP for tomorrow + resolve the past. Rules only, no AI. */
  private processAppointmentsDaily(newDay: number): void {
    this.runRsvpPass(newDay);
    this.resolveDueAppointments(newDay);
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
        const jump = this.clock.jumpToNextMorning(wakeHour);
        const hoursSlept = jump.elapsedMinutes / 60;
        this.economy.restOrSleep(hoursSlept);
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
        this.notifySubscribers();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        const durations: Record<string, number> = {
          tea: 6,
          coffee: 5,
          meal: 15,
          shower: 12,
          window: 4,
        };
        const dur = durations[action.activity] ?? 10;
        this.advanceGameMinutes(dur, `Room interaction: ${action.activity}`);
        if (action.activity === 'tea' || action.activity === 'coffee') {
          this.economy.restoreEnergy(5);
        } else if (action.activity === 'meal') {
          this.economy.restoreEnergy(15);
        } else if (action.activity === 'window') {
          this.telemetry.recordWindowObservation();
          this.world.addWindowObservation(`window_day${this.clock.getTime().day}_${this.clock.getTotalMinutes()}`);
        }
        this.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        return { success: true };
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
