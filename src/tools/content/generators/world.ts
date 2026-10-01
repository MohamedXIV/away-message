// Deterministic world-registry emitter.
// Phase A (#99): behavior-preserving extraction from codegen.ts.

import {
  WORLD_MODIFIER_DOMAINS,
  parseModifierValue,
  type WorldModifierDomain,
} from '../../../engine/WorldModifiers';
import type { ContentTables } from '../shared';
import { contentHash, tsString } from '../shared';
import { generatePhysicalWorldSource } from './physical';
import { generateVenueWorldSource } from './venue';
import { generateShopWorldSource } from './shop';

function spatialBoundsLiteral(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record['polygon'])) return null;

  const polygon = record['polygon']
    .filter((point): point is Record<string, unknown> => Boolean(point && typeof point === 'object' && !Array.isArray(point)))
    .map((point) => `{ x: ${Number(point['x'])}, y: ${Number(point['y'])} }`);

  const fields = [`polygon: [${polygon.join(', ')}]`];
  if (typeof record['minZ'] === 'number') fields.push(`minZ: ${record['minZ']}`);
  if (typeof record['maxZ'] === 'number') fields.push(`maxZ: ${record['maxZ']}`);
  if (typeof record['priority'] === 'number') fields.push(`priority: ${record['priority']}`);
  return `{ ${fields.join(', ')} }`;
}

function spatialPositionLiteral(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record['x'] !== 'number' ||
    typeof record['y'] !== 'number' ||
    typeof record['z'] !== 'number'
  ) {
    return null;
  }
  return `{ x: ${record['x']}, y: ${record['y']}, z: ${record['z']} }`;
}

/**
 * Emit the world registry TypeScript source (#51 slice 1).
 * Goes to its own generated file (src/engine/worldContent.generated.ts) so
 * the character registry stays stable; one pull/check contract covers both.
 * Sorted row order keeps output deterministic regardless of store.json order.
 */
