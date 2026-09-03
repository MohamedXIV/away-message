import {
  BuddyPresenceStatus,
  RelationshipDimensions,
  BuddyCharacter,
  BuddyLifecycleStatus,
  BuddyPresence,
  CoreMemory,
  DailyMood,
  MessageRecord,
  PromiseRecord,
  RelationshipStage,
  SocialEngineState,
  ScheduleBlock,
} from './types';
import { EventBus } from './EventBus';
import { validateCharacterId, isValidSchedule, isCoreBuddyId } from './characterTemplates';
import { validatePersistedBuddy } from './CharacterEngine';

// P3 long-term memory caps (keeps prompt injection bounded and saves small)
export const MAX_CORE_MEMORIES = 8;
export const MAX_OPEN_PROMISES = 5;
// P3 sharp-event thresholds (annoyance scale 0..100; dismissive gives +8)
export const STRAINED_ANNOYANCE = 60;
export const DISTANT_ANNOYANCE = 85;
export const GONE_ANNOYANCE = 95;

// P4 buddy-to-buddy affinity bounds (room turns give +2, capped +6/pair/day)
export const MAX_AFFINITY = 100;
export const ROOM_BUMP_PER_TURN = 2;
export const ROOM_BUMP_DAILY_CAP = 6;

/** Canonical affinity key: ids sorted alphabetically so (a,b) === (b,a). */
export function affinityKey(a: string, b: string): string {
  const x = normalizeBuddyId(a);
  const y = normalizeBuddyId(b);
  return x < y ? `${x}__${y}` : `${y}__${x}`;
}

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
      initialRelationships: { ...def.initialRelationships },
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

    // Persist only procedural buddy defs (core 4 are code-owned and re-seeded).
    const buddyDefs: Record<string, BuddyCharacter> = {};
    for (const [id, b] of this.buddies.entries()) {
      if (isCoreBuddyId(id)) continue;
      buddyDefs[id] = {
        ...b,
        initialRelationships: { ...b.initialRelationships },
        schedule: Object.fromEntries(
          Object.entries(b.schedule).map(([day, blks]) => [Number(day), blks.map((blk) => ({ ...blk }))])
        ),
      };
    }

    return { relationships: rels, presence: pres, conversations: convs, buddies: buddyDefs, coreMemories: mems, promises: proms, affinities: affs, affinityCaps: caps };
  }

  private static sanitizeMemoryText(text: string, max: number): string {
    return text.trim().replace(/\s+/g, ' ').slice(0, max);
  }

  private static isValidMemoryKind(kind: unknown): kind is CoreMemory['kind'] {
    return kind === 'fact' || kind === 'promise_kept' || kind === 'promise_broken' || kind === 'first_meeting' || kind === 'shared_moment';
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
      this.relationships.set(normalizeBuddyId(rawId), { ...r });
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

    // Backfill empty presence/conversations for any buddy missing them (old saves).
    for (const buddy of this.buddies.values()) {
      if (!this.relationships.has(buddy.id)) this.relationships.set(buddy.id, { ...buddy.initialRelationships });
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
      initialRelationships: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0 },
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
      initialRelationships: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0 },
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
      initialRelationships: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0 },
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
      initialRelationships: { familiarity: 30, trust: 30, comfort: 20, respect: 40, annoyance: 10 },
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
      empathy: { familiarity: 3, trust: 4, comfort: 5, respect: 2, annoyance: -2 },
      remembered_detail: { familiarity: 5, trust: 6, comfort: 6, respect: 4, annoyance: -1 },
      tease_playful: { familiarity: 4, trust: 2, comfort: 3, respect: 2, annoyance: 0 },
      dismissive: { familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: 8 },
      vulnerable_share: { familiarity: 6, trust: 7, comfort: 8, respect: 3, annoyance: -2 },
      work_camaraderie: { familiarity: 4, trust: 3, comfort: 4, respect: 3, annoyance: 0 },
      intellectual_curiosity: { familiarity: 4, trust: 5, comfort: 2, respect: 6, annoyance: 0 },
    };

    const delta = deltas[actionType] || { familiarity: 1 };

    const updated: RelationshipDimensions = {
      familiarity: Math.max(0, Math.min(100, current.familiarity + (delta.familiarity ?? 0))),
      trust: Math.max(0, Math.min(100, current.trust + (delta.trust ?? 0))),
      comfort: Math.max(0, Math.min(100, current.comfort + (delta.comfort ?? 0))),
      respect: Math.max(0, Math.min(100, current.respect + (delta.respect ?? 0))),
      annoyance: Math.max(0, Math.min(100, current.annoyance + (delta.annoyance ?? 0))),
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
    const rel = this.relationships.get(normalizeBuddyId(rawBuddyId));
    if (rel && rel.annoyance >= STRAINED_ANNOYANCE) return 'cold';
    const roll = hashText(`${normalizeBuddyId(rawBuddyId)}:${Math.max(1, Math.floor(day) || 1)}`) % 100;
    if (roll < 35) return 'warm';
    if (roll < 70) return 'steady';
    if (roll < 88) return 'tired';
    return 'off';
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
    const updated: RelationshipDimensions = {
      familiarity: current.familiarity,
      trust: current.trust,
      comfort: current.comfort,
      respect: current.respect,
      annoyance: current.annoyance,
      ...Object.fromEntries(
        Object.entries(partial).map(([k, v]) => [k, typeof v === 'number' && Number.isFinite(v) ? clamp(v) : current[k as keyof RelationshipDimensions]])
      ),
    } as RelationshipDimensions;
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
}
