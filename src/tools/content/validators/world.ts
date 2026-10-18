// Domain validators for authored world content.
// Phase A (#99): behavior-preserving extraction from codegen.ts.

import {
  WORLD_MODIFIER_DOMAINS,
  WORLD_MODIFIER_KINDS,
  WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES,
  WORLD_MODIFIER_MAX_DURATION_MINUTES,
  WORLD_MODIFIER_ENV_SCALAR_DELTA_MAX,
  WORLD_MODIFIER_ENV_SCALAR_DELTA_MIN,
  WORLD_MODIFIER_ENV_TEMPERATURE_DELTA_MAX,
  WORLD_MODIFIER_ENV_TEMPERATURE_DELTA_MIN,
  type WorldModifierDomain,
} from '../../../engine/WorldModifiers';
import type { ContentTables } from '../shared';
import { validateWorldId } from '../shared';

/**
 * Semantic validation for the town content tables.
 * Every error identifies table/id/field so Content Studio (#52) can show
 * useful per-row feedback. Never repairs: invalid content fails loudly.
 */
export function validateWorldContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const districts = tables['districts'] ?? {};
  const places = tables['places'] ?? {};
  const transitStops = tables['transitStops'] ?? {};
  const busLines = tables['busLines'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};
  const housingOffers = tables['housingOffers'] ?? {};
  const shopFixtures = tables['shopFixtures'] ?? {};
  const venueStations = tables['venueStations'] ?? {};

  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const checkId = (table: string, id: string): boolean => {
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) {
      errors.push(`${table}/${id}: ${idCheck.error}`);
      return false;
    }
    return true;
  };
  const checkName = (table: string, id: string, row: Record<string, unknown>): void => {
    const name = row['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
    }
  };
  const checkMapPoint = (table: string, id: string, row: Record<string, unknown>): void => {
    for (const key of ['mapX', 'mapY']) {
      if (!num(row[key])) errors.push(`${table}/${id}.${key}: must be a finite number.`);
    }
  };
  const readArray = (table: string, id: string, field: string, raw: unknown): unknown[] | null => {
    if (!Array.isArray(raw)) {
      errors.push(`${table}/${id}.${field}: must be an array.`);
      return null;
    }
    return raw;
  };

  // Districts.
  for (const [id, row] of Object.entries(districts)) {
    if (!row || typeof row !== 'object') {
      errors.push(`districts/${id}: must be an object.`);
      continue;
    }
    checkId('districts', id);
    const r = row as Record<string, unknown>;
    checkName('districts', id, r);
    checkMapPoint('districts', id, r);
    const tags = readArray('districts', id, 'tags', r['tags']);
    if (tags) {
      if (tags.length > 12) errors.push(`districts/${id}.tags: max 12 tags.`);
      for (const tag of tags) {
        if (typeof tag !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(tag)) {
          errors.push(`districts/${id}.tags: '${String(tag)}' must be a lowercase tag ≤ 24 chars.`);
        }
      }
    }
  }

  // Transit stops (before places so place access links can resolve them;
  // existence checks are key-based so order does not matter).
  for (const [id, row] of Object.entries(transitStops)) {
    if (!row || typeof row !== 'object') {
      errors.push(`transitStops/${id}: must be an object.`);
      continue;
    }
    checkId('transitStops', id);
    const r = row as Record<string, unknown>;
    checkName('transitStops', id, r);
    const districtId = r['districtId'];
    if (typeof districtId !== 'string' || !districts[districtId]) {
      errors.push(`transitStops/${id}.districtId: unknown district '${String(districtId)}'.`);
    }
    const placeId = r['placeId'];
    if (placeId !== undefined && placeId !== null && placeId !== '') {
      if (typeof placeId !== 'string' || !places[String(placeId)]) {
        errors.push(`transitStops/${id}.placeId: unknown place '${String(placeId)}'.`);
      }
    }
    checkMapPoint('transitStops', id, r);
  }

  // Places.
  for (const [id, row] of Object.entries(places)) {
    if (!row || typeof row !== 'object') {
      errors.push(`places/${id}: must be an object.`);
      continue;
    }
    checkId('places', id);
    const r = row as Record<string, unknown>;
    const districtId = r['districtId'];
    if (typeof districtId !== 'string' || !districts[districtId]) {
      errors.push(`places/${id}.districtId: unknown district '${String(districtId)}'.`);
    }
    checkName('places', id, r);
    const access = readArray('places', id, 'transitAccess', r['transitAccess']);
    if (access) {
      if (access.length > 8) errors.push(`places/${id}.transitAccess: max 8 access links.`);
      for (const [i, entry] of access.entries()) {
        const stopId = (entry as Record<string, unknown>)?.['stopId'];
        const walkMinutes = (entry as Record<string, unknown>)?.['walkMinutes'];
        if (typeof stopId !== 'string' || !transitStops[stopId]) {
          errors.push(`places/${id}.transitAccess[${i}].stopId: unknown transit stop '${String(stopId)}'.`);
        }
        if (!num(walkMinutes) || (walkMinutes as number) <= 0) {
          errors.push(`places/${id}.transitAccess[${i}].walkMinutes: must be a positive number of minutes.`);
        }
      }
    }
    const legacyIds = readArray('places', id, 'legacyIds', r['legacyIds']);
    if (legacyIds) {
      if (legacyIds.length > 8) errors.push(`places/${id}.legacyIds: max 8 legacy ids.`);
      for (const [i, legacyId] of legacyIds.entries()) {
        if (typeof legacyId !== 'string' || legacyId.trim() === '' || legacyId.length > 60) {
          errors.push(`places/${id}.legacyIds[${i}]: must be a non-empty string <= 60 chars.`);
        }
      }
    }
  }

  // QA fixture isolation (PR #198 review item 2): a technical vertical
  // slice may live in the same canonical catalog, but it must never leak
  // into a player-facing world surface. These invariants are what let the
  // runtime treat GENERATED_PLACES/SPACES/VIEWS as safe to enumerate.
  const qaPlaceIds = new Set<string>();
  for (const [id, row] of Object.entries(places)) {
    if (row && typeof row === 'object' && (row as Record<string, unknown>)['qaFixture'] === true) {
      qaPlaceIds.add(id);
    }
  }
  const qaSpaceIds = new Set<string>();
  const qaViewIds = new Set<string>();
  for (const placeId of qaPlaceIds) {
    const place = places[placeId] as Record<string, unknown> | undefined;
    if (!place) continue;
    // The town map and spatial presence enumerate every place; a QA fixture
    // that stays presentation-only must not claim world geometry.
    if (place['spatialBounds'] !== undefined) {
      errors.push(`places/${placeId}: a QA fixture place must not author spatialBounds (it would join the player-facing town map).`);
    }
    if (place['entryPosition'] !== undefined) {
      errors.push(`places/${placeId}: a QA fixture place must not author an entryPosition (spatial presence would treat it as a real destination).`);
    }
  }
  for (const [id, row] of Object.entries(spaces)) {
    const placeId = (row as Record<string, unknown> | undefined)?.['placeId'];
    if (typeof placeId === 'string' && qaPlaceIds.has(placeId)) qaSpaceIds.add(id);
  }
  for (const [id, row] of Object.entries(views)) {
    const spaceId = (row as Record<string, unknown> | undefined)?.['spaceId'];
    if (typeof spaceId === 'string' && qaSpaceIds.has(spaceId)) qaViewIds.add(id);
  }
  if (qaPlaceIds.size > 0) {
    for (const [id, row] of Object.entries(transitStops)) {
      const placeId = (row as Record<string, unknown> | undefined)?.['placeId'];
      if (typeof placeId === 'string' && qaPlaceIds.has(placeId)) {
        errors.push(`transitStops/${id}.placeId: transit stop must not reference QA fixture place '${placeId}'.`);
      }
    }
    for (const [id, row] of Object.entries(places)) {
      const legacyIds = (row as Record<string, unknown> | undefined)?.['legacyIds'];
      if (!Array.isArray(legacyIds)) continue;
      for (const legacyId of legacyIds) {
        if (typeof legacyId === 'string' && qaPlaceIds.has(legacyId)) {
          errors.push(`places/${id}.legacyIds: legacy alias must not target QA fixture place '${legacyId}'.`);
        }
      }
    }
    for (const [id, row] of Object.entries(housingOffers)) {
      const placeId = (row as Record<string, unknown> | undefined)?.['placeId'];
      if (typeof placeId === 'string' && qaPlaceIds.has(placeId)) {
        errors.push(`housingOffers/${id}.placeId: housing offer must not target QA fixture place '${placeId}'.`);
      }
    }
    for (const [id, row] of Object.entries(shopFixtures)) {
      const placeId = (row as Record<string, unknown> | undefined)?.['placeId'];
      if (typeof placeId === 'string' && qaPlaceIds.has(placeId)) {
        errors.push(`shopFixtures/${id}.placeId: shop fixture must not target QA fixture place '${placeId}'.`);
      }
    }
    for (const [id, row] of Object.entries(venueStations)) {
      const placeId = (row as Record<string, unknown> | undefined)?.['placeId'];
      const spaceId = (row as Record<string, unknown> | undefined)?.['spaceId'];
      if (typeof placeId === 'string' && qaPlaceIds.has(placeId)) {
        errors.push(`venueStations/${id}.placeId: venue station must not target QA fixture place '${placeId}'.`);
      }
      if (typeof spaceId === 'string' && qaSpaceIds.has(spaceId)) {
        errors.push(`venueStations/${id}.spaceId: venue station must not target a QA fixture space.`);
      }
    }
    // View adjacency is how the player walks between rooms: no real view
    // may link to a fixture view, and fixture views may not link out.
    for (const [id, row] of Object.entries(views)) {
      const neighbors = (row as Record<string, unknown> | undefined)?.['neighbors'];
      if (!Array.isArray(neighbors)) continue;
      const isQaView = qaViewIds.has(id);
      for (const neighbor of neighbors) {
        if (typeof neighbor !== 'string') continue;
        if (qaViewIds.has(neighbor)) {
          errors.push(`views/${id}.neighbors: player-facing view graph must not link to QA fixture view '${neighbor}'.`);
        } else if (isQaView) {
          errors.push(`views/${id}.neighbors: QA fixture view must not link into the player-facing view graph ('${neighbor}').`);
        }
      }
    }
  }

  // Bus lines.
  for (const [id, row] of Object.entries(busLines)) {
    if (!row || typeof row !== 'object') {
      errors.push(`busLines/${id}: must be an object.`);
      continue;
    }
    checkId('busLines', id);
    const r = row as Record<string, unknown>;
    checkName('busLines', id, r);
    const stopIds = readArray('busLines', id, 'stopIds', r['stopIds']);
    if (stopIds) {
      if (stopIds.length < 2) {
        errors.push(`busLines/${id}.stopIds: a line needs at least 2 stops (found ${stopIds.length}).`);
      }
      for (const [i, stopId] of stopIds.entries()) {
        if (typeof stopId !== 'string' || !transitStops[String(stopId)]) {
          errors.push(`busLines/${id}.stopIds[${i}]: unknown transit stop '${String(stopId)}'.`);
        }
        if (i > 0 && stopId === stopIds[i - 1]) {
          errors.push(`busLines/${id}.stopIds[${i}]: duplicate adjacent stop '${String(stopId)}'.`);
        }
      }
    }
    const segments = readArray('busLines', id, 'segmentMinutes', r['segmentMinutes']);
    if (stopIds && segments && stopIds.length >= 2 && segments.length !== stopIds.length - 1) {
      errors.push(
        `busLines/${id}.segmentMinutes: length ${segments.length} must equal stops - 1 (${stopIds.length - 1}).`
      );
    }
    if (segments) {
      for (const [i, minutes] of segments.entries()) {
        if (!num(minutes) || (minutes as number) <= 0) {
          errors.push(`busLines/${id}.segmentMinutes[${i}]: must be a positive number of minutes.`);
        }
      }
    }
    const headway = r['headwayMinutes'];
    if (!num(headway) || (headway as number) <= 0) {
      errors.push(`busLines/${id}.headwayMinutes: must be a positive number of minutes.`);
    }
    const start = r['serviceStartMinute'];
    const end = r['serviceEndMinute'];
    const windowOk =
      Number.isInteger(start) && Number.isInteger(end) &&
      (start as number) >= 0 && (end as number) <= 1440 && (start as number) < (end as number);
    if (!windowOk) {
      errors.push(
        `busLines/${id}.service: serviceStartMinute/serviceEndMinute must be ints with 0 <= start < end <= 1440 (no cross-midnight).`
      );
    }
    const fare = r['fare'];
    if (!num(fare) || (fare as number) < 0) {
      errors.push(`busLines/${id}.fare: must be a non-negative number.`);
    }
  }

  return errors;
}

