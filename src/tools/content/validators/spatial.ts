import {
  containsSpatialPosition,
  type SpatialBounds,
  type SpatialPosition,
} from '../../../engine/spatial/SpatialPresence';
import type { ContentTables } from '../shared';

interface ParsedSpatialBounds {
  bounds: SpatialBounds;
  priority?: number;
}

function parseBounds(
  errors: string[],
  table: string,
  id: string,
  value: unknown,
): ParsedSpatialBounds | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${table}/${id}.spatialBounds: must be an object.`);
    return null;
  }

  const record = value as Record<string, unknown>;
  const polygonRaw = record['polygon'];
  if (!Array.isArray(polygonRaw)) {
    errors.push(`${table}/${id}.spatialBounds.polygon: must be an array.`);
    return null;
  }
  if (polygonRaw.length < 3) {
    errors.push(`${table}/${id}.spatialBounds.polygon: needs at least 3 points.`);
  }

  const polygon: Array<{ x: number; y: number }> = [];
  for (const [index, point] of polygonRaw.entries()) {
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      errors.push(`${table}/${id}.spatialBounds.polygon[${index}]: must be an {x,y} point.`);
      continue;
    }
    const p = point as Record<string, unknown>;
    if (
      typeof p['x'] !== 'number' ||
      !Number.isFinite(p['x']) ||
      typeof p['y'] !== 'number' ||
      !Number.isFinite(p['y'])
    ) {
      errors.push(
        `${table}/${id}.spatialBounds.polygon[${index}]: x/y must be finite numbers.`,
      );
      continue;
    }
    polygon.push({ x: p['x'], y: p['y'] });
  }

  const minZ = record['minZ'];
  const maxZ = record['maxZ'];
  const priority = record['priority'];

  if (minZ !== undefined && (typeof minZ !== 'number' || !Number.isFinite(minZ))) {
    errors.push(`${table}/${id}.spatialBounds.minZ: must be a finite number when authored.`);
  }
  if (maxZ !== undefined && (typeof maxZ !== 'number' || !Number.isFinite(maxZ))) {
    errors.push(`${table}/${id}.spatialBounds.maxZ: must be a finite number when authored.`);
  }
  if (
    typeof minZ === 'number' &&
    Number.isFinite(minZ) &&
    typeof maxZ === 'number' &&
    Number.isFinite(maxZ) &&
    minZ > maxZ
  ) {
    errors.push(`${table}/${id}.spatialBounds: minZ must be <= maxZ.`);
  }
  if (priority !== undefined && (typeof priority !== 'number' || !Number.isFinite(priority))) {
    errors.push(
      `${table}/${id}.spatialBounds.priority: must be a finite number when authored.`,
    );
  }

  return {
    bounds: {
      polygon,
      ...(typeof minZ === 'number' && Number.isFinite(minZ) ? { minZ } : {}),
      ...(typeof maxZ === 'number' && Number.isFinite(maxZ) ? { maxZ } : {}),
    },
    ...(typeof priority === 'number' && Number.isFinite(priority) ? { priority } : {}),
  };
}

function boundsContainedBy(child: SpatialBounds, parent: SpatialBounds): boolean {
  if (
    parent.minZ !== undefined &&
    (child.minZ === undefined || child.minZ < parent.minZ)
  ) {
    return false;
  }
  if (
    parent.maxZ !== undefined &&
    (child.maxZ === undefined || child.maxZ > parent.maxZ)
  ) {
    return false;
  }

  const sampleZ =
    child.minZ ??
    child.maxZ ??
    parent.minZ ??
    parent.maxZ ??
    0;

  return child.polygon.every((point) =>
    containsSpatialPosition({ x: point.x, y: point.y, z: sampleZ }, parent),
  );
}

function parseEntry(
  errors: string[],
  table: string,
  id: string,
  value: unknown,
): SpatialPosition | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${table}/${id}.entryPosition: must be an {x,y,z} object.`);
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (typeof record[axis] !== 'number' || !Number.isFinite(record[axis])) {
      errors.push(`${table}/${id}.entryPosition.${axis}: must be a finite number.`);
      return null;
    }
  }
  return {
    x: record['x'] as number,
    y: record['y'] as number,
    z: record['z'] as number,
  };
}

/**
 * Validate optional authored geometry attached to canonical district/place/space rows.
 * Missing geometry is allowed and means unresolved, never an implicit fallback.
 */
export function validateWorldSpatialContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const districts = tables['districts'] ?? {};
  const places = tables['places'] ?? {};
  const spaces = tables['spaces'] ?? {};

  const districtBounds = new Map<string, ParsedSpatialBounds>();
  const placeBounds = new Map<string, ParsedSpatialBounds>();

  for (const [id, row] of Object.entries(districts)) {
    if (!row || typeof row !== 'object') continue;
    const parsed = parseBounds(
      errors,
      'districts',
      id,
      (row as Record<string, unknown>)['spatialBounds'],
    );
    if (parsed) districtBounds.set(id, parsed);
  }

  for (const [id, row] of Object.entries(places)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const parsed = parseBounds(errors, 'places', id, record['spatialBounds']);
    const entry = parseEntry(errors, 'places', id, record['entryPosition']);
    const districtId = record['districtId'];

    if (parsed) {
      placeBounds.set(id, parsed);
      const parent =
        typeof districtId === 'string' ? districtBounds.get(districtId) : undefined;
      if (!parent) {
        errors.push(
          `places/${id}.spatialBounds: parent district '${String(districtId)}' needs authored spatialBounds.`,
        );
      } else if (!boundsContainedBy(parsed.bounds, parent.bounds)) {
        errors.push(
          `places/${id}.spatialBounds: must stay inside parent district '${districtId}'.`,
        );
      }
    }
    if (entry && !parsed) {
      errors.push(`places/${id}.entryPosition: requires authored spatialBounds.`);
    } else if (entry && parsed && !containsSpatialPosition(entry, parsed.bounds)) {
      errors.push(`places/${id}.entryPosition: must resolve inside its own spatialBounds.`);
    }
  }

  for (const [id, row] of Object.entries(spaces)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const parsed = parseBounds(errors, 'spaces', id, record['spatialBounds']);
    const entry = parseEntry(errors, 'spaces', id, record['entryPosition']);
    const placeId = record['placeId'];

    if (parsed) {
      const parent =
        typeof placeId === 'string' ? placeBounds.get(placeId) : undefined;
      if (!parent) {
        errors.push(
          `spaces/${id}.spatialBounds: parent place '${String(placeId)}' needs authored spatialBounds.`,
        );
      } else if (!boundsContainedBy(parsed.bounds, parent.bounds)) {
        errors.push(
          `spaces/${id}.spatialBounds: must stay inside parent place '${placeId}'.`,
        );
      }
    }
    if (entry && !parsed) {
      errors.push(`spaces/${id}.entryPosition: requires authored spatialBounds.`);
    } else if (entry && parsed && !containsSpatialPosition(entry, parsed.bounds)) {
      errors.push(`spaces/${id}.entryPosition: must resolve inside its own spatialBounds.`);
    }
  }

  return errors;
}
