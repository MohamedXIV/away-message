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
  RelationshipDimensions,
} from './types';
import {
  buildScheduleForArchetype,
  CHARACTER_ARCHETYPES,
  clampRelationships,
  isValidSchedule,
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
  });

  // Small deterministic jitter (±3) so same-archetype buddies don't feel identical.
  // Jitter is derived from id hash — stable across reloads, no randomness in saves.
  const jitter = (hashString(options.id) % 7) - 3;
  const initialRelationships = clampRelationships({
    ...merged,
    familiarity: merged.familiarity + jitter,
    comfort: merged.comfort + (jitter > 0 ? 1 : -1),
  });

  const definition: CharacterDefinition = {
    id: options.id,
    displayName: displayName.slice(0, 40),
    handle: handle.slice(0, 40),
    avatarUrl: options.avatarUrl,
    schedule: buildScheduleForArchetype(archetype),
    initialRelationships,
    typingSpeedWpm: options.typingSpeedWpm ?? template.typingSpeedWpm,
    archetype,
    status: options.status ?? 'acquaintance',
    metVia: options.metVia ?? 'intro',
    isProcedural: true,
    createdDay: options.createdDay ?? 1,
  };

  return { definition, personaHint: options.personaHint ?? template.personaHint };
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
  return {
    ok: true,
    definition: {
      ...definition,
      id: String(d.id),
      initialRelationships: clampRelationships(rel),
      status: (d.status as BuddyLifecycleStatus) ?? 'acquaintance',
      metVia: (d.metVia as BuddyMetVia) ?? 'intro',
      isProcedural: d.isProcedural !== false,
      createdDay: typeof d.createdDay === 'number' ? d.createdDay : 1,
    },
  };
}
