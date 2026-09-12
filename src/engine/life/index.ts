export type * from './types';
export { createLifeSources, createSimulationLifeSources } from './LifeSources';
export { buildLifeMatrixSnapshot } from './LifeSnapshot';
export { buildCharacterObligations } from './Obligations';
export {
  selectCharacterIntent,
  INTENT_PREPARE_WINDOW_MINUTES,
  INTENT_REEVALUATE_HORIZON_MINUTES,
  INTENT_DUE_NOW_BONUS,
  INTENT_STARTS_SOON_BONUS,
  INTENT_DEADLINE_NEAR_BONUS,
  INTENT_TRAIT_NUDGE,
  INTENT_OPPORTUNITY_BONUS,
  INTENT_REST_PRIORITY,
  INTENT_ROUTINE_FLOW_PRIORITY,
} from './Intent';
export {
  resolveCharacterPresence,
  resolveCharacterPresenceFromSimulation,
  characterPresenceToLegacyBuddyPresence,
  resolveLegacyBuddyPresenceFromSimulation,
  type CharacterCommunicationStatus,
  type CharacterMessagingDeviceContext,
  type CharacterPhysicalPresence,
  type CharacterPresenceInput,
  type CharacterPresenceProjection,
  type CharacterPresenceResolveOptions,
  type CharacterPresenceSimulationSource,
} from './Presence';
export {
  deriveDefaultNpcPressure,
  advanceNpcPressure,
  projectLifePressureView,
} from './Pressure';
export {
  MAX_ACTIVE_GOALS_PER_ACTOR,
  ARCHETYPE_GOAL_TEMPLATES,
  initializeActorGoals,
  evaluateGoalProgress,
} from './Goals';
export {
  serializePersonalGoals,
  hydratePersonalGoals,
  serializeNpcPressure,
  hydrateNpcPressure,
  emptyNpcLives,
  serializeNpcLives,
  hydrateNpcLives,
} from './Persistence';

