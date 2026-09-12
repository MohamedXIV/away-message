// src/engine/encounters/director.ts
// #47 — thin wiring between pure collection and pure selection.
// collectEncounterCandidates() is the renderer-safe read path: it never
// marks cooldowns or one-shots, so opening a view creates nothing.
// decideEncounter() additionally stamps the returned director state.

import { collectEncounterCandidates } from './candidates';
import { selectEncounter } from './select';
import type { EncounterSelection } from './select';
import type { EncounterDecisionInput, EncounterDirectorState } from './types';

export function decideEncounter(
  input: EncounterDecisionInput,
  state: EncounterDirectorState,
): EncounterSelection {
  return selectEncounter(collectEncounterCandidates(input), input.nowMinute, state);
}
