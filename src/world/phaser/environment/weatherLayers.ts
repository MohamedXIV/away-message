// src/world/phaser/environment/weatherLayers.ts

import type { WeatherType } from '../../types';

export interface WeatherLayerOptions {
  weather: WeatherType;
  isInterior?: boolean;
  rainIntensity?: number;
  /**
   * Whether an interior renderer has a real window mask for exterior rain.
   * The technical fixture defaults to true; authored backgrounds without a
   * mask must opt out so rain never draws over the room image.
   */
  allowUnmaskedInteriorRain?: boolean;
}

export interface WeatherLayerResolution {
  backgroundRain: boolean;
  foregroundRain: boolean;
  windowDroplets: boolean;
  surfaceSplashes: boolean;
  dustMotes: boolean;
  rainIntensity: number;
  wetSurfaceProminence: number;
}

/**
 * Resolves active weather layers obeying indoor/outdoor occlusion.
 * Generic and renderer-neutral without location-specific logic.
 */
export function resolveWeatherLayers(options: WeatherLayerOptions): WeatherLayerResolution {
  const {
    weather,
    isInterior = true,
    rainIntensity = 1.0,
    allowUnmaskedInteriorRain = true,
  } = options;
  const isRaining = weather === 'rain';

  if (!isRaining) {
    return {
      backgroundRain: false,
      foregroundRain: false,
      windowDroplets: false,
      surfaceSplashes: false,
      dustMotes: true,
      rainIntensity: 0,
      wetSurfaceProminence: 0,
    };
  }

  if (isInterior) {
    if (!allowUnmaskedInteriorRain) {
      // A production background is one opaque image until a renderer-level
      // window mask/shader exists. Keeping the rain state but suppressing all
      // unmasked particles is safer than drawing weather across the room.
      return {
        backgroundRain: false,
        foregroundRain: false,
        windowDroplets: false,
        surfaceSplashes: false,
        dustMotes: false,
        rainIntensity,
        wetSurfaceProminence: 0,
      };
    }

    // Indoor spaces: rain falls in the distant exterior layer (visible through windows),
    // produces window droplets/condensation on glass, but suppresses foreground streaks
    // and floor splashes.
    return {
      backgroundRain: true,
      foregroundRain: false,
      windowDroplets: true,
      surfaceSplashes: false,
      dustMotes: false,
      rainIntensity,
      wetSurfaceProminence: 0.4,
    };
  }

  // Outdoor spaces: full foreground streaks, distant rain, and surface splashes.
  return {
    backgroundRain: true,
    foregroundRain: true,
    windowDroplets: false,
    surfaceSplashes: true,
    dustMotes: false,
    rainIntensity,
    wetSurfaceProminence: 1.0,
  };
}
