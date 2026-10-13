import {
  SimulationState,
  SimulationAction,
  ActionResult,
  Appointment,
} from './types';
import { GameClock } from './GameClock';
import { EventBus } from './EventBus';
import { EconomyEngine } from './EconomyEngine';
import { PlayerNeedsEngine } from './PlayerNeedsEngine';
import { HardwareEngine } from './HardwareEngine';
import { FileSystemEngine } from './FileSystemEngine';
import { DownloadManager } from './DownloadManager';
import {
  DeliveryEngine,
  type Fulfillment,
  type PlaceDeliveryOptions,
} from './DeliveryEngine';
import { SoftwareRegistry } from './SoftwareRegistry';
import { SocialEngine } from './SocialEngine';
import { TelemetryEngine } from './TelemetryEngine';
import { WorldEventsEngine } from './WorldEventsEngine';
import { EnvironmentEngine } from './EnvironmentEngine';
import { MoodEngine } from './MoodEngine';
import type { GameContextReadApi } from './GameContext';

import { OsEngine } from './OsEngine';
import { PulseEngine } from './PulseEngine';
import { MyPlaceEngine } from './MyPlaceEngine';
import { validatePersistedBuddy } from './CharacterEngine';
import { generateNewcomer, shouldAutoDiscover, NEWCOMER_METVIA_ROTATION } from './CharacterDirector';

import { pickOutingWarmLine, pickOutingReservedLine, pickMediationThanks, pickContactLine, pickContactBounce, rollSeeded100, } from './characterTemplates';

import { OUTINGS, isValidOutingId, isOutingOpen, outingHoursLabel, dinerStaffEncounter, canalRegularEncounter, buildLaundromatRumor, MIN_OUTING_ENERGY, type OutingId } from './OutingDirector';

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
  } from './PlayerActs';
import { CITY_NODES, isCityNodeId, quoteTravel, walkEnergyCost, rollStreetEncounter, BUS_FARE, type CityNodeId, type TravelMode } from './CityMap';
import { pulseHasFeature, getAllPulseReleases } from './PulseCatalog';

import { createCoreDomainOwners, type CoreDomainOwners } from './kernel/CoreDomainOwners';
import { TimeAdvancement } from './kernel/TimeAdvancement';
import { projectCoreState } from './kernel/CoreStateProjection';
import { JobBoardCoordination } from './kernel/JobBoardCoordination';
import { GroceryDeliveryCoordination } from './kernel/GroceryDeliveryCoordination';
import { MyPlaceSocialCycle } from './kernel/MyPlaceSocialCycle';
import { RentCoordination } from './kernel/RentCoordination';
import { AppointmentCoordination } from './kernel/AppointmentCoordination';
import { SocialPresenceCycle } from './kernel/SocialPresenceCycle';
import { RelationshipContinuity } from './kernel/RelationshipContinuity';
import { NpcSocialLifeCycle } from './kernel/NpcSocialLifeCycle';

export class SimulationEngine {
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

  private activeView: 'pc' | 'room' | 'cafe' | 'work' | 'city' = 'room';
  private subscribers: Set<(state: Readonly<SimulationState>) => void> = new Set();
  private _procGenPending = false;
  private _procGenLastDay = 0;
  private _cachedState: Readonly<SimulationState> | null = null;
  private _cachedStateVersion = -1;
  private _stateVersion = 0;