/**
 * Semantic validation for world-event modifier specs (#46). Authored effect
 * templates only: unknown event ids validate structurally (they publish
 * nothing until such an event triggers), but domains/kinds/values must fit
 * the engine's closed vocabulary. Never repairs: fails loudly.
 */
export function validateEventModifiers(tables: ContentTables): string[] {
  const errors: string[] = [];
  const specs = tables['eventModifiers'] ?? {};
  const places = tables['places'] ?? {};
  const transitStops = tables['transitStops'] ?? {};
  const busLines = tables['busLines'] ?? {};

  for (const [id, row] of Object.entries(specs)) {
    if (!row || typeof row !== 'object') {
      errors.push(`eventModifiers/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`eventModifiers/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;

    const eventId = r['eventId'];
    if (typeof eventId !== 'string' || !/^[a-z0-9_]+$/.test(eventId)) {
      errors.push(`eventModifiers/${id}.eventId: must be a snake_case event id.`);
    }
    const domain = r['domain'];
    if (typeof domain !== 'string' || !(WORLD_MODIFIER_DOMAINS as readonly string[]).includes(domain)) {
      errors.push(
        `eventModifiers/${id}.domain: must be one of ${(WORLD_MODIFIER_DOMAINS as readonly string[]).join(', ')}.`
      );
      continue;
    }
    const kinds = WORLD_MODIFIER_KINDS[domain as WorldModifierDomain];
    const kind = r['kind'];
    if (typeof kind !== 'string' || !kinds.includes(kind)) {
      errors.push(`eventModifiers/${id}.kind: must be one of ${kinds.join(', ')} for domain '${domain}'.`);
    }
    const duration = r['durationMinutes'];
    if (!Number.isInteger(duration) || (duration as number) < 0 || (duration as number) > WORLD_MODIFIER_MAX_DURATION_MINUTES) {
      errors.push(
        `eventModifiers/${id}.durationMinutes: must be an int 0..${WORLD_MODIFIER_MAX_DURATION_MINUTES}.`
      );
    }
    const targets = r['targetIds'];
    if (!Array.isArray(targets)) {
      errors.push(`eventModifiers/${id}.targetIds: must be an array.`);
    } else {
      if (targets.length > 16) errors.push(`eventModifiers/${id}.targetIds: max 16 targets.`);
      for (const [i, target] of targets.entries()) {
        if (typeof target !== 'string' || !target) {
          errors.push(`eventModifiers/${id}.targetIds[${i}]: must be a non-empty id string.`);
          continue;
        }
        if (!places[target] && !transitStops[target] && !busLines[target]) {
          errors.push(`eventModifiers/${id}.targetIds[${i}]: unknown place/stop/line '${target}'.`);
        }
      }
    }
    const value = r['value'];
    if (typeof value !== 'string') {
      errors.push(`eventModifiers/${id}.value: must be a string cell (parsed by kind).`);
    } else if (value.length > 80) {
      errors.push(`eventModifiers/${id}.value: max 80 chars.`);
    } else if (domain === 'environment' && value.trim() !== '') {
      if (kind === 'condition_override') {
        const allowed = ['rain', 'drizzle', 'overcast', 'fog', 'clear', 'heat', 'storm'];
        if (!allowed.includes(value.trim())) {
          errors.push(
            `eventModifiers/${id}.value: condition_override must be one of ${allowed.join(', ')}.`
          );
        }
      } else {
        const numeric = Number(value);
        const min = kind === 'temperature_delta'
          ? WORLD_MODIFIER_ENV_TEMPERATURE_DELTA_MIN
          : WORLD_MODIFIER_ENV_SCALAR_DELTA_MIN;
        const max = kind === 'temperature_delta'
          ? WORLD_MODIFIER_ENV_TEMPERATURE_DELTA_MAX
          : WORLD_MODIFIER_ENV_SCALAR_DELTA_MAX;
        if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
          errors.push(
            `eventModifiers/${id}.value: ${String(kind)} must be numeric within ${min}..${max}.`
          );
        }
      }
    } else if (domain === 'delivery' && kind === 'courier_backlog' && value.trim() !== '') {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || Math.round(minutes) < 0 || Math.round(minutes) > WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES) {
        errors.push(
          `eventModifiers/${id}.value: courier_backlog must be empty or 0..${WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES} minutes.`
        );
      }
    } else if (domain === 'life' && typeof kind === 'string' && kind.endsWith('_opportunity') && value.trim() !== '') {
      const priority = Number(value);
      if (!Number.isFinite(priority) || Math.round(priority) < 0 || Math.round(priority) > 100) {
        errors.push(`eventModifiers/${id}.value: life opportunities must be empty or a priority 0..100.`);
      }
    }
  }

  return errors;
}

