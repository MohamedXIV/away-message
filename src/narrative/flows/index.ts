import type { NarrativeFlowDefinition } from '../NarrativeCoordinator';
import cafeMeetingCompiled from '../ink/flows/cafe-meeting.ink.json';
import scenarioOldDebtCompiled from '../ink/flows/scenario-old-debt.ink.json';

export const CAFE_MEETING_INTERACTION_ID = 'cafe_meeting';
export const CAFE_MEETING_FLOW_ID = 'cafe_meeting';
export const SCENARIO_OLD_DEBT_FLOW_ID = 'scenario_old_debt';
export const SCENARIO_OLD_DEBT_SEARCH_CUE = 'old_obligation_recalled';
export const SCENARIO_OLD_DEBT_ENCOUNTER_CUE = 'unfinished_business_nearby';

/**
 * Compiled authored flows available to the application seam. Flow ids are
 * stable save/load keys; content changes recompile through `npm run ink:compile`.
 */
export const DEFAULT_NARRATIVE_FLOWS: readonly NarrativeFlowDefinition[] = [
  {
    flowId: CAFE_MEETING_FLOW_ID,
    compiledStory: cafeMeetingCompiled,
    startsOn: {
      interactionIds: [CAFE_MEETING_INTERACTION_ID],
      semanticKinds: ['conversation_started'],
      conversationChannels: ['in_person'],
    },
  },
  {
    flowId: SCENARIO_OLD_DEBT_FLOW_ID,
    compiledStory: scenarioOldDebtCompiled,
    startsOn: {
      scenarioCues: [SCENARIO_OLD_DEBT_SEARCH_CUE, SCENARIO_OLD_DEBT_ENCOUNTER_CUE],
    },
  },
];
