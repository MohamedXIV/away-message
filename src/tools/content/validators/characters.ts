// Character-domain semantic validation.
// Phase A (#99): behavior-preserving extraction from codegen.ts.

import type { HairColor, EyeColor } from '../../../engine/types';
import { HEART_KEYS, TRAIT_KEYS } from '../domain/characters';
import type { ContentTables } from '../shared';
import { validateCharacterId } from '../shared';

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

/** Semantic validation against engine rules. Returns error list (empty = valid). */
export function validateCharacterContent(tables: ContentTables): string[] {
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
      const arr = (row as Record<string, unknown>)[arrKey];
      if (!Array.isArray(arr)) errors.push(`archetypes/${archId}.${arrKey}: must be an array.`);
    }
  }

  // 2. Capability roles declared on live characters
  const liveRoles = new Set<string>();
  for (const row of Object.values(characters)) {
    const roles = (row as Record<string, unknown>)?.['roles'];
    if (Array.isArray(roles)) {
      for (const role of roles) if (typeof role === 'string') liveRoles.add(role);
    }
  }

  // 3. Characters validation
  for (const [id, row] of Object.entries(characters)) {
    if (!row || typeof row !== 'object') {
      errors.push(`characters/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateCharacterId(id);
    if (!idCheck.ok) errors.push(`characters/${id}: ${idCheck.error}`);
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
    const roles = (row as Record<string, unknown>)['roles'];
    if (Array.isArray(roles)) {
      if (roles.length > 8) errors.push(`characters/${id}.roles: max 8 roles.`);
      for (const r of roles) {
        if (typeof r !== 'string' || !/^[a-z][a-z0-9_-]{1,23}$/.test(r)) {
          errors.push(`characters/${id}.roles: '${String(r)}' must be lowercase tag ≤ 24 chars.`);
        }
      }
    } else {
      errors.push(`characters/${id}.roles: must be an array.`);
    }

    // Languages
    const languages = (row as Record<string, unknown>)['languages'];
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
    } else {
      errors.push(`characters/${id}.languages: must be an array.`);
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
    const candidates = (row as Record<string, unknown>)['candidates'];
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
    } else {
      errors.push(`backstories/${id}.candidates: must be an array.`);
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
    const lines = (row as Record<string, unknown>)['lines'];
    if (Array.isArray(lines)) {
      if (lines.length === 0 || lines.length > 12) errors.push(`dialoguePools/${key}.lines: needs 1..12 lines.`);
      for (const [i, line] of lines.entries()) {
        if (typeof line !== 'string' || !line.trim() || line.length > 300) {
          errors.push(`dialoguePools/${key}.lines[${i}]: must be a non-empty string <= 300 chars.`);
        }
      }
    } else {
      errors.push(`dialoguePools/${key}.lines: must be an array.`);
    }
    const version = (row as Record<string, unknown>)['version'];
    if (!Number.isInteger(version) || (version as number) < 1) errors.push(`dialoguePools/${key}.version: must be an int >= 1.`);
  }

  return errors;
}
