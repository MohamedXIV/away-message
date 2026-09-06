import {
  AgendaItem,
  BuddyPresenceStatus,
  RelationshipDimensions,
  BuddyCharacter,
  BuddyLifecycleStatus,
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
  PromiseRecord,
  RelationshipStage,
  SocialEngineState,
  ScheduleBlock,
} from './types';
import { EventBus } from './EventBus';
import { getWeatherForDay, isWetWeather } from './WeatherEngine';
import { validateCharacterId, isValidSchedule, isCoreBuddyId, traitsForBuddy, clampTraits, clampRelationships, resolveArchetype, rollSeeded100 } from './characterTemplates';
import { validatePersistedBuddy } from './CharacterEngine';

// P3 long-term memory caps (keeps prompt injection bounded and saves small)
export const MAX_CORE_MEMORIES = 8;
export const MAX_OPEN_PROMISES = 5;
// P5.5 visual memory: at most 3 immortal photos per buddy (facts must survive too)
export const MAX_PHOTO_MEMORIES = 3;
// P3 sharp-event thresholds (annoyance scale 0..100; dismissive gives +8)
export const STRAINED_ANNOYANCE = 60;
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

/** Hand-authored starting ties between the core 4 (everyone else starts at 0). */
export const SEED_AFFINITIES: Record<string, number> = {
  maya__ryan: 15,
  henderson__maya: 10,
  henderson__ryan: 10,
  maya__nora: 5,
  henderson__nora: 0,
  nora__ryan: -5,
};

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

// Canonical engine ids are short ('maya'); old saves/UI used handles. Normalize on load.
export const BUDDY_ID_ALIASES: Record<string, string> = {
  starlight_maya: 'maya',
  ryan_foodcart: 'ryan',
  NightOwl87: 'nora',
  motel_office: 'henderson',
};

export function normalizeBuddyId(id: string): string {
  return BUDDY_ID_ALIASES[id] ?? id;
}

