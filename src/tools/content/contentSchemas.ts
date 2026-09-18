import { z } from 'zod';

const stringCell = (defaultValue = '') => z.string().default(defaultValue);
const numberCell = (defaultValue: number) => z.number().default(defaultValue);
const booleanCell = (defaultValue: boolean) => z.boolean().default(defaultValue);

/**
 * Single authored-content row-shape catalog.
 *
 * TinyBase derives its table schema from these Zod row schemas. Domain
 * semantics and cross-row constraints intentionally remain in validators.
 * Phase B initially preserves historical string-encoded collection cells;
 * those migrate to native array/object cells in explicit later slices.
 */
export const CONTENT_ROW_SCHEMAS = {
  characters: z.object({
    role: stringCell(),
    displayName: stringCell(),
    archetypeId: stringCell('regular'),
    roles: stringCell('[]'),
    reach: stringCell('local'),
    hair: stringCell('brown'),
    eyes: stringCell('brown'),
    chatColor: stringCell('#6a3fa0'),
    bio: stringCell(),
    typingSpeedWpm: numberCell(60),
    languages: stringCell('[{"lang":"en","level":5}]'),
  }),
  archetypes: z.object({
    label: stringCell(),
    description: stringCell(),
    personaHint: stringCell(),
    vocabulary: stringCell('[]'),
    defaultInterests: stringCell('[]'),
    defaultSong: stringCell(),
    typingSpeedWpm: numberCell(70),
  }),
  temperaments: z.object({
    shyness: numberCell(50),
    warmth: numberCell(50),
    discipline: numberCell(50),
    spontaneity: numberCell(50),
    loyalty: numberCell(50),
  }),
  initialAffinities: z.object({
    familiarity: numberCell(0),
    trust: numberCell(0),
    comfort: numberCell(0),
    respect: numberCell(0),
    annoyance: numberCell(0),
    affection: numberCell(0),
    attraction: numberCell(0),
    suspicion: numberCell(0),
    resentment: numberCell(0),
  }),
  backstories: z.object({
    relationship: stringCell('stranger'),
    label: stringCell(),
    lapseDays: numberCell(0),
    knowsAccounts: booleanCell(false),
    candidates: stringCell('[]'),
    bioSeed: stringCell(),
  }),
  routines: z.object({
    wakeMinute: numberCell(420),
    sleepMinute: numberCell(1380),
    workShift: stringCell('day'),
    preferredHangout: stringCell('cafe'),
  }),
  artProfiles: z.object({
    engine: stringCell('none'),
    modelPath: stringCell(),
    expressions: stringCell('{}'),
    defaultOutfit: stringCell('default'),
  }),
  affinitySeeds: z.object({
    roleA: stringCell(),
    roleB: stringCell(),
    value: numberCell(0),
  }),
  dialoguePools: z.object({
    lines: stringCell('[]'),
    version: numberCell(1),
  }),
  items: z.object({
    name: stringCell(),
    kind: stringCell('misc'),
    portable: booleanCell(true),
    volume: numberCell(1),
    assetId: stringCell(),
    tags: stringCell('[]'),
  }),
  containers: z.object({
    name: stringCell(),
    capacity: numberCell(1),
    allowedItemKinds: stringCell('[]'),
    tags: stringCell('[]'),
  }),
  districts: z.object({
    name: stringCell(),
    mapX: numberCell(0),
    mapY: numberCell(0),
    tags: stringCell('[]'),
  }),
  places: z.object({
    districtId: stringCell(),
    name: stringCell(),
    transitAccess: stringCell('[]'),
    legacyIds: stringCell('[]'),
  }),
  spaces: z.object({
    placeId: stringCell(),
    name: stringCell(),
    tags: stringCell('[]'),
  }),
  views: z.object({
    spaceId: stringCell(),
    name: stringCell(),
    neighbors: stringCell('[]'),
    assetId: stringCell(),
    tags: stringCell('[]'),
  }),
  anchors: z.object({
    viewId: stringCell(),
    name: stringCell(),
    x: numberCell(0.5),
    y: numberCell(0.5),
    tags: stringCell('[]'),
  }),
  interactions: z.object({
    anchorId: stringCell(),
    capability: stringCell(),
    name: stringCell(),
    tags: stringCell('[]'),
  }),
  assets: z.object({
    name: stringCell(),
    kind: stringCell('image'),
    uri: stringCell(),
    normalMapAssetId: stringCell(),
    tags: stringCell('[]'),
  }),
  lightProfiles: z.object({
    name: stringCell(),
    timeOfDay: stringCell(),
    colorTint: stringCell(),
    intensity: numberCell(1),
    tags: stringCell('[]'),
  }),
  audioProfiles: z.object({
    name: stringCell(),
    kind: stringCell('ambience'),
    assetId: stringCell(),
    volume: numberCell(0.6),
    tags: stringCell('[]'),
  }),
  ambientProfiles: z.object({
    name: stringCell(),
    weather: stringCell(),
    timeOfDay: stringCell(),
    density: numberCell(0.5),
    tags: stringCell('[]'),
  }),
  transitStops: z.object({
    districtId: stringCell(),
    name: stringCell(),
    placeId: stringCell(),
    mapX: numberCell(0),
    mapY: numberCell(0),
  }),
  busLines: z.object({
    name: stringCell(),
    stopIds: stringCell('[]'),
    serviceStartMinute: numberCell(360),
    serviceEndMinute: numberCell(1380),
    headwayMinutes: numberCell(20),
    segmentMinutes: stringCell('[]'),
    fare: numberCell(2),
  }),
  eventModifiers: z.object({
    eventId: stringCell(),
    domain: stringCell(),
    kind: stringCell(),
    durationMinutes: numberCell(1440),
    targetIds: stringCell('[]'),
    value: stringCell(),
  }),
} as const;

export type ContentRowSchemas = typeof CONTENT_ROW_SCHEMAS;
