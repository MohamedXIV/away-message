// src/tools/content/schema.ts
// Content-store schema (TinyBase) — the offline source of truth for character
// identity, archetypes, routines, art profiles, dialogue pools, and authored
// physical-world geography. The game NEVER reads this at runtime; pull/codegen
// validates it and emits typed runtime registries.

import { createStore, type TablesSchema } from 'tinybase';

export const CONTENT_SCHEMA = {
  characters: {
    role: { type: 'string', default: '' },
    displayName: { type: 'string', default: '' },
    archetypeId: { type: 'string', default: 'regular' },
    roles: { type: 'string', default: '[]' },
    reach: { type: 'string', default: 'local' },
    hair: { type: 'string', default: 'brown' },
    eyes: { type: 'string', default: 'brown' },
    chatColor: { type: 'string', default: '#6a3fa0' },
    bio: { type: 'string', default: '' },
    typingSpeedWpm: { type: 'number', default: 60 },
    languages: { type: 'string', default: '[{"lang":"en","level":5}]' },
  },
  archetypes: {
    label: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    personaHint: { type: 'string', default: '' },
    vocabulary: { type: 'string', default: '[]' },
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
    candidates: { type: 'string', default: '[]' },
    bioSeed: { type: 'string', default: '' },
  },
  routines: {
    wakeMinute: { type: 'number', default: 420 },
    sleepMinute: { type: 'number', default: 1380 },
    workShift: { type: 'string', default: 'day' },
    preferredHangout: { type: 'string', default: 'cafe' },
  },
  artProfiles: {
    engine: { type: 'string', default: 'none' },
    modelPath: { type: 'string', default: '' },
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
  districtDefinitions: {
    displayName: { type: 'string', default: '' },
    mapX: { type: 'number', default: 0 },
    mapY: { type: 'number', default: 0 },
  },
  placeDefinitions: {
    displayName: { type: 'string', default: '' },
    districtId: { type: 'string', default: '' },
    accessStops: { type: 'string', default: '[]' },
  },
  transitStopDefinitions: {
    displayName: { type: 'string', default: '' },
    districtId: { type: 'string', default: '' },
    placeId: { type: 'string', default: '' },
  },
  busLineDefinitions: {
    displayName: { type: 'string', default: '' },
    stopIds: { type: 'string', default: '[]' },
    segmentMinutes: { type: 'string', default: '[]' },
    serviceStartMinute: { type: 'number', default: 360 },
    serviceEndMinute: { type: 'number', default: 1380 },
    headwayMinutes: { type: 'number', default: 20 },
    fareCents: { type: 'number', default: 0 },
  },
} as const satisfies TablesSchema;

export type ContentStore = ReturnType<typeof createContentStore>;

/** Empty schema-valid store (callers hydrate from content/store.json or generated code). */
export function createContentStore() {
  return createStore().setTablesSchema(CONTENT_SCHEMA);
}
