import { z } from 'zod';

const stringCell = (defaultValue = '') => z.string().default(defaultValue);
const numberCell = (defaultValue: number) => z.number().default(defaultValue);
const booleanCell = (defaultValue: boolean) => z.boolean().default(defaultValue);

const spatialPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const spatialPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const spatialBoundsSchema = z.object({
  polygon: z.array(spatialPointSchema),
  minZ: z.number().optional(),
  maxZ: z.number().optional(),
  priority: z.number().optional(),
});

/**
 * Single authored-content row-shape catalog.
 *
 * TinyBase derives its table schema from these Zod row schemas. Domain
 * semantics and cross-row constraints intentionally remain in validators.
 * Collection/object cells use TinyBase-native values; JSON serialization is
 * reserved for the store export boundary rather than embedded inside cells.
 */
export const CONTENT_ROW_SCHEMAS = {
  characters: z.object({
    role: stringCell(),
    displayName: stringCell(),
    archetypeId: stringCell('regular'),
    roles: z.array(z.string()).default([]),
    reach: stringCell('local'),
    hair: stringCell('brown'),
    eyes: stringCell('brown'),
    chatColor: stringCell('#6a3fa0'),
    bio: stringCell(),
    typingSpeedWpm: numberCell(60),
    languages: z.array(z.object({ lang: z.string(), level: z.number() })).default([{ lang: 'en', level: 5 }]),
  }),
  archetypes: z.object({
    label: stringCell(),
    description: stringCell(),
    personaHint: stringCell(),
    vocabulary: z.array(z.string()).default([]),
    defaultInterests: z.array(z.string()).default([]),
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
    candidates: z.array(z.object({ handle: z.string(), status: z.string(), note: z.string().optional() })).default([]),
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
    expressions: z.record(z.string(), z.string()).default({}),
    defaultOutfit: stringCell('default'),
  }),
  affinitySeeds: z.object({
    roleA: stringCell(),
    roleB: stringCell(),
    value: numberCell(0),
  }),
  dialoguePools: z.object({
    lines: z.array(z.string()).default([]),
    version: numberCell(1),
  }),
  items: z.object({
    name: stringCell(),
    kind: stringCell('misc'),
    portable: booleanCell(true),
    volume: numberCell(1),
    assetId: stringCell(),
    tags: z.array(z.string()).default([]),
  }),
  containers: z.object({
    name: stringCell(),
    capacity: numberCell(1),
    allowedItemKinds: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  physicalObjectDefs: z.object({
    name: stringCell(),
    kind: stringCell('fixture'),
    containerId: stringCell(),
    affordances: z.array(z.string()).default([]),
    toolCapabilities: z.array(z.string()).default([]),
    resourceCapabilities: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  placementSlots: z.object({
    name: stringCell(),
    // Root slots belong to one canonical Space. Nested slots leave spaceId empty
    // and derive containment through parentPlacementId.
    spaceId: stringCell(),
    // Optional authored View anchor for interaction/presentation only.
    anchorId: stringCell(),
    parentPlacementId: stringCell(),
    slotKind: stringCell('generic'),
    allowedObjectKinds: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  objectPlacements: z.object({
    objectDefId: stringCell(),
    slotId: stringCell(),
  }),
  districts: z.object({
    name: stringCell(),
    mapX: numberCell(0),
    mapY: numberCell(0),
    tags: z.array(z.string()).default([]),
    spatialBounds: spatialBoundsSchema.optional(),
  }),
  places: z.object({
    districtId: stringCell(),
    name: stringCell(),
    transitAccess: z.array(z.object({ stopId: z.string(), walkMinutes: z.number() })).default([]),
    legacyIds: z.array(z.string()).default([]),
    spatialBounds: spatialBoundsSchema.optional(),
    entryPosition: spatialPositionSchema.optional(),
  }),
  spaces: z.object({
    placeId: stringCell(),
    name: stringCell(),
    tags: z.array(z.string()).default([]),
    spatialBounds: spatialBoundsSchema.optional(),
    entryPosition: spatialPositionSchema.optional(),
  }),
  views: z.object({
    spaceId: stringCell(),
    name: stringCell(),
    neighbors: z.array(z.string()).default([]),
    assetId: stringCell(),
    tags: z.array(z.string()).default([]),
  }),
  anchors: z.object({
    viewId: stringCell(),
    name: stringCell(),
    x: numberCell(0.5),
    y: numberCell(0.5),
    tags: z.array(z.string()).default([]),
  }),
  interactions: z.object({
    anchorId: stringCell(),
    capability: stringCell(),
    name: stringCell(),
    tags: z.array(z.string()).default([]),
  }),
  assets: z.object({
    name: stringCell(),
    kind: stringCell('image'),
    uri: stringCell(),
    normalMapAssetId: stringCell(),
    tags: z.array(z.string()).default([]),
  }),
  lightProfiles: z.object({
    name: stringCell(),
    timeOfDay: stringCell(),
    colorTint: stringCell(),
    intensity: numberCell(1),
    tags: z.array(z.string()).default([]),
  }),
  audioProfiles: z.object({
    name: stringCell(),
    kind: stringCell('ambience'),
    assetId: stringCell(),
    volume: numberCell(0.6),
    tags: z.array(z.string()).default([]),
  }),
  ambientProfiles: z.object({
    name: stringCell(),
    weather: stringCell(),
    timeOfDay: stringCell(),
    density: numberCell(0.5),
    tags: z.array(z.string()).default([]),
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
    stopIds: z.array(z.string()).default([]),
    serviceStartMinute: numberCell(360),
    serviceEndMinute: numberCell(1380),
    headwayMinutes: numberCell(20),
    segmentMinutes: z.array(z.number()).default([]),
    fare: numberCell(2),
  }),
  eventModifiers: z.object({
    eventId: stringCell(),
    domain: stringCell(),
    kind: stringCell(),
    durationMinutes: numberCell(1440),
    targetIds: z.array(z.string()).default([]),
    value: stringCell(),
  }),
} as const;

export type ContentRowSchemas = typeof CONTENT_ROW_SCHEMAS;
