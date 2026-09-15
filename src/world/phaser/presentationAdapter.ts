// src/world/phaser/presentationAdapter.ts

import {
  GENERATED_PLACES,
  GENERATED_SPACES,
  GENERATED_VIEWS,
  GENERATED_ANCHORS,
  GENERATED_INTERACTIONS,
  GENERATED_ASSETS,
  GENERATED_LIGHT_PROFILES,
} from '../../engine/worldContent.generated';
import type { TimeOfDay, WeatherType } from '../types';
import type {
  WorldSceneProjection,
  WorldLightingProjection,
  WorldParticleProjection,
  WorldAnchorProjection,
  WorldViewSummary,
  WorldCameraFocus,
  WorldInteractionIntent,
  WorldPointLightDef,
} from './types';

import { interpolateDayPhase, CANONICAL_DAY_PHASES } from './environment/dayPhases';
import type { PuddleZoneDef } from './environment/puddles';
import type { AmbientMotionDef } from './environment/ambientMotion';
import type { AuthoredLightDef } from './environment/lightingEngine';
import type { SpatialAudioSourceDef, ListenerOrientation } from '../../audio/types';

export interface CreateProjectionOptions {
  placeId: string;
  viewId?: string;
  timeOfDay?: TimeOfDay;
  minuteOfDay?: number;
  weather?: WeatherType;
  customLights?: WorldPointLightDef[];
  authoredLights?: AuthoredLightDef[];
  puddleZones?: PuddleZoneDef[];
  ambientMotions?: AmbientMotionDef[];
  windIntensity?: number;
  isInterior?: boolean;
  focus?: WorldCameraFocus | null;
  spatialAudioSources?: SpatialAudioSourceDef[];
  listenerOrientation?: ListenerOrientation;
}

export function getMinuteForTimeOfDay(timeOfDay: TimeOfDay): number {
  switch (timeOfDay) {
    case 'morning':
      return CANONICAL_DAY_PHASES.dawn_morning.minuteOfDay;
    case 'day':
      return CANONICAL_DAY_PHASES.day.minuteOfDay;
    case 'evening':
      return CANONICAL_DAY_PHASES.dusk_evening.minuteOfDay;
    case 'night':
      return 1320; // 22:00 (evening-to-night transition)
    case 'late_night':
      return CANONICAL_DAY_PHASES.night_late_night.minuteOfDay; // 150 (02:30 deepest night)
    default:
      return 720;
  }
}

export function getLightingForTimeOfDay(
  timeOfDay: TimeOfDay,
  customLights: WorldPointLightDef[] = [],
  minuteOfDay?: number
): WorldLightingProjection {
  const hasPreciseMinute = minuteOfDay !== undefined;
  const minute = minuteOfDay ?? getMinuteForTimeOfDay(timeOfDay);
  const phaseParams = interpolateDayPhase(minute);

  // Coarse callers may opt into authored time-of-day profile overrides. When
  // an exact minute is supplied, preserve the generic continuous day-phase
  // interpolation instead of freezing an entire coarse label to one profile.
  const profile = hasPreciseMinute
    ? undefined
    : GENERATED_LIGHT_PROFILES.find((p) => p.timeOfDay === timeOfDay);

  const ambientColor = profile?.colorTint ?? phaseParams.ambientColor;
  const ambientIntensity = profile ? profile.intensity : phaseParams.ambientIntensity;

  // Default point lights if none provided
  const pointLights: WorldPointLightDef[] = customLights.length > 0
    ? customLights
    : [
        {
          id: 'primary_lamp',
          x: 0.5,
          y: 0.4,
          radius: 350,
          color: timeOfDay === 'night' || timeOfDay === 'late_night' ? '#ffea9f' : '#fff5d6',
          intensity: timeOfDay === 'night' || timeOfDay === 'late_night' ? 1.8 : 0.8,
          movable: true,
        },
      ];

  return {
    ambientColor,
    ambientIntensity,
    pointLights,
  };
}

export function getParticlesForWeather(
  weather: WeatherType,
  isInterior = false,
): WorldParticleProjection {
  switch (weather) {
    case 'rain':
      return {
        dustMotes: false,
        // `rain` is the full-screen/foreground particle layer. Interior
        // projections keep the weather state but leave this layer to the
        // EnvironmentManager's occlusion-aware background/window paths.
        rain: !isInterior,
        density: 1.0,
      };
    case 'cloudy':
      return {
        dustMotes: true,
        rain: false,
        density: 0.4,
      };
    case 'clear':
    default:
      return {
        dustMotes: true,
        rain: false,
        density: 0.6,
      };
  }
}

/**
 * Supplies a small generic ambience bed for authored projections without
 * requiring each place to invent renderer-specific audio wiring. Explicit
 * source definitions still win, which keeps technical fixtures and future
 * authored place-specific audio data intact.
 */
