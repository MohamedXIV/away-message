import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  buildLifeMatrixSnapshot,
  createSimulationLifeSources,
  buildCharacterObligations,
  selectCharacterIntent,
  deriveDefaultNpcPressure,
  advanceNpcPressure,
  projectLifePressureView,
  initializeActorGoals,
  hydrateNpcLives,
  type CharacterIntent,
  type CharacterObligation,
  type FidelityTier,
  type LifeMatrixSnapshot,
  type LifePressureView,
  type NpcLifeEntry,
  type NpcLifePersistedState,
  type NpcPressureState,
  type PersonalGoal,
} from '../life';

/**
 * Single canonical owner of each NPC's persistent goals and evolving pressure.
 * Never mirrors relationships/appointments, never owns a clock, and performs no
 * background work. All selectors share the same read-only domain source.
 *
 * #171 cutover: LegacyFacade may call this owner on the unmerged branch,
 * but the inherited execution class must be deleted before merge.
 */
export class NpcLifeRuntime {
  private entries: Map<string, NpcLifeEntry> = new Map();

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'social' | 'world'>,
    private readonly invalidate: () => void,
    initial?: NpcLifePersistedState,
  ) {
    this.loadState(initial);
  }

  public loadState(state?: NpcLifePersistedState): void {
    this.entries = new Map(Object.entries(hydrateNpcLives(state ?? {})));
    this.ensureAllNpcLifeEntries();
    this.invalidate();
  }

  public getLifeSnapshot(actorId: string): LifeMatrixSnapshot | null {
    return buildLifeMatrixSnapshot(
      createSimulationLifeSources({
        social: this.owners.social,
        world: this.owners.world,
        getNpcPressure: (id) => this.getNpcPressure(id),
        getPersonalGoals: (id) => this.getPersonalGoals(id),
        getFidelityTier: (id) => this.getFidelityTier(id),
      }),
      actorId,
      this.owners.clock.getTotalMinutes(),
    );
  }

  /**
   * On-demand character obligations: projects the actor's current life
   * snapshot through the pure obligation projector. No cache, no tick
   * hook, no persisted state — missing actors yield an empty list.
   */
  public getCharacterObligations(actorId: string): CharacterObligation[] {
    const snapshot = this.getLifeSnapshot(actorId);
    return snapshot ? buildCharacterObligations(snapshot) : [];
  }

  /**
   * On-demand character intent (#44): selects WHAT the actor currently
   * intends plus WHY from a fresh snapshot. Pure read — no cache, no tick
   * hook, no persisted ledger, no consequences. Missing actors yield null.
   */
  public getCharacterIntent(actorId: string): CharacterIntent | null {
    const snapshot = this.getLifeSnapshot(actorId);
    if (!snapshot) return null;
    const intent = selectCharacterIntent(snapshot);
    if (!intent) return null;
    return { ...intent, reasons: [...intent.reasons], blockers: [...intent.blockers] };
  }

  /** Canonical #43 slice as plain snapshot data (deep copies, bounded). */
  public getNpcLivesState(): NpcLifePersistedState {
    const out: NpcLifePersistedState = {};
    for (const [actorId, entry] of this.entries) {
      out[actorId] = {
        goals: entry.goals.map((goal) => ({
          ...goal,
          ...(goal.metadata ? { metadata: { ...goal.metadata } } : {}),
        })),
        pressure: {
          ...entry.pressure,
          activeNeeds: [...entry.pressure.activeNeeds],
        },
      };
    }
    return out;
  }

  private deriveEntryPressure(actorId: string, day: number): NpcPressureState {
    const buddy = this.owners.social.getBuddy(actorId);
    const routine = buddy?.schedule[day] ?? buddy?.schedule[1] ?? [];
    const traits = this.owners.social.getTraits(actorId);
    const tier: FidelityTier = buddy?.reach === 'remote' ? 'background_remote' : 'important_local';
    return deriveDefaultNpcPressure(actorId, traits, routine as never, tier);
  }

  private initializeEntryGoals(actorId: string, day: number): PersonalGoal[] {
    const buddy = this.owners.social.getBuddy(actorId);
    if (!buddy) return [];
    const traits = this.owners.social.getTraits(actorId);
    const tier: FidelityTier = buddy.reach === 'remote' ? 'background_remote' : 'important_local';
    const bonds = this.owners.social
      .getBuddies()
      .filter((target) => target.id !== actorId)
      .map((target) => ({ targetId: target.id, ...this.owners.social.getNpcBond(actorId, target.id).dims }));
    const events = this.owners.world.getTriggeredEvents().map((e) => ({ ...e }));
    return initializeActorGoals(
      actorId,
      buddy.archetype || 'regular',
      `away_seed_${day}`,
      traits,
      bonds,
      events,
      tier,
    );
  }

  /**
   * Canonical entry, created deterministically when missing. Creation stamps
   * the authoritative minute WITHOUT simulating elapsed history — there is
   * no fake past to replay (old saves, late joiners). Never advances here;
   * time evolution happens only on explicit reads below. Returns null for
   * unknown actors (callers keep their null/[] contract).
   */
  private getOrCreateNpcLifeEntry(actorId: string): NpcLifeEntry | null {
    const buddy = this.owners.social.getBuddy(actorId);
    if (!buddy) return null;
    const atMinute = this.owners.clock.getTotalMinutes();
    const day = this.owners.clock.getTime().day;

    const existing = this.entries.get(actorId);
    if (existing) return existing;

    const entry: NpcLifeEntry = {
      goals: this.initializeEntryGoals(actorId, day),
      pressure: {
        ...this.deriveEntryPressure(actorId, day),
        lastUpdatedMinute: atMinute,
      },
    };
    this.entries.set(actorId, entry);
    this.invalidate();
    return entry;
  }

  /**
   * Coarse/event-driven time evolution for one entry. Pure function of the
   * persisted entry plus current schedule/appointment context — identical
   * reads at identical minutes always agree.
   */
  private advanceNpcLifeEntryToNow(actorId: string, entry: NpcLifeEntry): NpcLifeEntry {
    const buddy = this.owners.social.getBuddy(actorId);
    if (!buddy) return entry;
    const atMinute = this.owners.clock.getTotalMinutes();
    const day = this.owners.clock.getTime().day;
    if (entry.pressure.lastUpdatedMinute >= atMinute) return entry;

    const scheduleBlocks = (buddy.schedule[day] ?? []) as Array<{
      status?: string;
      startMinuteOfDay?: number;
      endMinuteOfDay?: number;
    }>;
    const minuteOfDay = ((atMinute % 1440) + 1440) % 1440;
    const isAtWork = scheduleBlocks.some((b) =>
      b.status === 'away'
      && (b.startMinuteOfDay ?? 0) <= minuteOfDay
      && minuteOfDay < (b.endMinuteOfDay ?? 0)
    );
    const inAppointment = this.owners.world.getAppointments().some((a) =>
      a.characterId === actorId && a.targetDay === day && minuteOfDay >= a.startMinute && minuteOfDay < (a.endMinute ?? a.startMinute + 60)
    );
    const updated: NpcLifeEntry = {
      goals: entry.goals,
      pressure: advanceNpcPressure(entry.pressure, entry.pressure.lastUpdatedMinute, atMinute, {
        day,
        isAtWork,
        inAppointment,
      }),
    };
    this.entries.set(actorId, updated);
    this.invalidate();
    return updated;
  }

  /** Materialize canonical entries for every known buddy (ctor/load deterministic defaults). */
  private ensureAllNpcLifeEntries(): void {
    for (const buddy of this.owners.social.getBuddies()) {
      this.getOrCreateNpcLifeEntry(buddy.id);
    }
  }

  /**
   * Coarse tick-driven time evolution (#43 fidelity law). Runs after every
   * clock movement so reads stay pure: observed and control sims evolve
   * identically whether or not anyone looked. Idempotent at a fixed minute.
   */
  public advanceAllNpcPressuresToNow(): void {
    for (const buddy of this.owners.social.getBuddies()) {
      const entry = this.getOrCreateNpcLifeEntry(buddy.id);
      if (entry) this.advanceNpcLifeEntryToNow(buddy.id, entry);
    }
  }

  public getNpcPressure(actorId: string): LifePressureView | null {
    const entry = this.getOrCreateNpcLifeEntry(actorId);
    if (!entry) return null;
    return projectLifePressureView(entry.pressure, this.owners.clock.getTotalMinutes());
  }

  public getPersonalGoals(actorId: string): PersonalGoal[] {
    const entry = this.getOrCreateNpcLifeEntry(actorId);
    if (!entry) return [];
    return entry.goals.map((g) => ({ ...g }));
  }

  public getFidelityTier(actorId: string): FidelityTier {
    const buddy = this.owners.social.getBuddy(actorId);
    if (!buddy) return 'background_remote';
    return buddy.reach === 'remote' ? 'background_remote' : 'important_local';
  }

}
