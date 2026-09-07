// src/engine/coreBuddies.ts
// The core-buddy registry: single source of truth for core-4 identity.
// Values come from content (content/store.json → coreBuddies.generated.ts);
// this module adds types, casts, schedules, and ROLE ANCHORS.
// Phase 2 renames point the anchors (and the store) at the new ids —
// call sites below the anchors never change.

import {
  GENERATED_CHARACTERS,
  GENERATED_ARCHETYPES,
  GENERATED_AFFINITY_SEEDS,
  GENERATED_DIALOGUE_POOLS,
  CONTENT_VERSION,
  type GeneratedCharacterDef,
} from './coreBuddies.generated';
import type {
  BuddyBackstory,
  BuddyCharacter,
  CharacterArchetype,
  CharacterTraits,
  RelationshipDimensions,
  ScheduleBlock,
  CharacterRoutine,
  CharacterArtProfile,
  HairColor,
  EyeColor,
} from './types';

export { CONTENT_VERSION, GENERATED_ARCHETYPES, GENERATED_DIALOGUE_POOLS };

export interface CoreBuddy {
  id: string;
  /** Stable story role (never renamed): anchors resolve through it. */
  role: string;
  displayName: string;
  archetypeId: string;
  archetype: CharacterArchetype;
  roles: string[];
  reach: 'local' | 'remote';
  hair: HairColor | string;
  eyes: EyeColor | string;
  chatColor: string;
  color: string;
  bio: string;
  persona: string;
  typingSpeedWpm: number;
  languages: Array<{ lang: string; level: number }>;
  backstory: BuddyBackstory | null;
  traits: CharacterTraits;
  hearts: RelationshipDimensions;
  routine: CharacterRoutine;
  art: CharacterArtProfile;
  handle: string;
  myplace: string;
  status: 'friend' | 'acquaintance';
  formerIds: string[];
}

const CORE_CANONICAL_ACCOUNTS: Record<string, { handle: string; myplace: string; status: 'friend' | 'acquaintance' }> = {
  ryan: { handle: 'ryan_foodcart', myplace: 'tacocart_ryan', status: 'friend' },
  maya: { handle: 'starlight_maya', myplace: 'maya_x', status: 'acquaintance' },
  nora: { handle: 'NightOwl87', myplace: 'nightowl87', status: 'acquaintance' },
  henderson: { handle: 'motel_office', myplace: '', status: 'acquaintance' },
};

function normalize(def: GeneratedCharacterDef): CoreBuddy {
  const accounts = CORE_CANONICAL_ACCOUNTS[def.id] ?? {
    handle: def.backstory?.candidates?.[0]?.handle || def.id,
    myplace: def.id,
    status: 'acquaintance' as const,
  };
  return {
    id: def.id,
    role: typeof def.role === 'string' && def.role ? def.role : def.id,
    displayName: def.displayName,
    archetypeId: def.archetypeId,
    archetype: def.archetypeId as CharacterArchetype,
    roles: [...(def.roles ?? [])],
    reach: def.reach === 'remote' ? 'remote' : 'local',
    hair: def.hair?.trim() || 'brown',
    eyes: def.eyes?.trim() || 'brown',
    chatColor: def.chatColor || '#6a3fa0',
    color: def.chatColor || '#6a3fa0',
    bio: def.bio || '',
    persona: def.bio || '',
    typingSpeedWpm: def.typingSpeedWpm,
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
    traits: { ...def.temperament },
    hearts: { ...def.initialAffinity },
    routine: {
      wakeMinute: def.routine?.wakeMinute ?? 420,
      sleepMinute: def.routine?.sleepMinute ?? 1380,
      workShift: (def.routine?.workShift as CharacterRoutine['workShift']) ?? 'day',
      preferredHangout: def.routine?.preferredHangout ?? 'cafe',
    },
    art: {
      engine: (def.art?.engine as CharacterArtProfile['engine']) ?? 'none',
      modelPath: def.art?.modelPath ?? '',
      expressions: { ...(def.art?.expressions ?? {}) },
      defaultOutfit: def.art?.defaultOutfit ?? 'default',
    },
    handle: accounts.handle,
    myplace: accounts.myplace,
    status: accounts.status,
    formerIds: [],
  };
}

export const CORE_BUDDIES: CoreBuddy[] = GENERATED_CHARACTERS.map(normalize);

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

