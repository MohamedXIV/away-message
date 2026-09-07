// src/engine/CharacterEngine.ts
// Unified character factory — single place that builds validated, template-driven
// buddy definitions for the whole game (core 4 stay code-owned in SocialEngine;
// every NEW buddy is built here, never hand-written across 10 files).
//
// P1 scope: offline templates only (no AI). AI generation plugs into buildCharacter
// later via an optional `personaOverride` without changing the contract.

import type {
  BuddyCharacter,
  BuddyLifecycleStatus,
  BuddyMetVia,
  CharacterArchetype,
  CharacterTraits,
  RelationshipDimensions,
} from './types';
import {
  buildScheduleForArchetype,
  CHARACTER_ARCHETYPES,
  clampRelationships,
  clampTraits,
  isValidSchedule,
  resolveArchetype,
  traitsForBuddy,
  validateCharacterId,
} from './characterTemplates';

export interface CharacterMetadata {
  archetype: CharacterArchetype;
  status: BuddyLifecycleStatus;
  metVia: BuddyMetVia;
  isProcedural: boolean;
  createdDay: number;
}

export type CharacterDefinition = BuddyCharacter & CharacterMetadata;

export interface BuildCharacterOptions {
  id: string;
  displayName: string;
  handle: string;
  archetype?: CharacterArchetype;
  avatarUrl?: string;
  typingSpeedWpm?: number;
  initialRelationships?: Partial<RelationshipDimensions>;
  /** Fixed temperament override (manual/AI-lab). Defaults to archetype + stable jitter. */
  traits?: Partial<CharacterTraits>;
  /** Physical vs far-away (online-source newcomers arrive remote). */
  reach?: 'local' | 'remote';
  appearance?: { hair?: string; eyes?: string };
  languages?: Array<{ lang: string; level: number }>;
  roles?: string[];
  status?: BuddyLifecycleStatus;
  metVia?: BuddyMetVia;
  createdDay?: number;
  personaHint?: string;
}

export interface BuiltCharacter {
  definition: CharacterDefinition;
  personaHint: string;
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Build a validated buddy definition from an archetype template.
 * Throws on invalid id — callers (SocialEngine.registerBuddy) rely on this.
 */
export function buildCharacter(options: BuildCharacterOptions): BuiltCharacter {
  const idCheck = validateCharacterId(options.id);
  if (!idCheck.ok) throw new Error(idCheck.error);

  const displayName = (options.displayName || '').trim();
  if (!displayName) throw new Error('Buddy displayName must be non-empty.');
  if (displayName.length > 40) throw new Error('Buddy displayName must be <= 40 chars.');

  const handle = (options.handle || '').trim();
  if (!handle) throw new Error('Buddy handle must be non-empty.');
  if (handle.length > 40) throw new Error('Buddy handle must be <= 40 chars.');

  const archetype: CharacterArchetype = options.archetype ?? 'regular';
  const template = CHARACTER_ARCHETYPES[archetype];
  if (!template) throw new Error(`Unknown archetype: ${archetype}`);

  const base = template.initialRelationships;
  const merged = clampRelationships({
    familiarity: options.initialRelationships?.familiarity ?? base.familiarity,
    trust: options.initialRelationships?.trust ?? base.trust,
    comfort: options.initialRelationships?.comfort ?? base.comfort,
    respect: options.initialRelationships?.respect ?? base.respect,
    annoyance: options.initialRelationships?.annoyance ?? base.annoyance,
    affection: options.initialRelationships?.affection ?? base.affection,
    attraction: options.initialRelationships?.attraction ?? base.attraction,
    suspicion: options.initialRelationships?.suspicion ?? base.suspicion,
    resentment: options.initialRelationships?.resentment ?? base.resentment,
  });

  // Small deterministic jitter (±3) so same-archetype buddies don't feel identical.
  // Jitter is derived from id hash — stable across reloads, no randomness in saves.
  const jitter = (hashString(options.id) % 7) - 3;
  const initialRelationships = clampRelationships({
    ...merged,
    familiarity: merged.familiarity + jitter,
    comfort: merged.comfort + (jitter > 0 ? 1 : -1),
  });

  // Fixed temperament: archetype base (or explicit override) + tiny stable
  // jitter (±5 per dim). Set once here, never mutated afterwards.
  const traitBase = traitsForBuddy(options.id, archetype);
  const traitJitter = (dim: string): number => (hashString(`${options.id}:trait:${dim}`) % 11) - 5;
  const traits = clampTraits({
    shyness: options.traits?.shyness ?? traitBase.shyness + traitJitter('shyness'),
    warmth: options.traits?.warmth ?? traitBase.warmth + traitJitter('warmth'),
    discipline: options.traits?.discipline ?? traitBase.discipline + traitJitter('discipline'),
    spontaneity: options.traits?.spontaneity ?? traitBase.spontaneity + traitJitter('spontaneity'),
    loyalty: options.traits?.loyalty ?? traitBase.loyalty + traitJitter('loyalty'),
  });

  const definition: CharacterDefinition = {
    id: options.id,
    displayName: displayName.slice(0, 40),
    handle: handle.slice(0, 40),
    avatarUrl: options.avatarUrl,
    schedule: buildScheduleForArchetype(archetype),
    initialRelationships,
    traits,
    typingSpeedWpm: options.typingSpeedWpm ?? template.typingSpeedWpm,
    archetype,
    status: options.status ?? 'acquaintance',
    metVia: options.metVia ?? 'intro',
    isProcedural: true,
    createdDay: options.createdDay ?? 1,
    // Free roster identity (validated, capped; remote for online-source newcomers).
    reach: options.reach === 'remote' ? 'remote' : 'local',
    appearance: {
      hair: String(options.appearance?.hair || 'brown').trim().slice(0, 24) || 'brown',
      eyes: String(options.appearance?.eyes || 'brown').trim().slice(0, 24) || 'brown',
    },
    languages: sanitizeLanguages(options.languages),
    roles: Array.isArray(options.roles)
      ? options.roles.filter((r): r is string => typeof r === 'string' && /^[a-z][a-z0-9_-]{1,23}$/.test(r)).slice(0, 6)
      : [],
  };

  return { definition, personaHint: options.personaHint ?? template.personaHint };
}

/** Clamp a language list to ≤3 {lang, level 1..5} (unknown langs dropped). */
export function sanitizeLanguages(languages: unknown): Array<{ lang: string; level: number }> {
  if (!Array.isArray(languages)) return [{ lang: 'en', level: 5 }];
  const clean: Array<{ lang: string; level: number }> = [];
  for (const entry of languages) {
    if (!entry || typeof entry !== 'object') continue;
    const lang = String((entry as { lang?: unknown }).lang ?? '').trim().toLowerCase().slice(0, 12);
    const level = (entry as { level?: unknown }).level;
    if (!/^[a-z]{2,12}$/.test(lang)) continue;
    if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 5) continue;
    if (clean.some((l) => l.lang === lang)) continue;
    clean.push({ lang, level: level as number });
    if (clean.length >= 3) break;
  }
  return clean.length > 0 ? clean : [{ lang: 'en', level: 5 }];
}

