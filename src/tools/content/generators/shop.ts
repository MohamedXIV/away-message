import type { ContentTables } from '../shared';
import { tsString } from '../shared';

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function nullableString(value: unknown): string {
  return value === undefined || value === null || value === ''
    ? 'null'
    : tsString(String(value));
}

export function generateShopWorldSource(tables: ContentTables): string {
  const fixtures = tables['shopFixtures'] ?? {};
  const slots = tables['shopSlots'] ?? {};
  const props = tables['sceneProps'] ?? {};
  const lines: string[] = [];

  lines.push('export interface GeneratedShopFixtureDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  viewId: string;');
  lines.push('  anchorId: string;');
  lines.push('  name: string;');
  lines.push('  kind: string;');
  lines.push('  focusZoom: number;');
  lines.push('  lightProfileIds: string[];');
  lines.push('  audioProfileIds: string[];');
  lines.push('  effectTags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedShopSlotDef {');
  lines.push('  id: string;');
  lines.push('  fixtureId: string;');
  lines.push('  eligibleSkuIds: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedScenePropDef {');
  lines.push('  id: string;');
  lines.push('  viewId: string;');
  lines.push('  anchorId: string;');
  lines.push('  assetId: string;');
  lines.push('  depth: number;');
  lines.push('  width: number;');
  lines.push('  height: number;');
  lines.push('  motionType: string | null;');
  lines.push('  motionSpeed: number;');
  lines.push('  motionAmplitude: number;');
  lines.push('  renderLayer: string;');
  lines.push('  maskZone: boolean;');
  lines.push('  swapGroup: string | null;');
  lines.push('  variant: string | null;');
  lines.push('  blendMode: string;');
  lines.push('  lightProfileIds: string[];');
  lines.push('  audioProfileIds: string[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_SHOP_FIXTURES: GeneratedShopFixtureDef[] = [');
  for (const id of Object.keys(fixtures).sort()) {
    const row = fixtures[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    placeId: ' + tsString(String(row['placeId'] ?? '')) + ',');
    lines.push('    viewId: ' + tsString(String(row['viewId'] ?? '')) + ',');
    lines.push('    anchorId: ' + tsString(String(row['anchorId'] ?? '')) + ',');
    lines.push('    name: ' + tsString(String(row['name'] ?? '')) + ',');
    lines.push('    kind: ' + tsString(String(row['kind'] ?? 'shelf')) + ',');
    lines.push('    focusZoom: ' + Number(row['focusZoom'] ?? 1) + ',');
    lines.push('    lightProfileIds: [' + stringArray(row['lightProfileIds']).map(tsString).join(', ') + '],');
    lines.push('    audioProfileIds: [' + stringArray(row['audioProfileIds']).map(tsString).join(', ') + '],');
    lines.push('    effectTags: [' + stringArray(row['effectTags']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_SHOP_SLOTS: GeneratedShopSlotDef[] = [');
  for (const id of Object.keys(slots).sort()) {
    const row = slots[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    fixtureId: ' + tsString(String(row['fixtureId'] ?? '')) + ',');
    lines.push('    eligibleSkuIds: [' + stringArray(row['eligibleSkuIds']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_SCENE_PROPS: GeneratedScenePropDef[] = [');
  for (const id of Object.keys(props).sort()) {
    const row = props[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push('    id: ' + tsString(id) + ',');
    lines.push('    viewId: ' + tsString(String(row['viewId'] ?? '')) + ',');
    lines.push('    anchorId: ' + tsString(String(row['anchorId'] ?? '')) + ',');
    lines.push('    assetId: ' + tsString(String(row['assetId'] ?? '')) + ',');
    lines.push('    depth: ' + Number(row['depth'] ?? 20) + ',');
    lines.push('    width: ' + Number(row['width'] ?? 0.1) + ',');
    lines.push('    height: ' + Number(row['height'] ?? 0.1) + ',');
    lines.push('    motionType: ' + nullableString(row['motionType']) + ',');
    lines.push('    motionSpeed: ' + Number(row['motionSpeed'] ?? 0) + ',');
    lines.push('    motionAmplitude: ' + Number(row['motionAmplitude'] ?? 0) + ',');
    lines.push('    renderLayer: ' + tsString(String(row['renderLayer'] ?? 'auto')) + ',');
    lines.push('    maskZone: ' + (row['maskZone'] === true) + ',');
    lines.push('    swapGroup: ' + nullableString(row['swapGroup']) + ',');
    lines.push('    variant: ' + nullableString(row['variant']) + ',');
    lines.push('    blendMode: ' + tsString(String(row['blendMode'] ?? 'normal')) + ',');
    lines.push('    lightProfileIds: [' + stringArray(row['lightProfileIds']).map(tsString).join(', ') + '],');
    lines.push('    audioProfileIds: [' + stringArray(row['audioProfileIds']).map(tsString).join(', ') + '],');
    lines.push('    tags: [' + stringArray(row['tags']).map(tsString).join(', ') + '],');
    lines.push('  },');
  }
  lines.push('];');

  return lines.join('\n');
}