/**
 * Semantic validation for the item/container content tables (#51 slice 2).
 * Every error identifies table/id/field so Content Studio (#52) can show
 * useful per-row feedback. Never repairs: invalid content fails loudly.
 * Kinds are an open tag vocabulary (format-checked only) so new kinds can
 * be authored without gameplay-code edits.
 */
export function validateWorldItems(tables: ContentTables): string[] {
  const errors: string[] = [];
  const items = tables['items'] ?? {};
  const containers = tables['containers'] ?? {};

  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const checkTag = (table: string, id: string, field: string, value: unknown): void => {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(value)) {
      errors.push(`${table}/${id}.${field}: '${String(value)}' must be a lowercase tag ≤ 24 chars.`);
    }
  };
  const checkTags = (table: string, id: string, row: Record<string, unknown>): void => {
    const tags = row['tags'];
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be an array.`);
      return;
    }
    if (tags.length > 12) errors.push(`${table}/${id}.tags: max 12 tags.`);
    for (const tag of tags) checkTag(table, id, 'tags', tag);
  };
  const checkName = (table: string, id: string, row: Record<string, unknown>): void => {
    const name = row['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
    }
  };

  for (const [id, row] of Object.entries(items)) {
    if (!row || typeof row !== 'object') {
      errors.push(`items/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`items/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName('items', id, r);
    checkTag('items', id, 'kind', r['kind']);
    if (typeof r['portable'] !== 'boolean') {
      errors.push(`items/${id}.portable: must be a boolean.`);
    }
    if (!num(r['volume']) || (r['volume'] as number) < 0) {
      errors.push(`items/${id}.volume: must be a non-negative number of capacity units.`);
    }
    checkTags('items', id, r);
  }

  for (const [id, row] of Object.entries(containers)) {
    if (!row || typeof row !== 'object') {
      errors.push(`containers/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`containers/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName('containers', id, r);
    if (!num(r['capacity']) || (r['capacity'] as number) <= 0) {
      errors.push(`containers/${id}.capacity: must be a positive number of capacity units.`);
    }
    const kinds = r['allowedItemKinds'];
    if (Array.isArray(kinds)) {
      if (kinds.length > 24) errors.push(`containers/${id}.allowedItemKinds: max 24 kinds.`);
      for (const kind of kinds) checkTag('containers', id, 'allowedItemKinds', kind);
    } else {
      errors.push(`containers/${id}.allowedItemKinds: must be an array ([] = unrestricted).`);
    }
    checkTags('containers', id, r);
  }

  return errors;
}

/**
 * Semantic validation for the space/view content tables (#51 slice 3).
 * Every error identifies table/id/field so Content Studio (#52) can show
 * useful per-row feedback. Never repairs: invalid content fails loudly.
 */
export function validateWorldSpaces(tables: ContentTables): string[] {
  const errors: string[] = [];
  const places = tables['places'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};

  const checkName = (table: string, id: string, row: Record<string, unknown>): void => {
    const name = row['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
    }
  };
  const checkTags = (table: string, id: string, row: Record<string, unknown>): void => {
    const tags = row['tags'];
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be an array.`);
      return;
    }
    if (tags.length > 12) errors.push(`${table}/${id}.tags: max 12 tags.`);
    for (const tag of tags) {
      if (typeof tag !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(tag)) {
        errors.push(`${table}/${id}.tags: '${String(tag)}' must be a lowercase tag ≤ 24 chars.`);
      }
    }
  };

  for (const [id, row] of Object.entries(spaces)) {
    if (!row || typeof row !== 'object') {
      errors.push(`spaces/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`spaces/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    const placeId = r['placeId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push(`spaces/${id}.placeId: unknown place '${String(placeId)}'.`);
    }
    checkName('spaces', id, r);
    checkTags('spaces', id, r);
  }

  for (const [id, row] of Object.entries(views)) {
    if (!row || typeof row !== 'object') {
      errors.push(`views/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`views/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    const spaceId = r['spaceId'];
    if (typeof spaceId !== 'string' || !spaces[spaceId]) {
      errors.push(`views/${id}.spaceId: unknown space '${String(spaceId)}'.`);
    }
    checkName('views', id, r);
    const neighbors = r['neighbors'];
    if (Array.isArray(neighbors)) {
      if (neighbors.length > 12) errors.push(`views/${id}.neighbors: max 12 neighbors.`);
      for (const [i, neighbor] of neighbors.entries()) {
        if (typeof neighbor !== 'string' || !views[String(neighbor)]) {
          errors.push(`views/${id}.neighbors[${i}]: unknown view '${String(neighbor)}'.`);
        } else if (neighbor === id) {
          errors.push(`views/${id}.neighbors[${i}]: a view cannot neighbor itself.`);
        }
      }
    } else {
      errors.push(`views/${id}.neighbors: must be an array of view ids.`);
    }
    checkTags('views', id, r);
  }

  return errors;
}

/**
 * Semantic validation for the anchor/interaction content tables (#51 slice 4).
 * Every error identifies table/id/field so Content Studio (#52) can show
 * useful per-row feedback. Never repairs: invalid content fails loudly.
 */
export function validateWorldAnchors(tables: ContentTables): string[] {
  const errors: string[] = [];
  const views = tables['views'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const interactions = tables['interactions'] ?? {};

  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const checkName = (table: string, id: string, row: Record<string, unknown>): void => {
    const name = row['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
    }
  };
  const checkTags = (table: string, id: string, row: Record<string, unknown>): void => {
    const tags = row['tags'];
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be an array.`);
      return;
    }
    if (tags.length > 12) errors.push(`${table}/${id}.tags: max 12 tags.`);
    for (const tag of tags) {
      if (typeof tag !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(tag)) {
        errors.push(`${table}/${id}.tags: '${String(tag)}' must be a lowercase tag ≤ 24 chars.`);
      }
    }
  };

  for (const [id, row] of Object.entries(anchors)) {
    if (!row || typeof row !== 'object') {
      errors.push(`anchors/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`anchors/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    const viewId = r['viewId'];
    if (typeof viewId !== 'string' || !views[viewId]) {
      errors.push(`anchors/${id}.viewId: unknown view '${String(viewId)}'.`);
    }
    checkName('anchors', id, r);
    for (const axis of ['x', 'y']) {
      const v = r[axis];
      if (!num(v) || (v as number) < 0 || (v as number) > 1) {
        errors.push(`anchors/${id}.${axis}: must be a number in 0..1 view bounds.`);
      }
    }
    checkTags('anchors', id, r);
  }

  for (const [id, row] of Object.entries(interactions)) {
    if (!row || typeof row !== 'object') {
      errors.push(`interactions/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`interactions/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    const anchorId = r['anchorId'];
    if (typeof anchorId !== 'string' || !anchors[anchorId]) {
      errors.push(`interactions/${id}.anchorId: unknown anchor '${String(anchorId)}'.`);
    }
    const capability = r['capability'];
    if (typeof capability !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(capability)) {
      errors.push(`interactions/${id}.capability: must be a lowercase capability tag ≤ 24 chars.`);
    }
    checkName('interactions', id, r);
    checkTags('interactions', id, r);
  }

  return errors;
}

/**
 * Semantic validation for the asset content table (#51 slice 5), plus the
 * optional assetId references carried by items and views.
 * A normal-map reference must resolve to a *different* image-kind asset.
 * Every error identifies table/id/field for Content Studio (#52) feedback.
 */
export function validateWorldAssets(tables: ContentTables): string[] {
  const errors: string[] = [];
  const assets = tables['assets'] ?? {};
  const items = tables['items'] ?? {};
  const views = tables['views'] ?? {};

  const checkName = (table: string, id: string, row: Record<string, unknown>): void => {
    const name = row['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
    }
  };
  const checkTags = (table: string, id: string, row: Record<string, unknown>): void => {
    const tags = row['tags'];
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be an array.`);
      return;
    }
    if (tags.length > 12) errors.push(`${table}/${id}.tags: max 12 tags.`);
    for (const tag of tags) {
      if (typeof tag !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(tag)) {
        errors.push(`${table}/${id}.tags: '${String(tag)}' must be a lowercase tag ≤ 24 chars.`);
      }
    }
  };
  const checkAssetId = (table: string, id: string, value: unknown): void => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value !== 'string' || !assets[String(value)]) {
      errors.push(`${table}/${id}.assetId: unknown asset '${String(value)}'.`);
    }
  };

  for (const [id, row] of Object.entries(assets)) {
    if (!row || typeof row !== 'object') {
      errors.push(`assets/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`assets/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName('assets', id, r);
    const kind = r['kind'];
    if (typeof kind !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(kind)) {
      errors.push(`assets/${id}.kind: '${String(kind)}' must be a lowercase tag ≤ 24 chars.`);
    }
    const uri = r['uri'];
    if (typeof uri !== 'string' || !uri.trim() || uri.length > 200) {
      errors.push(`assets/${id}.uri: must be a non-empty reference <= 200 chars.`);
    }
    const normalId = r['normalMapAssetId'];
    if (normalId !== undefined && normalId !== null && normalId !== '') {
      if (typeof normalId !== 'string' || !assets[String(normalId)]) {
        errors.push(`assets/${id}.normalMapAssetId: unknown asset '${String(normalId)}'.`);
      } else if (normalId === id) {
        errors.push(`assets/${id}.normalMapAssetId: cannot reference itself.`);
      } else if ((assets[String(normalId)] as Record<string, unknown>)?.['kind'] !== 'image') {
        errors.push(`assets/${id}.normalMapAssetId: target '${String(normalId)}' must be an image asset.`);
      }
    }
    checkTags('assets', id, r);
  }

  for (const [id, row] of Object.entries(items)) {
    if (!row || typeof row !== 'object') continue;
    checkAssetId('items', id, (row as Record<string, unknown>)['assetId']);
  }
  for (const [id, row] of Object.entries(views)) {
    if (!row || typeof row !== 'object') continue;
    const value = (row as Record<string, unknown>)['assetId'];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || !assets[String(value)]) {
      errors.push(`views/${id}.assetId: unknown asset '${String(value)}'.`);
    } else if ((assets[String(value)] as Record<string, unknown>)?.['kind'] !== 'image') {
      errors.push(`views/${id}.assetId: asset '${String(value)}' must be an image asset to back a view.`);
    }
  }

  return errors;
}

/**
 * Semantic validation for the light/audio/ambient profile tables (#51 slice 6).
 * Every error identifies table/id/field so Content Studio (#52) can show
 * useful per-row feedback. Never repairs: invalid content fails loudly.
 */
export function validateWorldProfiles(tables: ContentTables): string[] {
  const errors: string[] = [];
  const assets = tables['assets'] ?? {};
  const lightProfiles = tables['lightProfiles'] ?? {};
  const audioProfiles = tables['audioProfiles'] ?? {};
  const ambientProfiles = tables['ambientProfiles'] ?? {};

  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const checkName = (table: string, id: string, row: Record<string, unknown>): void => {
    const name = row['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
    }
  };
  const checkTag = (table: string, id: string, field: string, value: unknown, optional: boolean): void => {
    if (optional && (value === undefined || value === null || value === '')) return;
    if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(value)) {
      errors.push(`${table}/${id}.${field}: '${String(value)}' must be a lowercase tag ≤ 24 chars.`);
    }
  };
  const checkTags = (table: string, id: string, row: Record<string, unknown>): void => {
    const tags = row['tags'];
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be an array.`);
      return;
    }
    if (tags.length > 12) errors.push(`${table}/${id}.tags: max 12 tags.`);
    for (const tag of tags) checkTag(table, id, 'tags', tag, false);
  };

  for (const [id, row] of Object.entries(lightProfiles)) {
    if (!row || typeof row !== 'object') {
      errors.push(`lightProfiles/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`lightProfiles/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName('lightProfiles', id, r);
    checkTag('lightProfiles', id, 'timeOfDay', r['timeOfDay'], true);
    const tint = r['colorTint'];
    if (tint !== undefined && tint !== null && tint !== '' && (typeof tint !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(tint))) {
      errors.push(`lightProfiles/${id}.colorTint: must be a #rrggbb hex code or empty.`);
    }
    if (!num(r['intensity']) || (r['intensity'] as number) < 0) {
      errors.push(`lightProfiles/${id}.intensity: must be a non-negative number.`);
    }
    checkTags('lightProfiles', id, r);
  }

  for (const [id, row] of Object.entries(audioProfiles)) {
    if (!row || typeof row !== 'object') {
      errors.push(`audioProfiles/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`audioProfiles/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName('audioProfiles', id, r);
    checkTag('audioProfiles', id, 'kind', r['kind'], false);
    const assetId = r['assetId'];
    if (assetId !== undefined && assetId !== null && assetId !== '' && (typeof assetId !== 'string' || !assets[String(assetId)])) {
      errors.push(`audioProfiles/${id}.assetId: unknown asset '${String(assetId)}'.`);
    }
    if (!num(r['volume']) || (r['volume'] as number) < 0 || (r['volume'] as number) > 1) {
      errors.push(`audioProfiles/${id}.volume: must be a number in 0..1.`);
    }
    checkTags('audioProfiles', id, r);
  }

  for (const [id, row] of Object.entries(ambientProfiles)) {
    if (!row || typeof row !== 'object') {
      errors.push(`ambientProfiles/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`ambientProfiles/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName('ambientProfiles', id, r);
    checkTag('ambientProfiles', id, 'weather', r['weather'], true);
    checkTag('ambientProfiles', id, 'timeOfDay', r['timeOfDay'], true);
    if (!num(r['density']) || (r['density'] as number) < 0) {
      errors.push(`ambientProfiles/${id}.density: must be a non-negative number.`);
    }
    checkTags('ambientProfiles', id, r);
  }

  return errors;
}

