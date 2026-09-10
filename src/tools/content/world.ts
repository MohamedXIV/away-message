import type { ContentTables } from './codegen';

const ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

function parseJsonArray(value: unknown, path: string, errors: string[]): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(String(value ?? '[]'));
    if (!Array.isArray(parsed)) {
      errors.push(`${path}: must be a JSON array.`);
      return null;
    }
    return parsed;
  } catch {
    errors.push(`${path}: invalid JSON array.`);
    return null;
  }
}

export function validateWorldContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const districts = tables['districtDefinitions'] ?? {};
  const places = tables['placeDefinitions'] ?? {};
  const stops = tables['transitStopDefinitions'] ?? {};
  const lines = tables['busLineDefinitions'] ?? {};

  const checkIds = (tableName: string, rows: Record<string, Record<string, unknown>>) => {
    for (const id of Object.keys(rows)) {
      if (!ID_PATTERN.test(id)) errors.push(`${tableName}/${id}: invalid stable id.`);
    }
  };
  checkIds('districtDefinitions', districts);
  checkIds('placeDefinitions', places);
  checkIds('transitStopDefinitions', stops);
  checkIds('busLineDefinitions', lines);

  for (const [id, row] of Object.entries(districts)) {
    if (typeof row['displayName'] !== 'string' || !String(row['displayName']).trim()) {
      errors.push(`districtDefinitions/${id}.displayName: required.`);
    }
  }

  for (const [id, row] of Object.entries(places)) {
    const districtId = String(row['districtId'] ?? '');
    if (!districts[districtId]) {
      errors.push(`placeDefinitions/${id}.districtId: unknown district '${districtId}'.`);
    }
    const accessStops = parseJsonArray(row['accessStops'], `placeDefinitions/${id}.accessStops`, errors);
    if (accessStops) {
      for (const [index, access] of accessStops.entries()) {
        if (!access || typeof access !== 'object') {
          errors.push(`placeDefinitions/${id}.accessStops[${index}]: must be an object.`);
          continue;
        }
        const entry = access as Record<string, unknown>;
        const stopId = String(entry['stopId'] ?? '');
        if (!stops[stopId]) errors.push(`placeDefinitions/${id}.accessStops[${index}].stopId: unknown stop '${stopId}'.`);
        const walkMinutes = entry['walkMinutes'];
        if (typeof walkMinutes !== 'number' || !Number.isFinite(walkMinutes) || walkMinutes <= 0) {
          errors.push(`placeDefinitions/${id}.accessStops[${index}].walkMinutes: must be > 0.`);
        }
      }
    }
  }

  for (const [id, row] of Object.entries(stops)) {
    const districtId = String(row['districtId'] ?? '');
    const placeId = String(row['placeId'] ?? '');
    if (!districts[districtId]) errors.push(`transitStopDefinitions/${id}.districtId: unknown district '${districtId}'.`);
    if (!places[placeId]) errors.push(`transitStopDefinitions/${id}.placeId: unknown place '${placeId}'.`);
  }

  for (const [id, row] of Object.entries(lines)) {
    const stopIds = parseJsonArray(row['stopIds'], `busLineDefinitions/${id}.stopIds`, errors);
    const segmentMinutes = parseJsonArray(row['segmentMinutes'], `busLineDefinitions/${id}.segmentMinutes`, errors);

    if (stopIds) {
      const normalized = stopIds.map(String);
      if (normalized.length < 2) errors.push(`busLineDefinitions/${id}.stopIds: needs at least two stops.`);
      if (new Set(normalized).size !== normalized.length) errors.push(`busLineDefinitions/${id}.stopIds: duplicate stops are not allowed.`);
      for (const stopId of normalized) {
        if (!stops[stopId]) errors.push(`busLineDefinitions/${id}.stopIds: unknown stop '${stopId}'.`);
      }
      if (segmentMinutes && segmentMinutes.length !== Math.max(0, normalized.length - 1)) {
        errors.push(`busLineDefinitions/${id}.segmentMinutes: length must equal stopIds.length - 1.`);
      }
    }

    if (segmentMinutes) {
      for (const [index, minutes] of segmentMinutes.entries()) {
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
          errors.push(`busLineDefinitions/${id}.segmentMinutes[${index}]: must be > 0.`);
        }
      }
    }

    const headway = row['headwayMinutes'];
    if (typeof headway !== 'number' || !Number.isFinite(headway) || headway <= 0) {
      errors.push(`busLineDefinitions/${id}.headwayMinutes: must be > 0.`);
    }
    const start = row['serviceStartMinute'];
    const end = row['serviceEndMinute'];
    if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 0 || (end as number) > 1439 || (start as number) >= (end as number)) {
      errors.push(`busLineDefinitions/${id}.service window: must be 0..1439 with start < end.`);
    }
    const fare = row['fareCents'];
    if (!Number.isInteger(fare) || (fare as number) < 0) errors.push(`busLineDefinitions/${id}.fareCents: must be a non-negative integer.`);
  }

  return errors;
}