export function generateWorldRegistrySource(tables: ContentTables): string {
  const version = contentHash(tables);
  const districts = tables['districts'] ?? {};
  const places = tables['places'] ?? {};
  const transitStops = tables['transitStops'] ?? {};
  const busLines = tables['busLines'] ?? {};
  const eventModifiers = tables['eventModifiers'] ?? {};
  const items = tables['items'] ?? {};
  const containers = tables['containers'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const interactions = tables['interactions'] ?? {};
  const assets = tables['assets'] ?? {};
  const lightProfiles = tables['lightProfiles'] ?? {};
  const audioProfiles = tables['audioProfiles'] ?? {};
  const ambientProfiles = tables['ambientProfiles'] ?? {};

  const lines: string[] = [];
  lines.push('// GENERATED — do not edit by hand.');
  lines.push(`// Source: content/store.json (content v${version}). Regenerate: npm run content:pull.`);
  lines.push(`export const WORLD_CONTENT_VERSION = '${version}';`);
  lines.push('');
  lines.push('export interface GeneratedSpatialPoint {');
  lines.push('  x: number;');
  lines.push('  y: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedSpatialPosition {');
  lines.push('  x: number;');
  lines.push('  y: number;');
  lines.push('  z: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedSpatialBounds {');
  lines.push('  polygon: GeneratedSpatialPoint[];');
  lines.push('  minZ?: number;');
  lines.push('  maxZ?: number;');
  lines.push('  priority?: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedDistrictDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  mapX: number;');
  lines.push('  mapY: number;');
  lines.push('  tags: string[];');
  lines.push('  spatialBounds?: GeneratedSpatialBounds;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedPlaceTransitAccess {');
  lines.push('  stopId: string;');
  lines.push('  walkMinutes: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedPlaceDef {');
  lines.push('  id: string;');
  lines.push('  districtId: string;');
  lines.push('  name: string;');
  lines.push('  transitAccess: GeneratedPlaceTransitAccess[];');
  lines.push('  legacyIds?: string[];');
  lines.push('  spatialBounds?: GeneratedSpatialBounds;');
  lines.push('  entryPosition?: GeneratedSpatialPosition;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedTransitStopDef {');
  lines.push('  id: string;');
  lines.push('  districtId: string;');
  lines.push('  name: string;');
  lines.push('  placeId: string | null;');
  lines.push('  mapX: number;');
  lines.push('  mapY: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedBusLineDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  stopIds: string[];');
  lines.push('  serviceStartMinute: number;');
  lines.push('  serviceEndMinute: number;');
  lines.push('  headwayMinutes: number;');
  lines.push('  segmentMinutes: number[];');
  lines.push('  fare: number;');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_DISTRICTS: GeneratedDistrictDef[] = [');
  for (const id of Object.keys(districts).sort()) {
    const r = districts[id] as Record<string, unknown>;
    const tags = Array.isArray(r['tags'])
      ? r['tags'].filter((x): x is string => typeof x === 'string')
      : [];
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    mapX: ${Number(r['mapX'] ?? 0)},`);
    lines.push(`    mapY: ${Number(r['mapY'] ?? 0)},`);
    lines.push(`    tags: [${tags.map((t) => tsString(t)).join(', ')}],`);
    const spatialBounds = spatialBoundsLiteral(r['spatialBounds']);
    if (spatialBounds) lines.push(`    spatialBounds: ${spatialBounds},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_PLACES: GeneratedPlaceDef[] = [');
  for (const id of Object.keys(places).sort()) {
    const r = places[id] as Record<string, unknown>;
    const access: Array<{ stopId: string; walkMinutes: number }> = Array.isArray(r['transitAccess'])
      ? r['transitAccess']
          .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
          .map((e) => ({ stopId: String(e['stopId'] ?? ''), walkMinutes: Number(e['walkMinutes'] ?? 0) }))
      : [];
    const legacyIds = Array.isArray(r['legacyIds'])
      ? r['legacyIds'].filter((x): x is string => typeof x === 'string')
      : [];
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    districtId: ${tsString(String(r['districtId'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    transitAccess: [${access.map((a) => `{ stopId: ${tsString(a.stopId)}, walkMinutes: ${a.walkMinutes} }`).join(', ')}],`);
    lines.push(`    legacyIds: [${legacyIds.map((t) => tsString(t)).join(', ')}],`);
    const spatialBounds = spatialBoundsLiteral(r['spatialBounds']);
    const entryPosition = spatialPositionLiteral(r['entryPosition']);
    if (spatialBounds) lines.push(`    spatialBounds: ${spatialBounds},`);
    if (entryPosition) lines.push(`    entryPosition: ${entryPosition},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_TRANSIT_STOPS: GeneratedTransitStopDef[] = [');
  for (const id of Object.keys(transitStops).sort()) {
    const r = transitStops[id] as Record<string, unknown>;
    const placeId = r['placeId'];
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    districtId: ${tsString(String(r['districtId'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    placeId: ${placeId === undefined || placeId === null || placeId === '' ? 'null' : tsString(String(placeId))},`);
    lines.push(`    mapX: ${Number(r['mapX'] ?? 0)},`);
    lines.push(`    mapY: ${Number(r['mapY'] ?? 0)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_BUS_LINES: GeneratedBusLineDef[] = [');
  for (const id of Object.keys(busLines).sort()) {
    const r = busLines[id] as Record<string, unknown>;
    const strArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const numArr = (v: unknown): number[] =>
      Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    stopIds: [${strArr(r['stopIds']).map((s) => tsString(s)).join(', ')}],`);
    lines.push(`    serviceStartMinute: ${Number(r['serviceStartMinute'] ?? 0)},`);
    lines.push(`    serviceEndMinute: ${Number(r['serviceEndMinute'] ?? 0)},`);
    lines.push(`    headwayMinutes: ${Number(r['headwayMinutes'] ?? 0)},`);
    lines.push(`    segmentMinutes: [${numArr(r['segmentMinutes']).join(', ')}],`);
    lines.push(`    fare: ${Number(r['fare'] ?? 0)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export interface GeneratedItemDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  kind: string;');
  lines.push('  portable: boolean;');
  lines.push('  volume: number;');
  lines.push('  assetId: string | null;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedContainerDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  capacity: number;');
  lines.push('  allowedItemKinds: string[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const optId = (v: unknown): string =>
    v === undefined || v === null || v === '' ? 'null' : tsString(String(v));

  lines.push('export const GENERATED_ITEMS: GeneratedItemDef[] = [');
  for (const id of Object.keys(items).sort()) {
    const r = items[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    kind: ${tsString(String(r['kind'] ?? 'misc'))},`);
    lines.push(`    portable: ${r['portable'] === true ? 'true' : 'false'},`);
    lines.push(`    volume: ${Number(r['volume'] ?? 0)},`);
    lines.push(`    assetId: ${optId(r['assetId'])},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_CONTAINERS: GeneratedContainerDef[] = [');
  for (const id of Object.keys(containers).sort()) {
    const r = containers[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    capacity: ${Number(r['capacity'] ?? 0)},`);
    lines.push(`    allowedItemKinds: [${strArr(r['allowedItemKinds']).map((k) => tsString(k)).join(', ')}],`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export interface GeneratedSpaceDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  name: string;');
  lines.push('  tags: string[];');
  lines.push('  spatialBounds?: GeneratedSpatialBounds;');
  lines.push('  entryPosition?: GeneratedSpatialPosition;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedViewDef {');
  lines.push('  id: string;');
  lines.push('  spaceId: string;');
  lines.push('  name: string;');
  lines.push('  neighbors: string[];');
  lines.push('  assetId: string | null;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_SPACES: GeneratedSpaceDef[] = [');
  for (const id of Object.keys(spaces).sort()) {
    const r = spaces[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    placeId: ${tsString(String(r['placeId'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    const spatialBounds = spatialBoundsLiteral(r['spatialBounds']);
    const entryPosition = spatialPositionLiteral(r['entryPosition']);
    if (spatialBounds) lines.push(`    spatialBounds: ${spatialBounds},`);
    if (entryPosition) lines.push(`    entryPosition: ${entryPosition},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_VIEWS: GeneratedViewDef[] = [');
  for (const id of Object.keys(views).sort()) {
    const r = views[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    spaceId: ${tsString(String(r['spaceId'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    neighbors: [${strArr(r['neighbors']).map((n) => tsString(n)).join(', ')}],`);
    lines.push(`    assetId: ${optId(r['assetId'])},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export interface GeneratedAnchorDef {');
  lines.push('  id: string;');
  lines.push('  viewId: string;');
  lines.push('  name: string;');
  lines.push('  x: number;');
  lines.push('  y: number;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedInteractionDef {');
  lines.push('  id: string;');
  lines.push('  anchorId: string;');
  lines.push('  capability: string;');
  lines.push('  name: string;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_ANCHORS: GeneratedAnchorDef[] = [');
  for (const id of Object.keys(anchors).sort()) {
    const r = anchors[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    viewId: ${tsString(String(r['viewId'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    x: ${Number(r['x'] ?? 0)},`);
    lines.push(`    y: ${Number(r['y'] ?? 0)},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_INTERACTIONS: GeneratedInteractionDef[] = [');
  for (const id of Object.keys(interactions).sort()) {
    const r = interactions[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    anchorId: ${tsString(String(r['anchorId'] ?? ''))},`);
    lines.push(`    capability: ${tsString(String(r['capability'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export interface GeneratedAssetDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  kind: string;');
  lines.push('  uri: string;');
  lines.push('  normalMapAssetId: string | null;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_ASSETS: GeneratedAssetDef[] = [');
  for (const id of Object.keys(assets).sort()) {
    const r = assets[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    kind: ${tsString(String(r['kind'] ?? 'image'))},`);
    lines.push(`    uri: ${tsString(String(r['uri'] ?? ''))},`);
    lines.push(`    normalMapAssetId: ${optId(r['normalMapAssetId'])},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export interface GeneratedLightProfileDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  timeOfDay: string | null;');
  lines.push('  colorTint: string | null;');
  lines.push('  intensity: number;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedAudioProfileDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  kind: string;');
  lines.push('  assetId: string | null;');
  lines.push('  volume: number;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedAmbientProfileDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  weather: string | null;');
  lines.push('  timeOfDay: string | null;');
  lines.push('  density: number;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  const optStr = (v: unknown): string =>
    v === undefined || v === null || v === '' ? 'null' : tsString(String(v));

  lines.push('export const GENERATED_LIGHT_PROFILES: GeneratedLightProfileDef[] = [');
  for (const id of Object.keys(lightProfiles).sort()) {
    const r = lightProfiles[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    timeOfDay: ${optStr(r['timeOfDay'])},`);
    lines.push(`    colorTint: ${optStr(r['colorTint'])},`);
    lines.push(`    intensity: ${Number(r['intensity'] ?? 0)},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_AUDIO_PROFILES: GeneratedAudioProfileDef[] = [');
  for (const id of Object.keys(audioProfiles).sort()) {
    const r = audioProfiles[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    kind: ${tsString(String(r['kind'] ?? 'ambience'))},`);
    lines.push(`    assetId: ${optId(r['assetId'])},`);
    lines.push(`    volume: ${Number(r['volume'] ?? 0)},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_AMBIENT_PROFILES: GeneratedAmbientProfileDef[] = [');
  for (const id of Object.keys(ambientProfiles).sort()) {
    const r = ambientProfiles[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    weather: ${optStr(r['weather'])},`);
    lines.push(`    timeOfDay: ${optStr(r['timeOfDay'])},`);
    lines.push(`    density: ${Number(r['density'] ?? 0)},`);
    lines.push(`    tags: [${strArr(r['tags']).map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export interface GeneratedEventModifierDef {');
  lines.push('  id: string;');
  lines.push('  eventId: string;');
  lines.push('  domain: string;');
  lines.push('  kind: string;');
  lines.push('  durationMinutes: number;');
  lines.push('  targetIds: string[];');
  lines.push('  value?: number | string | boolean;');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_EVENT_MODIFIERS: GeneratedEventModifierDef[] = [');
  for (const id of Object.keys(eventModifiers).sort()) {
    const r = eventModifiers[id] as Record<string, unknown>;
    const domain = String(r['domain'] ?? '');
    const kind = String(r['kind'] ?? '');
    const value = (WORLD_MODIFIER_DOMAINS as readonly string[]).includes(domain)
      ? parseModifierValue(domain as WorldModifierDomain, kind, String(r['value'] ?? ''))
      : undefined;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    eventId: ${tsString(String(r['eventId'] ?? ''))},`);
    lines.push(`    domain: ${tsString(domain)},`);
    lines.push(`    kind: ${tsString(kind)},`);
    lines.push(`    durationMinutes: ${Number(r['durationMinutes'] ?? 0)},`);
    lines.push(`    targetIds: [${strArr(r['targetIds']).map((t) => tsString(t)).join(', ')}],`);
    if (value !== undefined) {
      lines.push(`    value: ${typeof value === 'string' ? tsString(value) : String(value)},`);
    }
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push(generatePhysicalWorldSource(tables));
  lines.push('');
  lines.push(generateVenueWorldSource(tables));
  lines.push('');
  lines.push(generateShopWorldSource(tables));
  lines.push('');

  return lines.join('\n');
}
