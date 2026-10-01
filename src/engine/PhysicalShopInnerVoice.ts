import type { TimeOfDay, WeatherType } from '../world/types';
import type { ThoughtIntent, ThoughtTrigger } from './innerVoice';
import type { GameContextReadApi } from './GameContext';
import { buildInnerVoiceKnowledgeFromGameContext } from './innerVoice/GameContextKnowledge';

export interface PhysicalShopInnerVoiceSource {
  readonly gameContext?: GameContextReadApi;
  requestInnerThought(
    trigger: ThoughtTrigger,
    nowMinute?: number,
  ): ThoughtIntent | null;
}

export interface PhysicalShopArrivalObservation {
  placeId: string;
  placeName: string;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  nowMinute?: number;
}

/**
 * Requests one sparse, knowledge-bounded arrival observation through #23.
 * It never reads inventory, prices, cashier internals, schedules, or hidden
 * relationship state. Individual shelf clicks deliberately do not call this.
 */
export function requestPhysicalShopArrivalThought(
  source: PhysicalShopInnerVoiceSource,
  observation: PhysicalShopArrivalObservation,
): ThoughtIntent | null {
  const currentEnvironment = source.gameContext?.environment.current();
  const currentTime = source.gameContext?.time.current();
  const observedWeather = currentEnvironment?.weather.condition ?? observation.weather;
  const observedTimeOfDay = currentTime?.timeOfDay ?? observation.timeOfDay;
  const rainy = currentEnvironment
    ? currentEnvironment.weather.tags.includes('wet')
    : observedWeather === 'rain';
  const late = observedTimeOfDay === 'night' || observedTimeOfDay === 'late_night';
  const knowledgeRefs = [
    `visible:place:${observation.placeId}`,
    ...(rainy ? [`visible:weather:${observedWeather}`] : []),
  ];
  const atmosphere = rainy
    ? 'Rain against the storefront makes the small shop feel more enclosed.'
    : late
      ? 'The neighborhood shop feels different this late, even with the same shelves and counter.'
      : `I can take in the layout of ${observation.placeName} before deciding what I need.`;

  const publicKnowledge = source.gameContext
    ? buildInnerVoiceKnowledgeFromGameContext(source.gameContext, {
        visiblePlaceId: observation.placeId,
      })
    : {
        visiblePlaceId: observation.placeId,
        ...(rainy ? { weatherHint: String(observedWeather) } : {}),
        timeHint: String(observedTimeOfDay),
      };
  const moodBand = source.gameContext?.player.mood().band;
  const needs = source.gameContext?.player.needs();

  return source.requestInnerThought({
    kind: 'place_changed',
    topic: 'physical_shop_arrival',
    semanticMeaning: atmosphere,
    tone: rainy || late ? 'curious' : 'neutral',
    priority: 24,
    source: 'world:physical_shop',
    knowledgeRefs: [
      ...knowledgeRefs,
      ...(moodBand ? [`player:mood:${moodBand}`] : []),
      ...(needs?.isExhausted ? [`player:body:${needs.energyBand}`] : []),
    ],
    cooldownKey: `physical_shop_arrival:${observation.placeId}`,
    presentation: 'ambient',
    knowledge: publicKnowledge,
  }, observation.nowMinute);
}