/** Re-validate a persisted buddy definition (e.g. from saves) before registering. */
export function validatePersistedBuddy(def: unknown): { ok: boolean; error?: string; definition?: CharacterDefinition } {
  if (!def || typeof def !== 'object') return { ok: false, error: 'Buddy definition must be an object.' };
  const d = def as Record<string, unknown>;
  const idCheck = validateCharacterId(String(d.id ?? ''));
  if (!idCheck.ok) return { ok: false, error: idCheck.error };
  if (typeof d.displayName !== 'string' || !d.displayName.trim()) return { ok: false, error: 'Persisted buddy missing displayName.' };
  if (typeof d.handle !== 'string' || !d.handle.trim()) return { ok: false, error: 'Persisted buddy missing handle.' };
  if (!isValidSchedule(d.schedule)) return { ok: false, error: 'Persisted buddy has an invalid schedule.' };
  const rel = d.initialRelationships as RelationshipDimensions | undefined;
  if (!rel || typeof rel.familiarity !== 'number') return { ok: false, error: 'Persisted buddy missing initialRelationships.' };
  if (typeof d.typingSpeedWpm !== 'number' || d.typingSpeedWpm < 20 || d.typingSpeedWpm > 140) {
    return { ok: false, error: 'Persisted buddy has an invalid typingSpeedWpm.' };
  }
  const definition = d as unknown as CharacterDefinition;
  const persistedId = String(d.id);
  const storedArchetype = (typeof d.archetype === 'string' && CHARACTER_ARCHETYPES[d.archetype as CharacterArchetype]
    ? (d.archetype as CharacterArchetype)
    : resolveArchetype(persistedId, undefined));
  // v3 saves predate fixed temperament: backfill deterministically with the
  // exact values a fresh buildCharacter() would roll for this id
  // (archetype base + stable id jitter), overlaid with any persisted partial.
  const persistedTraits = (d.traits && typeof d.traits === 'object') ? (d.traits as Partial<CharacterTraits>) : {};  const traitBase = traitsForBuddy(persistedId, storedArchetype);
  const traitJitter = (dim: string): number => (hashString(`${persistedId}:trait:${dim}`) % 11) - 5;
  const traits = clampTraits({
    shyness: persistedTraits.shyness ?? traitBase.shyness + traitJitter('shyness'),
    warmth: persistedTraits.warmth ?? traitBase.warmth + traitJitter('warmth'),
    discipline: persistedTraits.discipline ?? traitBase.discipline + traitJitter('discipline'),
    spontaneity: persistedTraits.spontaneity ?? traitBase.spontaneity + traitJitter('spontaneity'),
    loyalty: persistedTraits.loyalty ?? traitBase.loyalty + traitJitter('loyalty'),
  });
  return {
    ok: true,
    definition: {
      ...definition,
      id: persistedId,
      initialRelationships: clampRelationships(rel),
      traits,
      status: (d.status as BuddyLifecycleStatus) ?? 'acquaintance',
      metVia: (d.metVia as BuddyMetVia) ?? 'intro',
      isProcedural: d.isProcedural !== false,
      createdDay: typeof d.createdDay === 'number' ? d.createdDay : 1,
      // Free roster identity backfills (older docs predate these fields).
      reach: d.reach === 'remote' ? 'remote' : 'local',
      appearance: {
        hair: String((d.appearance as { hair?: unknown } | undefined)?.hair || 'brown').trim().slice(0, 24) || 'brown',
        eyes: String((d.appearance as { eyes?: unknown } | undefined)?.eyes || 'brown').trim().slice(0, 24) || 'brown',
      },
      languages: sanitizeLanguages(d.languages),
      roles: Array.isArray(d.roles)
        ? (d.roles as unknown[]).filter((r): r is string => typeof r === 'string' && /^[a-z][a-z0-9_-]{1,23}$/.test(r)).slice(0, 6)
        : [],
    },
  };
}
