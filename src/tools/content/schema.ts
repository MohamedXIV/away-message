// src/tools/content/schema.ts
// Content-store schema (TinyBase) — the offline source of truth for buddy
// identity + template pools. The game NEVER reads this at runtime; a pull
// script validates it and generates src/engine/coreBuddies.generated.ts.
//
// Tables (row ids are meaningful — renames are explicit key changes).
// ORDER MATTERS in `buddies`: table order is roster order, and seeded rolls
// depend on roster iteration. Keep the canonical order (or change it loudly).
// - buddies: one row per buddy id (display/handle/myplace/archetype/status/...)
// - buddyTraits: fixed temperament per buddy id (Big5-lite, 0..100)
// - buddyHearts: initial player-relationship dims per buddy id (0..100)
// - buddySchedules: daily rhythm blocks per buddy id (JSON array string)
// - pools: template line pools keyed 'kind:sub:sub' (JSON array string + version)

import { createStore, type TablesSchema } from 'tinybase';

export const CONTENT_SCHEMA = {
  buddies: {
    // Stable story role (ryan/maya/nora/henderson): NEVER renamed. The code
    // anchors (CORE_IDS) resolve through it, so identity edits need no code.
    role: { type: 'string', default: '' },
    displayName: { type: 'string', default: '' },
    handle: { type: 'string', default: '' },
    myplace: { type: 'string', default: '' },
    archetype: { type: 'string', default: 'regular' },
    status: { type: 'string', default: 'acquaintance' },
    metVia: { type: 'string', default: 'core' },
    color: { type: 'string', default: '#800080' },
    persona: { type: 'string', default: '' },
    typingSpeedWpm: { type: 'number', default: 60 },
    // JSON array of superseded ids/handles (save + alias bridge after a rename).
    formerIds: { type: 'string', default: '[]' },
    // Capability tags (JSON array): landlord, diner-staff, canal-regular,
    // rain-lover... The engine queries THESE, never ids. Rename-proof.
    roles: { type: 'string', default: '[]' },
    // Physical vs far-away: remote buddies never meet in person (no cafe,
    // outings, or room presence) — DMs/rooms/mail/MyPlace only, no art.
    reach: { type: 'string', default: 'local' },
    hair: { type: 'string', default: 'brown' },
    eyes: { type: 'string', default: 'brown' },
    // JSON array ≤3 of {lang, level 1..5}. The AI knows exactly these.
    languages: { type: 'string', default: '[{"lang":"en","level":5}]' },
  },
  buddyTraits: {
    shyness: { type: 'number', default: 50 },
    warmth: { type: 'number', default: 50 },
    discipline: { type: 'number', default: 50 },
    spontaneity: { type: 'number', default: 50 },
    loyalty: { type: 'number', default: 50 },
  },
  buddyHearts: {
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
  buddySchedules: {
    blocks: { type: 'string', default: '[]' },
  },
  pools: {
    lines: { type: 'string', default: '[]' },
    version: { type: 'number', default: 1 },
  },
  // Starting NPC↔NPC ties by ROLE pair (row id `${roleA}__${roleB}`, value -100..100).
  affinitySeeds: {
    roleA: { type: 'string', default: '' },
    roleB: { type: 'string', default: '' },
    value: { type: 'number', default: 0 },
  },
  // Pre-game history per buddy id: who they were to the player before day 1.
  backstories: {
    relationship: { type: 'string', default: 'stranger' },
    label: { type: 'string', default: '' },
    lapseDays: { type: 'number', default: 0 },
    knowsAccounts: { type: 'boolean', default: false },
    // JSON array ≤3 of {handle, status: active|dead|changed, note?}
    candidates: { type: 'string', default: '[]' },
    bioSeed: { type: 'string', default: '' },
  },
} as const satisfies TablesSchema;

export type ContentStore = ReturnType<typeof createContentStore>;

/** Empty schema-valid store (callers hydrate from content/store.json or generated code). */
export function createContentStore() {
  return createStore().setTablesSchema(CONTENT_SCHEMA);
}
