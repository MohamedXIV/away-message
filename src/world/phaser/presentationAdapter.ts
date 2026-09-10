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

export interface CreateProjectionOptions {
  placeId: string;
  viewId?: string;
  timeOfDay?: TimeOfDay;
  weather?: WeatherType;
  customLights?: WorldPointLightDef[];
  focus?: WorldCameraFocus | null;
}

export function getLightingForTimeOfDay(
  timeOfDay: TimeOfDay,
  customLights: WorldPointLightDef[] = []
): WorldLightingProjection {
  // Check generated light profiles first
  const profile = GENERATED_LIGHT_PROFILES.find((p) => p.timeOfDay === timeOfDay);

  const ambientColorMap: Record<TimeOfDay, string> = {
    morning: '#fff2d0',
    day: '#ffffff',
    evening: '#ffaa77',
    night: '#2b334d',
    late_night: '#191e30',
  };

  const intensityMap: Record<TimeOfDay, number> = {
    morning: 0.8,
    day: 1.0,
    evening: 0.7,
    night: 0.35,
    late_night: 0.25,
  };

  const ambientColor = profile?.colorTint ?? ambientColorMap[timeOfDay] ?? '#ffffff';
  const ambientIntensity = profile?.intensity ?? intensityMap[timeOfDay] ?? 1.0;

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

export function getParticlesForWeather(weather: WeatherType): WorldParticleProjection {
  switch (weather) {
    case 'rain':
      return {
        dustMotes: false,
        rain: true,
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
  } = options;

  const place = GENERATED_PLACES.find((p) => p.id === placeId);
  const spaces = GENERATED_SPACES.filter((s) => s.placeId === placeId);
  const spaceIds = new Set(spaces.map((s) => s.id));
  const viewsInPlace = GENERATED_VIEWS.filter((v) => spaceIds.has(v.spaceId));

  const activeView = (viewId ? viewsInPlace.find((v) => v.id === viewId) : viewsInPlace[0])
    ?? (viewId ? GENERATED_VIEWS.find((v) => v.id === viewId) : null);

  const activeSpace = activeView ? spaces.find((s) => s.id === activeView.spaceId) : null;

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

  const lighting = getLightingForTimeOfDay(timeOfDay, customLights);
  const particles = getParticlesForWeather(weather);

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
