// src/engine/encounters/select.ts
// #47 — deterministic selection over collected candidates. Pipeline:
// validity window → stable prioritization → hard cap → suppression
// (one-shot/cooldown/knowledge) → first or none. Pure: marking is applied
// to a fresh state object returned alongside the decision.

import {
  ENCOUNTER_COOLDOWN_MINUTES,
  MAX_CANDIDATES_PER_CYCLE,
  MAX_DIRECTOR_STATE_ENTRIES,
} from './types';
import type {
  EncounterCandidate,
  EncounterDecision,
  EncounterDirectorState,
} from './types';

export interface EncounterSelection {
  decision: EncounterDecision;
  nextState: EncounterDirectorState;
}

function inWindow(candidate: EncounterCandidate, nowMinute: number): boolean {
  return nowMinute >= candidate.validFromMinute && nowMinute < candidate.validUntilMinute;
}

function cooldownActive(
  state: EncounterDirectorState,
  cooldownKey: string,
  nowMinute: number,
): boolean {
  const stamped = state.cooldowns[cooldownKey];
  if (stamped === undefined) return false;
  return nowMinute - stamped < ENCOUNTER_COOLDOWN_MINUTES;
}

/**
 * Total deterministic order: priority desc, id asc, input-index asc.
 * Array.prototype.sort is stable, but the explicit index makes the total
 * order independent of engine sort guarantees.
 */
export function prioritizeCandidates(candidates: EncounterCandidate[]): EncounterCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      if (b.candidate.priority !== a.candidate.priority) {
        return b.candidate.priority - a.candidate.priority;
      }
      const byId = a.candidate.id.localeCompare(b.candidate.id);
      if (byId !== 0) return byId;
      return a.index - b.index;
    })
    .map((entry) => entry.candidate);
}

function stampCooldown(
  state: EncounterDirectorState,
  cooldownKey: string,
  nowMinute: number,
): EncounterDirectorState {
  const cooldowns: Record<string, number> = { ...state.cooldowns, [cooldownKey]: nowMinute };
  const keys = Object.keys(cooldowns);
  if (keys.length > MAX_DIRECTOR_STATE_ENTRIES) {
    const evict = keys
      .map((key) => ({ key, at: cooldowns[key] ?? 0 }))
      .sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1))
      .slice(0, keys.length - MAX_DIRECTOR_STATE_ENTRIES);
    for (const { key } of evict) delete cooldowns[key];
  }
  return { ...state, cooldowns };
}

function markOneShot(state: EncounterDirectorState, id: string): EncounterDirectorState {
  if (state.surfacedOneShots.includes(id)) return state;
  const surfacedOneShots = [...state.surfacedOneShots, id];
  while (surfacedOneShots.length > MAX_DIRECTOR_STATE_ENTRIES) surfacedOneShots.shift();
  return { ...state, surfacedOneShots };
}

export function selectEncounter(
  candidates: EncounterCandidate[],
  nowMinute: number,
  state: EncounterDirectorState,
): EncounterSelection {
  const valid = candidates.filter((candidate) => inWindow(candidate, nowMinute));
  if (valid.length === 0) return { decision: { kind: 'none', reason: 'no_valid_candidates' }, nextState: state };

  const evaluated = prioritizeCandidates(valid).slice(0, MAX_CANDIDATES_PER_CYCLE);
  let unknownSeen = false;
  for (const candidate of evaluated) {
    if (candidate.oneShot === true && state.surfacedOneShots.includes(candidate.id)) continue;
    if (cooldownActive(state, candidate.cooldownKey, nowMinute)) continue;
    if (!candidate.participantKnown) {
      unknownSeen = true;
      continue;
    }
    let nextState = stampCooldown(state, candidate.cooldownKey, nowMinute);
    if (candidate.oneShot === true) nextState = markOneShot(nextState, candidate.id);
    return { decision: { kind: 'encounter', candidate }, nextState };
  }
  return {
    decision: {
      kind: 'none',
      reason: unknownSeen && evaluated.length > 0 ? 'unknown_participant' : 'all_suppressed',
    },
    nextState: state,
  };
}
