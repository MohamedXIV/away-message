// src/tools/content/codegen.ts
// Content → TypeScript codegen (pure, deterministic, testable).
// Reads TinyBase-shaped tables (see schema.ts), validates them against the
// same rules the engine enforces, and emits coreBuddies.generated.ts.
// The thin Node runner lives in tools/pull-content.ts (fs + argv only).

import { listArchetypes, validateCharacterId } from '../../engine/characterTemplates';

export type ContentTables = Record<string, Record<string, Record<string, unknown>>>;

const BUDDY_STATUSES = new Set(['stranger', 'acquaintance', 'friend', 'close', 'distant', 'gone', 'blocked']);
const BUDDY_METVIA = new Set(['nightboard', 'myplace', 'pulse-room', 'work', 'intro', 'core']);
const BLOCK_STATUSES = new Set(['online', 'away', 'busy', 'offline']);
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
  const buddies = tables['buddies'] ?? {};
  const traits = tables['buddyTraits'] ?? {};
  const hearts = tables['buddyHearts'] ?? {};
  const schedules = tables['buddySchedules'] ?? {};
  const pools = tables['pools'] ?? {};
  const archetypes = new Set(listArchetypes());

  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const in100 = (v: unknown): boolean => num(v) && (v as number) >= 0 && (v as number) <= 100;

  for (const [id, row] of Object.entries(buddies)) {
    if (!row || typeof row !== 'object') {
      errors.push(`buddies/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateCharacterId(id);
    if (!idCheck.ok) errors.push(`buddies/${id}: ${idCheck.error}`);
    const role = (row as Record<string, unknown>)['role'];
    if (typeof role !== 'string' || !role.trim()) {
      errors.push(`buddies/${id}.role: must be a non-empty stable role key.`);
    } else {
      const clash = Object.entries(buddies).find(
        ([otherId, other]) => otherId !== id && (other as Record<string, unknown>)?.['role'] === role
      );
      if (clash) errors.push(`buddies/${id}.role: duplicate role '${role}' (also on ${clash[0]}).`);
    }
    const formerRaw = (row as Record<string, unknown>)['formerIds'];
    let former: unknown = [];
    try {
      former = JSON.parse(String(formerRaw ?? '[]'));
    } catch {
      errors.push(`buddies/${id}.formerIds: invalid JSON array.`);
      former = null;
    }
    if (Array.isArray(former)) {
      const liveIds = new Set(Object.keys(buddies));
      const liveHandles = new Set(
        Object.values(buddies).map((r) => String((r as Record<string, unknown>)?.['handle'] ?? ''))
      );
      for (const old of former) {
        if (typeof old !== 'string' || !validateCharacterId(old).ok) {
          errors.push(`buddies/${id}.formerIds: '${String(old)}' is not a valid id.`);
        } else if (liveIds.has(old) || liveHandles.has(old)) {
          errors.push(`buddies/${id}.formerIds: '${old}' collides with a live id/handle.`);
        }
      }
    } else if (former !== null) {
      errors.push(`buddies/${id}.formerIds: must be a JSON array.`);
    }
    const str = (k: string, max: number): string | null => {
      const v = (row as Record<string, unknown>)[k];
      if (typeof v !== 'string' || !v.trim() || v.length > max) {
        errors.push(`buddies/${id}.${k}: must be a non-empty string <= ${max} chars.`);
        return null;
      }
      return v;
    };
    str('displayName', 40);
    str('handle', 40);
    const myplace = (row as Record<string, unknown>)['myplace'];
    if (typeof myplace !== 'string' || myplace.length > 40) errors.push(`buddies/${id}.myplace: must be a string <= 40 chars.`);
    const arch = (row as Record<string, unknown>)['archetype'];
    if (typeof arch !== 'string' || !archetypes.has(arch as never)) {
      errors.push(`buddies/${id}.archetype: unknown archetype '${String(arch)}'.`);
    }
    if (typeof (row as Record<string, unknown>)['status'] !== 'string' || !BUDDY_STATUSES.has(String((row as Record<string, unknown>)['status']))) {
      errors.push(`buddies/${id}.status: unknown lifecycle status.`);
    }
    if (typeof (row as Record<string, unknown>)['metVia'] !== 'string' || !BUDDY_METVIA.has(String((row as Record<string, unknown>)['metVia']))) {
      errors.push(`buddies/${id}.metVia: unknown origin.`);
    }
    if (typeof (row as Record<string, unknown>)['color'] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(String((row as Record<string, unknown>)['color']))) {
      errors.push(`buddies/${id}.color: must be #rrggbb.`);
    }
    str('persona', 400);
    const wpm = (row as Record<string, unknown>)['typingSpeedWpm'];
    if (!num(wpm) || (wpm as number) < 20 || (wpm as number) > 140) errors.push(`buddies/${id}.typingSpeedWpm: must be 20..140.`);

    const trow = traits[id];
    if (!trow || typeof trow !== 'object') {
      errors.push(`buddyTraits/${id}: missing row.`);
    } else {
      for (const k of TRAIT_KEYS) {
        if (!in100((trow as Record<string, unknown>)[k])) errors.push(`buddyTraits/${id}.${k}: must be 0..100.`);
      }
    }
    const hrow = hearts[id];
    if (!hrow || typeof hrow !== 'object') {
      errors.push(`buddyHearts/${id}: missing row.`);
    } else {
      for (const k of HEART_KEYS) {
        if (!in100((hrow as Record<string, unknown>)[k])) errors.push(`buddyHearts/${id}.${k}: must be 0..100.`);
      }
    }
    const srow = schedules[id];
    if (!srow || typeof srow !== 'object' || typeof (srow as Record<string, unknown>)['blocks'] !== 'string') {
      errors.push(`buddySchedules/${id}: missing blocks JSON.`);
    } else {
      let blocks: unknown;
      try {
        blocks = JSON.parse(String((srow as Record<string, unknown>)['blocks']));
      } catch {
        errors.push(`buddySchedules/${id}.blocks: invalid JSON.`);
        blocks = null;
      }
      if (Array.isArray(blocks)) {
        if (blocks.length === 0) errors.push(`buddySchedules/${id}.blocks: needs at least one block.`);
        for (const [i, b] of blocks.entries()) {
          const blk = b as Record<string, unknown>;
          const ok = blk && typeof blk === 'object'
            && Number.isInteger(blk['start']) && (blk['start'] as number) >= 0 && (blk['start'] as number) <= 1439
            && Number.isInteger(blk['end']) && (blk['end'] as number) >= 1 && (blk['end'] as number) <= 1440
            && (blk['end'] as number) > (blk['start'] as number)
            && BLOCK_STATUSES.has(String(blk['status']))
            && typeof blk['msg'] === 'string' && (blk['msg'] as string).length > 0;
          if (!ok) errors.push(`buddySchedules/${id}.blocks[${i}]: bad block (start/end/status/msg).`);
        }
      } else if (blocks !== null) {
        errors.push(`buddySchedules/${id}.blocks: must be a JSON array.`);
      }
    }
  }
  for (const table of ['buddyTraits', 'buddyHearts', 'buddySchedules'] as const) {
    for (const id of Object.keys(tables[table] ?? {})) {
      if (!buddies[id]) errors.push(`${table}/${id}: no matching buddies row.`);
    }
  }
  for (const [key, row] of Object.entries(pools)) {
    if (!row || typeof row !== 'object') {
      errors.push(`pools/${key}: must be an object.`);
      continue;
    }
    let lines: unknown = null;
    try {
      lines = JSON.parse(String((row as Record<string, unknown>)['lines'] ?? ''));
    } catch {
      errors.push(`pools/${key}.lines: invalid JSON.`);
    }
    if (Array.isArray(lines)) {
      if (lines.length === 0 || lines.length > 12) errors.push(`pools/${key}.lines: needs 1..12 lines.`);
      for (const [i, line] of lines.entries()) {
        if (typeof line !== 'string' || !line.trim() || line.length > 300) {
          errors.push(`pools/${key}.lines[${i}]: must be a non-empty string <= 300 chars.`);
        }
      }
    } else if (lines !== null) {
      errors.push(`pools/${key}.lines: must be a JSON array.`);
    }
    const version = (row as Record<string, unknown>)['version'];
    if (!Number.isInteger(version) || (version as number) < 1) errors.push(`pools/${key}.version: must be an int >= 1.`);
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

/** Emit the registry TypeScript source (buddies keep store.json order — roster order feeds seeded rolls). */
export function generateRegistrySource(tables: ContentTables): string {
  const version = contentHash(tables);
  const buddies = tables['buddies'] ?? {};
  const traits = tables['buddyTraits'] ?? {};
  const hearts = tables['buddyHearts'] ?? {};
  const schedules = tables['buddySchedules'] ?? {};
  const pools = tables['pools'] ?? {};
  const lines: string[] = [];
  lines.push('// GENERATED — do not edit by hand.');
  lines.push(`// Source: content/store.json (content v${version}). Regenerate: npm run content:pull.`);
  lines.push(`export const CONTENT_VERSION = '${version}';`);
  lines.push('');
  lines.push('export interface GeneratedScheduleBlock {');
  lines.push('  start: number;');
  lines.push('  end: number;');
  lines.push("  status: 'online' | 'away' | 'busy' | 'offline';");
  lines.push('  msg: string;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedBuddyDef {');
  lines.push('  id: string;');
  lines.push('  role: string;');
  lines.push('  displayName: string;');
  lines.push('  handle: string;');
  lines.push('  myplace: string;');
  lines.push('  archetype: string;');
  lines.push('  status: string;');
  lines.push('  metVia: string;');
  lines.push('  color: string;');
  lines.push('  persona: string;');
  lines.push('  typingSpeedWpm: number;');
  lines.push('  formerIds: string[];');
  lines.push('  traits: { shyness: number; warmth: number; discipline: number; spontaneity: number; loyalty: number };');
  lines.push('  hearts: { familiarity: number; trust: number; comfort: number; respect: number; annoyance: number; affection: number; attraction: number; suspicion: number; resentment: number };');
  lines.push('  blocks: GeneratedScheduleBlock[];');
  lines.push('}');
  lines.push('');
  lines.push('export const GENERATED_BUDDIES: GeneratedBuddyDef[] = [');
  // NOTE: insertion order (store.json authorial order), NOT sorted — the
  // engine iterates the roster in this order and seeded rolls depend on it.
  for (const id of Object.keys(buddies)) {
    const row = buddies[id] as Record<string, unknown>;
    const trow = (traits[id] ?? {}) as Record<string, unknown>;
    const hrow = (hearts[id] ?? {}) as Record<string, unknown>;
    const blocks = JSON.parse(String((schedules[id] as Record<string, unknown> | undefined)?.['blocks'] ?? '[]')) as Array<Record<string, unknown>>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    role: ${tsString(String(row['role'] ?? ''))},`);
    for (const k of ['displayName', 'handle', 'myplace', 'archetype', 'status', 'metVia', 'color', 'persona'] as const) {
      lines.push(`    ${k}: ${tsString(String(row[k] ?? ''))},`);
    }
    lines.push(`    typingSpeedWpm: ${Number(row['typingSpeedWpm'] ?? 60)},`);
    let formerIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(String(row['formerIds'] ?? '[]'));
      if (Array.isArray(parsed)) formerIds = parsed.filter((x): x is string => typeof x === 'string');
    } catch { formerIds = []; }
    lines.push(`    formerIds: [${formerIds.map((x) => tsString(x)).join(', ')}],`);
    const numList = (keys: string[], src: Record<string, unknown>): string =>
      keys.map((k) => `${k}: ${Number(src[k] ?? 0)}`).join(', ');
    lines.push(`    traits: { ${numList(TRAIT_KEYS, trow)} },`);
    lines.push(`    hearts: { ${numList(HEART_KEYS, hrow)} },`);
    lines.push('    blocks: [');
    for (const b of blocks) {
      lines.push(`      { start: ${Number(b['start'])}, end: ${Number(b['end'])}, status: ${tsString(String(b['status']))} as GeneratedScheduleBlock['status'], msg: ${tsString(String(b['msg']))} },`);
    }
    lines.push('    ],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  lines.push('export interface GeneratedPool {');
  lines.push('  key: string;');
  lines.push('  lines: string[];');
  lines.push('  version: number;');
  lines.push('}');
  lines.push('');
  lines.push('export const GENERATED_POOLS: GeneratedPool[] = [');
  for (const key of Object.keys(pools).sort()) {
    const row = pools[key] as Record<string, unknown>;
    const parsed = JSON.parse(String(row['lines'] ?? '[]')) as string[];
    lines.push('  {');
    lines.push(`    key: ${tsString(key)},`);
    lines.push(`    lines: [${parsed.map((l) => tsString(l)).join(', ')}],`);
    lines.push(`    version: ${Number(row['version'] ?? 1)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}