  constructor(initialState?: Partial<SimulationState>) {
    // #171 transitional wiring on the unmerged feature branch. This is one
    // owner graph, not a parallel second engine. The inherited runtime below
    // must be removed before the atomic production cutover is merged.
    const owners = createCoreDomainOwners(initialState);
    this.coreOwners = owners;
    this.jobBoard = new JobBoardCoordination(owners, () => this.notifySubscribers());
    this.myplaceSocial = new MyPlaceSocialCycle(owners);
    this.rentCoordination = new RentCoordination(owners, () => this.notifySubscribers());
    this.appointmentCoordination = new AppointmentCoordination(owners);
    this.socialPresence = new SocialPresenceCycle(owners);
    this.relationshipContinuity = new RelationshipContinuity(owners);
    this.npcSocialLife = new NpcSocialLifeCycle(owners);
    this.groceryDelivery = new GroceryDeliveryCoordination(
      owners,
      (minutes, reason) => this.advanceGameMinutes(minutes, reason),
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
      processNewDay: (day) => {
        this.maybeScheduleProceduralGeneration();
        this.maybeAutoDiscoverNewcomer(day);
      },
      publishState: () => this.notifySubscribers(),
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
    // Mood context is derived, so reconcile before consulting the state cache.
    this.mood.publishIfChanged();
    // Cheap cache: if version hasn't changed, return same object reference to keep getSnapshot stable
    if (this._cachedState && this._cachedStateVersion === this._stateVersion) {
      return this._cachedState;
    }
    const newState = projectCoreState(this.coreOwners, this.activeView);
    this._cachedState = newState;
    this._cachedStateVersion = this._stateVersion;
    return newState;
  }

  /**
   * The migration branch delegates timing to one composed coordinator. This
   * inherited caller must be removed at the #171 atomic production cutover.
   */
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
    if (this.needs.getSocialBattery() < 2) {
      return { success: false, error: pickInnerVoice('blocked', `add:${target.id}:${day}`) };
    }
    if (this.world.getFlag(`contactadd_${target.id}_${day}`)) {
      return { success: false, error: 'You already reached out today. Give it a day.' };
    }
    this.world.setFlag(`contactadd_${target.id}_${day}`, true);
    this.needs.spendSocialBattery(2);
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
    if (this.needs.getSocialBattery() < 6) {
      return { success: false, error: pickInnerVoice('blocked', `nbmeet:${day}`) };
    }
    this.needs.spendSocialBattery(6);
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
      this.needs.rechargeSocialBattery(BATTERY_APOLOGY_REWARD);
      this.social.applySocialAction(buddyId, 'apologize');
      // Owning it reads loyal and kind.
      this.social.observePlayerTrait(buddyId, { loyalty: 65, warmth: 60 }, day);
      return { ok: true };
    }
    const assessment = classifyPlayerTone(text);
    if (this.needs.getSocialBattery() < assessment.upfrontCost) {
      return { ok: false, error: pickInnerVoice('blocked', `${buddyId}:${day}`) };
    }
    this.needs.spendSocialBattery(assessment.upfrontCost);
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
        this.needs.rechargeSocialBattery(BATTERY_WARM_REFUND + BATTERY_WARM_BONUS);
      } else if (reception === 'lukewarm') {
        // Short of the sting: spendSocialBattery leaves the balance (lenient).
        this.needs.spendSocialBattery(BATTERY_LUKEWARM_EXTRA);
      } else {
        this.needs.drainSocialBattery();
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
      const environment = this.gameContext.environment.current();
      if (to === 'canal' && environment.weather.condition === 'storm') {
        return { success: false, error: 'Canal walkway closed in the storm. Come back after the front passes.' };
      }
      const quote = quoteTravel(from, to, mode, environment.weather.tags.includes('wet'));
      if (quote.busUsed && !this.economy.canAfford(BUS_FARE)) {
        return { success: false, error: `Bus fare is $${BUS_FARE.toFixed(2)} — walk it instead?` };
      }
      const walkCost = quote.mode === 'walk' ? walkEnergyCost(quote.minutes) : 0;
      // P7 leniency: the auto-trip home never strands the player, whatever the legs feel like
      if (!options?.ignoreFatigue && this.needs.getState().energy < 10 && walkCost > 0) {
        return { success: false, error: 'Too tired to walk there (need 10% energy). Take the bus or rest.' };
      }
      if (quote.busUsed) this.economy.spendCash(BUS_FARE, `Bus to ${CITY_NODES[to].name}`);
      this.advanceGameMinutes(quote.minutes, `Travel: ${CITY_NODES[from].name} → ${CITY_NODES[to].name} (${quote.mode})`);
      if (walkCost > 0) this.needs.consumeEnergy(walkCost);
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
        const encounter = rollStreetEncounter(from, to, day, environment.weather.tags.includes('wet'), candidates);
        if (encounter && encounter.kind !== 'quiet') {
          if (encounter.cashDelta !== 0) this.economy.earnCash(encounter.cashDelta, 'Street find');
          if (encounter.energyDelta !== 0) {
            if (encounter.energyDelta < 0) this.needs.consumeEnergy(-encounter.energyDelta);
            else this.needs.restoreEnergy(encounter.energyDelta);
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

  public getJobBoard(): Array<{
    gig: import('./JobDirector').Gig;
    pending: boolean;
    appliedMinute: number;
  }> {
    return this.jobBoard.getJobBoard();
  }

  private applyForGig(gigId: string): ActionResult {
    return this.jobBoard.applyForGig(gigId);
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

  private static isBuddyAvailable<T extends { status?: string }>(buddy: T | undefined): buddy is T {
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
      const needs = this.needs.getState();
      if (needs.energy < MIN_OUTING_ENERGY) {
        return { success: false, error: `Too tired to head out (need ${MIN_OUTING_ENERGY}% energy). Rest first.` };
      }
      if (spec.cost > 0 && !this.economy.canAfford(spec.cost)) {
        return { success: false, error: `Cannot afford ${spec.label} ($${spec.cost.toFixed(2)}).` };
      }
      // Social battery: going out costs presence (~1 per 6 minutes out).
      const outingBattery = batteryCostForOuting(spec.minutes);
      if (this.needs.getSocialBattery() < outingBattery) {
        return { success: false, error: pickInnerVoice('outing', `${outingId}:${day}`) };
      }
      // P6 the city keeps time — closed places fail honestly (UI gates too)
      if (!isOutingOpen(outingId, hour)) {
        return { success: false, error: `${spec.label} is closed now (open ${outingHoursLabel(outingId)}).` };
      }
      const environment = this.gameContext.environment.current();
      if (outingId === 'canal_walk' && environment.weather.condition === 'storm') {
        return { success: false, error: 'Canal storm outside — the walkway is closed. Come back after the front passes.' };
      }
      if (spec.cost > 0) this.economy.spendCash(spec.cost, `City outing (${spec.label})`);
      this.needs.spendSocialBattery(outingBattery);
      this.advanceGameMinutes(spec.minutes, `City outing: ${spec.label}`);
      if (spec.energyDelta < 0) this.needs.consumeEnergy(-spec.energyDelta);
      else this.needs.restoreEnergy(spec.energyDelta);
      this.needs.addHunger(spec.hungerDelta);
      this.needs.addHealth(spec.healthDelta);

      // Encounters (deterministic per day; buddies must be present and available).
      // Whoever holds the role shows up — voice pool follows temperament, not identity.
      if (outingId === 'diner_soup' || outingId === 'diner_platter' || outingId === 'diner_pie') {
        const staffBuddy = this.social.getBuddyWithRole('diner-staff');
        if (SimulationEngine.isBuddyAvailable(staffBuddy) && staffBuddy && dinerStaffEncounter(hour, day)) {
          const buddyId = staffBuddy.id;
          this.social.applySocialAction(buddyId, 'remembered_detail');
          this.social.addCoreMemory(buddyId, { text: `Ran into ${staffBuddy.displayName} working the diner, Day ${day}.`, kind: 'shared_moment', day });
          // Face to face: you learn their handle on the spot.
          this.social.learnHandle(buddyId, staffBuddy.handle);
          // Showing up in person reads spontaneous.
          this.social.observePlayerTrait(buddyId, { spontaneity: 70 }, day);
          const shy = this.social.getTraits(buddyId).shyness >= 60;
          const line = shy ? pickOutingReservedLine(`${outingId}:${day}`) : pickOutingWarmLine(`${outingId}:${day}`);
          this.social.sendMessage(buddyId, buddyId, 'player', line, this.clock.getTotalMinutes(), false, ['outing', 'diner']);
          this.telemetry.logEvent('social', 'outing_encounter', minutes, { buddyId, outing: outingId });
          this.notifySubscribers();
          return { success: true, data: { summary: `Hearty ${spec.label} at the diner — and ${staffBuddy.displayName} was on shift!`, encounterBuddyId: buddyId } };
        }
        this.telemetry.logEvent('room', 'outing_diner', minutes, { outing: outingId });
        this.notifySubscribers();
        return { success: true, data: { summary: `Hearty ${spec.label} at the diner. Quiet tables, good coffee.` } };
      }
      if (outingId === 'canal_walk') {
        const walker = this.social.getBuddyWithRole('canal-regular');
        const raining = environment.weather.tags.includes('wet');
        if (SimulationEngine.isBuddyAvailable(walker) && walker && canalRegularEncounter(hour, day, raining)) {
          const buddyId = walker.id;
          this.social.applySocialAction(buddyId, 'intellectual_curiosity');
          this.social.addCoreMemory(buddyId, { text: `Walked the canal with ${walker.displayName}, Day ${day}${raining ? ' in the rain' : ''}.`, kind: 'shared_moment', day });
          // Face to face: you learn their handle on the spot.
          this.social.learnHandle(buddyId, walker.handle);
          // Showing up in person reads spontaneous.
          this.social.observePlayerTrait(buddyId, { spontaneity: 70 }, day);
          const shy = this.social.getTraits(buddyId).shyness >= 60;
          const line = shy ? pickOutingReservedLine(`${outingId}:${day}`) : pickOutingWarmLine(`${outingId}:${day}`);
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
   * profile alias → handle → id, so notes land where players actually look.
   */
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
        const durationMinutes = action.durationMinutes ?? 240;
        const wage = action.wage ?? 62.0;
        const needResult = this.needs.applyWorkShift();
        if (!needResult.success) return { success: false, error: needResult.error };
        const hours = durationMinutes / 60;
        this.economy.earnCash(wage, `Work shift (${hours} hrs)`);
        this.events.emit('economy:shift_completed', {
          wage,
          hours,
          energySpent: needResult.energySpent,
        });
        const shiftRes = {
          success: true,
          hours,
          earnedWage: wage,
          energySpent: needResult.energySpent,
          fatigueAdded: needResult.fatigueAdded,
        };
        this.advanceGameMinutes(durationMinutes, 'Work Shift');
        this.telemetry.logEvent('economy', 'shift_worked', currentMinutes, {
          wage: shiftRes.earnedWage,
          hours: shiftRes.hours,
        });
        return { success: true, data: shiftRes };
      }

      case 'PLAYER_PAY_RENT': {
        return this.rentCoordination.payRent();
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
        this.needs.restOrSleep(hoursSlept, bedtimeHour);
        this.needs.advanceTime(jump.elapsedMinutes); // P6.1 you still get hungry overnight (slowly)
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
        this.needs.rechargeSocialBattery(30);
        this.notifySubscribers();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        // P7 gating: room comforts require the player's current home
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
          this.needs.restoreEnergy(5);
          // Quiet rituals repay the introvert a little (+3 tea/coffee, +2 window below)
          this.needs.rechargeSocialBattery(3);
        } else if (action.activity === 'meal' || action.activity === 'groceries') {
          // Energy already handled inside eatMeal; time still passes above
        } else if (action.activity === 'shower') {
          this.needs.showerBoost();
        } else if (action.activity === 'window') {
          this.telemetry.recordWindowObservation();
          this.world.addWindowObservation(`window_day${this.clock.getTime().day}_${this.clock.getTotalMinutes()}`);
          this.needs.rechargeSocialBattery(2);
        }
        this.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        // Room mutations land after advanceGameMinutes() already notified once
        // (rebuilding the getState cache mid-handler). Notify again so reads
        // and subscribers observe the final tea/meal/shower/window state.
        this.notifySubscribers();
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
          return { success: false, error: 'Download line paused by property management — settle your residence rent to resume.' };
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
          this.relationshipContinuity.checkSharpRelationship(action.buddyId, currentMinutes);
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
    this.needs.loadState((snapshot as any).needs ?? snapshot.player);
    this.economy.loadState(snapshot.player);
    this.mood.loadState((snapshot as any).mood);
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
