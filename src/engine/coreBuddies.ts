// src/engine/coreBuddies.ts
// The core-buddy registry: single source of truth for core-4 identity.
// Values come from content (content/store.json → coreBuddies.generated.ts);
// this module adds types, casts, schedules, and ROLE ANCHORS.
// Phase 2 renames point the anchors (and the store) at the new ids —
// call sites below the anchors never change.

import {
  GENERATED_BUDDIES,
  GENERATED_AFFINITY_SEEDS,
  CONTENT_VERSION,
  type GeneratedBuddyDef,
} from './coreBuddies.generated';
import type {
  BuddyBackstory,
  BuddyCharacter,
  BuddyLifecycleStatus,
  BuddyMetVia,
  BuddyPresenceStatus,
  CharacterArchetype,
  CharacterTraits,
  RelationshipDimensions,
  ScheduleBlock,
} from './types';

export { CONTENT_VERSION };

export interface CoreBuddy {
  id: string;
  /** Stable story role (never renamed): anchors resolve through it. */
  role: string;
  displayName: string;
  handle: string;
  myplace: string;
  archetype: CharacterArchetype;
  status: BuddyLifecycleStatus;
  metVia: BuddyMetVia;
  color: string;
  persona: string;
  typingSpeedWpm: number;
  /** Superseded ids/handles (save + alias bridge after a rename). */
  formerIds: string[];
  /** Capability tags (landlord, diner-staff, rain-lover...). Engine queries these. */
  roles: string[];
  reach: 'local' | 'remote';
  appearance: { hair: string; eyes: string };
  languages: Array<{ lang: string; level: number }>;
  backstory: BuddyBackstory | null;
  traits: CharacterTraits;
  hearts: RelationshipDimensions;
  blocks: Array<{ start: number; end: number; status: BuddyPresenceStatus; msg: string }>;
}

function asArchetype(value: string, id: string): CharacterArchetype {
  if (value === 'coworker' || value === 'nightowl' || value === 'student' || value === 'trader' || value === 'artist' || value === 'regular') {
    return value;
  }
  throw new Error(`coreBuddies: buddy '${id}' has an unknown archetype '${value}'.`);
}

function normalize(def: GeneratedBuddyDef): CoreBuddy {
  // Defensive: the generated file may lag the schema mid-development (the
  // pull script itself imports through characterTemplates → here).
  return {
    id: def.id,
    role: typeof def.role === 'string' && def.role ? def.role : def.id,
    displayName: def.displayName,
    handle: def.handle,
    myplace: def.myplace,
    archetype: asArchetype(def.archetype, def.id),
    status: def.status as BuddyLifecycleStatus,
    metVia: def.metVia as BuddyMetVia,
    color: def.color,
    persona: def.persona,
    typingSpeedWpm: def.typingSpeedWpm,
    formerIds: [...(def.formerIds ?? [])],
    roles: [...(def.roles ?? [])],
    reach: def.reach === 'remote' ? 'remote' : 'local',
    appearance: { hair: def.hair?.trim() || 'brown', eyes: def.eyes?.trim() || 'brown' },
    languages: (def.languages ?? []).map((l) => ({ lang: l.lang, level: Math.max(1, Math.min(5, Math.round(l.level))) })),
    backstory: def.backstory
      ? {
          relationship: def.backstory.relationship as BuddyBackstory['relationship'],
          label: def.backstory.label,
          lapseDays: def.backstory.lapseDays,
          knowsAccounts: def.backstory.knowsAccounts,
          candidates: def.backstory.candidates.map((c) => ({
            handle: c.handle,
            status: c.status as BuddyBackstory['candidates'][number]['status'],
            ...(c.note !== undefined ? { note: c.note } : {}),
          })),
          bioSeed: def.backstory.bioSeed,
        }
      : null,
    traits: { ...def.traits },
    hearts: { ...def.hearts },
    blocks: def.blocks.map((b) => ({ ...b })),
  };
}

