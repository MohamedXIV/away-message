// src/audio/environmentMapping.ts
import type { EnvironmentSnapshot } from '../engine/GameContext';

export interface EnvironmentAudioParameters {
  precipitation: number;
  wind: number;
  visibility: number;
  wet: boolean;
  severe: boolean;
}

export function projectEnvironmentAudio(
  snapshot: EnvironmentSnapshot,
): EnvironmentAudioParameters {
  return {
    precipitation: snapshot.weather.precipitation,
    wind: snapshot.weather.wind,
    visibility: snapshot.weather.visibility,
    wet: snapshot.weather.tags.includes('wet'),
    severe: snapshot.weather.tags.includes('severe'),
  };
}
