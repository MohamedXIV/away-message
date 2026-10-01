// src/world/phaser/environment/environmentProjection.ts
import type { EnvironmentSnapshot } from '../../../engine/EnvironmentEngine';
import type { WeatherType } from '../../types';

export interface EnvironmentPresentationProfile {
  weather: WeatherType;
  rainIntensity: number;
  windIntensity: number;
  visibility: number;
  temperatureF: number;
  tags: string[];
}

export function projectEnvironmentPresentation(
  snapshot: EnvironmentSnapshot,
): EnvironmentPresentationProfile {
  const condition = snapshot.weather.condition;
  const weather: WeatherType =
    snapshot.weather.precipitation > 0.05
      || condition === 'rain'
      || condition === 'drizzle'
      || condition === 'storm'
      ? 'rain'
      : condition === 'overcast' || condition === 'fog'
        ? 'cloudy'
        : 'clear';

  return {
    weather,
    rainIntensity: snapshot.weather.precipitation,
    windIntensity: snapshot.weather.wind,
    visibility: snapshot.weather.visibility,
    temperatureF: snapshot.weather.temperatureF,
    tags: [...snapshot.weather.tags],
  };
}
