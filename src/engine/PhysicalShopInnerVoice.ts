import type { TimeOfDay, WeatherType } from '../world/types';
import type { ThoughtIntent, ThoughtTrigger } from './innerVoice';

export interface PhysicalShopInnerVoiceSource {
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
  const rainy = observation.weather === 'rain';
  const late = observation.timeOfDay === 'night' || observation.timeOfDay === 'late_night';
  const knowledgeRefs = [
    `visible:place:${observation.placeId}`,
    ...(rainy ? [`visible:weather:${observation.weather}`] : []),
  ];
  const atmosphere = rainy
    ? 'Rain against the storefront makes the small shop feel more enclosed.'
    : late
      ? 'The neighborhood shop feels different this late, even with the same shelves and counter.'
      : `I can take in the layout of ${observation.placeName} before deciding what I need.`;

  return source.requestInnerThought({
    kind: 'place_changed',
    topic: 'physical_shop_arrival',
    semanticMeaning: atmosphere,
    tone: rainy || late ? 'curious' : 'neutral',
    priority: 24,
    source: 'world:physical_shop',
    knowledgeRefs,
    cooldownKey: `physical_shop_arrival:${observation.placeId}`,
    presentation: 'ambient',
    knowledge: {
      visiblePlaceId: observation.placeId,
      ...(rainy ? { weatherHint: observation.weather } : {}),
      timeHint: observation.timeOfDay,
    },
  }, observation.nowMinute);
}