export class SocialEngine {
  private buddies: Map<string, BuddyCharacter> = new Map();
  private relationships: Map<string, RelationshipDimensions> = new Map();
  private presence: Map<string, BuddyPresence> = new Map();
  private conversations: Map<string, MessageRecord[]> = new Map();
  // P3 long-term memory: immortal facts + promise ledger per buddy
  private coreMemories: Map<string, CoreMemory[]> = new Map();
  private promises: Map<string, PromiseRecord[]> = new Map();
  // P4 buddy-to-buddy affinities ("a__b" sorted keys) + room-bump daily caps
  private affinities: Map<string, number> = new Map();
  private affinityCaps: Map<string, number> = new Map();
  // Character Lives: directed NPC↔NPC bonds ("from__to"), per-buddy agenda,
  // player mediations, and a capped witness log of NPC↔NPC moments
  private npcBonds: Map<string, NpcBondState> = new Map();
  private agenda: Map<string, AgendaItem[]> = new Map();
  private mediations: MediationRecord[] = [];
  private npcSocialLog: NpcInteractionLog[] = [];
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
   * Register a new buddy at runtime (unified roster — core 4 stay code-owned,
   * every NEW buddy comes through here, typically built by CharacterEngine).
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
      schedule: Object.fromEntries(
        Object.entries(def.schedule).map(([day, blks]) => [Number(day), blks.map((b) => ({ ...b }))])
      ),
    };
    this.buddies.set(id, stored);
    if (!this.relationships.has(id)) this.relationships.set(id, { ...stored.initialRelationships });
    if (!this.presence.has(id)) this.presence.set(id, { status: 'offline', awayMessage: '' });
    if (!this.conversations.has(id)) this.conversations.set(id, []);
    this.eventBus.emit('social:buddy_registered', { buddy: { ...stored } });
    return { ...stored };
  }

  /**
   * Remove a procedural buddy (lifecycle: gone/blocked cleanup).
   * Core buddies cannot be removed — change their status instead.
   */
  public removeBuddy(rawId: string): boolean {
    const id = normalizeBuddyId(rawId);
    if (isCoreBuddyId(id)) throw new Error(`Core buddy cannot be removed: ${id}`);
    if (!this.buddies.has(id)) return false;
    this.buddies.delete(id);
    this.relationships.delete(id);
    this.presence.delete(id);
    this.conversations.delete(id);
    this.coreMemories.delete(id);
    this.promises.delete(id);
    // Character Lives: drop directed bonds, agenda and mediations touching this buddy
    for (const key of Array.from(this.npcBonds.keys())) {
      if (key.split('__').includes(id)) this.npcBonds.delete(key);
    }
    this.agenda.delete(id);
    this.mediations = this.mediations.filter((m) => m.requesterId !== id && m.targetId !== id);
    this.npcSocialLog = this.npcSocialLog.filter((l) => l.firstId !== id && l.secondId !== id);
    // P4: drop every affinity pair and cap entry involving this buddy
    for (const key of Array.from(this.affinities.keys())) {
      const parts = key.split('__');
      if (parts.includes(id)) this.affinities.delete(key);
    }
    for (const key of Array.from(this.affinityCaps.keys())) {
      const pairPart = key.slice(0, key.lastIndexOf('_'));
      if (pairPart.split('__').includes(id)) this.affinityCaps.delete(key);
    }
    this.eventBus.emit('social:buddy_removed', { buddyId: id });
    return true;
  }

  public getState(): SocialEngineState {
    const rels: Record<string, RelationshipDimensions> = {};
    for (const [id, r] of this.relationships.entries()) rels[id] = { ...r };

    const pres: Record<string, BuddyPresence> = {};
    for (const [id, p] of this.presence.entries()) pres[id] = { ...p };

    const convs: Record<string, MessageRecord[]> = {};
    for (const [id, msgs] of this.conversations.entries()) convs[id] = msgs.map(m => ({ ...m }));

    const mems: Record<string, CoreMemory[]> = {};
    for (const [id, items] of this.coreMemories.entries()) mems[id] = items.map(m => ({ ...m }));

    const proms: Record<string, PromiseRecord[]> = {};
    for (const [id, items] of this.promises.entries()) proms[id] = items.map(p => ({ ...p }));

    const affs: Record<string, number> = {};
    for (const [key, value] of this.affinities.entries()) affs[key] = value;

    const caps: Record<string, number> = {};
    for (const [key, value] of this.affinityCaps.entries()) caps[key] = value;

    // Character Lives: directed bonds (validated pairs only), agenda (pruned),
    // mediations (capped), witness log (capped) — all rebuilt deterministically
    // on load when absent, so v3 saves restore cleanly.
    const bonds: Record<string, NpcBondState> = {};
    for (const [key, bond] of this.npcBonds.entries()) {
      bonds[key] = { dims: { ...bond.dims }, romance: bond.romance, romanceSinceDay: bond.romanceSinceDay, updatedDay: bond.updatedDay };
    }
    const agenda: Record<string, AgendaItem[]> = {};
    for (const [id, items] of this.agenda.entries()) agenda[id] = items.map((a) => ({ ...a }));
    const mediations = this.mediations.map((m) => ({ ...m }));
    const npcSocialLog = this.npcSocialLog.map((l) => ({ ...l }));

    // Persist only procedural buddy defs (core 4 are code-owned and re-seeded).
    const buddyDefs: Record<string, BuddyCharacter> = {};
    for (const [id, b] of this.buddies.entries()) {
      if (isCoreBuddyId(id)) continue;
      buddyDefs[id] = {
        ...b,
        initialRelationships: { ...b.initialRelationships },
        traits: { ...b.traits },
        schedule: Object.fromEntries(
          Object.entries(b.schedule).map(([day, blks]) => [Number(day), blks.map((blk) => ({ ...blk }))])
        ),
      };
    }

    return { relationships: rels, presence: pres, conversations: convs, buddies: buddyDefs, coreMemories: mems, promises: proms, affinities: affs, affinityCaps: caps, npcBonds: bonds, agenda, mediations, npcSocialLog };
  }

  private static sanitizeMemoryText(text: string, max: number): string {
    return text.trim().replace(/\s+/g, ' ').slice(0, max);
  }

  private static isValidMemoryKind(kind: unknown): kind is CoreMemory['kind'] {
    return kind === 'fact' || kind === 'promise_kept' || kind === 'promise_broken' || kind === 'first_meeting' || kind === 'shared_moment' || kind === 'shared_photo';
  }

  public restoreState(state: SocialEngineState): void {
    // Re-register persisted procedural defs first so rel/presence/convos land on real buddies.
    if (state.buddies) {
      for (const [rawId, def] of Object.entries(state.buddies)) {
        const id = normalizeBuddyId(rawId);
        if (this.buddies.has(id) || isCoreBuddyId(id)) continue;
        const res = validatePersistedBuddy({ ...def, id });
        if (!res.ok || !res.definition) continue;
        this.buddies.set(id, res.definition);
      }
    }

    this.relationships.clear();
    for (const [rawId, r] of Object.entries(state.relationships)) {
      // v3 records carry 5 dims; normalizeRelationshipDims backfills the v4 rest.
      this.relationships.set(normalizeBuddyId(rawId), normalizeRelationshipDims(r));
    }

    this.presence.clear();
    for (const [rawId, p] of Object.entries(state.presence)) {
      this.presence.set(normalizeBuddyId(rawId), { ...p });
    }

    this.conversations.clear();
    for (const [rawId, msgs] of Object.entries(state.conversations)) {
      const id = normalizeBuddyId(rawId);
      this.conversations.set(id, msgs.map(m => ({
        ...m,
        conversationId: normalizeBuddyId(m.conversationId),
        senderId: m.senderId === 'player' ? 'player' : normalizeBuddyId(m.senderId),
        recipientId: m.recipientId === 'player' ? 'player' : normalizeBuddyId(m.recipientId),
      })));
    }

    // P3 long-term memory restore (validated + capped so corrupt saves can't bloat prompts)
    this.coreMemories.clear();
    if (state.coreMemories) {
      for (const [rawId, items] of Object.entries(state.coreMemories)) {
        const id = normalizeBuddyId(rawId);
        if (!Array.isArray(items)) continue;
        const clean: CoreMemory[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const text = SocialEngine.sanitizeMemoryText(String((item as CoreMemory).text ?? ''), 160);
          const kind = (item as CoreMemory).kind;
          if (text.length < 3 || !SocialEngine.isValidMemoryKind(kind)) continue;
          if (clean.some((c) => c.text.toLowerCase() === text.toLowerCase())) continue;
          clean.push({ id: String((item as CoreMemory).id || `cm_${clean.length}`), text, kind, day: Number.isFinite((item as CoreMemory).day) ? Math.max(1, Math.floor((item as CoreMemory).day)) : 1 });
          if (clean.length >= MAX_CORE_MEMORIES) break;
        }
        if (clean.length > 0) this.coreMemories.set(id, clean);
      }
    }
    this.promises.clear();
    if (state.promises) {
      for (const [rawId, items] of Object.entries(state.promises)) {
        const id = normalizeBuddyId(rawId);
        if (!Array.isArray(items)) continue;
        const clean: PromiseRecord[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const text = SocialEngine.sanitizeMemoryText(String((item as PromiseRecord).text ?? ''), 140);
          const status = (item as PromiseRecord).status;
          if (text.length < 8 || (status !== 'open' && status !== 'kept' && status !== 'broken')) continue;
          const dueDay = (item as PromiseRecord).dueDay;
          clean.push({
            id: String((item as PromiseRecord).id || `pr_${clean.length}`),
            text,
            status,
            createdDay: Number.isFinite((item as PromiseRecord).createdDay) ? Math.max(1, Math.floor((item as PromiseRecord).createdDay)) : 1,
            ...(Number.isFinite(dueDay) ? { dueDay: Math.max(1, Math.floor(dueDay as number)) } : {}),
          });
        }
        if (clean.length > 0) this.promises.set(id, clean);
      }
    }

    // P4 affinities restore (validated + clamped; corrupt values fall back to 0/seed)
    this.affinities.clear();
    if (state.affinities) {
      for (const [key, value] of Object.entries(state.affinities)) {
        if (typeof key !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) continue;
        const parts = key.split('__');
        if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) continue;
        const canonical = affinityKey(parts[0], parts[1]);
        if (canonical !== key) continue;
        this.affinities.set(key, Math.max(-MAX_AFFINITY, Math.min(MAX_AFFINITY, Math.round(value))));
      }
    }
    this.affinityCaps.clear();
    if (state.affinityCaps) {
      for (const [key, value] of Object.entries(state.affinityCaps)) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
        this.affinityCaps.set(key, Math.min(ROOM_BUMP_DAILY_CAP, Math.round(value)));
      }
    }

    // Character Lives restore (validated + clamped; absent in v3 saves → neutral defaults)
    this.npcBonds.clear();
    if (state.npcBonds) {
      for (const [key, bond] of Object.entries(state.npcBonds)) {
        if (typeof key !== 'string' || !bond || typeof bond !== 'object') continue;
        const parts = key.split('__');
        if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) continue;
        if (npcBondKey(parts[0]!, parts[1]!) !== key) continue;
        const dims = normalizeRelationshipDims((bond as NpcBondState).dims as Partial<RelationshipDimensions>);
        const romance = (bond as NpcBondState).romance;
        this.npcBonds.set(key, {
          dims: {
            familiarity: dims.familiarity, trust: dims.trust, comfort: dims.comfort,
            respect: dims.respect, affection: dims.affection, attraction: dims.attraction,
            annoyance: dims.annoyance, suspicion: dims.suspicion, resentment: dims.resentment,
          },
          romance: romance === 'crush' || romance === 'dating' ? romance : 'none',
          romanceSinceDay: Number.isFinite((bond as NpcBondState).romanceSinceDay) ? Math.max(1, Math.floor((bond as NpcBondState).romanceSinceDay)) : 1,
          updatedDay: Number.isFinite((bond as NpcBondState).updatedDay) ? Math.max(1, Math.floor((bond as NpcBondState).updatedDay)) : 1,
        });
      }
    }
    this.agenda.clear();
    if (state.agenda) {
      for (const [rawId, items] of Object.entries(state.agenda)) {
        const id = normalizeBuddyId(rawId);
        if (!Array.isArray(items)) continue;
        const clean: AgendaItem[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const kind = (item as AgendaItem).kind;
          if (kind !== 'sleep' && kind !== 'work' && kind !== 'social' && kind !== 'errand') continue;
          const start = (item as AgendaItem).startMinute;
          const end = (item as AgendaItem).endMinute;
          const day = (item as AgendaItem).day;
          if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(day)) continue;
          clean.push({
            id: String((item as AgendaItem).id || `ag_${clean.length}`),
            kind,
            label: String((item as AgendaItem).label || kind).trim().replace(/\s+/g, ' ').slice(0, 60) || kind,
            day: Math.max(1, Math.floor(day)),
            startMinute: Math.max(0, Math.min(1439, Math.floor(start))),
            endMinute: Math.max(1, Math.min(1440, Math.floor(end))),
          });
          if (clean.length >= MAX_AGENDA_PER_BUDDY_DAY * 7) break;
        }
        if (clean.length > 0) this.agenda.set(id, clean);
      }
    }
    this.mediations = [];
    if (Array.isArray(state.mediations)) {
      for (const item of state.mediations) {
        if (!item || typeof item !== 'object') continue;
        const kind = (item as MediationRecord).kind;
        const status = (item as MediationRecord).status;
        if (kind !== 'introduce' && kind !== 'strengthen' && kind !== 'ask_about') continue;
        if (status !== 'open' && status !== 'fulfilled' && status !== 'ignored' && status !== 'sabotaged' && status !== 'exposed') continue;
        const requesterId = normalizeBuddyId(String((item as MediationRecord).requesterId ?? ''));
        const targetId = normalizeBuddyId(String((item as MediationRecord).targetId ?? ''));
        if (!requesterId || !targetId || requesterId === targetId) continue;
        this.mediations.push({
          id: String((item as MediationRecord).id || `med_${this.mediations.length}`),
          requesterId,
          targetId,
          kind,
          status,
          createdDay: Number.isFinite((item as MediationRecord).createdDay) ? Math.max(1, Math.floor((item as MediationRecord).createdDay)) : 1,
          ...(Number.isFinite((item as MediationRecord).resolvedDay) ? { resolvedDay: Math.max(1, Math.floor((item as MediationRecord).resolvedDay as number)) } : {}),
        });
        if (this.mediations.length >= MAX_MEDIATIONS * 2) break;
      }
    }
    this.npcSocialLog = [];
    if (Array.isArray(state.npcSocialLog)) {
      for (const item of state.npcSocialLog) {
        if (!item || typeof item !== 'object') continue;
        const firstId = normalizeBuddyId(String((item as NpcInteractionLog).firstId ?? ''));
        const secondId = normalizeBuddyId(String((item as NpcInteractionLog).secondId ?? ''));
        if (!firstId || !secondId || firstId === secondId) continue;
        this.npcSocialLog.push({
          id: String((item as NpcInteractionLog).id || `nl_${this.npcSocialLog.length}`),
          day: Number.isFinite((item as NpcInteractionLog).day) ? Math.max(1, Math.floor((item as NpcInteractionLog).day)) : 1,
          firstId,
          secondId,
          location: String((item as NpcInteractionLog).location || 'around town').slice(0, 40),
          line: String((item as NpcInteractionLog).line || '').slice(0, 140),
        });
        if (this.npcSocialLog.length >= MAX_NPC_SOCIAL_LOG) break;
      }
    }

    // Backfill empty presence/conversations for any buddy missing them (old saves).
    for (const buddy of this.buddies.values()) {
      if (!this.relationships.has(buddy.id)) this.relationships.set(buddy.id, normalizeRelationshipDims(buddy.initialRelationships));
      if (!this.presence.has(buddy.id)) this.presence.set(buddy.id, { status: 'offline', awayMessage: '' });
      if (!this.conversations.has(buddy.id)) this.conversations.set(buddy.id, []);
    }
    // P4 affinity seeds: existing saves win, seeds only fill gaps (old saves get the core-4 ties)
    for (const [key, value] of Object.entries(SEED_AFFINITIES)) {
      if (!this.affinities.has(key)) this.affinities.set(key, value);
    }
  }

  private initializeDefaultState(): void {
    for (const buddy of this.buddies.values()) {
      this.relationships.set(buddy.id, { ...buddy.initialRelationships });
      this.presence.set(buddy.id, { status: 'offline', awayMessage: '' });
      this.conversations.set(buddy.id, []);
    }
    for (const [key, value] of Object.entries(SEED_AFFINITIES)) this.affinities.set(key, value);
  }

  private initializeCharacters(): void {
    // 1. Ryan (Food Cart Coworker)
    const ryanSchedule = this.generateStandardSchedule([
      { start: 0, end: 420, status: 'offline', msg: 'asleep' },
      { start: 420, end: 540, status: 'offline', msg: 'commute' },
      { start: 540, end: 960, status: 'offline', msg: 'work @ cart' },
      { start: 960, end: 1080, status: 'away', msg: 'afk grabbin tacos' },
      { start: 1080, end: 1320, status: 'online', msg: 'gaming / chilling' },
      { start: 1320, end: 1440, status: 'offline', msg: 'sleep is for the weak' },
    ]);

    this.buddies.set('ryan', {
      id: 'ryan',
      displayName: 'Ryan',
      handle: 'ryan_foodcart',
      schedule: ryanSchedule,
      initialRelationships: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
      traits: traitsForBuddy('ryan', 'coworker'),
      typingSpeedWpm: 80,
      archetype: 'coworker',
      status: 'friend',
      metVia: 'core',
      isProcedural: false,
      createdDay: 1,
    });

    // 2. Maya (Primary Arc)
    const mayaSchedule = this.generateStandardSchedule([
      { start: 0, end: 480, status: 'offline', msg: 'sleeping' },
      { start: 480, end: 540, status: 'offline', msg: 'morning tea' },
      { start: 540, end: 1050, status: 'away', msg: 'at the desk... dont look at me' },
      { start: 1050, end: 1260, status: 'online', msg: 'home! making coffee :)' },
      { start: 1260, end: 1440, status: 'online', msg: 'listening to the rain ~ myplace/mayablue' },
    ]);

    this.buddies.set('maya', {
      id: 'maya',
      displayName: 'Maya',
      handle: 'starlight_maya',
      schedule: mayaSchedule,
      initialRelationships: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
      traits: traitsForBuddy('maya', 'artist'),
      typingSpeedWpm: 60,
      archetype: 'artist',
      status: 'acquaintance',
      metVia: 'core',
      isProcedural: false,
      createdDay: 1,
    });

    // 3. Nora (NightOwl87)
    const noraSchedule = this.generateStandardSchedule([
      { start: 0, end: 300, status: 'online', msg: 'the night is quiet' },
      { start: 300, end: 360, status: 'away', msg: 'watching dawn' },
      { start: 360, end: 1140, status: 'offline', msg: 'offline' },
      { start: 1140, end: 1320, status: 'away', msg: 'indexing old logs' },
      { start: 1320, end: 1440, status: 'online', msg: 'nightboard / logs' },
    ]);

    this.buddies.set('nora', {
      id: 'nora',
      displayName: 'Nora',
      handle: 'NightOwl87',
      schedule: noraSchedule,
      initialRelationships: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
      traits: traitsForBuddy('nora', 'nightowl'),
      typingSpeedWpm: 90,
      archetype: 'nightowl',
      status: 'acquaintance',
      metVia: 'core',
      isProcedural: false,
      createdDay: 1,
    });

    // 4. Mr. Henderson (Landlord)
    const hendersonSchedule = this.generateStandardSchedule([
      { start: 0, end: 480, status: 'offline', msg: 'office closed' },
      { start: 480, end: 1200, status: 'online', msg: 'motel front desk open' },
      { start: 1200, end: 1440, status: 'offline', msg: 'office closed' },
    ]);

    this.buddies.set('henderson', {
      id: 'henderson',
      displayName: 'Mr. Henderson',
      handle: 'motel_office',
      schedule: hendersonSchedule,
      initialRelationships: { familiarity: 30, trust: 30, comfort: 20, respect: 40, annoyance: 10, affection: 0, attraction: 0, suspicion: 0, resentment: 0 },
      traits: traitsForBuddy('henderson', 'regular'),
      typingSpeedWpm: 40,
      archetype: 'regular',
      status: 'acquaintance',
      metVia: 'core',
      isProcedural: false,
      createdDay: 1,
    });
  }

  private generateStandardSchedule(
    blocks: Array<{ start: number; end: number; status: BuddyPresenceStatus; msg: string }>
  ): Record<number, ScheduleBlock[]> {
    const sched: Record<number, ScheduleBlock[]> = {};
    for (let day = 1; day <= 14; day++) {
      sched[day] = blocks.map(b => ({
        startMinuteOfDay: b.start,
        endMinuteOfDay: b.end,
        status: b.status,
        awayMessage: b.msg,
      }));
    }
    return sched;
  }

  /**
   * Updates contact presence based on current game time.
   * Schedule lookup: exact day → weekly rotation (day 8 reuses day 1 pattern) → day 1.
   * Core buddies keep 1..14 maps (unchanged behaviour); dynamic buddies use 1..7.
   */
  public updatePresence(currentTotalMinutes: number): void {
    const day = Math.floor(currentTotalMinutes / 1440) + 1;
    const minuteOfDay = currentTotalMinutes % 1440;

    for (const [id, buddy] of this.buddies.entries()) {
      // P3 sharp lifecycle: distant/gone/blocked buddies stay dark regardless of schedule.
      if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') {
        const prev = this.presence.get(id);
        if (!prev || prev.status !== 'offline') {
          this.presence.set(id, { status: 'offline', awayMessage: '' });
          this.eventBus.emit('social:status_changed', { buddyId: id, presence: { status: 'offline', awayMessage: '' } });
        }
        continue;
      }
      const weeklyDay = ((day - 1) % 7) + 1;
      const daySched = buddy.schedule[day] || buddy.schedule[weeklyDay] || buddy.schedule[1];
      let currentBlock = daySched?.find(
        b => minuteOfDay >= b.startMinuteOfDay && minuteOfDay < b.endMinuteOfDay
      );

      if (!currentBlock && daySched && daySched.length > 0) {
        currentBlock = daySched[0];
      }

      if (currentBlock) {
        const prev = this.presence.get(id);
        if (!prev || prev.status !== currentBlock.status || prev.awayMessage !== currentBlock.awayMessage) {
          const newPresence: BuddyPresence = {
            status: currentBlock.status,
            awayMessage: currentBlock.awayMessage,
          };
          this.presence.set(id, newPresence);
          this.eventBus.emit('social:status_changed', { buddyId: id, presence: newPresence });
        }
      }
    }
  }

  public applySocialAction(rawBuddyId: string, actionType: string): RelationshipDimensions {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const current = this.relationships.get(buddyId);
    if (!current) throw new Error(`Buddy not found: ${buddyId}`);

    const deltas: Record<string, Partial<RelationshipDimensions>> = {
      empathy: { familiarity: 3, trust: 4, comfort: 5, respect: 2, annoyance: -2, affection: 1 },
      remembered_detail: { familiarity: 5, trust: 6, comfort: 6, respect: 4, annoyance: -1, affection: 1 },
      tease_playful: { familiarity: 4, trust: 2, comfort: 3, respect: 2, annoyance: 0, affection: 1 },
      dismissive: { familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: 8, suspicion: 2, resentment: 4 },
      vulnerable_share: { familiarity: 6, trust: 7, comfort: 8, respect: 3, annoyance: -2, affection: 4 },
      work_camaraderie: { familiarity: 4, trust: 3, comfort: 4, respect: 3, annoyance: 0, affection: 1 },
      intellectual_curiosity: { familiarity: 4, trust: 5, comfort: 2, respect: 6, annoyance: 0 },
      // Engine-only (mediation/romance paths — never AI-honoured, not in the chat allowlist)
      apologize: { trust: 2, respect: 2, comfort: 2, annoyance: -3, resentment: -3 },
      betray_confidence: { trust: -12, respect: -8, comfort: -8, annoyance: 10, suspicion: 8, resentment: 12, affection: -6 },
    };

    const delta = deltas[actionType] || { familiarity: 1 };
    const base = normalizeRelationshipDims(current);

    const updated: RelationshipDimensions = {
      familiarity: Math.max(0, Math.min(100, base.familiarity + (delta.familiarity ?? 0))),
      trust: Math.max(0, Math.min(100, base.trust + (delta.trust ?? 0))),
      comfort: Math.max(0, Math.min(100, base.comfort + (delta.comfort ?? 0))),
      respect: Math.max(0, Math.min(100, base.respect + (delta.respect ?? 0))),
      annoyance: Math.max(0, Math.min(100, base.annoyance + (delta.annoyance ?? 0))),
      affection: Math.max(0, Math.min(100, base.affection + (delta.affection ?? 0))),
      attraction: Math.max(0, Math.min(100, base.attraction + (delta.attraction ?? 0))),
      suspicion: Math.max(0, Math.min(100, base.suspicion + (delta.suspicion ?? 0))),
      resentment: Math.max(0, Math.min(100, base.resentment + (delta.resentment ?? 0))),
    };

    this.relationships.set(buddyId, updated);
    this.eventBus.emit('social:relationship_updated', {
      buddyId,
      dimensions: { ...updated },
      delta,
    });

    return { ...updated };
  }

  // ==========================================
  // P3 — LONG-TERM MEMORY, STAGES, MOOD, LIFECYCLE
  // ==========================================

  /** Add an immortal memory (capped at MAX_CORE_MEMORIES, deduped by text). Returns stored record or null. */
  public addCoreMemory(rawBuddyId: string, memory: { text: string; kind: CoreMemory['kind']; day: number }): CoreMemory | null {
    const buddyId = normalizeBuddyId(rawBuddyId);
    if (!this.buddies.has(buddyId)) return null;
    if (!SocialEngine.isValidMemoryKind(memory.kind)) return null;
    const text = SocialEngine.sanitizeMemoryText(memory.text, 160);
    if (text.length < 3) return null;
    const existing = this.coreMemories.get(buddyId) || [];
    if (existing.some((m) => m.text.toLowerCase() === text.toLowerCase())) return null;
    const record: CoreMemory = {
      id: `cm_${Date.now().toString(36)}_${hashText(`${buddyId}:${text}`).toString(36)}`,
      text,
      kind: memory.kind,
      day: Math.max(1, Math.floor(memory.day) || 1),
    };
    const next = [...existing, record];
    // Evict oldest non-first_meeting first so origin memories survive longest
    while (next.length > MAX_CORE_MEMORIES) {
      const evictIndex = next.findIndex((m) => m.kind !== 'first_meeting');
      next.splice(evictIndex === -1 ? 0 : evictIndex, 1);
    }
    this.coreMemories.set(buddyId, next);
    return { ...record };
  }

  public getCoreMemories(rawBuddyId: string): CoreMemory[] {
    return (this.coreMemories.get(normalizeBuddyId(rawBuddyId)) || []).map((m) => ({ ...m }));
  }

  /** Record a player commitment. Caps open promises at MAX_OPEN_PROMISES (oldest open dropped). */
  public addPromise(rawBuddyId: string, text: string, createdDay: number, dueDay?: number): PromiseRecord | null {
    const buddyId = normalizeBuddyId(rawBuddyId);
    if (!this.buddies.has(buddyId)) return null;
    const clean = SocialEngine.sanitizeMemoryText(text, 140);
    if (clean.length < 8) return null;
    const existing = this.promises.get(buddyId) || [];
    if (existing.some((p) => p.status === 'open' && p.text.toLowerCase() === clean.toLowerCase())) return null;
    const record: PromiseRecord = {
      id: `pr_${Date.now().toString(36)}_${hashText(`${buddyId}:${clean}`).toString(36)}`,
      text: clean,
      status: 'open',
      createdDay: Math.max(1, Math.floor(createdDay) || 1),
      ...(Number.isFinite(dueDay) ? { dueDay: Math.max(1, Math.floor(dueDay as number)) } : {}),
    };
    const next = [...existing, record];
    const open = next.filter((p) => p.status === 'open');
    while (open.length > MAX_OPEN_PROMISES) {
      const oldest = open.shift()!;
      const idx = next.indexOf(oldest);
      if (idx !== -1) next.splice(idx, 1);
    }
    this.promises.set(buddyId, next);
    return { ...record };
  }

  public getPromises(rawBuddyId: string): PromiseRecord[] {
    return (this.promises.get(normalizeBuddyId(rawBuddyId)) || []).map((p) => ({ ...p }));
  }

  public getOpenPromises(rawBuddyId: string): PromiseRecord[] {
    return this.getPromises(rawBuddyId).filter((p) => p.status === 'open');
  }

  /**
   * Resolve a promise. Kept → immortal memory + remembered_detail bump;
   * broken → immortal memory + dismissive hit. Returns null when unknown/already closed.
   */
  public resolvePromise(rawBuddyId: string, promiseId: string, kept: boolean, day: number): { promise: PromiseRecord; relationships: RelationshipDimensions } | null {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const list = this.promises.get(buddyId);
    if (!list) return null;
    const record = list.find((p) => p.id === promiseId);
    if (!record || record.status !== 'open') return null;
    record.status = kept ? 'kept' : 'broken';
    this.addCoreMemory(buddyId, {
      text: `${kept ? 'Kept promise' : 'Broke promise'}: "${record.text}"`,
      kind: kept ? 'promise_kept' : 'promise_broken',
      day,
    });
    const relationships = this.applySocialAction(buddyId, kept ? 'remembered_detail' : 'dismissive');
    this.eventBus.emit('social:promise_resolved', { buddyId, promiseId, kept });
    return { promise: { ...record }, relationships };
  }

  /**
   * Auto-break overdue open promises (dueDay < day). Returns broken records for messaging.
   * Called once per day-change by SimulationEngine — never from chat paths.
   */
  public checkPromiseDues(day: number): Array<{ buddyId: string; promise: PromiseRecord }> {
    const broken: Array<{ buddyId: string; promise: PromiseRecord }> = [];
    for (const [buddyId, list] of this.promises.entries()) {
      for (const record of list) {
        if (record.status !== 'open' || record.dueDay === undefined || record.dueDay >= day) continue;
        const res = this.resolvePromise(buddyId, record.id, false, day);
        if (res) broken.push({ buddyId, promise: res.promise });
      }
    }
    return broken;
  }

  /** Relationship stage derived from dimensions (strained overrides everything at high annoyance). */
  public getRelationshipStage(rawBuddyId: string): RelationshipStage {
    const rel = this.relationships.get(normalizeBuddyId(rawBuddyId));
    if (!rel) return 'stranger';
    if (rel.annoyance >= STRAINED_ANNOYANCE) return 'strained';
    if (rel.familiarity < 10) return 'stranger';
    if (rel.familiarity < 35) return 'acquaintance';
    if (rel.familiarity < 65 || rel.trust < 50) return 'friend';
    return 'close';
  }

  /** Daily mood: deterministic per (buddy, day); strained buddies are always cold. */
  public getDailyMood(rawBuddyId: string, day: number): DailyMood {
    const id = normalizeBuddyId(rawBuddyId);
    const rel = this.relationships.get(id);
    if (rel && rel.annoyance >= STRAINED_ANNOYANCE) return 'cold';
    const roll = hashText(`${id}:${Math.max(1, Math.floor(day) || 1)}`) % 100;
    let mood: DailyMood;
    if (roll < 35) mood = 'warm';
    else if (roll < 70) mood = 'steady';
    else if (roll < 88) mood = 'tired';
    else mood = 'off';
    // P6.2 Maya loves the rain: wet days lift her one step (strained-cold is exempt above)
    if (id === 'maya' && isWetWeather(getWeatherForDay(day).condition)) {
      if (mood === 'off') mood = 'tired';
      else if (mood === 'tired') mood = 'steady';
      else if (mood === 'steady') mood = 'warm';
    }
    return mood;
  }

  /**
   * Move a buddy along the lifecycle (distant/gone for sharp events, back to
   * acquaintance on return). Core 4 are protected: they can never go distant/gone/blocked.
   */
  public setBuddyStatus(rawId: string, status: BuddyLifecycleStatus): BuddyCharacter {
    const id = normalizeBuddyId(rawId);
    const buddy = this.buddies.get(id);
    if (!buddy) throw new Error(`Buddy not found: ${id}`);
    if (isCoreBuddyId(id) && (status === 'distant' || status === 'gone' || status === 'blocked')) {
      throw new Error(`Core buddy is protected from '${status}': ${id}`);
    }
    buddy.status = status;
    this.eventBus.emit('social:buddy_status_changed', { buddyId: id, status });
    return { ...buddy };
  }

  /** Governed direct adjustment (used by the distant-return path). Values clamped 0..100. */
  public adjustRelationship(rawBuddyId: string, partial: Partial<RelationshipDimensions>): RelationshipDimensions {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const current = this.relationships.get(buddyId);
    if (!current) throw new Error(`Buddy not found: ${buddyId}`);
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const base = normalizeRelationshipDims(current);
    const updated: RelationshipDimensions = { ...base };
    for (const [k, v] of Object.entries(partial)) {
      const key = k as keyof RelationshipDimensions;
      if (typeof v === 'number' && Number.isFinite(v) && key in base) {
        updated[key] = clamp(v);
      }
    }
    this.relationships.set(buddyId, updated);
    this.eventBus.emit('social:relationship_updated', { buddyId, dimensions: { ...updated }, delta: partial });
    return { ...updated };
  }

  /** Compact long-term context for prompt injection (bounded: 8 memories + 5 promises). */
  public buildLongTermContext(rawBuddyId: string): string {
    const buddyId = normalizeBuddyId(rawBuddyId);
    const memories = this.getCoreMemories(buddyId);
    const open = this.getOpenPromises(buddyId);
    const memoryLine = memories.length > 0
      ? memories.map((m) => `[${m.kind} d${m.day}] ${m.text}`).join(' | ')
      : 'No long-term memories yet.';
    const promiseLine = open.length > 0
      ? open.map((p) => `"${p.text}"${p.dueDay !== undefined ? ` (due d${p.dueDay})` : ''}`).join(' | ')
      : 'No open promises.';
    return `LongTerm: ${memoryLine} | OpenPromises: ${promiseLine}`;
  }

  // ==========================================
  // P4 — BUDDY-TO-BUDDY AFFINITIES (C2 matrix)
  // ==========================================

  /** Current affinity between two buddies (-100..100, 0 = neutral strangers). */
  public getAffinity(rawA: string, rawB: string): number {
    const a = normalizeBuddyId(rawA);
    const b = normalizeBuddyId(rawB);
    if (a === b) return 0;
    return this.affinities.get(affinityKey(a, b)) ?? 0;
  }

  /**
   * Shift an affinity pair by delta (clamped -100..100). Both buddies must exist
   * and differ; self-pairs and unknown ids are ignored (returns current value).
   */
  public adjustAffinity(rawA: string, rawB: string, delta: number): number {
    const a = normalizeBuddyId(rawA);
    const b = normalizeBuddyId(rawB);
    if (a === b || !this.buddies.has(a) || !this.buddies.has(b)) return this.getAffinity(a, b);
    if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) return this.getAffinity(a, b);
    const next = Math.max(-MAX_AFFINITY, Math.min(MAX_AFFINITY, Math.round(this.getAffinity(a, b) + delta)));
    this.affinities.set(affinityKey(a, b), next);
    return next;
  }

  /**
   * Shared room turn: every pair among participants grows closer by `points`
   * (P5.3 mood-weighted: lively 3, warm/steady 2, tense 1, cold 0),
   * capped at +6 per pair per day (anti-farming). Returns bumped pair count.
   */
  public bumpRoomAffinity(rawParticipantIds: string[], day: number, points = ROOM_BUMP_PER_TURN): number {
    const ids = Array.from(new Set(rawParticipantIds.map(normalizeBuddyId))).filter((id) => this.buddies.has(id));
    if (ids.length < 2) return 0;
    const gain = Math.max(0, Math.min(ROOM_BUMP_PER_TURN + 1, Math.floor(points) || 0));
    if (gain === 0) return 0;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    let bumped = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = affinityKey(ids[i]!, ids[j]!);
        const capKey = `${key}_${safeDay}`;
        const used = this.affinityCaps.get(capKey) ?? 0;
        if (used >= ROOM_BUMP_DAILY_CAP) continue;
        const add = Math.min(gain, ROOM_BUMP_DAILY_CAP - used);
        this.adjustAffinity(ids[i]!, ids[j]!, add);
        this.affinityCaps.set(capKey, used + add);
        bumped++;
      }
    }
    // Prune caps older than the window so the map stays tiny
    for (const capKey of Array.from(this.affinityCaps.keys())) {
      const dayPart = Number(capKey.slice(capKey.lastIndexOf('_') + 1));
      if (Number.isFinite(dayPart) && dayPart < safeDay - 2) this.affinityCaps.delete(capKey);
    }
    return bumped;
  }

  /**
   * Compact buddy-to-buddy context for prompt injection ("Others: Maya↔Ryan: warm (+15)").
   * Only notable ties (|v| >= 5), max 6, strongest first. Empty string when none.
   */
  public buildAffinityContext(rawBuddyId: string): string {
    const buddyId = normalizeBuddyId(rawBuddyId);
    if (!this.buddies.has(buddyId)) return '';
    const entries: Array<{ name: string; label: string; value: number }> = [];
    for (const other of this.buddies.values()) {
      if (other.id === buddyId) continue;
      const value = this.getAffinity(buddyId, other.id);
      if (Math.abs(value) < 5) continue;
      const label = value >= 30 ? 'deep bond' : value >= 10 ? 'warm' : value <= -30 ? 'bitter' : 'tense';
      entries.push({ name: other.displayName, label, value });
    }
    if (entries.length === 0) return '';
    entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const parts = entries.slice(0, 6).map((e) => `${e.name}: ${e.label} (${e.value >= 0 ? '+' : ''}${e.value})`);
    return `Others: ${parts.join(' • ')}`;
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

  /** Directed bond read (a→b). Absent pairs read neutral — the matrix is sparse, never auto-filled. */
  public getNpcBond(rawFrom: string, rawTo: string): NpcBondState {
    const key = npcBondKey(rawFrom, rawTo);
    const stored = key ? this.npcBonds.get(key) : undefined;
    if (!stored) return neutralNpcBond();
    return {
      dims: { ...stored.dims },
      romance: stored.romance,
      romanceSinceDay: stored.romanceSinceDay,
      updatedDay: stored.updatedDay,
    };
  }

  /**
   * Shift a directed bond by deltas (clamped 0..100). Both buddies must exist
   * and differ; anything else returns null (no silent writes).
   */
  public adjustNpcBond(rawFrom: string, rawTo: string, partial: Partial<NpcBondDims>, day: number): NpcBondState | null {
    const from = normalizeBuddyId(rawFrom);
    const to = normalizeBuddyId(rawTo);
    if (!from || !to || from === to || !this.buddies.has(from) || !this.buddies.has(to)) return null;
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const current = this.getNpcBond(from, to);
    const dims: NpcBondDims = { ...current.dims };
    for (const [k, v] of Object.entries(partial)) {
      const key = k as keyof NpcBondDims;
      if (typeof v === 'number' && Number.isFinite(v) && key in dims) {
        dims[key] = clamp(dims[key] + v);
      }
    }
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const next: NpcBondState = { dims, romance: current.romance, romanceSinceDay: current.romanceSinceDay, updatedDay: safeDay };
    this.npcBonds.set(npcBondKey(from, to), next);
    this.eventBus.emit('social:npc_bond_updated' as any, { fromId: from, toId: to, bond: { ...next, dims: { ...dims } } });
    return this.getNpcBond(from, to);
  }

  /** Apply a named NPC↔NPC action from the fixed table (unknown names read, never write). */
  public applyNpcSocialAction(rawFrom: string, rawTo: string, action: string, day: number): NpcBondState | null {
    const delta = NPC_SOCIAL_ACTION_DELTAS[action];
    if (!delta) return this.getNpcBond(rawFrom, rawTo);
    return this.adjustNpcBond(rawFrom, rawTo, delta, day);
  }

  /** Set the directed romance stage (validated pair only). Same-stage writes are no-ops. */
  public setNpcRomance(rawFrom: string, rawTo: string, stage: NpcRomanceStage, day: number): NpcBondState | null {
    const from = normalizeBuddyId(rawFrom);
    const to = normalizeBuddyId(rawTo);
    if (!from || !to || from === to || !this.buddies.has(from) || !this.buddies.has(to)) return null;
    if (stage !== 'none' && stage !== 'crush' && stage !== 'dating') return null;
    const current = this.getNpcBond(from, to);
    const safeDay = Math.max(1, Math.floor(day) || 1);
    if (current.romance === stage) return current;
    const next: NpcBondState = {
      ...current,
      dims: { ...current.dims },
      romance: stage,
      romanceSinceDay: stage === 'none' ? 1 : safeDay,
      updatedDay: safeDay,
    };
    this.npcBonds.set(npcBondKey(from, to), next);
    this.eventBus.emit('social:npc_romance_changed' as any, { fromId: from, toId: to, stage, day: safeDay });
    return this.getNpcBond(from, to);
  }

  /** True when the buddy is informally dating anyone (either direction counts). */
  public isDatingAnyone(rawId: string): boolean {
    const id = normalizeBuddyId(rawId);
    for (const other of this.buddies.values()) {
      if (other.id === id) continue;
      if (this.getNpcBond(id, other.id).romance === 'dating') return true;
      if (this.getNpcBond(other.id, id).romance === 'dating') return true;
    }
    return false;
  }

  // ---------- Agenda ----------

  /** Planned blocks for a buddy (optionally one day), earliest-first. Copies, never live refs. */
  public getAgenda(rawId: string, day?: number): AgendaItem[] {
    const items = this.agenda.get(normalizeBuddyId(rawId)) ?? [];
    const list = (day === undefined ? items : items.filter((a) => a.day === day)).map((a) => ({ ...a }));
    list.sort((x, y) => x.startMinute - y.startMinute);
    return list;
  }

  /** Replace a buddy's agenda (validated, per-day capped). Throws for unknown buddies. */
  public setAgenda(rawId: string, items: AgendaItem[]): AgendaItem[] {
    const id = normalizeBuddyId(rawId);
    if (!this.buddies.has(id)) throw new Error(`Buddy not found: ${id}`);
    const perDay = new Map<number, number>();
    const clean: AgendaItem[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const kind = (item as AgendaItem).kind;
      if (kind !== 'sleep' && kind !== 'work' && kind !== 'social' && kind !== 'errand') continue;
      const day = (item as AgendaItem).day;
      const start = (item as AgendaItem).startMinute;
      const end = (item as AgendaItem).endMinute;
      if (!Number.isFinite(day) || !Number.isFinite(start) || !Number.isFinite(end)) continue;
      const safeDay = Math.max(1, Math.floor(day));
      const used = perDay.get(safeDay) ?? 0;
      if (used >= MAX_AGENDA_PER_BUDDY_DAY) continue;
      perDay.set(safeDay, used + 1);
      clean.push({
        id: String((item as AgendaItem).id || `ag_${safeDay}_${clean.length}`),
        kind,
        label: String((item as AgendaItem).label || kind).trim().replace(/\s+/g, ' ').slice(0, 60) || kind,
        day: safeDay,
        startMinute: Math.max(0, Math.min(1439, Math.floor(start))),
        endMinute: Math.max(1, Math.min(1440, Math.floor(end))),
      });
    }
    clean.sort((x, y) => x.day - y.day || x.startMinute - y.startMinute);
    this.agenda.set(id, clean);
    this.eventBus.emit('social:agenda_updated' as any, { buddyId: id, count: clean.length });
    return clean.map((a) => ({ ...a }));
  }

  // ---------- Mediations ----------

  /** Ask the player to mediate (introduce / strengthen / ask about). Capped + deduped. */
  public requestMediation(rawRequester: string, rawTarget: string, kind: MediationKind, day: number): MediationRecord | null {
    const requesterId = normalizeBuddyId(rawRequester);
    const targetId = normalizeBuddyId(rawTarget);
    if (!requesterId || !targetId || requesterId === targetId) return null;
    if (!this.buddies.has(requesterId) || !this.buddies.has(targetId)) return null;
    if (kind !== 'introduce' && kind !== 'strengthen' && kind !== 'ask_about') return null;
    if (this.mediations.some((m) => m.status === 'open' && m.requesterId === requesterId && m.targetId === targetId && m.kind === kind)) return null;
    if (this.mediations.filter((m) => m.status === 'open').length >= MAX_MEDIATIONS) return null;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    let id = `med_${requesterId}_${targetId}_${kind}_${safeDay}`;
    let n = 2;
    while (this.mediations.some((m) => m.id === id)) id = `med_${requesterId}_${targetId}_${kind}_${safeDay}_${n++}`;
    const record: MediationRecord = { id, requesterId, targetId, kind, status: 'open', createdDay: safeDay };
    this.mediations.push(record);
    this.eventBus.emit('social:mediation_requested' as any, { mediation: { ...record } });
    return { ...record };
  }

  public getMediation(mediationId: string): MediationRecord | undefined {
    const found = this.mediations.find((m) => m.id === mediationId);
    return found ? { ...found } : undefined;
  }

  public getOpenMediations(): MediationRecord[] {
    return this.mediations.filter((m) => m.status === 'open').map((m) => ({ ...m }));
  }

  /**
   * Resolve the player's answer. help → bond bump + requester trust up;
   * ignore → mild annoyance; badmouth → 'sabotaged' (no immediate damage —
   * the pair may expose it later when they interact, see checkMediationExposure).
   */
  public respondMediation(mediationId: string, choice: 'help' | 'ignore' | 'badmouth', day: number): MediationRecord | null {
    const record = this.mediations.find((m) => m.id === mediationId);
    if (!record || record.status !== 'open') return null;
    if (choice !== 'help' && choice !== 'ignore' && choice !== 'badmouth') return null;
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const rel = this.relationships.get(record.requesterId);
    if (choice === 'ignore') {
      record.status = 'ignored';
      record.resolvedDay = safeDay;
      if (rel) {
        this.adjustRelationship(record.requesterId, {
          ...normalizeRelationshipDims(rel),
          trust: Math.max(0, rel.trust - 2),
          annoyance: Math.min(100, (rel.annoyance ?? 0) + 4),
        });
      }
    } else if (choice === 'help') {
      record.status = 'fulfilled';
      record.resolvedDay = safeDay;
      if (record.kind === 'introduce') {
        this.adjustNpcBond(record.requesterId, record.targetId, { familiarity: 6, comfort: 3 }, safeDay);
        this.adjustNpcBond(record.targetId, record.requesterId, { familiarity: 6, comfort: 3 }, safeDay);
      } else {
        this.adjustNpcBond(record.requesterId, record.targetId, { trust: 3, comfort: 2 }, safeDay);
        this.adjustNpcBond(record.targetId, record.requesterId, { trust: 3, comfort: 2 }, safeDay);
      }
      this.applySocialAction(record.requesterId, 'remembered_detail');
    } else {
      // badmouth: recorded, damage lands only if the pair compares notes later.
      record.status = 'sabotaged';
    }
    this.eventBus.emit('social:mediation_resolved' as any, { mediation: { ...record } });
    return { ...record };
  }

  /**
   * Discovery pass after an NPC↔NPC interaction between a and b: every
   * 'sabotaged' mediation across this pair rolls exposure (seeded by
   * mediation+day, weighted by the pair's suspicion). Exposed sabotage craters
   * BOTH player relationships — they talked, and the player lied to both.
   */
  public checkMediationExposure(rawA: string, rawB: string, day: number): MediationRecord[] {
    const a = normalizeBuddyId(rawA);
    const b = normalizeBuddyId(rawB);
    if (!a || !b || a === b) return [];
    const safeDay = Math.max(1, Math.floor(day) || 1);
    const exposed: MediationRecord[] = [];
    for (const m of this.mediations) {
      if (m.status !== 'sabotaged') continue;
      const onPair = (m.requesterId === a && m.targetId === b) || (m.requesterId === b && m.targetId === a);
      if (!onPair) continue;
      const suspicion = Math.max(
        this.getNpcBond(m.requesterId, m.targetId).dims.suspicion,
        this.getNpcBond(m.targetId, m.requesterId).dims.suspicion,
      );
      const roll = rollSeeded100(`expose:${m.id}:${safeDay}`);
      if (roll >= 25 + suspicion * 0.5) continue;
      m.status = 'exposed';
      m.resolvedDay = safeDay;
      const rName = this.buddies.get(m.requesterId)?.displayName ?? m.requesterId;
      const tName = this.buddies.get(m.targetId)?.displayName ?? m.targetId;
      for (const buddyId of [m.requesterId, m.targetId]) {
        if (!this.buddies.has(buddyId)) continue;
        this.applySocialAction(buddyId, 'betray_confidence');
        this.addCoreMemory(buddyId, {
          text: `Badmouthed ${buddyId === m.requesterId ? tName : rName} — they compared notes (day ${safeDay}). Trust is wrecked.`,
          kind: 'fact',
          day: safeDay,
        });
      }
      this.eventBus.emit('social:mediation_exposed' as any, { mediation: { ...m } });
      exposed.push({ ...m });
    }
    return exposed;
  }

  // ---------- Witness log ----------

  /** Record a witnessable NPC↔NPC moment (capped; oldest evicted). */
  public logNpcInteraction(entry: Omit<NpcInteractionLog, 'id'>): NpcInteractionLog {
    const record: NpcInteractionLog = {
      id: `nl_${entry.day}_${entry.firstId}_${entry.secondId}`,
      day: Math.max(1, Math.floor(entry.day) || 1),
      firstId: normalizeBuddyId(entry.firstId),
      secondId: normalizeBuddyId(entry.secondId),
      location: String(entry.location || 'around town').slice(0, 40),
      line: String(entry.line || '').slice(0, 140),
    };
    const existing = this.npcSocialLog.findIndex((l) => l.id === record.id);
    if (existing !== -1) this.npcSocialLog.splice(existing, 1);
    this.npcSocialLog.push(record);
    while (this.npcSocialLog.length > MAX_NPC_SOCIAL_LOG) this.npcSocialLog.shift();
    return { ...record };
  }

  public getNpcSocialLog(day?: number): NpcInteractionLog[] {
    const list = day === undefined ? this.npcSocialLog : this.npcSocialLog.filter((l) => l.day === day);
    return list.map((l) => ({ ...l }));
  }

  // ---------- Prompt contexts (bounded, never quoted literally) ----------

  /**
   * Compact directed-tie context ("Ties: Ryan — warm, dating since d8").
   * Only notable ties (romance, |net| >= 10), max 6, strongest first.
   */
  public buildBondContext(rawBuddyId: string): string {
    const buddyId = normalizeBuddyId(rawBuddyId);
    if (!this.buddies.has(buddyId)) return '';
    const entries: Array<{ text: string; weight: number }> = [];
    for (const other of this.buddies.values()) {
      if (other.id === buddyId) continue;
      const out = this.getNpcBond(buddyId, other.id);
      const back = this.getNpcBond(other.id, buddyId);
      const net = out.dims.affection - out.dims.annoyance - out.dims.resentment
        + back.dims.affection - back.dims.annoyance - back.dims.resentment;
      const romance = out.romance === 'dating' || back.romance === 'dating' ? 'dating'
        : out.romance === 'crush' || back.romance === 'crush' ? 'crush' : 'none';
      if (romance === 'none' && Math.abs(net) < 10) continue;
      const since = out.romance !== 'none' ? out.romanceSinceDay : back.romanceSinceDay;
      const label = romance === 'dating' ? `dating since d${since}`
        : romance === 'crush' ? 'crush'
        : net >= 30 ? 'deep bond' : net >= 10 ? 'warm' : net <= -30 ? 'bitter' : 'tense';
      entries.push({ text: `${other.displayName}: ${label}`, weight: romance !== 'none' ? 1000 + Math.abs(net) : Math.abs(net) });
    }
    if (entries.length === 0) return '';
    entries.sort((x, y) => y.weight - x.weight);
    return `Ties: ${entries.slice(0, 6).map((e) => e.text).join(' • ')}`;
  }

  /**
   * Compact romance line answering "are you seeing anyone?" ("Romance: dating
   * Ryan since day 8"). Always present (single when uninvolved) so the model
   * never invents partners.
   */
  public buildRomanceContext(rawBuddyId: string): string {
    const buddyId = normalizeBuddyId(rawBuddyId);
    if (!this.buddies.has(buddyId)) return 'Romance: single';
    const involvements: string[] = [];
    for (const other of this.buddies.values()) {
      if (other.id === buddyId) continue;
      const out = this.getNpcBond(buddyId, other.id);
      const back = this.getNpcBond(other.id, buddyId);
      const stage: NpcRomanceStage = out.romance === 'dating' || back.romance === 'dating' ? 'dating'
        : out.romance === 'crush' || back.romance === 'crush' ? 'crush' : 'none';
      if (stage === 'none') continue;
      const since = out.romance !== 'none' ? out.romanceSinceDay : back.romanceSinceDay;
      involvements.push(stage === 'dating' ? `dating ${other.displayName} since day ${since}` : `crush on ${other.displayName}`);
    }
    return involvements.length > 0 ? `Romance: ${involvements.slice(0, 3).join('; ')}` : 'Romance: single';
  }

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

    const existing = this.conversations.get(conversationId) || [];
    existing.push(msg);
    this.conversations.set(conversationId, existing);

    // P5.5 visual memory: buddy-sent photos become immortal (capped so facts survive too).
    // Covers every photo path (AI chat, scripts) since all funnel through here.
    if (senderId !== 'player' && (imagePrompt || imageUrl) && this.buddies.has(conversationId)) {
      const photos = (this.coreMemories.get(conversationId) || []).filter((m) => m.kind === 'shared_photo');
      if (photos.length < MAX_PHOTO_MEMORIES) {
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

  public markAsRead(rawConversationId: string): void {
    const msgs = this.conversations.get(normalizeBuddyId(rawConversationId));
    if (msgs) {
      for (const m of msgs) {
        m.isRead = true;
      }
    }
  }

  public getBuddy(rawId: string): BuddyCharacter | undefined {
    return this.buddies.get(normalizeBuddyId(rawId));
  }

  public getBuddies(): BuddyCharacter[] {
    return Array.from(this.buddies.values());
  }

  public getRelationships(rawId: string): RelationshipDimensions | undefined {
    const rel = this.relationships.get(normalizeBuddyId(rawId));
    return rel ? { ...rel } : undefined;
  }

  public getPresence(rawId: string): BuddyPresence | undefined {
    const pres = this.presence.get(normalizeBuddyId(rawId));
    return pres ? { ...pres } : undefined;
  }

  public getMessages(rawConversationId: string): MessageRecord[] {
    const msgs = this.conversations.get(normalizeBuddyId(rawConversationId)) || [];
    return msgs.map(m => ({ ...m }));
  }

  /** P6.5 last footprint: latest conversation minute with a buddy (either direction), 0 when never. */
  public getLastActivityMinute(rawBuddyId: string): number {
    const msgs = this.conversations.get(normalizeBuddyId(rawBuddyId)) || [];
    let last = 0;
    for (const m of msgs) {
      if (typeof m.timestampMinute === 'number' && m.timestampMinute > last) last = m.timestampMinute;
    }
    return last;
  }

  /** Latest minute the PLAYER wrote anything (any buddy), 0 when never. Solitude accounting. */
  public getLastPlayerMessageMinute(): number {
    let last = 0;
    for (const msgs of this.conversations.values()) {
      for (const m of msgs) {
        if (m.senderId === 'player' && typeof m.timestampMinute === 'number' && m.timestampMinute > last) {
          last = m.timestampMinute;
        }
      }
    }
    return last;
  }

  /** True when the player wrote at least one line on the given game day. */
  public didPlayerWriteOnDay(day: number): boolean {
    const safeDay = Math.max(1, Math.floor(day) || 1);
    for (const msgs of this.conversations.values()) {
      for (const m of msgs) {
        if (m.senderId !== 'player' || typeof m.timestampMinute !== 'number') continue;
        if (Math.floor(m.timestampMinute / 1440) + 1 === safeDay) return true;
      }
    }
    return false;
  }
}
