import type { NarrativeFlowDefinition } from '../NarrativeCoordinator';
import cafeMeetingCompiled from '../ink/flows/cafe-meeting.ink.json';
import pulseCheckinCompiled from '../ink/flows/pulse-checkin.ink.json';
import pulseNearbyCompiled from '../ink/flows/pulse-nearby.ink.json';
import pulseRemoteCompiled from '../ink/flows/pulse-remote.ink.json';
import pulseNightCompiled from '../ink/flows/pulse-night.ink.json';
import pulseShiftCompiled from '../ink/flows/pulse-shift.ink.json';
import pulseTrustedCompiled from '../ink/flows/pulse-trusted.ink.json';
import pulseRepairCompiled from '../ink/flows/pulse-repair.ink.json';
import pulseReminisceCompiled from '../ink/flows/pulse-reminisce.ink.json';
import pulseFollowupPersonal from '../ink/flows/pulse-followup-personal.ink.json';
import pulseFollowupTopic from '../ink/flows/pulse-followup-topic.ink.json';
import pulseFollowupCourtesy from '../ink/flows/pulse-followup-courtesy.ink.json';
import pulseOutreachReply from '../ink/flows/pulse-outreach-reply.ink.json';
import scenarioOldDebtCompiled from '../ink/flows/scenario-old-debt.ink.json';

export const CAFE_MEETING_INTERACTION_ID = 'cafe_meeting';
export const CAFE_MEETING_FLOW_ID = 'cafe_meeting';
export const PULSE_CHECKIN_FLOW_ID = 'pulse_checkin';
/** Reusable authored Pulse variants; context selection is Worker-only. */
/** An incoming NPC outreach opens a real Ink reply menu, not generic greetings. */
export const PULSE_OUTREACH_REPLY_FLOW: NarrativeFlowDefinition = {
  flowId: 'pulse_outreach_reply', compiledStory: pulseOutreachReply,
  startsOn: { semanticKinds: ['conversation_started'], conversationChannels: ['pulse'] },
};

export const PULSE_FOLLOWUP_FLOWS: readonly NarrativeFlowDefinition[] = [
  { flowId: 'pulse_followup_personal', compiledStory: pulseFollowupPersonal,
    startsOn: { semanticKinds: ['conversation_started'], conversationChannels: ['pulse'] } },
  { flowId: 'pulse_followup_topic', compiledStory: pulseFollowupTopic,
    startsOn: { semanticKinds: ['conversation_started'], conversationChannels: ['pulse'] } },
  { flowId: 'pulse_followup_courtesy', compiledStory: pulseFollowupCourtesy,
    startsOn: { semanticKinds: ['conversation_started'], conversationChannels: ['pulse'] } },
];

export const PULSE_CONTEXTUAL_FLOWS: Readonly<Record<string, NarrativeFlowDefinition>> = Object.freeze({
  nearby: { flowId: 'pulse_nearby', compiledStory: pulseNearbyCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
  remote: { flowId: 'pulse_remote', compiledStory: pulseRemoteCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
  night: { flowId: 'pulse_night', compiledStory: pulseNightCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
  shift: { flowId: 'pulse_shift', compiledStory: pulseShiftCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
  trusted: { flowId: 'pulse_trusted', compiledStory: pulseTrustedCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
  repair: { flowId: 'pulse_repair', compiledStory: pulseRepairCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
  reminisce: { flowId: 'pulse_reminisce', compiledStory: pulseReminisceCompiled, startsOn: {
    semanticKinds: ['conversation_started'], conversationChannels: ['pulse'],
  } },
});

export const SCENARIO_OLD_DEBT_FLOW_ID = 'scenario_old_debt';
export const SCENARIO_OLD_DEBT_SEARCH_CUE = 'old_obligation_recalled';
export const SCENARIO_OLD_DEBT_ENCOUNTER_CUE = 'unfinished_business_nearby';

/**
 * Compiled authored flows available to the application seam. Flow ids are
 * stable save/load keys; content changes recompile through `npm run ink:compile`.
 */
export const DEFAULT_NARRATIVE_FLOWS: readonly NarrativeFlowDefinition[] = [
  {
    flowId: PULSE_CHECKIN_FLOW_ID,
    compiledStory: pulseCheckinCompiled,
    startsOn: {
      semanticKinds: ['conversation_started'],
      conversationChannels: ['pulse'],
    },
  },
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