const CORE_CANONICAL_BLOCKS: Record<string, Array<{ start: number; end: number; status: ScheduleBlock['status']; msg: string }>> = {
  ryan: [
    { start: 0, end: 420, status: 'offline', msg: 'asleep' },
    { start: 420, end: 540, status: 'offline', msg: 'commute' },
    { start: 540, end: 960, status: 'offline', msg: 'work @ cart' },
    { start: 960, end: 1080, status: 'away', msg: 'afk grabbin tacos' },
    { start: 1080, end: 1320, status: 'online', msg: 'gaming / chilling' },
    { start: 1320, end: 1440, status: 'offline', msg: 'sleep is for the weak' },
  ],
  maya: [
    { start: 0, end: 480, status: 'offline', msg: 'sleeping' },
    { start: 480, end: 540, status: 'offline', msg: 'morning tea' },
    { start: 540, end: 1050, status: 'away', msg: 'at the desk... dont look at me' },
    { start: 1050, end: 1260, status: 'online', msg: 'home! making coffee :)' },
    { start: 1260, end: 1440, status: 'online', msg: 'listening to the rain ~ myplace/mayablue' },
  ],
  nora: [
    { start: 0, end: 300, status: 'online', msg: 'the night is quiet' },
    { start: 300, end: 360, status: 'away', msg: 'watching dawn' },
    { start: 360, end: 1140, status: 'offline', msg: 'offline' },
    { start: 1140, end: 1320, status: 'away', msg: 'indexing old logs' },
    { start: 1320, end: 1440, status: 'online', msg: 'nightboard / logs' },
  ],
  henderson: [
    { start: 0, end: 480, status: 'offline', msg: 'office closed' },
    { start: 480, end: 1200, status: 'online', msg: 'motel front desk open' },
    { start: 1200, end: 1440, status: 'offline', msg: 'office closed' },
  ],
};

/** 14-day schedule from canonical blocks or character's routine. */
export function coreSchedule(id: string): Record<number, ScheduleBlock[]> {
  const blocks = CORE_CANONICAL_BLOCKS[id];
  let dailyBlocks: ScheduleBlock[] = [];
  if (blocks) {
    dailyBlocks = blocks.map((b) => ({
      startMinuteOfDay: b.start,
      endMinuteOfDay: b.end,
      status: b.status,
      awayMessage: b.msg,
    }));
  } else {
    const buddy = CORE_BY_ID[id];
    const wake = buddy?.routine?.wakeMinute ?? 420;
    const sleep = buddy?.routine?.sleepMinute ?? 1380;
    const shift = buddy?.routine?.workShift ?? 'day';

    if (sleep > wake) {
      dailyBlocks.push({ startMinuteOfDay: 0, endMinuteOfDay: wake, status: 'offline', awayMessage: 'asleep' });
      if (shift === 'day') {
        dailyBlocks.push({ startMinuteOfDay: wake, endMinuteOfDay: 540, status: 'online', awayMessage: 'morning check-in' });
        dailyBlocks.push({ startMinuteOfDay: 540, endMinuteOfDay: 1020, status: 'away', awayMessage: 'busy / out' });
        dailyBlocks.push({ startMinuteOfDay: 1020, endMinuteOfDay: sleep, status: 'online', awayMessage: 'online' });
      } else {
        dailyBlocks.push({ startMinuteOfDay: wake, endMinuteOfDay: sleep, status: 'online', awayMessage: 'around' });
      }
      dailyBlocks.push({ startMinuteOfDay: sleep, endMinuteOfDay: 1440, status: 'offline', awayMessage: 'asleep' });
    } else {
      dailyBlocks.push({ startMinuteOfDay: 0, endMinuteOfDay: sleep, status: 'online', awayMessage: 'night shift' });
      dailyBlocks.push({ startMinuteOfDay: sleep, endMinuteOfDay: wake, status: 'offline', awayMessage: 'sleeping through day' });
      dailyBlocks.push({ startMinuteOfDay: wake, endMinuteOfDay: 1440, status: 'online', awayMessage: 'awake / logs' });
    }
  }

  const sched: Record<number, ScheduleBlock[]> = {};
  for (let day = 1; day <= 14; day++) {
    sched[day] = dailyBlocks.map((b) => ({ ...b }));
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
    archetype: buddy.archetypeId as CharacterArchetype,
    status: buddy.status,
    metVia: 'core',
    isProcedural: false,
    createdDay: 1,
    reach: buddy.reach,
    appearance: { hair: buddy.hair, eyes: buddy.eyes },
    languages: buddy.languages.map((l) => ({ ...l })),
    roles: [...buddy.roles],
    backstory: buddy.backstory ? { ...buddy.backstory, candidates: buddy.backstory.candidates.map((c) => ({ ...c })) } : undefined,
    chatColor: buddy.chatColor,
    bio: buddy.bio,
    routine: { ...buddy.routine },
    art: { ...buddy.art },
  };
}
