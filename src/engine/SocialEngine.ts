import {
  AgendaItem,
  RelationshipDimensions,
  BuddyCharacter,
  BuddyLifecycleStatus,
  ActorCondition,
  BuddyPresence,
  CharacterTraits,
  CoreMemory,
  DailyMood,
  MediationKind,
  MediationRecord,
  MessageRecord,
  NpcBondDims,
  NpcBondState,
  NpcInteractionLog,
  NpcRomanceStage,
  PlayerReadState,
  PromiseRecord,
  RelationshipStage,
  SocialEngineState,
} from './types';
import { EventBus } from './EventBus';
import { getWeatherForDay, isWetWeather } from './WeatherEngine';
import { validateCharacterId, isValidSchedule, traitsForBuddy, clampTraits, clampRelationships, resolveArchetype } from './characterTemplates';
import { SEED_CHARACTERS, seedCharacterDef, isSeedCharacter, resolveAffinitySeeds } from './seedCharacters';
import { validatePersistedBuddy, sanitizeLanguages } from './CharacterEngine';
import { conditionFromLegacyStatus, projectLegacyBuddyStatus, validActorCondition } from './semantic/ActorCondition';
import type { BoardBuddy } from './BoardDirector';
import { ConversationHistory } from './social/ConversationHistory';
import { MAX_PHOTO_MEMORIES, SocialMemoryLedger, socialHashText } from './social/SocialMemoryLedger';
import { NpcRelationshipGraph } from './social/NpcRelationshipGraph';
import { PlayerRelationships, STRAINED_ANNOYANCE } from './social/PlayerRelationships';
import { PlayerReadLedger } from './social/PlayerReadLedger';
import { MediationLedger } from './social/MediationLedger';
import { SocialPresence } from './social/SocialPresence';
import { SocialActivityLedger } from './social/SocialActivityLedger';
import { SocialContactDirectory } from './social/SocialContactDirectory';
export { MAX_CORE_MEMORIES, MAX_OPEN_PROMISES, MAX_PHOTO_MEMORIES } from './social/SocialMemoryLedger';
export { STRAINED_ANNOYANCE } from './social/PlayerRelationships';

// P3 sharp-event thresholds (annoyance scale 0..100; dismissive gives +8)
export const DISTANT_ANNOYANCE = 85;
export const GONE_ANNOYANCE = 95;

// P4 buddy-to-buddy affinity bounds (room turns give +2, capped +6/pair/day)
export const MAX_AFFINITY = 100;
export const ROOM_BUMP_PER_TURN = 2;
export const ROOM_BUMP_DAILY_CAP = 6;

// Character Lives — caps that keep saves small and prompts bounded
export const MAX_AGENDA_PER_BUDDY_DAY = 4;
export const MAX_MEDIATIONS = 6;
export const MAX_NPC_SOCIAL_LOG = 20;
// Free roster — caps for contacts and epitaphs
export const MAX_KNOWN_HANDLES = 6;
export const MAX_EPITAPHS = 20;

/** Canonical affinity key: ids sorted alphabetically so (a,b) === (b,a). */
export function affinityKey(a: string, b: string): string {
  const x = normalizeBuddyId(a);
  const y = normalizeBuddyId(b);
  return x < y ? `${x}__${y}` : `${y}__${x}`;
}

/**
 * Canonical directed bond key: order matters (a→b differs from b→a).
 * Empty string for self-pairs (callers treat as no-bond).
 */
export function npcBondKey(rawFrom: string, rawTo: string): string {
  const from = normalizeBuddyId(rawFrom);
  const to = normalizeBuddyId(rawTo);
  if (!from || !to || from === to) return '';
  return `${from}__${to}`;
}

// Canonical actor ids and handle/former-id aliases derive from authored seed content.
// After a rename, old aliases keep resolving through `formerIds`; no actor id is privileged.
// Declared before SEED_AFFINITIES: seed keys are computed through
// affinityKey → normalizeBuddyId at module load (TDZ otherwise).
export const BUDDY_ID_ALIASES: Record<string, string> = Object.fromEntries(
  SEED_CHARACTERS.flatMap((b) => [[b.handle, b.id], ...b.formerIds.map((old): [string, string] => [old, b.id])])
);

export function normalizeBuddyId(id: string): string {
  return BUDDY_ID_ALIASES[id] ?? id;
}

/** Neutral directed bond (strangers who never interacted). Never stored — read default. */
export function neutralNpcBond(): NpcBondState {  return {
    dims: {
      familiarity: 0, trust: 0, comfort: 0, respect: 0, affection: 0,
      attraction: 0, annoyance: 0, suspicion: 0, resentment: 0,
    },
    romance: 'none',
    romanceSinceDay: 1,
    updatedDay: 1,
  };
}

/** Trait compatibility 0..100 (high = easy crush). Symmetric, deterministic, rules-only. */
export function traitCompatibility(a: CharacterTraits, b: CharacterTraits): number {
  const diff = Math.abs(a.shyness - b.shyness)
    + Math.abs(a.warmth - b.warmth)
    + Math.abs(a.spontaneity - b.spontaneity)
    + Math.abs(a.loyalty - b.loyalty)
    + Math.abs(a.discipline - b.discipline);
  return Math.max(0, Math.min(100, Math.round(100 - diff / 5)));
}

/** Normalize a possibly-v3 relationship record into the full v4 shape (0..100). */
export function normalizeRelationshipDims(raw: Partial<RelationshipDimensions> | undefined): RelationshipDimensions {
  return clampRelationships({
    familiarity: raw?.familiarity ?? 0,
    trust: raw?.trust ?? 0,
    comfort: raw?.comfort ?? 0,
    respect: raw?.respect ?? 0,
    annoyance: raw?.annoyance ?? 0,
    affection: raw?.affection ?? 0,
    attraction: raw?.attraction ?? 0,
    suspicion: raw?.suspicion ?? 0,
    resentment: raw?.resentment ?? 0,
  });
}

/**
 * Deterministic NPC↔NPC action → directed delta table (ported pattern from
 * orionos-game social-actions: semantic actions map to fixed numbers, never
 * model-picked). All values 0..100-clamped on apply.
 */
export const NPC_SOCIAL_ACTION_DELTAS: Record<string, Partial<NpcBondDims>> = {
  warm_chat: { familiarity: 2, comfort: 2, affection: 1 },
  shared_activity: { familiarity: 3, comfort: 3, affection: 2, trust: 1 },
  deep_talk: { familiarity: 2, trust: 3, comfort: 2, affection: 2 },
  small_favor: { trust: 2, respect: 1, affection: 1 },
  support_crisis: { trust: 4, affection: 3, comfort: 3, respect: 1 },
  flirt: { attraction: 4, affection: 2, familiarity: 1 },
  argument: { annoyance: 8, comfort: -4, resentment: 4, affection: -2 },
  cold_shoulder: { annoyance: 5, comfort: -3, suspicion: 3, affection: -1 },
};

