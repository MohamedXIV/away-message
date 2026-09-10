// src/tools/content/codegen.ts
// Content → TypeScript codegen (pure, deterministic, testable).
// Reads TinyBase-shaped tables (see schema.ts), validates them against the
// same rules the engine enforces, and emits coreBuddies.generated.ts.
// The thin Node runner lives in tools/pull-content.ts (fs + argv only).

import type { HairColor, EyeColor } from '../../engine/types';

export type ContentTables = Record<string, Record<string, Record<string, unknown>>>;

export function validateCharacterId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'Character id must be a non-empty string.' };
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) {
    return { ok: false, error: 'Character id must be snake_case: start with a letter, a-z/0-9/_, 2..32 chars.' };
  }
  const reserved = ['player', 'system', 'you', 'me', 'unknown'];
  if (reserved.includes(id)) return { ok: false, error: `Character id '${id}' is reserved.` };
  return { ok: true };
}

/** Stable world-content ids (districts, places, stops, lines): same shape as character ids. */
export function validateWorldId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'World id must be a non-empty string.' };
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) {
    return { ok: false, error: 'World id must be snake_case: start with a letter, a-z/0-9/_, 2..32 chars.' };
  }
  return { ok: true };
}

const REACHES = new Set(['local', 'remote']);
const HAIR_COLORS = new Set<HairColor>([
  'black', 'dark_brown', 'brown', 'light_brown', 'blonde', 'auburn', 'red', 'grey', 'dyed_blue', 'dyed_pink', 'dyed_green'
]);
const EYE_COLORS = new Set<EyeColor>([
  'brown', 'dark_brown', 'hazel', 'blue', 'green', 'grey', 'amber'
]);
const ART_ENGINES = new Set(['live2d', 'mesh', 'none']);
const WORK_SHIFTS = new Set(['morning', 'day', 'evening', 'night', 'flexible']);
const BACKSTORY_RELATIONSHIPS = new Set(['stranger', 'acquaintance', 'friend', 'close', 'estranged']);
const CANDIDATE_STATUSES = new Set(['active', 'dead', 'changed']);
const LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'ja']);
const TRAIT_KEYS = ['shyness', 'warmth', 'discipline', 'spontaneity', 'loyalty'];
const HEART_KEYS = ['familiarity', 'trust', 'comfort', 'respect', 'annoyance', 'affection', 'attraction', 'suspicion', 'resentment'];

/** Parse raw JSON text into tables (structural check only). */
export function parseContentJson(raw: string): ContentTables {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('content/store.json is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('content/store.json must be a tables object.');
  }
  return parsed as ContentTables;
}

