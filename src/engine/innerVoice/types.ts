// src/engine/innerVoice/types.ts
// Governed Player Inner Voice contracts (#23).
//
// RULES DECIDE WHAT THE PLAYER MAY THINK AND WHEN.
// AI MAY ONLY PARAPHRASE AN ALREADY-APPROVED SEMANTIC THOUGHT.
//
// This module owns semantic contracts only. It never mutates gameplay state,
// never reveals hidden NPC/world knowledge, and never chooses consequences.
// All knowledge flowing into a ThoughtIntent must come from the allowlisted
// PlayerKnowledgeView below: currently visible physical state, explicitly
// learned world knowledge, player-owned memories/history, or private
// player body/economy state.

/** Closed tone palette for the governed voice. New tones need a profile update. */
export type ThoughtTone =
  | 'neutral'
  | 'curious'
  | 'uneasy'
  | 'warm'
  | 'tired'
  | 'annoyed'
  | 'amused';

export const THOUGHT_TONES: ReadonlyArray<ThoughtTone> = [
  'neutral',
  'curious',
  'uneasy',
  'warm',
  'tired',
  'annoyed',
  'amused',
];

/** Renderer-neutral presentation class. The engine never owns typography/animation. */
export type ThoughtPresentation = 'ambient' | 'inspect' | 'urgent';

export const THOUGHT_PRESENTATIONS: ReadonlyArray<ThoughtPresentation> = [
  'ambient',
  'inspect',
  'urgent',
];

/**
 * Bounded semantic intent. Carries meaning/tone/source/knowledge provenance —
 * never resolved text, never mutations, never hidden knowledge.
 */
export interface ThoughtIntent {
  id: string;
  topic: string;
  semanticMeaning: string;
  tone: ThoughtTone;
  /** 0..100. Higher preempts lower for the single active thought slot. */
  priority: number;
  /** Owning semantic source, e.g. 'world:weather', 'inspect:item', 'economy:rent'. */
  source: string;
  /** Provenance refs. Must all pass the knowledge allowlist. */
  knowledgeRefs: string[];
  /** Dedupe/cooldown identity. Suppresses replays inside the window. */
  cooldownKey?: string;
  presentation: ThoughtPresentation;
}

/**
 * The ONLY knowledge a ThoughtIntent may be built from:
 * currently visible physical state, explicitly learned world knowledge,
 * player-owned memories/history, private player body/economy state.
 * Anything else (NPC hidden motives, undisclosed facts, private schedules,
 * hidden relationship numbers, unrevealed item metadata) is rejected.
 */
export interface PlayerKnowledgeView {
  visiblePlaceId?: string;
  visibleObjects?: string[];
  learnedFacts?: string[];
  playerMemories?: string[];
  bodyHint?: string;
  economyHint?: string;
  timeHint?: string;
  weatherHint?: string;
}

/** Semantic trigger kinds. Renderers never invent these; systems request them. */
export type ThoughtTriggerKind =
  | 'inspect_item'
  | 'inspect_place'
  | 'place_changed'
  | 'weather'
  | 'body_state'
  | 'missed_event'
  | 'street_detail'
  | 'purchase'
  | 'economy_pressure'
  | 'social_aftermath'
  | 'old_object'
  | 'explicit_think';

/** A system asks for a thought. Rules (InnerVoiceEngine) decide if one is owed. */
export interface ThoughtTrigger {
  kind: string;
  topic: string;
  semanticMeaning: string;
  tone?: ThoughtTone;
  priority?: number;
  source: string;
  knowledgeRefs: string[];
  cooldownKey?: string;
  presentation?: ThoughtPresentation;
  knowledge: PlayerKnowledgeView;
}

/** Explicit player Inspect/Think request. Must never mutate world state. */
export interface InspectThoughtRequest {
  topic: string;
  semanticMeaning: string;
  tone?: ThoughtTone;
  source: string;
  knowledgeRefs: string[];
  cooldownKey?: string;
  knowledge: PlayerKnowledgeView;
}

/** UI state that may suppress low-priority ambient thoughts. */
export interface InnerVoiceUiState {
  importantDialogueOpen?: boolean;
  urgentModalOpen?: boolean;
  inCutscene?: boolean;
}

/**
 * Minimal persisted slice: cooldown/notable-history only, so save/reload
 * cannot immediately replay an already-suppressed notable thought.
 * Everything else (queue, active thought) is session-ephemeral.
 */
export interface InnerVoicePersistedState {
  cooldowns: Record<string, number>;
  notableIds: string[];
  recent: Array<{ id: string; minute: number }>;
}

/**
 * Renderer-neutral result: resolved short first-person text plus a
 * presentation class. No mutation fields, no typography, no animation.
 */
export interface ResolvedThought {
  text: string;
  presentation: ThoughtPresentation;
  tone: ThoughtTone;
  sourceId: string;
  intentId: string;
  fallback: boolean;
  fromAI: boolean;
}