/**
 * Hand-authored starting ties between buddies, resolved from role pairs
 * (content-owned — a rename re-keys automatically, no code changes).
 */
export const SEED_AFFINITIES: Record<string, number> = resolveAffinitySeeds();


export class SocialEngine {
  private buddies: Map<string, BuddyCharacter> = new Map();
  // Only authoritative departure/contact state. BuddyCharacter.status is an
  // authored input or derived compatibility read; never stored on live actors.
  /** Canonical actor↔player dimensions and structural contact/lifecycle are one owner. */
  private readonly playerLinks = new PlayerRelationships({
    normalize: normalizeBuddyId,
    normalizeDims: normalizeRelationshipDims,
    actorExists: id => this.buddies.has(id),
  });
  /** Presence reads contact law; it never duplicates condition or relationship truth. */
  private readonly online = new SocialPresence({
    normalize: normalizeBuddyId,
    actors: () => this.buddies.entries(),
    condition: id => this.playerLinks.getCondition(id),
    emit: (buddyId, presence) => this.eventBus.emit('social:status_changed', { buddyId, presence }),
    isKnown: id => this.isKnown(id),
  });
  /** One canonical history owner; relationship/presence state never stores transcript bodies. */
  private readonly conversations = new ConversationHistory(normalizeBuddyId);
  // One canonical owner for structured memory facts and player commitments.
  private readonly memory = new SocialMemoryLedger(normalizeBuddyId, id => this.buddies.has(id));
  /** One authoritative sparse graph for NPC↔NPC affinity, directed bonds and romance. */
  private readonly graph = new NpcRelationshipGraph({
    normalize: normalizeBuddyId,
    affinityKey,
    bondKey: npcBondKey,
    neutral: neutralNpcBond,
    normalizeDims: normalizeRelationshipDims,
    actorExists: id => this.buddies.has(id),
    actors: () => this.buddies.values(),
    emit: (kind, payload) => this.eventBus.emit(kind as any, payload as any),
    actionDeltas: NPC_SOCIAL_ACTION_DELTAS,
    maxAffinity: MAX_AFFINITY,
    roomBumpPerTurn: ROOM_BUMP_PER_TURN,
    roomBumpDailyCap: ROOM_BUMP_DAILY_CAP,
  });
  /** Canonical NPC agendas/witness moments; event coordination stays in SocialEngine. */
  private readonly activity = new SocialActivityLedger(
    normalizeBuddyId, id => this.buddies.has(id), MAX_AGENDA_PER_BUDDY_DAY, MAX_NPC_SOCIAL_LOG);
  private readonly mediation = new MediationLedger(normalizeBuddyId, id => this.buddies.has(id), MAX_MEDIATIONS);
  private readonly playerRead = new PlayerReadLedger(normalizeBuddyId, id => this.buddies.has(id));
  /** Earned Pulse contacts are separate from relationship, physical presence and actor identity. */
  private readonly directory = new SocialContactDirectory(
    normalizeBuddyId, id => this.buddies.has(id), MAX_KNOWN_HANDLES, MAX_EPITAPHS);
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: SocialEngineState) {
    this.eventBus = eventBus;
    this.initializeCharacters();

    if (initialState) {
      this.restoreState(initialState);
    } else {
      this.initializeDefaultState();
    }
  }

  /**
   * Register a new actor at runtime. Authored seed actors and generated actors
   * share the same social contracts; new actors typically come from CharacterEngine.
   * Throws on invalid/duplicate ids. Never overwrites existing state.
   */
  public registerBuddy(def: BuddyCharacter): BuddyCharacter {
    const id = normalizeBuddyId(def.id);
    const idCheck = validateCharacterId(id);
    if (!idCheck.ok) throw new Error(idCheck.error);
    if (this.buddies.has(id)) throw new Error(`Buddy already registered: ${id}`);
    if (!def.displayName?.trim()) throw new Error('Buddy displayName must be non-empty.');
    if (!def.handle?.trim()) throw new Error('Buddy handle must be non-empty.');
    if (!isValidSchedule(def.schedule)) throw new Error(`Buddy '${id}' has an invalid schedule.`);
    if (typeof def.typingSpeedWpm !== 'number' || def.typingSpeedWpm < 20 || def.typingSpeedWpm > 140) {
      throw new Error(`Buddy '${id}' has an invalid typingSpeedWpm.`);
    }
    const stored: BuddyCharacter = {
      ...def,
      id,
      displayName: def.displayName.slice(0, 40),
      handle: def.handle.slice(0, 40),
      initialRelationships: normalizeRelationshipDims(def.initialRelationships),
      // v3-era defs predate temperament: backfill deterministically (never random).
      traits: clampTraits({
        ...traitsForBuddy(id, def.archetype ?? resolveArchetype(id, undefined)),
        ...((def as Partial<BuddyCharacter>).traits ?? {}),
      }),
      // Free roster identity backfills (older defs predate these fields).
      reach: (def as Partial<BuddyCharacter>).reach === 'remote' ? 'remote' : 'local',
      appearance: {
        hair: String((def as Partial<BuddyCharacter>).appearance?.hair || 'brown').trim().slice(0, 24) || 'brown',
        eyes: String((def as Partial<BuddyCharacter>).appearance?.eyes || 'brown').trim().slice(0, 24) || 'brown',
      },
      languages: sanitizeLanguages((def as Partial<BuddyCharacter>).languages),
      roles: Array.isArray((def as Partial<BuddyCharacter>).roles)
        ? ((def as Partial<BuddyCharacter>).roles as unknown[]).filter((r): r is string => typeof r === 'string' && /^[a-z][a-z0-9_-]{1,23}$/.test(r)).slice(0, 6)
        : [],
      schedule: Object.fromEntries(
        Object.entries(def.schedule).map(([day, blks]) => [Number(day), blks.map((b) => ({ ...b }))])
      ),
    };
    this.playerLinks.putCondition(id, conditionFromLegacyStatus(def.status));
    delete stored.status;
    this.buddies.set(id, stored);
    if (!this.playerLinks.has(id)) this.playerLinks.put(id, { ...stored.initialRelationships });
    if (!this.online.has(id)) this.online.put(id, { status: 'offline', awayMessage: '' });
    this.conversations.ensure(id);
    const registered = this.getBuddy(id)!;
    this.eventBus.emit('social:buddy_registered', { buddy: registered });
    return registered;
  }

  /**
   * Remove a buddy (lifecycle: gone/blocked cleanup). No one is sacred —
   * anyone can leave; the sharp-event governor (one active sharp at a time)
   * is what keeps departures rare, not identity.
   */
  public removeBuddy(rawId: string): boolean {
    const id = normalizeBuddyId(rawId);
    if (!this.buddies.has(id)) return false;
    this.buddies.delete(id);
    this.playerLinks.forgetCondition(id);
    this.playerLinks.forget(id);
    this.online.forget(id);
    this.conversations.delete(id);
    this.memory.forget(id);
    this.graph.forget(id);
    this.activity.forget(id);
    this.mediation.forgetActor(id);
    this.playerRead.forget(id);
    this.directory.forget(id);
    this.eventBus.emit('social:buddy_removed', { buddyId: id });
    return true;
  }

  public getState(): SocialEngineState {
    const { relationships: rels, actorConditions } = this.playerLinks.exportState();
    const { presence: pres } = this.online.exportState();

    const { agenda, npcSocialLog } = this.activity.exportState();
    const mediations = this.mediation.exportRecords();
    const playerReads = this.playerRead.exportState();
    const { knownHandles, epitaphs } = this.directory.exportState();

    // Persist generated/non-registry definitions. Seed definitions come from content,
    // while their per-save lifecycle divergence is persisted separately.
    const buddyDefs: Record<string, BuddyCharacter> = {};
    for (const [id, b] of this.buddies.entries()) {
      if (isSeedCharacter(id)) continue;
      const identity = { ...b };
      delete identity.status; // an old exported status would duplicate canonical truth
      buddyDefs[id] = {
        ...identity,
        initialRelationships: { ...b.initialRelationships },
        traits: { ...b.traits },
        appearance: { ...(b.appearance ?? { hair: 'brown', eyes: 'brown' }) },
        languages: (b.languages ?? [{ lang: 'en', level: 5 }]).map((l) => ({ ...l })),
        roles: [...(b.roles ?? [])],
        backstory: b.backstory
          ? { ...b.backstory, candidates: b.backstory.candidates.map((c) => ({ ...c })) }
          : undefined,
        schedule: Object.fromEntries(
          Object.entries(b.schedule).map(([day, blks]) => [Number(day), blks.map((blk) => ({ ...blk }))])
        ),
      };
    }

     const removedSeedActorIds = SEED_CHARACTERS
      .filter(seed => !this.buddies.has(seed.id)).map(seed => seed.id);

    return {
      relationships: rels,
      presence: pres,
      conversations: this.conversations.exportAll(),
      buddies: buddyDefs,
      actorConditions,
      removedSeedActorIds,
      ...this.memory.exportState(),
      ...this.graph.exportState(),
      agenda,
      mediations,
      npcSocialLog,
      playerReads,
      knownHandles,
      epitaphs,
    };
  }

  public restoreState(state: SocialEngineState): void {
    // Loading a new current-format world replaces roster/condition truth, not
    // just its relationship graph. Otherwise a prior removed actor may leak.
    this.buddies.clear();
    this.playerLinks.clearConditions();
    this.initializeCharacters();
    // Apply per-save seed-roster divergence before restoring dependent state.
    for (const rawId of state.removedSeedActorIds ?? []) {
      const id = normalizeBuddyId(rawId);
      if (isSeedCharacter(id)) {
        this.buddies.delete(id);
        this.playerLinks.forgetCondition(id);
      }
    }
    // Import-only legacy snapshots. New snapshots contain actorConditions.
    if (!state.actorConditions) {
      for (const [rawId, status] of Object.entries(state.seedActorStatuses ?? {})) {
        const id = normalizeBuddyId(rawId);
        if (this.buddies.has(id)) this.playerLinks.putCondition(id, conditionFromLegacyStatus(status));
      }
    }

    // Re-register persisted non-seed definitions first so rel/presence/convos land on real buddies.
    if (state.buddies) {
      for (const [rawId, def] of Object.entries(state.buddies)) {
        const id = normalizeBuddyId(rawId);
        if (this.buddies.has(id) || isSeedCharacter(id)) continue;
        const res = validatePersistedBuddy({ ...def, id });
        if (!res.ok || !res.definition) continue;
        const stored: BuddyCharacter = { ...res.definition };
        this.playerLinks.putCondition(id, conditionFromLegacyStatus(stored.status));
        delete stored.status;
        this.buddies.set(id, stored);
      }
    }
    for (const [rawId, condition] of Object.entries(state.actorConditions ?? {})) {
      const id = normalizeBuddyId(rawId);
      if (this.buddies.has(id) && validActorCondition(condition)) {
        this.playerLinks.putCondition(id, { ...condition });
      }
    }

    this.playerLinks.restoreDimensions(state.relationships);
    this.online.restore(state.presence);

    this.conversations.restore(state.conversations);

    // Structured memories/commitments are restored by their sole owner.
    this.memory.restoreState(state);

    // Restore one canonical sparse NPC graph, with the same validation law.
    this.graph.restoreState(state);
    this.activity.restore(state);
    this.mediation.restore(state.mediations);
    // Player-belief import is validated by its canonical owner.
    this.playerRead.restore(state.playerReads);
    this.directory.restore(state);

    // Backfill empty presence/conversations for any buddy missing them (old saves).
    for (const buddy of this.buddies.values()) {
      if (!this.playerLinks.has(buddy.id)) this.playerLinks.put(buddy.id, normalizeRelationshipDims(buddy.initialRelationships));
      if (!this.online.has(buddy.id)) this.online.put(buddy.id, { status: 'offline', awayMessage: '' });
      this.conversations.ensure(buddy.id);
    }
    // P4 affinity seeds: existing saves win, seeds only fill gaps (old saves get the core-4 ties)
    this.graph.seedMissing(SEED_AFFINITIES);
  }

  private initializeDefaultState(): void {
    for (const buddy of this.buddies.values()) {
      this.playerLinks.put(buddy.id, { ...buddy.initialRelationships });
      this.online.put(buddy.id, { status: 'offline', awayMessage: '' });
      this.conversations.ensure(buddy.id);
    }
    this.graph.seedMissing(SEED_AFFINITIES);
  }

  /**
   * Authored seed roster, sourced from the registry (content/store.json → generated).
   * These actors are starting content, not mandatory product identities.
   */
  private initializeCharacters(): void {
    for (const buddy of SEED_CHARACTERS) {
      const stored = seedCharacterDef(buddy.id);
      this.playerLinks.putCondition(buddy.id, conditionFromLegacyStatus(stored.status));
      delete stored.status;
      this.buddies.set(buddy.id, stored);
    }
  }

  /**
   * Updates contact presence based on current game time.
   * Schedule lookup: exact day → weekly rotation (day 8 reuses day 1 pattern) → day 1.
   * Authored and dynamic actors use repeating weekly schedules unless a specific day override exists.
   */
  public updatePresence(currentTotalMinutes: number): void {
    this.online.update(currentTotalMinutes);
  }

  public applySocialAction(rawBuddyId: string, actionType: string): RelationshipDimensions {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const { dimensions, delta } = this.playerLinks.applyAction(buddyId, actionType);
    this.eventBus.emit('social:relationship_updated', { buddyId, dimensions: { ...dimensions }, delta });
    return dimensions;
  }

  // ==========================================
  // P3 — LONG-TERM MEMORY, STAGES, MOOD, LIFECYCLE
  // ==========================================

  /** Memory and commitments have one canonical ledger. Social owns effects. */
  public addCoreMemory(
    rawBuddyId: string,
    memory: { text: string; kind: CoreMemory['kind']; day: number; meaning?: CoreMemory['meaning'] },
  ): CoreMemory | null {
    return this.memory.addMemory(rawBuddyId, memory);
  }

  public getCoreMemories(rawBuddyId: string): CoreMemory[] {
    return this.memory.getMemories(rawBuddyId);
  }

  public addPromise(rawBuddyId: string, text: string, createdDay: number, dueDay?: number): PromiseRecord | null {
    return this.memory.addPromise(rawBuddyId, text, createdDay, dueDay);
  }

  public getPromises(rawBuddyId: string): PromiseRecord[] {
    return this.memory.getPromises(rawBuddyId);
  }

  public getOpenPromises(rawBuddyId: string): PromiseRecord[] {
    return this.memory.getOpenPromises(rawBuddyId);
  }

  /**
   * One governed social transaction: the ledger changes the commitment,
   * while SocialEngine alone applies relationship/player-belief side effects.
   */
  public resolvePromise(rawBuddyId: string, promiseId: string, kept: boolean, day: number): {
    promise: PromiseRecord; relationships: RelationshipDimensions;
  } | null {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const record = this.memory.closePromise(buddyId, promiseId, kept);
    if (!record) return null;
    this.addCoreMemory(buddyId, {
      text: `${kept ? 'Kept promise' : 'Broke promise'}: "${record.text}"`,
      kind: kept ? 'promise_kept' : 'promise_broken',
      day,
      meaning: {
        participants: ['player', buddyId],
        subject: { kind: 'promise', id: record.id },
        source: { kind: 'domain_event', refId: record.id },
        salience: 'high',
        valence: kept ? 'positive' : 'negative',
      },
    });
    this.observePlayerTrait(buddyId, kept ? { loyalty: 85, discipline: 75 } : { loyalty: 20, discipline: 35 }, day);
    const relationships = this.applySocialAction(buddyId, kept ? 'remembered_detail' : 'dismissive');
    this.eventBus.emit('social:promise_resolved', { buddyId, promiseId, kept });
    return { promise: record, relationships };
  }

  /** Overdue ids are detached before closure to avoid mutating an iteration. */
  public checkPromiseDues(day: number): Array<{ buddyId: string; promise: PromiseRecord }> {
    const broken: Array<{ buddyId: string; promise: PromiseRecord }> = [];
    for (const { buddyId, promiseId } of this.memory.overdue(day)) {
      const result = this.resolvePromise(buddyId, promiseId, false, day);
      if (result) broken.push({ buddyId, promise: result.promise });
    }
    return broken;
  }

  /** Relationship stage derived from dimensions (strained overrides everything at high annoyance). */
  public getRelationshipStage(rawBuddyId: string): RelationshipStage {
    return this.playerLinks.stage(rawBuddyId);
  }

  /** Daily mood: deterministic per (buddy, day); strained buddies are always cold. */
  public getDailyMood(rawBuddyId: string, day: number): DailyMood {
    const id = normalizeBuddyId(rawBuddyId);
    const rel = this.playerLinks.get(id);
    if (rel && rel.annoyance >= STRAINED_ANNOYANCE) return 'cold';
    const roll = socialHashText(`${id}:${Math.max(1, Math.floor(day) || 1)}`) % 100;
    let mood: DailyMood;
    if (roll < 35) mood = 'warm';
    else if (roll < 70) mood = 'steady';
    else if (roll < 88) mood = 'tired';
    else mood = 'off';
    // Rain lovers lift one step on wet days (data tag, not an id — strained-cold exempt above)
    if ((this.buddies.get(id)?.roles ?? []).includes('rain-lover') && isWetWeather(getWeatherForDay(day).condition)) {
      if (mood === 'off') mood = 'tired';
      else if (mood === 'tired') mood = 'steady';
      else if (mood === 'steady') mood = 'warm';
    }
    return mood;
  }

  /**
   * Move a buddy along the lifecycle (distant/gone for sharp events, back to
   * acquaintance on return). No one is protected — anyone can walk away.
   */
  /** Canonical owner for lifecycle/contact. This is not the relationship stage. */
  public setActorCondition(rawId: string, next: ActorCondition): ActorCondition {
    const id = normalizeBuddyId(rawId);
    if (!this.buddies.has(id)) throw new Error(`Buddy not found: ${id}`);
    if (!validActorCondition(next)) throw new Error('Invalid actor condition');
    const previous = this.playerLinks.getCondition(id);
    if (previous?.lifecycle === next.lifecycle && previous.contact === next.contact) return { ...previous };
    this.playerLinks.putCondition(id, { ...next });
    const status = projectLegacyBuddyStatus(next, this.getRelationshipStage(id));
    this.eventBus.emit('social:buddy_status_changed', { buddyId: id, status });
    return { ...next };
  }

  public getActorCondition(rawId: string): ActorCondition | undefined {
    const id = normalizeBuddyId(rawId);
    if (!this.buddies.has(id)) return undefined;
    return { ...(this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus()) };
  }

  /** Legacy action adapter: friend/close are not mutable actor statuses. */
  public setBuddyStatus(rawId: string, status: BuddyLifecycleStatus): BuddyCharacter {
    const id = normalizeBuddyId(rawId);
    this.setActorCondition(id, conditionFromLegacyStatus(status));
    return this.getBuddy(id)!;
  }

  /** Governed direct adjustment (used by the distant-return path). Values clamped 0..100. */
  public adjustRelationship(rawBuddyId: string, partial: Partial<RelationshipDimensions>): RelationshipDimensions {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const updated = this.playerLinks.adjust(buddyId, partial);
    this.eventBus.emit('social:relationship_updated', { buddyId, dimensions: { ...updated }, delta: partial });
    return updated;
  }

  /** Compact, governed context from authored Social memory/commitment truth. */
  public buildLongTermContext(rawBuddyId: string): string {
    return this.memory.buildLongTermContext(rawBuddyId);
  }

  // ==========================================
  // P4 — BUDDY-TO-BUDDY AFFINITIES (C2 matrix)
  // ==========================================

  public getAffinity(rawA: string, rawB: string): number {
    return this.graph.getAffinity(rawA, rawB);
  }

  public adjustAffinity(rawA: string, rawB: string, delta: number): number {
    return this.graph.adjustAffinity(rawA, rawB, delta);
  }

  /** Deterministic per-pair/per-day anti-farming cap remains source-owned. */
  public bumpRoomAffinity(rawParticipantIds: string[], day: number, points = ROOM_BUMP_PER_TURN): number {
    return this.graph.bumpRoomAffinity(rawParticipantIds, day, points);
  }

  public buildAffinityContext(rawBuddyId: string): string {
    return this.graph.buildAffinityContext(rawBuddyId);
  }

  // ==========================================
  // CHARACTER LIVES — NPC inner life (bonds, agenda, mediations, romance)
  // Rules decide, AI paraphrases. All rolls are seeded hashes (see hashText) —
  // no Math.random, no model-picked numbers, offline-safe by construction.
  // ==========================================

  /** Fixed temperament for a buddy (never mutated after creation). Unknown ids read neutral. */
  public getTraits(rawId: string): CharacterTraits {
    const buddy = this.buddies.get(normalizeBuddyId(rawId));
    return clampTraits({
      ...traitsForBuddy(normalizeBuddyId(rawId), buddy?.archetype ?? resolveArchetype(normalizeBuddyId(rawId), undefined)),
      ...((buddy as Partial<BuddyCharacter>)?.traits ?? {}),
    });
  }

  public getNpcBond(rawFrom: string, rawTo: string): NpcBondState {
    return this.graph.getBond(rawFrom, rawTo);
  }

  public adjustNpcBond(rawFrom: string, rawTo: string, partial: Partial<NpcBondDims>, day: number): NpcBondState | null {
    return this.graph.adjustBond(rawFrom, rawTo, partial, day);
  }

  public applyNpcSocialAction(rawFrom: string, rawTo: string, action: string, day: number): NpcBondState | null {
    return this.graph.applyAction(rawFrom, rawTo, action, day);
  }

  public setNpcRomance(rawFrom: string, rawTo: string, stage: NpcRomanceStage, day: number): NpcBondState | null {
    return this.graph.setRomance(rawFrom, rawTo, stage, day);
  }

  public isDatingAnyone(rawId: string): boolean {
    return this.graph.isDatingAnyone(rawId);
  }

  // ---------- Agenda ----------

  /** Planning truth owned by SocialActivityLedger; SocialEngine publishes the event. */
  public getAgenda(rawId: string, day?: number): AgendaItem[] {
    return this.activity.getAgenda(rawId, day);
  }

  public setAgenda(rawId: string, items: AgendaItem[]): AgendaItem[] {
    const result = this.activity.setAgenda(rawId, items);
    const id = normalizeBuddyId(rawId);
    this.eventBus.emit('social:agenda_updated' as any, { buddyId: id, count: result.length });
    return result;
  }

  // ---------- Mediations ----------

  /** Mediation status is owned by MediationLedger; Social alone governs consequences and events. */
  public requestMediation(rawRequester: string, rawTarget: string, kind: MediationKind, day: number): MediationRecord | null {
    const record = this.mediation.request(rawRequester, rawTarget, kind, day);
    if (record) this.eventBus.emit('social:mediation_requested' as any, { mediation: { ...record } });
    return record;
  }

  public getMediation(mediationId: string): MediationRecord | undefined {
    return this.mediation.get(mediationId);
  }

  public getOpenMediations(): MediationRecord[] {
    return this.mediation.getOpen();
  }

  public respondMediation(mediationId: string, choice: 'help' | 'ignore' | 'badmouth', day: number): MediationRecord | null {
    const record = this.mediation.resolve(mediationId, choice, day);
    if (!record) return null;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const rel = this.playerLinks.get(record.requesterId);
    if (choice === 'ignore') {
      this.observePlayerTrait(record.requesterId, { warmth: 40, discipline: 45 }, safeDay);
      if (rel) {
        this.adjustRelationship(record.requesterId, {
          ...normalizeRelationshipDims(rel),
          trust: Math.max(0, rel.trust - 2),
          annoyance: Math.min(100, (rel.annoyance ?? 0) + 4),
        });
      }
    } else if (choice === 'help') {
      if (record.kind === 'introduce') {
        this.adjustNpcBond(record.requesterId, record.targetId, { familiarity: 6, comfort: 3 }, safeDay);
        this.adjustNpcBond(record.targetId, record.requesterId, { familiarity: 6, comfort: 3 }, safeDay);
        const target = this.buddies.get(record.targetId);
        if (target) this.learnHandle(record.targetId, target.handle);
      } else {
        this.adjustNpcBond(record.requesterId, record.targetId, { trust: 3, comfort: 2 }, safeDay);
        this.adjustNpcBond(record.targetId, record.requesterId, { trust: 3, comfort: 2 }, safeDay);
      }
      this.observePlayerTrait(record.requesterId, { loyalty: 80, warmth: 70 }, safeDay);
      this.applySocialAction(record.requesterId, 'remembered_detail');
    }
    this.eventBus.emit('social:mediation_resolved' as any, { mediation: { ...record } });
    return record;
  }

  public checkMediationExposure(rawA: string, rawB: string, day: number): MediationRecord[] {
    return this.mediation.expose(rawA, rawB, day,
      (requesterId, targetId) => Math.max(
        this.getNpcBond(requesterId, targetId).dims.suspicion,
        this.getNpcBond(targetId, requesterId).dims.suspicion,
      ),
      (record, safeDay) => {
        const rName = this.buddies.get(record.requesterId)?.displayName ?? record.requesterId;
        const tName = this.buddies.get(record.targetId)?.displayName ?? record.targetId;
        for (const buddyId of [record.requesterId, record.targetId]) {
          if (!this.buddies.has(buddyId)) continue;
          this.applySocialAction(buddyId, 'betray_confidence');
          this.addCoreMemory(buddyId, {
            text: `Badmouthed ${buddyId === record.requesterId ? tName : rName} — they compared notes (day ${safeDay}). Trust is wrecked.`,
            kind: 'fact',
            day: safeDay,
          });
          this.observePlayerTrait(buddyId, { loyalty: 10 }, safeDay);
        }
        this.eventBus.emit('social:mediation_exposed' as any, { mediation: { ...record } });
      });
  }

  // ---------- Witness log ----------

  /** Witness log is capped, source-owned and read detached. */
  public logNpcInteraction(entry: Omit<NpcInteractionLog, 'id'>): NpcInteractionLog {
    return this.activity.logNpcInteraction(entry);
  }

  public getNpcSocialLog(day?: number): NpcInteractionLog[] {
    return this.activity.getNpcSocialLog(day);
  }

  // ---------- Prompt contexts (bounded, never quoted literally) ----------

  public buildBondContext(rawBuddyId: string): string {
    return this.graph.buildBondContext(rawBuddyId);
  }

  public buildRomanceContext(rawBuddyId: string): string {
    return this.graph.buildRomanceContext(rawBuddyId);
  }

  // ---------- Known handles (earned contacts) ----------

  /** Earned handles are not inferred from friend stage or public room visibility. */
  public getKnownHandles(rawId: string): string[] { return this.directory.getKnownHandles(rawId); }
  public isKnown(rawId: string): boolean { return this.directory.isKnown(rawId); }
  public learnHandle(rawId: string, rawHandle: string): boolean {
    const result = this.directory.learn(rawId, rawHandle);
    if (result.newlyLearned) {
      this.eventBus.emit('social:handle_learned' as any,
        { buddyId: normalizeBuddyId(rawId), handle: result.handle });
    }
    return result.accepted;
  }

  public addEpitaph(line: string): void { this.directory.addEpitaph(line); }
  public getEpitaphs(): string[] { return this.directory.getEpitaphs(); }

  // ---------- NPC beliefs about the player (single owner) ----------

  public static neutralPlayerRead(): PlayerReadState { return PlayerReadLedger.neutral(); }
  public getPlayerRead(rawId: string): PlayerReadState { return this.playerRead.get(rawId); }
  public observePlayerTrait(rawId: string, obs: Partial<CharacterTraits>, day: number): void {
    this.playerRead.observe(rawId, obs, day);
  }
  public alignPlayerReads(rawA: string, rawB: string, day: number): boolean {
    return this.playerRead.align(rawA, rawB, day);
  }
  public buildPlayerReadContext(rawId: string): string { return this.playerRead.buildContext(rawId); }

  public sendMessage(
    rawConversationId: string,
    rawSenderId: string,
    rawRecipientId: string,
    text: string,
    currentMinute: number,
    deliveredAway = false,
    tags?: string[],
    imageUrl?: string,
    imagePrompt?: string,
    imageCaption?: string
  ): MessageRecord {
    const conversationId = normalizeBuddyId(rawConversationId);
    const senderId = rawSenderId === 'player' ? 'player' : normalizeBuddyId(rawSenderId);
    const recipientId = rawRecipientId === 'player' ? 'player' : normalizeBuddyId(rawRecipientId);
    const day = Math.floor(currentMinute / 1440) + 1;
    const msg: MessageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conversationId,
      senderId,
      recipientId,
      text,
      timestampMinute: currentMinute,
      day,
      isRead: senderId === 'player',
      deliveredAway,
      tags,
      imageUrl,
      imagePrompt,
      imageCaption,
    };

    this.conversations.append(msg);

    // P5.5 visual memory: buddy-sent photos become immortal (capped so facts survive too).
    // Covers every photo path (AI chat, scripts) since all funnel through here.
    if (senderId !== 'player' && (imagePrompt || imageUrl) && this.buddies.has(conversationId)) {
      if (this.memory.photoCount(conversationId) < MAX_PHOTO_MEMORIES) {
        const caption = String(imageCaption || imagePrompt || 'a photo').trim().replace(/\s+/g, ' ').slice(0, 100);
        this.addCoreMemory(conversationId, {
          text: `Shared a photo, Day ${day}: "${caption}"`,
          kind: 'shared_photo',
          day,
        });
      }
    }

    this.eventBus.emit('social:message_received', { message: { ...msg } });
    return { ...msg };
  }

  /** Mutate the canonical conversation only if unread messages exist. */
  public markAsRead(rawConversationId: string): boolean {
    return this.conversations.markRead(rawConversationId);
  }

  /** A derived public projection; callers cannot write to the live roster via status. */
  public getBuddy(rawId: string): BuddyCharacter | undefined {
    const id = normalizeBuddyId(rawId);
    const buddy = this.buddies.get(id);
    if (!buddy) return undefined;
    const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
    return { ...buddy, status: projectLegacyBuddyStatus(condition, this.getRelationshipStage(id)) };
  }

  public getBuddies(): BuddyCharacter[] {
    return Array.from(this.buddies.keys()).map(id => this.getBuddy(id)!);
  }

  /**
   * Resolve one Pulse room's live members at the Social owner. An action needs
   * IDs, not 500 BuddyCharacter copies with private schedules, bio and status.
   * Preserves explicit-member eligibility, dynamic role inclusion, derived
   * gone/blocked semantics, de-duplication and sorted responder order.
   */
  public getPulseRoomParticipantIdsRead(room: {
    participantIds: readonly string[];
    participantRoles: readonly string[];
  }): string[] {
    const resolved = new Set<string>();
    const eligible = (id: string): boolean => {
      if (!this.buddies.has(id)) return false;
      const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
      const status = projectLegacyBuddyStatus(condition, this.getRelationshipStage(id));
      return status !== 'gone' && status !== 'blocked';
    };
    for (const id of room.participantIds) {
      if (eligible(id)) resolved.add(id);
    }
    for (const [id, buddy] of this.buddies) {
      if (!(buddy.roles ?? []).some(role => room.participantRoles.includes(role))) continue;
      if (eligible(id)) resolved.add(id);
    }
    return [...resolved].sort();
  }

  /**
   * Explicit developer-only inspector: counts and a page of visible identities.
   * Never make a BuddyCharacter roster or chat/memory snapshot merely to render
   * the Lab. Full private diagnostics require a separate selected-page read.
   */
  public getLabRosterRead(offset = 0, limit = 16): {
    total: number;
    procedural: number;
    imageOptions: Array<{ id: string; displayName: string; handle: string }>;
    page: Array<Pick<BuddyCharacter, 'id' | 'displayName' | 'handle' | 'archetype' | 'status'>>;
  } {
    const start = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
    const size = Number.isFinite(limit) ? Math.max(1, Math.min(16, Math.trunc(limit))) : 16;
    let procedural = 0;
    const imageOptions: Array<{ id: string; displayName: string; handle: string }> = [];
    const page: Array<Pick<BuddyCharacter, 'id' | 'displayName' | 'handle' | 'archetype' | 'status'>> = [];
    let index = 0;
    for (const [id, buddy] of this.buddies) {
      if (buddy.isProcedural) procedural++;
      if (imageOptions.length < 500) imageOptions.push({
        id, displayName: buddy.displayName, handle: buddy.handle,
      });
      if (index >= start && index < start + size) {
        const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
        page.push({
          id,
          displayName: buddy.displayName,
          handle: buddy.handle,
          ...(buddy.archetype ? { archetype: buddy.archetype } : {}),
          status: projectLegacyBuddyStatus(condition, this.getRelationshipStage(id)),
        });
      }
      index++;
    }
    return { total: this.buddies.size, procedural, imageOptions, page };
  }

  /** Intent-time authoring input only: no actor bodies, memory or relationships. */
  public getLabActorIds(): string[] {
    return [...this.buddies.keys()];
  }

  /**
   * Public NightBoard authors only: finite, detached render identities from
   * the Social owner. Public forum authorship is not a claim that the player
   * knows a person privately; the generated threads may include strangers.
   * Never build BuddyCharacter snapshots, conversation history or NPC memory.
   * The 500-author window matches the largest supported simulation gate.
   */
  public getNightBoardAuthorsRead(maxAuthors = 500): BoardBuddy[] {
    const limit = Number.isFinite(maxAuthors)
      ? Math.max(0, Math.min(500, Math.trunc(maxAuthors))) : 500;
    const authors: BoardBuddy[] = [];
    if (limit === 0) return authors;
    for (const [id, buddy] of this.buddies) {
      const stage = this.getRelationshipStage(id);
      const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
      authors.push({
        id,
        displayName: buddy.displayName,
        handle: buddy.handle,
        archetype: buddy.archetype,
        stage,
        status: projectLegacyBuddyStatus(condition, stage),
        roles: buddy.roles ? [...buddy.roles] : [],
      });
      if (authors.length >= limit) break;
    }
    return authors;
  }

  /**
   * Mailbox's player-known sender identities, scoped to rendered mail fields.
   * Keep Social's conditions, identity and relationship stages in one owner;
   * never copy roster payloads, conversations or private NPC memories.
   */
  public getKnownMailboxBuddies(maxContacts = 500): BoardBuddy[] {
    const limit = Number.isFinite(maxContacts) ? Math.max(0, Math.min(500, Math.trunc(maxContacts))) : 500;
    const senders: BoardBuddy[] = [];
    if (limit === 0) return senders;
    for (const [id, buddy] of this.buddies) {
      if (!this.isKnown(id)) continue;
      const stage = this.getRelationshipStage(id);
      const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
      senders.push({
        id,
        displayName: buddy.displayName,
        handle: buddy.handle,
        ...(buddy.archetype ? { archetype: buddy.archetype } : {}),
        stage,
        status: projectLegacyBuddyStatus(condition, stage),
        ...(buddy.roles ? { roles: [...buddy.roles] } : {}),
      });
      if (senders.length >= limit) break;
    }
    return senders;
  }

  /**
   * Pulse's exact player-visible directory, scoped to known handles and
   * authored public-room membership. Never copies the whole BuddyCharacter
   * roster, its private relationships, schedules or conversation history.
   * Storage and learned-handle authority remain in this one Social owner.
   */
  public getPulseDirectoryRead(rooms: ReadonlyArray<{
    id: string;
    participantIds: readonly string[];
    participantRoles: readonly string[];
  }> = []): {
    contacts: Array<Pick<BuddyCharacter, 'id' | 'displayName' | 'handle' | 'roles' | 'archetype'>>;
    suggestions: Array<{ handle: string; note: string; buddyName: string }>;
    lastSeenMinutes: Record<string, number>;
    roomParticipantCounts: Record<string, number>;
    roomParticipantNames: Record<string, string>;
  } {
    const contacts: Array<Pick<BuddyCharacter, 'id' | 'displayName' | 'handle' | 'roles' | 'archetype'>> = [];
    const suggestions: Array<{ handle: string; note: string; buddyName: string }> = [];
    const lastSeenMinutes: Record<string, number> = {};
    for (const [id, buddy] of this.buddies) {
      if (this.isKnown(id)) {
        if (contacts.length >= 500) continue;
        contacts.push({
          id,
          displayName: buddy.displayName,
          handle: buddy.handle,
          ...(buddy.archetype ? { archetype: buddy.archetype } : {}),
          ...(buddy.roles ? { roles: [...buddy.roles] } : {}),
        });
        lastSeenMinutes[id] = this.getLastActivityMinute(id);
      } else if (suggestions.length < 500) {
        for (const candidate of buddy.backstory?.candidates ?? []) {
          if (suggestions.length >= 500) break;
          suggestions.push({
            handle: candidate.handle,
            note: candidate.note || buddy.backstory?.label || 'From your past',
            buddyName: buddy.displayName,
          });
        }
      }
    }

    const roomParticipantCounts: Record<string, number> = {};
    const roomParticipantNames: Record<string, string> = {};
    const publicRooms = rooms.slice(0, 32);
    // Status derives once per actor, not 32 times when Pulse shows 32 rooms.
    // Preserve room-first actor ordering for the 500-name presentation cap.
    const eligibleForRooms = new Set<string>();
    if (publicRooms.length > 0) {
      for (const [id] of this.buddies) {
        const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
        const status = projectLegacyBuddyStatus(condition, this.getRelationshipStage(id));
        if (status !== 'gone' && status !== 'blocked') eligibleForRooms.add(id);
      }
    }
    let namedCount = 0;
    for (const room of publicRooms) {
      const memberIds = new Set(room.participantIds);
      const memberRoles = new Set(room.participantRoles);
      let participantCount = 0;
      for (const [id, buddy] of this.buddies) {
        if (!eligibleForRooms.has(id)) continue;
        if (!memberIds.has(id) && !(buddy.roles ?? []).some(role => memberRoles.has(role))) continue;
        participantCount++;
        if (!Object.prototype.hasOwnProperty.call(roomParticipantNames, id) && namedCount < 500) {
          roomParticipantNames[id] = buddy.displayName;
          namedCount++;
        }
      }
      roomParticipantCounts[room.id] = participantCount;
    }
    return { contacts, suggestions, lastSeenMinutes, roomParticipantCounts, roomParticipantNames };
  }

  /**
   * Job-board identity only. Select the same first eligible role-holder as
   * getBuddyWithRole (non-distant before distant, then locale id order) in
   * one owner-owned scan, without cloning a whole BuddyCharacter roster.
   * Knowledge gates the chosen winner, not the selection itself: an unknown
   * winner must not be replaced with a conveniently known lower-priority actor.
   */
  public getPublicJobContactName(role: string): string {
    let best: { id: string; displayName: string; distant: number } | null = null;
    for (const [id, buddy] of this.buddies) {
      if (!(buddy.roles ?? []).includes(role)) continue;
      const condition = this.playerLinks.getCondition(id) ?? conditionFromLegacyStatus();
      const status = projectLegacyBuddyStatus(condition, this.getRelationshipStage(id));
      if (status === 'gone' || status === 'blocked') continue;
      const distant = status === 'distant' ? 1 : 0;
      if (!best || distant < best.distant
        || (distant === best.distant && id.localeCompare(best.id) < 0)) {
        best = { id, displayName: buddy.displayName, distant };
      }
    }
    return best && this.isKnown(best.id) ? best.displayName : role;
  }

  /**
   * Café guest candidate identities only. Public presence is decided by the
   * NPC place owner and semantic eligibility afterward, not by this roster
   * query. Only player-learned local identities cross into coordination.
   */
  public getKnownLocalCafeCandidatesRead(requestedActorId?: string): Array<{
    id: string;
    displayName: string;
  }> {
    if (requestedActorId) {
      const id = normalizeBuddyId(requestedActorId);
      const buddy = this.buddies.get(id);
      return buddy?.reach === 'local' && this.isKnown(id)
        ? [{ id, displayName: buddy.displayName }] : [];
    }
    const candidates: Array<{ id: string; displayName: string }> = [];
    for (const [id, buddy] of this.buddies) {
      if (buddy.reach !== 'local' || !this.isKnown(id)) continue;
      candidates.push({ id, displayName: buddy.displayName });
      if (candidates.length >= 500) break;
    }
    return candidates;
  }

  /** Resolve current actors by capability role. Seed content has no runtime privilege. */
  public getBuddiesWithRole(role: string): BuddyCharacter[] {
    return this.getBuddies()
      .filter((buddy) =>
        (buddy.roles ?? []).includes(role)
        && buddy.status !== 'gone'
        && buddy.status !== 'blocked'
      )
      .sort((a, b) => {
        const aDistant = a.status === 'distant' ? 1 : 0;
        const bDistant = b.status === 'distant' ? 1 : 0;
        return aDistant - bDistant || a.id.localeCompare(b.id);
      });
  }

  /** Deterministic current actor carrying a capability role, preferring non-distant actors. */
  public getBuddyWithRole(role: string): BuddyCharacter | undefined {
    return this.getBuddiesWithRole(role)[0];
  }

  public getRelationships(rawId: string): RelationshipDimensions | undefined {
    const rel = this.playerLinks.get(normalizeBuddyId(rawId));
    return rel ? { ...rel } : undefined;
  }

  /**
   * Lightweight presence only, without Social persistence state.
   * Internal simulation code may read all actor presence; player-facing
   * projections may expose only learned contacts and the player's own status.
   */
  public getPresenceSummary(playerKnownOnly = false): Record<string, BuddyPresence> {
    return this.online.summary(playerKnownOnly);
  }

  /** Player away text stays canonical Social state, not a UI overlay. */
  public setPlayerPresence(presence: BuddyPresence): void {
    this.online.setPlayer(presence);
  }

  public getPresence(rawId: string): BuddyPresence | undefined {
    return this.online.get(rawId);
  }

  /**
   * #172 bounded messenger read over the one canonical Social conversation.
   * Offset is measured backward from newest; returned messages remain in
   * chronological display order. #173 may change storage, not this contract.
   */
  public getConversationPage(rawConversationId: string, offset = 0, limit = 30): {
    conversationId: string;
    messages: MessageRecord[];
    total: number;
    hasOlder: boolean;
  } {
    return this.conversations.page(rawConversationId, offset, limit);
  }

  /** Source-owned unread counts, indexed by ConversationHistory (no transcript scan). */
  public getConversationUnreadCounts(maxConversations = 500, playerKnownOnly = false): Record<string, number> {
    return this.conversations.unreadCounts(
      maxConversations, playerKnownOnly ? id => this.isKnown(id) : () => true,
    );
  }

  /** Day presence is derived once by ConversationHistory; offline timestamps may be unordered. */
  public hasConversationMessageOnDay(rawConversationId: string, day: number): boolean {
    return this.conversations.hasMessageOnDay(rawConversationId, day);
  }

  /** Bounded preview of only source-owned unread messages, never all historical bodies. */
  public getUnreadTraySummary(maxPreview = 4, playerKnownOnly = false): {
    unreadCount: number;
    previews: Array<{ id: string; buddyId: string; buddyName: string; text: string }>;
  } {
    return this.conversations.unreadTray(
      maxPreview,
      playerKnownOnly ? id => this.isKnown(id) : () => true,
      id => this.buddies.get(id)?.displayName ?? id,
    );
  }

  /** Public messenger rows use derived conversation indices, not historical message arrays. */
  public getMessengerSummary(maxContacts = 32): Array<{
    actorId: string;
    displayName: string;
    handle: string;
    onlineStatus: BuddyPresence['status'];
    relationshipStage: RelationshipStage;
    lastMessageMinute: number | null;
    unread: number;
  }> {
    const limit = Number.isFinite(maxContacts) ? Math.max(0, Math.min(100, Math.floor(maxContacts))) : 32;
    if (limit === 0) return [];
    const rows = [];
    for (const [id, buddy] of this.buddies) {
      if (!this.isKnown(id)) continue;
      const summary = this.conversations.summary(id);
      rows.push({
        actorId: id,
        displayName: buddy.displayName,
        handle: buddy.handle,
        onlineStatus: this.online.get(id)?.status ?? 'offline',
        relationshipStage: this.getRelationshipStage(id),
        lastMessageMinute: summary.lastMessageMinute,
        unread: summary.unread,
      });
    }
    rows.sort((a, b) => (b.lastMessageMinute ?? -1) - (a.lastMessageMinute ?? -1)
      || a.actorId.localeCompare(b.actorId));
    return rows.slice(0, limit);
  }

  public getLastOfflineMessageText(rawConversationId: string): string | null {
    return this.conversations.lastOfflineMessage(rawConversationId);
  }

  /** Explicit conversation export for Save Log/legacy; normal UI uses bounded pages. */
  public getMessages(rawConversationId: string): MessageRecord[] {
    return this.conversations.allMessages(rawConversationId);
  }

  public getLastActivityMinute(rawBuddyId: string): number {
    return this.conversations.lastActivity(rawBuddyId);
  }

  public getLastPlayerMessageMinute(): number {
    return this.conversations.lastPlayerMessageMinute();
  }

  public didPlayerWriteOnDay(day: number): boolean {
    return this.conversations.playerWroteOnDay(day);
  }
}
