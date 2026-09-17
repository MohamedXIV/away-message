// src/tools/content/schema.ts
// Content-store schema (TinyBase) — the offline source of truth for character
// identity, archetypes, routines, art profiles, dialogue pools, and authored world content.
// The game NEVER reads this at runtime; a pull script validates it and generates runtime registries.

import { createStore, type TablesSchema } from 'tinybase';

export const CONTENT_SCHEMA = {
  characters: { role: { type: 'string', default: '' }, displayName: { type: 'string', default: '' }, archetypeId: { type: 'string', default: 'regular' }, roles: { type: 'string', default: '[]' }, reach: { type: 'string', default: 'local' }, hair: { type: 'string', default: 'brown' }, eyes: { type: 'string', default: 'brown' }, chatColor: { type: 'string', default: '#6a3fa0' }, bio: { type: 'string', default: '' }, typingSpeedWpm: { type: 'number', default: 60 }, languages: { type: 'string', default: '[{"lang":"en","level":5}]' } },
  archetypes: { label: { type: 'string', default: '' }, description: { type: 'string', default: '' }, personaHint: { type: 'string', default: '' }, vocabulary: { type: 'string', default: '[]' }, defaultInterests: { type: 'string', default: '[]' }, defaultSong: { type: 'string', default: '' }, typingSpeedWpm: { type: 'number', default: 70 } },
  temperaments: { shyness: { type: 'number', default: 50 }, warmth: { type: 'number', default: 50 }, discipline: { type: 'number', default: 50 }, spontaneity: { type: 'number', default: 50 }, loyalty: { type: 'number', default: 50 } },
  initialAffinities: { familiarity: { type: 'number', default: 0 }, trust: { type: 'number', default: 0 }, comfort: { type: 'number', default: 0 }, respect: { type: 'number', default: 0 }, annoyance: { type: 'number', default: 0 }, affection: { type: 'number', default: 0 }, attraction: { type: 'number', default: 0 }, suspicion: { type: 'number', default: 0 }, resentment: { type: 'number', default: 0 } },
  backstories: { relationship: { type: 'string', default: 'stranger' }, label: { type: 'string', default: '' }, lapseDays: { type: 'number', default: 0 }, knowsAccounts: { type: 'boolean', default: false }, candidates: { type: 'string', default: '[]' }, bioSeed: { type: 'string', default: '' } },
  routines: { wakeMinute: { type: 'number', default: 420 }, sleepMinute: { type: 'number', default: 1380 }, workShift: { type: 'string', default: 'day' }, preferredHangout: { type: 'string', default: 'cafe' } },
  artProfiles: { engine: { type: 'string', default: 'none' }, modelPath: { type: 'string', default: '' }, expressions: { type: 'string', default: '{}' }, defaultOutfit: { type: 'string', default: 'default' } },
  affinitySeeds: { roleA: { type: 'string', default: '' }, roleB: { type: 'string', default: '' }, value: { type: 'number', default: 0 } },
  dialoguePools: { lines: { type: 'string', default: '[]' }, version: { type: 'number', default: 1 } },
  items: { name: { type: 'string', default: '' }, kind: { type: 'string', default: 'misc' }, portable: { type: 'boolean', default: true }, volume: { type: 'number', default: 1 }, assetId: { type: 'string', default: '' }, tags: { type: 'string', default: '[]' } },
  containers: { name: { type: 'string', default: '' }, capacity: { type: 'number', default: 1 }, allowedItemKinds: { type: 'string', default: '[]' }, tags: { type: 'string', default: '[]' } },
  districts: { name: { type: 'string', default: '' }, mapX: { type: 'number', default: 0 }, mapY: { type: 'number', default: 0 }, tags: { type: 'string', default: '[]' } },
  places: { districtId: { type: 'string', default: '' }, name: { type: 'string', default: '' }, transitAccess: { type: 'string', default: '[]' }, legacyIds: { type: 'string', default: '[]' }, servicePolicies: { type: 'string', default: '{}' } },
  spaces: { placeId: { type: 'string', default: '' }, name: { type: 'string', default: '' }, tags: { type: 'string', default: '[]' } },
  views: { spaceId: { type: 'string', default: '' }, name: { type: 'string', default: '' }, neighbors: { type: 'string', default: '[]' }, assetId: { type: 'string', default: '' }, tags: { type: 'string', default: '[]' } },
  anchors: { viewId: { type: 'string', default: '' }, name: { type: 'string', default: '' }, x: { type: 'number', default: 0.5 }, y: { type: 'number', default: 0.5 }, tags: { type: 'string', default: '[]' }, acceptsObjectTags: { type: 'string', default: '[]' } },
  interactions: { anchorId: { type: 'string', default: '' }, capability: { type: 'string', default: '' }, name: { type: 'string', default: '' }, tags: { type: 'string', default: '[]' } },
  worldObjects: { name: { type: 'string', default: '' }, placementTags: { type: 'string', default: '[]' }, affordances: { type: 'string', default: '[]' }, toolCapabilities: { type: 'string', default: '[]' }, resources: { type: 'string', default: '[]' }, slots: { type: 'string', default: '[]' }, containerDefinitionId: { type: 'string', default: '' }, tags: { type: 'string', default: '[]' } },
  worldObjectPlacements: { objectDefinitionId: { type: 'string', default: '' }, anchorId: { type: 'string', default: '' }, parentPlacementId: { type: 'string', default: '' }, slotId: { type: 'string', default: '' }, owner: { type: 'string', default: 'property' } },
  assets: { name: { type: 'string', default: '' }, kind: { type: 'string', default: 'image' }, uri: { type: 'string', default: '' }, normalMapAssetId: { type: 'string', default: '' }, tags: { type: 'string', default: '[]' } },
  lightProfiles: { name: { type: 'string', default: '' }, timeOfDay: { type: 'string', default: '' }, colorTint: { type: 'string', default: '' }, intensity: { type: 'number', default: 1 }, tags: { type: 'string', default: '[]' } },
  audioProfiles: { name: { type: 'string', default: '' }, kind: { type: 'string', default: 'ambience' }, assetId: { type: 'string', default: '' }, volume: { type: 'number', default: 0.6 }, tags: { type: 'string', default: '[]' } },
  ambientProfiles: { name: { type: 'string', default: '' }, weather: { type: 'string', default: '' }, timeOfDay: { type: 'string', default: '' }, density: { type: 'number', default: 0.5 }, tags: { type: 'string', default: '[]' } },
  transitStops: { districtId: { type: 'string', default: '' }, name: { type: 'string', default: '' }, placeId: { type: 'string', default: '' }, mapX: { type: 'number', default: 0 }, mapY: { type: 'number', default: 0 } },
  busLines: { name: { type: 'string', default: '' }, stopIds: { type: 'string', default: '[]' }, serviceStartMinute: { type: 'number', default: 360 }, serviceEndMinute: { type: 'number', default: 1380 }, headwayMinutes: { type: 'number', default: 20 }, segmentMinutes: { type: 'string', default: '[]' }, fare: { type: 'number', default: 2 } },
  eventModifiers: { eventId: { type: 'string', default: '' }, domain: { type: 'string', default: '' }, kind: { type: 'string', default: '' }, durationMinutes: { type: 'number', default: 1440 }, targetIds: { type: 'string', default: '[]' }, value: { type: 'string', default: '' } },
} as const satisfies TablesSchema;

export type ContentStore = ReturnType<typeof createContentStore>;
export function createContentStore() { return createStore().setTablesSchema(CONTENT_SCHEMA); }
