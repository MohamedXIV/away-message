// src/audio/environmentMapping.ts
import type { GameContextEnvironmentSnapshot } from '../engine/GameContext';

export interface EnvironmentAudioParameters {
  precipitation: number;
  wind: number;
  visibility: number;
  wet: boolean;
  severe: boolean;
}

export function projectEnvironmentAudio(
  snapshot: GameContextEnvironmentSnapshot,
): EnvironmentAudioParameters {
  return {
    precipitation: snapshot.weather.precipitation,
    wind: snapshot.weather.wind,
    visibility: snapshot.weather.visibility,
    wet: snapshot.weather.tags.includes('wet'),
    severe: snapshot.weather.tags.includes('severe'),
  };
}
