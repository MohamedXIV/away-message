// src/engine/encounters/persist.ts
// #47 — minimal persisted director state: cooldown identity/timestamps plus
// surfaced one-shot identities. Tolerant hydration in the hydrateNpcLives /
// hydrateNpcMobility style: malformed rows drop, collections stay bounded.

import { MAX_DIRECTOR_STATE_ENTRIES } from './types';
import type { EncounterDirectorState } from './types';

const MAX_KEY_LENGTH = 120;

function cleanKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key === '' || key.length > MAX_KEY_LENGTH) return null;
  return key;
}

function cleanMinute(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return Math.floor(raw);
}

export function emptyEncounterDirectorState(): EncounterDirectorState {
  return { cooldowns: {}, surfacedOneShots: [] };
}

export function hydrateEncounterDirectorState(data: unknown): EncounterDirectorState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return emptyEncounterDirectorState();
  }
  const raw = data as Record<string, unknown>;
  const cooldowns: Record<string, number> = {};
  const rawCooldowns = raw['cooldowns'];
  if (rawCooldowns && typeof rawCooldowns === 'object' && !Array.isArray(rawCooldowns)) {
    for (const [key, minute] of Object.entries(rawCooldowns as Record<string, unknown>)) {
      const clean = cleanKey(key);
      const at = cleanMinute(minute);
      if (clean === null || at === null) continue;
      cooldowns[clean] = at;
      if (Object.keys(cooldowns).length >= MAX_DIRECTOR_STATE_ENTRIES) break;
    }
  }
  const surfacedOneShots: string[] = [];
  const rawShots = raw['surfacedOneShots'];
  if (Array.isArray(rawShots)) {
    for (const entry of rawShots) {
      const clean = cleanKey(entry);
      if (clean === null || surfacedOneShots.includes(clean)) continue;
      surfacedOneShots.push(clean);
      if (surfacedOneShots.length >= MAX_DIRECTOR_STATE_ENTRIES) break;
    }
  }
  return { cooldowns, surfacedOneShots };
}
