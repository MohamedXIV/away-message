import { GROCERY_SKUS } from '../../../engine/DeliveryEngine';
import type { ContentTables } from '../shared';
import { validateWorldId } from '../shared';

const FIXTURE_KINDS = new Set([
  'shelf', 'fridge', 'freezer', 'counterDisplay', 'rack', 'bin', 'cashierCounter',
]);
const MOTION_TYPES = new Set(['rotation', 'sway', 'vibration', 'light_sweep', 'drift']);
const TAG_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

function tags(errors: string[], table: string, id: string, field: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${table}/${id}.${field}: must be an array.`);
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || !TAG_PATTERN.test(entry)) {
      errors.push(`${table}/${id}.${field}[${index}]: must be a lowercase semantic tag.`);
      return;
    }
    if (seen.has(entry)) {
      errors.push(`${table}/${id}.${field}[${index}]: duplicate '${entry}'.`);
      return;
    }
    seen.add(entry);
    result.push(entry);
  });
  return result;
}

export function validateShopContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const places = tables['places'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const assets = tables['assets'] ?? {};
  const lightProfiles = tables['lightProfiles'] ?? {};
  const audioProfiles = tables['audioProfiles'] ?? {};
  const fixtures = tables['shopFixtures'] ?? {};
  const slots = tables['shopSlots'] ?? {};
  const props = tables['sceneProps'] ?? {};

  for (const [id, value] of Object.entries(fixtures)) {
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`shopFixtures/${id}: ${idCheck.error}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`shopFixtures/${id}: must be an object.`);
      continue;
    }
    const row = value as Record<string, unknown>;
    const placeId = String(row['placeId'] ?? '');
    const viewId = String(row['viewId'] ?? '');
    const anchorId = String(row['anchorId'] ?? '');
    if (!places[placeId]) errors.push(`shopFixtures/${id}.placeId: unknown place '${placeId}'.`);
    const view = views[viewId] as Record<string, unknown> | undefined;
    if (!view) {
      errors.push(`shopFixtures/${id}.viewId: unknown view '${viewId}'.`);
    } else {
      const space = spaces[String(view['spaceId'] ?? '')] as Record<string, unknown> | undefined;
      if (!space || space['placeId'] !== placeId) {
        errors.push(`shopFixtures/${id}.viewId: view '${viewId}' does not belong to place '${placeId}'.`);
      }
    }
    const anchor = anchors[anchorId] as Record<string, unknown> | undefined;
    if (!anchor) {
      errors.push(`shopFixtures/${id}.anchorId: unknown anchor '${anchorId}'.`);
    } else if (anchor['viewId'] !== viewId) {
      errors.push(`shopFixtures/${id}.anchorId: anchor '${anchorId}' is not in view '${viewId}'.`);
    }
    if (typeof row['name'] !== 'string' || !String(row['name']).trim()) {
      errors.push(`shopFixtures/${id}.name: must be non-empty.`);
    }
    if (typeof row['kind'] !== 'string' || !FIXTURE_KINDS.has(row['kind'])) {
      errors.push(`shopFixtures/${id}.kind: unsupported fixture kind '${String(row['kind'])}'.`);
    }
    if (typeof row['focusZoom'] !== 'number' || !Number.isFinite(row['focusZoom']) || row['focusZoom'] < 1 || row['focusZoom'] > 3) {
      errors.push(`shopFixtures/${id}.focusZoom: must be a number in 1..3.`);
    }
    for (const profileId of tags(errors, 'shopFixtures', id, 'lightProfileIds', row['lightProfileIds'])) {
      if (!lightProfiles[profileId]) errors.push(`shopFixtures/${id}.lightProfileIds: unknown light profile '${profileId}'.`);
    }
    for (const profileId of tags(errors, 'shopFixtures', id, 'audioProfileIds', row['audioProfileIds'])) {
      if (!audioProfiles[profileId]) errors.push(`shopFixtures/${id}.audioProfileIds: unknown audio profile '${profileId}'.`);
    }
    tags(errors, 'shopFixtures', id, 'effectTags', row['effectTags']);
  }

  for (const [id, value] of Object.entries(slots)) {
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`shopSlots/${id}: ${idCheck.error}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`shopSlots/${id}: must be an object.`);
      continue;
    }
    const row = value as Record<string, unknown>;
    const fixtureId = String(row['fixtureId'] ?? '');
    if (!fixtures[fixtureId]) errors.push(`shopSlots/${id}.fixtureId: unknown fixture '${fixtureId}'.`);
    const eligible = row['eligibleSkuIds'];
    if (!Array.isArray(eligible) || eligible.length === 0) {
      errors.push(`shopSlots/${id}.eligibleSkuIds: must contain at least one SKU.`);
    } else {
      eligible.forEach((sku, index) => {
        if (typeof sku !== 'string' || !GROCERY_SKUS[sku]) {
          errors.push(`shopSlots/${id}.eligibleSkuIds[${index}]: unknown grocery SKU '${String(sku)}'.`);
        }
      });
    }
  }

  for (const [id, value] of Object.entries(props)) {
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`sceneProps/${id}: ${idCheck.error}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`sceneProps/${id}: must be an object.`);
      continue;
    }
    const row = value as Record<string, unknown>;
    const viewId = String(row['viewId'] ?? '');
    const anchorId = String(row['anchorId'] ?? '');
    const assetId = String(row['assetId'] ?? '');
    if (!views[viewId]) errors.push(`sceneProps/${id}.viewId: unknown view '${viewId}'.`);
    const anchor = anchors[anchorId] as Record<string, unknown> | undefined;
    if (!anchor) {
      errors.push(`sceneProps/${id}.anchorId: unknown anchor '${anchorId}'.`);
    } else if (anchor['viewId'] !== viewId) {
      errors.push(`sceneProps/${id}.anchorId: anchor '${anchorId}' is not in view '${viewId}'.`);
    }
    const asset = assets[assetId] as Record<string, unknown> | undefined;
    if (!asset || asset['kind'] !== 'image') {
      errors.push(`sceneProps/${id}.assetId: '${assetId}' must reference an image asset.`);
    }
    for (const field of ['depth', 'width', 'height', 'motionSpeed', 'motionAmplitude'] as const) {
      if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) {
        errors.push(`sceneProps/${id}.${field}: must be a finite number.`);
      }
    }
    if (typeof row['width'] === 'number' && row['width'] <= 0) errors.push(`sceneProps/${id}.width: must be > 0.`);
    if (typeof row['height'] === 'number' && row['height'] <= 0) errors.push(`sceneProps/${id}.height: must be > 0.`);
    const motionType = row['motionType'];
    if (motionType !== '' && motionType !== undefined && motionType !== null && (typeof motionType !== 'string' || !MOTION_TYPES.has(motionType))) {
      errors.push(`sceneProps/${id}.motionType: unsupported motion type '${String(motionType)}'.`);
    }
    tags(errors, 'sceneProps', id, 'tags', row['tags']);
  }

  return errors;
}
