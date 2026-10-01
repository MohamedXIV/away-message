import type { GameContextReadApi } from '../GameContext';
import type { PlayerKnowledgeView } from './types';

export interface InnerVoiceVisibleContext {
  visiblePlaceId?: string;
  visibleObjects?: string[];
  learnedFacts?: string[];
  playerMemories?: string[];
}

/**
 * Builds private-player semantic knowledge from the stable Game Context API.
 * Mood is exposed only as a band, never as the exact private numeric value.
 */
export function buildInnerVoiceKnowledgeFromGameContext(
  gameContext: GameContextReadApi,
  visible: InnerVoiceVisibleContext = {},
): PlayerKnowledgeView {
  const time = gameContext.time.current();
  const environment = gameContext.environment.current();
  const needs = gameContext.player.needs();
  const mood = gameContext.player.mood();

  const healthBand = needs.health < 40 ? 'poor' : needs.health < 70 ? 'fair' : 'good';
  const weatherTags = environment.weather.tags.length > 0
    ? `, ${environment.weather.tags.join(', ')}`
    : '';

  return {
    ...(visible.visiblePlaceId ? { visiblePlaceId: visible.visiblePlaceId } : {}),
    ...(visible.visibleObjects ? { visibleObjects: [...visible.visibleObjects] } : {}),
    ...(visible.learnedFacts ? { learnedFacts: [...visible.learnedFacts] } : {}),
    ...(visible.playerMemories ? { playerMemories: [...visible.playerMemories] } : {}),
    bodyHint: `Energy ${needs.energyBand}; hunger ${needs.hungerBand}; health ${healthBand}.`,
    timeHint: `Day ${time.day}, ${time.timeOfDay}.`,
    weatherHint: `${environment.weather.condition}${weatherTags}.`,
    moodHint: `Mood feels ${mood.band}.`,
  };
}
