// src/tools/content/schema.ts
// Content-store schema (TinyBase) — the offline source of truth for character
// identity, archetypes, routines, art profiles, and dialogue pools. The game
// NEVER reads this at runtime; a pull script validates it and generates
// src/engine/coreBuddies.generated.ts.
//
// Tables:
// - characters: core identity, capability tags, appearance enums, languages
// - archetypes: first-class behavior templates, vocabulary, default traits
// - temperaments: quantitative Big-5-lite traits (0..100)
// - initialAffinities: starting player-relationship dimensions (0..100)
// - backstories: pre-game shared history & candidate handles
// - routines: daily schedule bounds (wake, sleep, shift)
// - artProfiles: engine-agnostic 2D art specification (Live2D / mesh / icon)
// - affinitySeeds: NPC↔NPC role affinity seeds (-100..100)
// - dialoguePools: template lines for offline / reactive chats

import { createStore, type TablesSchema } from 'tinybase';

export const CONTENT_SCHEMA = {
  characters: {
    // Stable story role (ryan/maya/nora/henderson): NEVER renamed. The code
    // anchors (CORE_IDS) resolve through it, so identity edits need no code.
    role: { type: 'string', default: '' },
    displayName: { type: 'string', default: '' },
    archetypeId: { type: 'string', default: 'regular' },
    // Capability tags (JSON array string): landlord, diner-staff, canal-regular,
    // rain-lover, cart-owner... Engine queries THESE, never ids.
    roles: { type: 'string', default: '[]' },
    // Reach: 'local' (village resident, physically present, never leaves town permanently)
    // vs 'remote' (online-only contact, can depart if mistreated).
    reach: { type: 'string', default: 'local' },
    hair: { type: 'string', default: 'brown' },
    eyes: { type: 'string', default: 'brown' },
    chatColor: { type: 'string', default: '#6a3fa0' },
    bio: { type: 'string', default: '' },
    typingSpeedWpm: { type: 'number', default: 60 },
    // JSON array ≤3 of {lang, level 1..5}.
    languages: { type: 'string', default: '[{"lang":"en","level":5}]' },
  },
  archetypes: {
    label: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    personaHint: { type: 'string', default: '' },
    // JSON array of strings: e.g. ["yo", "dude", "tacos"]
    vocabulary: { type: 'string', default: '[]' },
    // JSON array of strings: e.g. ["Music", "Coffee"]
    defaultInterests: { type: 'string', default: '[]' },
    defaultSong: { type: 'string', default: '' },
    typingSpeedWpm: { type: 'number', default: 70 },
  },
  temperaments: {
    shyness: { type: 'number', default: 50 },
    warmth: { type: 'number', default: 50 },
    discipline: { type: 'number', default: 50 },
    spontaneity: { type: 'number', default: 50 },
    loyalty: { type: 'number', default: 50 },
  },
  initialAffinities: {
    familiarity: { type: 'number', default: 0 },
    trust: { type: 'number', default: 0 },
    comfort: { type: 'number', default: 0 },
    respect: { type: 'number', default: 0 },
    annoyance: { type: 'number', default: 0 },
    affection: { type: 'number', default: 0 },
    attraction: { type: 'number', default: 0 },
    suspicion: { type: 'number', default: 0 },
    resentment: { type: 'number', default: 0 },
  },
  backstories: {
    relationship: { type: 'string', default: 'stranger' },
    label: { type: 'string', default: '' },
    lapseDays: { type: 'number', default: 0 },
    knowsAccounts: { type: 'boolean', default: false },
    // JSON array ≤3 of {handle, status: active|dead|changed, note?}
    candidates: { type: 'string', default: '[]' },
    bioSeed: { type: 'string', default: '' },
  },
  routines: {
    wakeMinute: { type: 'number', default: 420 }, // 07:00
    sleepMinute: { type: 'number', default: 1380 }, // 23:00
    workShift: { type: 'string', default: 'day' }, // morning | day | evening | night | flexible
    preferredHangout: { type: 'string', default: 'cafe' },
  },
  artProfiles: {
    // Engine: 'live2d' | 'mesh' | 'none'
    engine: { type: 'string', default: 'none' },
    modelPath: { type: 'string', default: '' },
    // JSON map of expression name -> model motion/expression id
    expressions: { type: 'string', default: '{}' },
    defaultOutfit: { type: 'string', default: 'default' },
  },
  affinitySeeds: {
    roleA: { type: 'string', default: '' },
    roleB: { type: 'string', default: '' },
    value: { type: 'number', default: 0 },
  },
  dialoguePools: {
    lines: { type: 'string', default: '[]' },
    version: { type: 'number', default: 1 },
  },
} as const satisfies TablesSchema;

export type ContentStore = ReturnType<typeof createContentStore>;

/** Empty schema-valid store (callers hydrate from content/store.json or generated code). */
export function createContentStore() {
  return createStore().setTablesSchema(CONTENT_SCHEMA);
}
