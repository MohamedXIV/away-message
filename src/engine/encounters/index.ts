// src/engine/encounters/index.ts
// #47 — Encounter Director public surface (pure; no engine imports at runtime).

export {
  ENCOUNTER_COOLDOWN_MINUTES,
  ENCOUNTER_MOMENT_WINDOW_MINUTES,
  MAX_CANDIDATES_PER_CYCLE,
  MAX_DIRECTOR_STATE_ENTRIES,
} from './types';
export type {
  EncounterActorRead,
  EncounterCandidate,
  EncounterCandidateKind,
  EncounterDecision,
  EncounterDecisionInput,
  EncounterDirectorState,
  EncounterPlayerTransitRead,
} from './types';
export {
  buildEventOpportunityCandidates,
  buildObligationCandidates,
  buildPlaceOverlapCandidates,
  buildTransitCandidates,
  collectEncounterCandidates,
} from './candidates';
export { decideEncounter } from './director';
export { prioritizeCandidates, selectEncounter } from './select';
export type { EncounterSelection } from './select';
export { emptyEncounterDirectorState, hydrateEncounterDirectorState } from './persist';
