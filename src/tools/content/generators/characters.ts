// Deterministic character-registry emitter.
// Phase A (#99): behavior-preserving extraction from codegen.ts.

import type { ContentTables } from '../shared';
import { contentHash, tsString } from '../shared';
import { HEART_KEYS, TRAIT_KEYS } from '../domain/characters';

/** Emit one character's backstory literal (or null when the store has no row). */
function emitBackstory(row: unknown): string {
  if (!row || typeof row !== 'object') return 'null';
  const r = row as Record<string, unknown>;
  const candidates: Array<{ handle: string; status: string; note?: string }> = Array.isArray(r['candidates'])
    ? r['candidates']
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          handle: String(c['handle'] ?? ''),
          status: String(c['status'] ?? 'dead'),
          ...(typeof c['note'] === 'string' && c['note'] ? { note: String(c['note']).slice(0, 80) } : {}),
        }))
    : [];
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
    const vocab = Array.isArray(r['vocabulary'])
      ? r['vocabulary'].filter((value): value is string => typeof value === 'string')
      : [];
    const interests = Array.isArray(r['defaultInterests'])
      ? r['defaultInterests'].filter((value): value is string => typeof value === 'string')
      : [];
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
    const roles = Array.isArray(row['roles'])
      ? row['roles'].filter((x): x is string => typeof x === 'string')
      : [];
    lines.push(`    roles: [${roles.map((x) => tsString(x)).join(', ')}],`);
    lines.push(`    reach: ${tsString(String(row['reach'] ?? 'local'))} as 'local' | 'remote',`);
    lines.push(`    hair: ${tsString(String(row['hair'] ?? 'brown'))},`);
    lines.push(`    eyes: ${tsString(String(row['eyes'] ?? 'brown'))},`);
    lines.push(`    chatColor: ${tsString(String(row['chatColor'] ?? '#6a3fa0'))},`);
    lines.push(`    bio: ${tsString(String(row['bio'] ?? ''))},`);
    lines.push(`    typingSpeedWpm: ${Number(row['typingSpeedWpm'] ?? 60)},`);
    const languages: Array<{ lang: string; level: number }> = Array.isArray(row['languages'])
      ? row['languages']
          .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
          .map((e) => ({ lang: String(e['lang'] ?? 'en'), level: Number(e['level'] ?? 1) }))
      : [];
    lines.push(`    languages: [${languages.map((l) => `{ lang: ${tsString(l.lang)}, level: ${l.level} }`).join(', ')}],`);
    lines.push(`    backstory: ${emitBackstory(backstories[id])},`);
    const numList = (keys: string[], src: Record<string, unknown>): string =>
      keys.map((k) => `${k}: ${Number(src[k] ?? 0)}`).join(', ');
    lines.push(`    temperament: { ${numList(TRAIT_KEYS, trow)} },`);
    lines.push(`    initialAffinity: { ${numList(HEART_KEYS, arow)} },`);
    lines.push(`    routine: { wakeMinute: ${Number(rrow['wakeMinute'] ?? 420)}, sleepMinute: ${Number(rrow['sleepMinute'] ?? 1380)}, workShift: ${tsString(String(rrow['workShift'] ?? 'day'))}, preferredHangout: ${tsString(String(rrow['preferredHangout'] ?? 'cafe'))} },`);

    const expressions: Record<string, string> =
      artRow['expressions'] && typeof artRow['expressions'] === 'object' && !Array.isArray(artRow['expressions'])
        ? Object.fromEntries(
            Object.entries(artRow['expressions'] as Record<string, unknown>)
              .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
          )
        : {};
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
    const parsed = Array.isArray(row['lines'])
      ? row['lines'].filter((line): line is string => typeof line === 'string')
      : [];
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