export function getDefaultSpatialAudioSources(
  weather: WeatherType,
  isInterior: boolean,
): SpatialAudioSourceDef[] {
  const sources: SpatialAudioSourceDef[] = [
    {
      id: 'environment_room_tone',
      eventId: 'ambience.room_tone',
      x: 0.5,
      y: 0.65,
      z: -0.35,
      loop: true,
      volume: 0.12,
      bus: 'ambience',
    },
  ];

  if (weather === 'rain') {
    sources.push({
      id: isInterior ? 'environment_window_rain' : 'environment_rain',
      eventId: 'ambience.weather.rain',
      x: isInterior ? 0.78 : 0.5,
      y: 0.25,
      z: 0.8,
      loop: true,
      volume: isInterior ? 0.25 : 0.55,
      bus: 'ambience',
      parameters: {
        rainIntensity: isInterior ? 0.35 : 1,
        muffled: isInterior ? 1 : 0,
      },
    });
  }

  return sources;
}

export function createWorldSceneProjection(
  options: CreateProjectionOptions
): WorldSceneProjection {
  const {
    placeId,
    viewId,
    timeOfDay = 'day',
    weather = 'clear',
    customLights = [],
    focus = null,
    minuteOfDay,
    authoredLights,
    puddleZones,
    ambientMotions,
    windIntensity = 0,
    isInterior: explicitIsInterior,
    spatialAudioSources,
    listenerOrientation,
  } = options;

  const place = GENERATED_PLACES.find((p) => p.id === placeId);
  const spaces = GENERATED_SPACES.filter((s) => s.placeId === placeId);
  const spaceIds = new Set(spaces.map((s) => s.id));
  const viewsInPlace = GENERATED_VIEWS.filter((v) => spaceIds.has(v.spaceId));

  const activeView = viewId ? viewsInPlace.find((v) => v.id === viewId) : viewsInPlace[0];

  // Authored places must never borrow a globally matching view from another place.
  // Keep the legacy empty-projection fallback for wholly unauthored/missing places so
  // callers can fail soft while content authoring is incomplete.
  if (place && viewId && !activeView) {
    throw new Error(`View ${viewId} does not belong to place ${placeId}`);
  }

  const activeSpace = activeView ? spaces.find((s) => s.id === activeView.spaceId) : null;
  const isInterior = explicitIsInterior ?? (activeSpace ? !activeSpace.tags.includes('exterior') : true);

  // Asset resolution
  let assetId: string | null = activeView?.assetId ?? null;
  let normalMapAssetId: string | null = null;
  if (assetId) {
    const assetDef = GENERATED_ASSETS.find((a) => a.id === assetId);
    if (assetDef) {
      normalMapAssetId = assetDef.normalMapAssetId ?? null;
    }
  }

  // Anchors for active view
  const anchorsForView = activeView
    ? GENERATED_ANCHORS.filter((a) => a.viewId === activeView.id)
    : [];

  const anchorProjections: WorldAnchorProjection[] = anchorsForView.map((a) => {
    const interactions = GENERATED_INTERACTIONS.filter((i) => i.anchorId === a.id);
    return {
      id: a.id,
      name: a.name,
      x: a.x,
      y: a.y,
      tags: a.tags,
      interactions: interactions.map((i) => ({
        id: i.id,
        capability: i.capability,
        name: i.name,
        tags: i.tags,
      })),
    };
  });

  // Sibling available views
  const availableViews: WorldViewSummary[] = viewsInPlace.map((v) => ({
    id: v.id,
    name: v.name,
    assetId: v.assetId,
    neighbors: v.neighbors,
  }));

  const effectiveMinute = minuteOfDay ?? getMinuteForTimeOfDay(timeOfDay);
  const lighting = getLightingForTimeOfDay(timeOfDay, customLights, minuteOfDay);
  const particles = getParticlesForWeather(weather, isInterior);
  const resolvedSpatialAudioSources = spatialAudioSources
    ?? (activeView ? getDefaultSpatialAudioSources(weather, isInterior) : undefined);

  return {
    placeId,
    placeName: place?.name ?? placeId,
    spaceId: activeSpace?.id ?? (spaces[0]?.id ?? ''),
    spaceName: activeSpace?.name ?? (spaces[0]?.name ?? ''),
    viewId: activeView?.id ?? (viewId ?? ''),
    viewName: activeView?.name ?? (viewId ?? ''),
    assetId,
    normalMapAssetId,
    timeOfDay,
    weather,
    lighting,
    particles,
    anchors: anchorProjections,
    availableViews,
    focus,
    minuteOfDay: effectiveMinute,
    isInterior,
    windIntensity,
    puddleZones,
    ambientMotions,
    authoredLights,
    spatialAudioSources: resolvedSpatialAudioSources,
    listenerOrientation,
  };
}

export function createSemanticInteractionIntent(
  anchorId: string,
  capability: string,
  name: string,
  payload?: Record<string, unknown>
): WorldInteractionIntent {
  return {
    type: 'INTERACTION',
    anchorId,
    capability,
    name,
    payload,
  };
}

export function createViewTransitionIntent(
  targetViewId: string,
  payload?: Record<string, unknown>
): WorldInteractionIntent {
  return {
    type: 'VIEW_TRANSITION',
    targetViewId,
    payload,
  };
}