export const CORE_BUDDIES: CoreBuddy[] = GENERATED_BUDDIES.map(normalize);

export const CORE_BY_ID: Record<string, CoreBuddy> = Object.fromEntries(
  CORE_BUDDIES.map((b) => [b.id, b])
);

/** All core ids (code-owned, protected — see SocialEngine core guards). */
export function coreBuddyIds(): string[] {
  return CORE_BUDDIES.map((b) => b.id);
}

/** Buddies carrying a capability tag, in roster order (rename-proof queries). */
export function buddiesWithRole(role: string): CoreBuddy[] {
  return CORE_BUDDIES.filter((b) => b.roles.includes(role));
}

/** First roster buddy carrying a capability tag (undefined when nobody does). */
export function buddyWithRole(role: string): CoreBuddy | undefined {
  return buddiesWithRole(role)[0];
}

/**
 * Starting NPC↔NPC ties, resolved from role pairs to sorted id keys.
 * Unresolvable pairs (role gone from data) are skipped — data edits must
 * keep their seeds alive (validated at pull time).
 */
export function resolveAffinitySeeds(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const seed of GENERATED_AFFINITY_SEEDS) {
    const a = buddyWithRole(seed.roleA);
    const b = buddyWithRole(seed.roleB);
    if (!a || !b || a.id === b.id) continue;
    const key = a.id < b.id ? `${a.id}__${b.id}` : `${b.id}__${a.id}`;
    out[key] = Math.max(-100, Math.min(100, Math.round(seed.value)));
  }
  return out;
}

/** Registry membership: defs that re-seed from content (never persisted). Not sacredness. */
export function isRegistryBuddy(id: string): boolean {
  return id in CORE_BY_ID;
}

// Role anchors: resolved through the stable `role` column, so renaming an
// id/displayName/handle in the content store needs ZERO code changes —
// anchors, seeds, aliases and rooms all follow automatically.
function anchor(role: string): string {
  return CORE_BUDDIES.find((b) => b.role === role)?.id ?? role;
}

export const CORE_IDS = {
  RYAN: anchor('ryan'),
  MAYA: anchor('maya'),
  NORA: anchor('nora'),
  HENDERSON: anchor('henderson'),
} as const;

/** 14-day schedule from the registry blocks (core rhythm, unchanged shape). */
export function coreSchedule(id: string): Record<number, ScheduleBlock[]> {
  const buddy = CORE_BY_ID[id];
  const blocks = (buddy?.blocks ?? []).map((b) => ({
    startMinuteOfDay: b.start,
    endMinuteOfDay: b.end,
    status: b.status as ScheduleBlock['status'],
    awayMessage: b.msg,
  }));
  const sched: Record<number, ScheduleBlock[]> = {};
  for (let day = 1; day <= 14; day++) {
    sched[day] = blocks.map((b) => ({ ...b }));
  }
  return sched;
}

/** Full BuddyCharacter def for a registry buddy (core-owned: never persisted). */
export function coreBuddyDef(id: string): BuddyCharacter {
  const buddy = CORE_BY_ID[id];
  if (!buddy) throw new Error(`coreBuddies: unknown core buddy '${id}'.`);
  return {
    id: buddy.id,
    displayName: buddy.displayName,
    handle: buddy.handle,
    schedule: coreSchedule(buddy.id),
    initialRelationships: { ...buddy.hearts },
    traits: { ...buddy.traits },
    typingSpeedWpm: buddy.typingSpeedWpm,
    archetype: buddy.archetype,
    status: buddy.status,
    metVia: buddy.metVia,
    isProcedural: false,
    createdDay: 1,
    reach: buddy.reach,
    appearance: { ...buddy.appearance },
    languages: buddy.languages.map((l) => ({ ...l })),
    roles: [...buddy.roles],
    backstory: buddy.backstory ? { ...buddy.backstory, candidates: buddy.backstory.candidates.map((c) => ({ ...c })) } : undefined,
  };
}