/** Semantic validation against engine rules. Returns error list (empty = valid). */
export function validateContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const characters = tables['characters'] ?? {};
  const archetypes = tables['archetypes'] ?? {};
  const temperaments = tables['temperaments'] ?? {};
  const initialAffinities = tables['initialAffinities'] ?? {};
  const backstories = tables['backstories'] ?? {};
  const routines = tables['routines'] ?? {};
  const artProfiles = tables['artProfiles'] ?? {};
  const affinitySeeds = tables['affinitySeeds'] ?? {};
  const dialoguePools = tables['dialoguePools'] ?? {};

  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const in100 = (v: unknown): boolean => num(v) && (v as number) >= 0 && (v as number) <= 100;

  // 1. Archetypes validation
  const archetypeIds = new Set(Object.keys(archetypes));
  if (archetypeIds.size === 0) {
    errors.push('archetypes: at least one archetype must be defined.');
  }
  for (const [archId, row] of Object.entries(archetypes)) {
    if (!row || typeof row !== 'object') {
      errors.push(`archetypes/${archId}: must be an object.`);
      continue;
    }
    const label = (row as Record<string, unknown>)['label'];
    if (typeof label !== 'string' || !label.trim()) errors.push(`archetypes/${archId}.label: required.`);
    const wpm = (row as Record<string, unknown>)['typingSpeedWpm'];
    if (!num(wpm) || (wpm as number) < 20 || (wpm as number) > 140) {
      errors.push(`archetypes/${archId}.typingSpeedWpm: must be 20..140.`);
    }
    for (const arrKey of ['vocabulary', 'defaultInterests']) {
      try {
        const arr = JSON.parse(String((row as Record<string, unknown>)[arrKey] ?? '[]'));
        if (!Array.isArray(arr)) errors.push(`archetypes/${archId}.${arrKey}: must be JSON array.`);
      } catch {
        errors.push(`archetypes/${archId}.${arrKey}: invalid JSON.`);
      }
    }
  }

  // 2. All roles declared on live characters
  const liveRoles = new Set<string>();
  for (const row of Object.values(characters)) {
    try {
      const parsed: unknown = JSON.parse(String((row as Record<string, unknown>)?.['roles'] ?? '[]'));
      if (Array.isArray(parsed)) {
        for (const r of parsed) if (typeof r === 'string') liveRoles.add(r);
      }
    } catch { /* reported per character */ }
  }

  // 3. Characters validation
  for (const [id, row] of Object.entries(characters)) {
    if (!row || typeof row !== 'object') {
      errors.push(`characters/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateCharacterId(id);
    if (!idCheck.ok) errors.push(`characters/${id}: ${idCheck.error}`);
    const role = (row as Record<string, unknown>)['role'];
    if (typeof role !== 'string' || !role.trim()) {
      errors.push(`characters/${id}.role: must be a non-empty stable role key.`);
    } else {
      const clash = Object.entries(characters).find(
        ([otherId, other]) => otherId !== id && (other as Record<string, unknown>)?.['role'] === role
      );
      if (clash) errors.push(`characters/${id}.role: duplicate role '${role}' (also on ${clash[0]}).`);
    }

    const str = (k: string, max: number): string | null => {
      const v = (row as Record<string, unknown>)[k];
      if (typeof v !== 'string' || !v.trim() || v.length > max) {
        errors.push(`characters/${id}.${k}: must be a non-empty string <= ${max} chars.`);
        return null;
      }
      return v;
    };
    str('displayName', 40);

    const archId = (row as Record<string, unknown>)['archetypeId'];
    if (typeof archId !== 'string' || !archetypeIds.has(archId)) {
      errors.push(`characters/${id}.archetypeId: unknown archetype '${String(archId)}'.`);
    }

    if (typeof (row as Record<string, unknown>)['reach'] !== 'string' || !REACHES.has(String((row as Record<string, unknown>)['reach']))) {
      errors.push(`characters/${id}.reach: must be local|remote.`);
    }

    const hair = String((row as Record<string, unknown>)['hair'] ?? '');
    if (!HAIR_COLORS.has(hair as HairColor)) {
      errors.push(`characters/${id}.hair: unknown hair color '${hair}'.`);
    }

    const eyes = String((row as Record<string, unknown>)['eyes'] ?? '');
    if (!EYE_COLORS.has(eyes as EyeColor)) {
      errors.push(`characters/${id}.eyes: unknown eye color '${eyes}'.`);
    }

    const chatColor = String((row as Record<string, unknown>)['chatColor'] ?? '');
    if (!/^#[0-9a-fA-F]{6}$/.test(chatColor)) {
      errors.push(`characters/${id}.chatColor: must be #rrggbb hex code.`);
    }

    const bio = (row as Record<string, unknown>)['bio'];
    if (typeof bio !== 'string' || bio.length > 500) {
      errors.push(`characters/${id}.bio: must be string <= 500 chars.`);
    }

    const wpm = (row as Record<string, unknown>)['typingSpeedWpm'];
    if (!num(wpm) || (wpm as number) < 20 || (wpm as number) > 140) {
      errors.push(`characters/${id}.typingSpeedWpm: must be 20..140.`);
    }

    // Roles capability tags
    let roles: unknown = [];
    try {
      roles = JSON.parse(String((row as Record<string, unknown>)['roles'] ?? '[]'));
    } catch {
      errors.push(`characters/${id}.roles: invalid JSON array.`);
      roles = null;
    }
    if (Array.isArray(roles)) {
      if (roles.length > 8) errors.push(`characters/${id}.roles: max 8 roles.`);
      for (const r of roles) {
        if (typeof r !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(r)) {
          errors.push(`characters/${id}.roles: '${String(r)}' must be lowercase tag ≤ 24 chars.`);
        }
      }
    } else if (roles !== null) {
      errors.push(`characters/${id}.roles: must be a JSON array.`);
    }

    // Languages
    let languages: unknown = null;
    try {
      languages = JSON.parse(String((row as Record<string, unknown>)['languages'] ?? '[]'));
    } catch {
      errors.push(`characters/${id}.languages: invalid JSON array.`);
    }
    if (Array.isArray(languages)) {
      if (languages.length === 0 || languages.length > 3) errors.push(`characters/${id}.languages: needs 1..3 entries.`);
      for (const [i, entry] of languages.entries()) {
        const lang = (entry as Record<string, unknown>)?.['lang'];
        const level = (entry as Record<string, unknown>)?.['level'];
        if (typeof lang !== 'string' || !LANGS.has(lang)) errors.push(`characters/${id}.languages[${i}].lang: unknown language.`);
        if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 5) {
          errors.push(`characters/${id}.languages[${i}].level: must be int 1..5.`);
        }
      }
    } else if (languages !== null) {
      errors.push(`characters/${id}.languages: must be a JSON array.`);
    }

    // Temperaments row check
    const trow = temperaments[id];
    if (!trow || typeof trow !== 'object') {
      errors.push(`temperaments/${id}: missing row.`);
    } else {
      for (const k of TRAIT_KEYS) {
        if (!in100((trow as Record<string, unknown>)[k])) errors.push(`temperaments/${id}.${k}: must be 0..100.`);
      }
    }

    // Initial Affinities row check
    const arow = initialAffinities[id];
    if (!arow || typeof arow !== 'object') {
      errors.push(`initialAffinities/${id}: missing row.`);
    } else {
      for (const k of HEART_KEYS) {
        if (!in100((arow as Record<string, unknown>)[k])) errors.push(`initialAffinities/${id}.${k}: must be 0..100.`);
      }
    }

    // Routines row check
    const rrow = routines[id];
    if (!rrow || typeof rrow !== 'object') {
      errors.push(`routines/${id}: missing row.`);
    } else {
      const wake = (rrow as Record<string, unknown>)['wakeMinute'];
      const sleep = (rrow as Record<string, unknown>)['sleepMinute'];
      const shift = (rrow as Record<string, unknown>)['workShift'];
      if (!Number.isInteger(wake) || (wake as number) < 0 || (wake as number) > 1439) {
        errors.push(`routines/${id}.wakeMinute: must be 0..1439.`);
      }
      if (!Number.isInteger(sleep) || (sleep as number) < 0 || (sleep as number) > 1439) {
        errors.push(`routines/${id}.sleepMinute: must be 0..1439.`);
      }
      if (typeof shift !== 'string' || !WORK_SHIFTS.has(shift)) {
        errors.push(`routines/${id}.workShift: must be morning|day|evening|night|flexible.`);
      }
    }

    // Art profile check
    const artRow = artProfiles[id];
    if (artRow && typeof artRow === 'object') {
      const engine = (artRow as Record<string, unknown>)['engine'];
      if (typeof engine !== 'string' || !ART_ENGINES.has(engine)) {
        errors.push(`artProfiles/${id}.engine: must be live2d|mesh|none.`);
      }
    }
  }

  // 4. Backstories validation
  for (const [id, row] of Object.entries(backstories)) {
    if (!characters[id]) {
      errors.push(`backstories/${id}: no matching characters row.`);
      continue;
    }
    if (!row || typeof row !== 'object') {
      errors.push(`backstories/${id}: must be an object.`);
      continue;
    }
    const rel = (row as Record<string, unknown>)['relationship'];
    if (typeof rel !== 'string' || !BACKSTORY_RELATIONSHIPS.has(rel)) {
      errors.push(`backstories/${id}.relationship: must be stranger|acquaintance|friend|close|estranged.`);
    }
    const label = (row as Record<string, unknown>)['label'];
    if (typeof label !== 'string' || label.length > 60) errors.push(`backstories/${id}.label: must be ≤ 60 chars.`);
    const lapse = (row as Record<string, unknown>)['lapseDays'];
    if (!Number.isInteger(lapse) || (lapse as number) < 0) errors.push(`backstories/${id}.lapseDays: must be int ≥ 0.`);
    if (typeof (row as Record<string, unknown>)['knowsAccounts'] !== 'boolean') {
      errors.push(`backstories/${id}.knowsAccounts: must be boolean.`);
    }
    let candidates: unknown = null;
    try {
      candidates = JSON.parse(String((row as Record<string, unknown>)['candidates'] ?? ''));
    } catch {
      errors.push(`backstories/${id}.candidates: invalid JSON array.`);
    }
    if (Array.isArray(candidates)) {
      if (candidates.length > 3) errors.push(`backstories/${id}.candidates: max 3.`);
      for (const [i, c] of candidates.entries()) {
        const handle = (c as Record<string, unknown>)?.['handle'];
        const status = (c as Record<string, unknown>)?.['status'];
        if (typeof handle !== 'string' || !handle.trim() || handle.length > 40) {
          errors.push(`backstories/${id}.candidates[${i}].handle: must be non-empty ≤ 40.`);
        }
        if (typeof status !== 'string' || !CANDIDATE_STATUSES.has(status)) {
          errors.push(`backstories/${id}.candidates[${i}].status: must be active|dead|changed.`);
        }
      }
    } else if (candidates !== null) {
      errors.push(`backstories/${id}.candidates: must be a JSON array.`);
    }
    const bio = (row as Record<string, unknown>)['bioSeed'];
    if (typeof bio !== 'string' || bio.length > 200) errors.push(`backstories/${id}.bioSeed: must be ≤ 200 chars.`);
  }

  // Orphan checks for relational tables
  for (const tid of Object.keys(temperaments)) {
    if (!characters[tid]) errors.push(`temperaments/${tid}: orphan row (no matching character).`);
  }
  for (const aid of Object.keys(initialAffinities)) {
    if (!characters[aid]) errors.push(`initialAffinities/${aid}: orphan row (no matching character).`);
  }
  for (const rid of Object.keys(routines)) {
    if (!characters[rid]) errors.push(`routines/${rid}: orphan row (no matching character).`);
  }
  for (const pid of Object.keys(artProfiles)) {
    if (!characters[pid]) errors.push(`artProfiles/${pid}: orphan row (no matching character).`);
  }
  for (const bid of Object.keys(backstories)) {
    if (!characters[bid]) errors.push(`backstories/${bid}: orphan row (no matching character).`);
  }

  // 5. Affinity seeds
  for (const [key, row] of Object.entries(affinitySeeds)) {
    if (!row || typeof row !== 'object') {
      errors.push(`affinitySeeds/${key}: must be an object.`);
      continue;
    }
    const roleA = (row as Record<string, unknown>)['roleA'];
    const roleB = (row as Record<string, unknown>)['roleB'];
    const value = (row as Record<string, unknown>)['value'];
    if (typeof roleA !== 'string' || !roleA) errors.push(`affinitySeeds/${key}.roleA: required.`);
    else if (!liveRoles.has(roleA)) errors.push(`affinitySeeds/${key}.roleA: unknown role '${roleA}'.`);
    if (typeof roleB !== 'string' || !roleB) errors.push(`affinitySeeds/${key}.roleB: required.`);
    else if (!liveRoles.has(roleB)) errors.push(`affinitySeeds/${key}.roleB: unknown role '${roleB}'.`);
    if (!Number.isInteger(value) || (value as number) < -100 || (value as number) > 100) {
      errors.push(`affinitySeeds/${key}.value: must be int -100..100.`);
    }
  }

  // 6. Dialogue pools
  for (const [key, row] of Object.entries(dialoguePools)) {
    if (!row || typeof row !== 'object') {
      errors.push(`dialoguePools/${key}: must be an object.`);
      continue;
    }
    let lines: unknown = null;
    try {
      lines = JSON.parse(String((row as Record<string, unknown>)['lines'] ?? ''));
    } catch {
      errors.push(`dialoguePools/${key}.lines: invalid JSON.`);
    }
    if (Array.isArray(lines)) {
      if (lines.length === 0 || lines.length > 12) errors.push(`dialoguePools/${key}.lines: needs 1..12 lines.`);
      for (const [i, line] of lines.entries()) {
        if (typeof line !== 'string' || !line.trim() || line.length > 300) {
          errors.push(`dialoguePools/${key}.lines[${i}]: must be a non-empty string <= 300 chars.`);
        }
      }
    } else if (lines !== null) {
      errors.push(`dialoguePools/${key}.lines: must be a JSON array.`);
    }
    const version = (row as Record<string, unknown>)['version'];
    if (!Number.isInteger(version) || (version as number) < 1) errors.push(`dialoguePools/${key}.version: must be an int >= 1.`);
  }

  // 7. World content (districts / places / transit stops / bus lines, #51 slice 1).
  // Absent tables validate clean so character-only stores (e.g. Studio
  // hydration from the character registry) keep passing.
  errors.push(...validateWorldContent(tables));

  // 8. World items/containers (#51 slice 2). Definition-only: no instance
  // state (location, contents, owner, stock) belongs in these tables.
  errors.push(...validateWorldItems(tables));

  // 9. World spaces/views (#51 slice 3). Renderer-neutral authored
  // hierarchy: a view is not a Phaser Scene.
  errors.push(...validateWorldSpaces(tables));

  // 10. World anchors/interactions (#51 slice 4). Authored placement and
  // capability bindings only; runtime interaction state stays out.
  errors.push(...validateWorldAnchors(tables));

  return errors;
}

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
  const parseJsonArray = (table: string, id: string, field: string, raw: unknown): unknown[] | null => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(raw ?? '[]'));
    } catch {
      errors.push(`${table}/${id}.${field}: invalid JSON array.`);
      return null;
    }
    if (!Array.isArray(parsed)) {
      errors.push(`${table}/${id}.${field}: must be a JSON array.`);
      return null;
    }
    return parsed;
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
    const tags = parseJsonArray('districts', id, 'tags', r['tags']);
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
    const access = parseJsonArray('places', id, 'transitAccess', r['transitAccess']);
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
    const stopIds = parseJsonArray('busLines', id, 'stopIds', r['stopIds']);
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
    const segments = parseJsonArray('busLines', id, 'segmentMinutes', r['segmentMinutes']);
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
    let tags: unknown = null;
    try {
      tags = JSON.parse(String(row['tags'] ?? '[]'));
    } catch {
      errors.push(`${table}/${id}.tags: invalid JSON array.`);
      return;
    }
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be a JSON array.`);
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
    let kinds: unknown = null;
    try {
      kinds = JSON.parse(String(r['allowedItemKinds'] ?? '[]'));
    } catch {
      errors.push(`containers/${id}.allowedItemKinds: invalid JSON array.`);
      kinds = null;
    }
    if (Array.isArray(kinds)) {
      if (kinds.length > 24) errors.push(`containers/${id}.allowedItemKinds: max 24 kinds.`);
      for (const kind of kinds) checkTag('containers', id, 'allowedItemKinds', kind);
    } else if (kinds !== null) {
      errors.push(`containers/${id}.allowedItemKinds: must be a JSON array ([] = unrestricted).`);
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
    let tags: unknown = null;
    try {
      tags = JSON.parse(String(row['tags'] ?? '[]'));
    } catch {
      errors.push(`${table}/${id}.tags: invalid JSON array.`);
      return;
    }
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be a JSON array.`);
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
    let neighbors: unknown = null;
    try {
      neighbors = JSON.parse(String(r['neighbors'] ?? '[]'));
    } catch {
      errors.push(`views/${id}.neighbors: invalid JSON array.`);
      neighbors = null;
    }
    if (Array.isArray(neighbors)) {
      if (neighbors.length > 12) errors.push(`views/${id}.neighbors: max 12 neighbors.`);
      for (const [i, neighbor] of neighbors.entries()) {
        if (typeof neighbor !== 'string' || !views[String(neighbor)]) {
          errors.push(`views/${id}.neighbors[${i}]: unknown view '${String(neighbor)}'.`);
        } else if (neighbor === id) {
          errors.push(`views/${id}.neighbors[${i}]: a view cannot neighbor itself.`);
        }
      }
    } else if (neighbors !== null) {
      errors.push(`views/${id}.neighbors: must be a JSON array of view ids.`);
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
    let tags: unknown = null;
    try {
      tags = JSON.parse(String(row['tags'] ?? '[]'));
    } catch {
      errors.push(`${table}/${id}.tags: invalid JSON array.`);
      return;
    }
    if (!Array.isArray(tags)) {
      errors.push(`${table}/${id}.tags: must be a JSON array.`);
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

/** Stable 8-hex digest of canonical tables (the content version stamp). */
export function contentHash(tables: ContentTables): string {
  const str = JSON.stringify(canonicalize(tables));
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 8);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function tsString(value: string): string {
  return JSON.stringify(value);
}

/** Emit one character's backstory literal (or null when the store has no row). */
function emitBackstory(row: unknown): string {
  if (!row || typeof row !== 'object') return 'null';
  const r = row as Record<string, unknown>;
  let candidates: Array<{ handle: string; status: string; note?: string }> = [];
  try {
    const parsed: unknown = JSON.parse(String(r['candidates'] ?? '[]'));
    if (Array.isArray(parsed)) {
      candidates = parsed
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          handle: String(c['handle'] ?? ''),
          status: String(c['status'] ?? 'dead'),
          ...(typeof c['note'] === 'string' && c['note'] ? { note: String(c['note']).slice(0, 80) } : {}),
        }));
    }
  } catch { candidates = []; }
  const cand = candidates.map((c) =>
    `{ handle: ${tsString(c.handle)}, status: ${tsString(c.status)}${c.note !== undefined ? `, note: ${tsString(c.note)}` : ''} }`
  ).join(', ');
  return `{ relationship: ${tsString(String(r['relationship'] ?? 'stranger'))}, label: ${tsString(String(r['label'] ?? ''))}, lapseDays: ${Number(r['lapseDays'] ?? 0)}, knowsAccounts: ${r['knowsAccounts'] === true ? 'true' : 'false'}, candidates: [${cand}], bioSeed: ${tsString(String(r['bioSeed'] ?? ''))} }`;
}

