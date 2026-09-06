// src/engine/coreBuddies.ts
// The core-buddy registry: single source of truth for core-4 identity.
// Values come from content (content/store.json → coreBuddies.generated.ts);
// this module adds types, casts, schedules, and ROLE ANCHORS.
// Phase 2 renames point the anchors (and the store) at the new ids —
// call sites below the anchors never change.

import {
  GENERATED_BUDDIES,
  CONTENT_VERSION,
  type GeneratedBuddyDef,
} from './coreBuddies.generated';
import type {
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
  displayName: string;
  handle: string;
  myplace: string;
  archetype: CharacterArchetype;
  status: BuddyLifecycleStatus;
  metVia: BuddyMetVia;
  color: string;
  persona: string;
  typingSpeedWpm: number;
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
  return {
    id: def.id,
    displayName: def.displayName,
    handle: def.handle,
    myplace: def.myplace,
    archetype: asArchetype(def.archetype, def.id),
    status: def.status as BuddyLifecycleStatus,
    metVia: def.metVia as BuddyMetVia,
    color: def.color,
    persona: def.persona,
    typingSpeedWpm: def.typingSpeedWpm,
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

export function isCoreBuddyId(id: string): boolean {
  return id === CORE_IDS.RYAN || id === CORE_IDS.MAYA || id === CORE_IDS.NORA || id === CORE_IDS.HENDERSON;
}

// Role anchors: the four story roles, by CURRENT id. Phase 2 renames edit
// these four lines (+ the content store) and every call site below follows.
function anchor(id: string): string {
  return CORE_BY_ID[id]?.id ?? id;
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
  };
}
