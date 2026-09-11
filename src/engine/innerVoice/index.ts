// src/engine/innerVoice/index.ts
// One public Inner Voice API for world, inventory, social, and narrative
// systems (#23). Renderer-neutral: callers receive rule-approved intents and
// resolved text + presentation class, never typography or animation.

export type {
  ThoughtTone,
  ThoughtPresentation,
  ThoughtIntent,
  PlayerKnowledgeView,
  ThoughtTriggerKind,
  ThoughtTrigger,
  InspectThoughtRequest,
  InnerVoiceUiState,
  InnerVoicePersistedState,
  ResolvedThought,
} from './types';
export { THOUGHT_TONES, THOUGHT_PRESENTATIONS } from './types';
export {
  DEFAULT_PLAYER_VOICE_PROFILE,
  renderFallbackText,
  type PlayerVoiceProfile,
} from './PlayerVoiceProfile';
export {
  InnerVoiceEngine,
  INNER_VOICE_DEFAULT_COOLDOWN_MINUTES,
  INNER_VOICE_INSPECT_COOLDOWN_MINUTES,
  INNER_VOICE_NOTABLE_COOLDOWN_MINUTES,
  INNER_VOICE_NOTABLE_PRIORITY,
  INNER_VOICE_MAX_QUEUE,
  INNER_VOICE_MAX_RECENT,
} from './InnerVoiceEngine';
export {
  resolveThoughtText,
  validateParaphrasedText,
  type ResolveThoughtTextOptions,
} from './InnerVoiceTextService';

/** Empty persisted slice for fresh saves. */
export function emptyInnerVoicePersistedState(): import('./types').InnerVoicePersistedState {
  return { cooldowns: {}, notableIds: [], recent: [] };
}