/** Emit the registry TypeScript source. */
export function generateRegistrySource(tables: ContentTables): string {
  const version = contentHash(tables);
  const characters = tables['characters'] ?? {};
  const archetypes = tables['archetypes'] ?? {};
  const temperaments = tables['temperaments'] ?? {};
  const initialAffinities = tables['initialAffinities'] ?? {};
  const backstories = tables['backstories'] ?? {};
  const routines = tables['routines'] ?? {};
  const artProfiles = tables['artProfiles'] ?? {};
  const affinitySeeds = tables['affinitySeeds'] ?? {};
  const dialoguePools = tables['dialoguePools'] ?? {};

  const lines: string[] = [];
  lines.push('// GENERATED — do not edit by hand.');
  lines.push(`// Source: content/store.json (content v${version}). Regenerate: npm run content:pull.`);
  lines.push(`export const CONTENT_VERSION = '${version}';`);
  lines.push('');

  // Emit Archetype definitions
  lines.push('export interface GeneratedArchetypeDef {');
  lines.push('  id: string;');
  lines.push('  label: string;');
  lines.push('  description: string;');
  lines.push('  personaHint: string;');
  lines.push('  vocabulary: string[];');
  lines.push('  defaultInterests: string[];');
  lines.push('  defaultSong: string;');
  lines.push('  typingSpeedWpm: number;');
  lines.push('}');
  lines.push('');
  lines.push('export const GENERATED_ARCHETYPES: GeneratedArchetypeDef[] = [');
  for (const [archId, row] of Object.entries(archetypes)) {
    const r = row as Record<string, unknown>;
    const vocab = JSON.parse(String(r['vocabulary'] ?? '[]')) as string[];
    const interests = JSON.parse(String(r['defaultInterests'] ?? '[]')) as string[];
    lines.push('  {');
    lines.push(`    id: ${tsString(archId)},`);
    lines.push(`    label: ${tsString(String(r['label'] ?? ''))},`);
    lines.push(`    description: ${tsString(String(r['description'] ?? ''))},`);
    lines.push(`    personaHint: ${tsString(String(r['personaHint'] ?? ''))},`);
    lines.push(`    vocabulary: [${vocab.map((v) => tsString(v)).join(', ')}],`);
    lines.push(`    defaultInterests: [${interests.map((i) => tsString(i)).join(', ')}],`);
    lines.push(`    defaultSong: ${tsString(String(r['defaultSong'] ?? ''))},`);
    lines.push(`    typingSpeedWpm: ${Number(r['typingSpeedWpm'] ?? 70)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  // Emit Character definitions
  lines.push('export interface GeneratedCharacterDef {');
  lines.push('  id: string;');
  lines.push('  role: string;');
  lines.push('  displayName: string;');
  lines.push('  archetypeId: string;');
  lines.push('  roles: string[];');
  lines.push("  reach: 'local' | 'remote';");
  lines.push('  hair: string;');
  lines.push('  eyes: string;');
  lines.push('  chatColor: string;');
  lines.push('  bio: string;');
  lines.push('  typingSpeedWpm: number;');
  lines.push('  languages: Array<{ lang: string; level: number }>;');
  lines.push('  backstory: { relationship: string; label: string; lapseDays: number; knowsAccounts: boolean; candidates: Array<{ handle: string; status: string; note?: string }>; bioSeed: string } | null;');
  lines.push('  temperament: { shyness: number; warmth: number; discipline: number; spontaneity: number; loyalty: number };');
  lines.push('  initialAffinity: { familiarity: number; trust: number; comfort: number; respect: number; annoyance: number; affection: number; attraction: number; suspicion: number; resentment: number };');
  lines.push('  routine: { wakeMinute: number; sleepMinute: number; workShift: string; preferredHangout: string };');
  lines.push('  art: { engine: string; modelPath: string; expressions: Record<string, string>; defaultOutfit: string };');
  lines.push('}');
  lines.push('');
  lines.push('export const GENERATED_CHARACTERS: GeneratedCharacterDef[] = [');

  for (const id of Object.keys(characters)) {
    const row = characters[id] as Record<string, unknown>;
    const trow = (temperaments[id] ?? {}) as Record<string, unknown>;
    const arow = (initialAffinities[id] ?? {}) as Record<string, unknown>;
    const rrow = (routines[id] ?? {}) as Record<string, unknown>;
    const artRow = (artProfiles[id] ?? {}) as Record<string, unknown>;

    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    role: ${tsString(String(row['role'] ?? ''))},`);
    lines.push(`    displayName: ${tsString(String(row['displayName'] ?? ''))},`);
    lines.push(`    archetypeId: ${tsString(String(row['archetypeId'] ?? 'regular'))},`);
    let roles: string[] = [];
    try {
      const parsed: unknown = JSON.parse(String(row['roles'] ?? '[]'));
      if (Array.isArray(parsed)) roles = parsed.filter((x): x is string => typeof x === 'string');
    } catch { roles = []; }
    lines.push(`    roles: [${roles.map((x) => tsString(x)).join(', ')}],`);
    lines.push(`    reach: ${tsString(String(row['reach'] ?? 'local'))} as 'local' | 'remote',`);
    lines.push(`    hair: ${tsString(String(row['hair'] ?? 'brown'))},`);
    lines.push(`    eyes: ${tsString(String(row['eyes'] ?? 'brown'))},`);
    lines.push(`    chatColor: ${tsString(String(row['chatColor'] ?? '#6a3fa0'))},`);
    lines.push(`    bio: ${tsString(String(row['bio'] ?? ''))},`);
    lines.push(`    typingSpeedWpm: ${Number(row['typingSpeedWpm'] ?? 60)},`);
    let languages: Array<{ lang: string; level: number }> = [];
    try {
      const parsed: unknown = JSON.parse(String(row['languages'] ?? '[]'));
      if (Array.isArray(parsed)) {
        languages = parsed
          .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
          .map((e) => ({ lang: String(e['lang'] ?? 'en'), level: Number(e['level'] ?? 1) }));
      }
    } catch { languages = []; }
    lines.push(`    languages: [${languages.map((l) => `{ lang: ${tsString(l.lang)}, level: ${l.level} }`).join(', ')}],`);
    lines.push(`    backstory: ${emitBackstory(backstories[id])},`);
    const numList = (keys: string[], src: Record<string, unknown>): string =>
      keys.map((k) => `${k}: ${Number(src[k] ?? 0)}`).join(', ');
    lines.push(`    temperament: { ${numList(TRAIT_KEYS, trow)} },`);
    lines.push(`    initialAffinity: { ${numList(HEART_KEYS, arow)} },`);
    lines.push(`    routine: { wakeMinute: ${Number(rrow['wakeMinute'] ?? 420)}, sleepMinute: ${Number(rrow['sleepMinute'] ?? 1380)}, workShift: ${tsString(String(rrow['workShift'] ?? 'day'))}, preferredHangout: ${tsString(String(rrow['preferredHangout'] ?? 'cafe'))} },`);

    let expressions: Record<string, string> = {};
    try {
      expressions = JSON.parse(String(artRow['expressions'] ?? '{}'));
    } catch { expressions = {}; }
    lines.push(`    art: { engine: ${tsString(String(artRow['engine'] ?? 'none'))}, modelPath: ${tsString(String(artRow['modelPath'] ?? ''))}, expressions: ${JSON.stringify(expressions)}, defaultOutfit: ${tsString(String(artRow['defaultOutfit'] ?? 'default'))} },`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  // Emit Dialogue Pools
  lines.push('export interface GeneratedDialoguePool {');
  lines.push('  key: string;');
  lines.push('  lines: string[];');
  lines.push('  version: number;');
  lines.push('}');
  lines.push('');
  lines.push('export const GENERATED_DIALOGUE_POOLS: GeneratedDialoguePool[] = [');
  for (const key of Object.keys(dialoguePools).sort()) {
    const row = dialoguePools[key] as Record<string, unknown>;
    const parsed = JSON.parse(String(row['lines'] ?? '[]')) as string[];
    lines.push('  {');
    lines.push(`    key: ${tsString(key)},`);
    lines.push(`    lines: [${parsed.map((l) => tsString(l)).join(', ')}],`);
    lines.push(`    version: ${Number(row['version'] ?? 1)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  // Emit Affinity Seeds
  lines.push('export interface GeneratedAffinitySeed {');
  lines.push('  roleA: string;');
  lines.push('  roleB: string;');
  lines.push('  value: number;');
  lines.push('}');
  lines.push('');
  lines.push('export const GENERATED_AFFINITY_SEEDS: GeneratedAffinitySeed[] = [');
  for (const key of Object.keys(affinitySeeds).sort()) {
    const row = affinitySeeds[key] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    roleA: ${tsString(String(row['roleA'] ?? ''))},`);
    lines.push(`    roleB: ${tsString(String(row['roleB'] ?? ''))},`);
    lines.push(`    value: ${Number(row['value'] ?? 0)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  return lines.join('\n');
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
  const items = tables['items'] ?? {};
  const containers = tables['containers'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const interactions = tables['interactions'] ?? {};

  const lines: string[] = [];
  lines.push('// GENERATED — do not edit by hand.');
  lines.push(`// Source: content/store.json (content v${version}). Regenerate: npm run content:pull.`);
  lines.push(`export const WORLD_CONTENT_VERSION = '${version}';`);
  lines.push('');
  lines.push('export interface GeneratedDistrictDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  mapX: number;');
  lines.push('  mapY: number;');
  lines.push('  tags: string[];');
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
    let tags: string[] = [];
    try {
      const parsed: unknown = JSON.parse(String(r['tags'] ?? '[]'));
      if (Array.isArray(parsed)) tags = parsed.filter((x): x is string => typeof x === 'string');
    } catch { tags = []; }
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    mapX: ${Number(r['mapX'] ?? 0)},`);
    lines.push(`    mapY: ${Number(r['mapY'] ?? 0)},`);
    lines.push(`    tags: [${tags.map((t) => tsString(t)).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_PLACES: GeneratedPlaceDef[] = [');
  for (const id of Object.keys(places).sort()) {
    const r = places[id] as Record<string, unknown>;
    let access: Array<{ stopId: string; walkMinutes: number }> = [];
    try {
      const parsed: unknown = JSON.parse(String(r['transitAccess'] ?? '[]'));
      if (Array.isArray(parsed)) {
        access = parsed
          .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
          .map((e) => ({ stopId: String(e['stopId'] ?? ''), walkMinutes: Number(e['walkMinutes'] ?? 0) }));
      }
    } catch { access = []; }
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    districtId: ${tsString(String(r['districtId'] ?? ''))},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    transitAccess: [${access.map((a) => `{ stopId: ${tsString(a.stopId)}, walkMinutes: ${a.walkMinutes} }`).join(', ')}],`);
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
    const strArr = (v: unknown): string[] => {
      try {
        const parsed: unknown = JSON.parse(String(v ?? '[]'));
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
      } catch { return []; }
    };
    const numArr = (v: unknown): number[] => {
      try {
        const parsed: unknown = JSON.parse(String(v ?? '[]'));
        return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : [];
      } catch { return []; }
    };
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

  const strArr = (v: unknown): string[] => {
    try {
      const parsed: unknown = JSON.parse(String(v ?? '[]'));
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  };

  lines.push('export const GENERATED_ITEMS: GeneratedItemDef[] = [');
  for (const id of Object.keys(items).sort()) {
    const r = items[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(r['name'] ?? ''))},`);
    lines.push(`    kind: ${tsString(String(r['kind'] ?? 'misc'))},`);
    lines.push(`    portable: ${r['portable'] === true ? 'true' : 'false'},`);
    lines.push(`    volume: ${Number(r['volume'] ?? 0)},`);
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
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedViewDef {');
  lines.push('  id: string;');
  lines.push('  spaceId: string;');
  lines.push('  name: string;');
  lines.push('  neighbors: string[];');
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

  return lines.join('\n');
}
