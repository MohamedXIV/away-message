// src/world/phaser/types.ts

import type React from 'react';
import type { TimeOfDay, WeatherType } from '../types';
import type { PuddleZoneDef } from './environment/puddles';
import type { AmbientMotionDef } from './environment/ambientMotion';
import type { AuthoredLightDef } from './environment/lightingEngine';
import type { SpatialAudioSourceDef, ListenerOrientation } from '../../audio/types';

export interface WorldPointLightDef {
  id: string;
  x: number; // 0..1 normalized or world px
  y: number; // 0..1 normalized or world px
  radius: number;
  color: string;
  intensity: number;
  movable?: boolean;
}

export interface WorldLightingProjection {
  ambientColor: string;
  ambientIntensity: number;
  pointLights: WorldPointLightDef[];
}

export interface WorldParticleProjection {
  dustMotes: boolean;
  rain: boolean;
  density: number;
}

export interface WorldInteractionDef {
  id: string;
  capability: string;
  name: string;
  tags: string[];
}

export interface WorldAnchorProjection {
  id: string;
  name: string;
  x: number; // 0..1 normalized coordinate
  y: number; // 0..1 normalized coordinate
  tags: string[];
  interactions: WorldInteractionDef[];
}

export interface WorldViewSummary {
  id: string;
  name: string;
  assetId: string | null;
  neighbors: string[];
}

export interface WorldCameraFocus {
  x: number; // 0..1 normalized or world coordinate
  y: number;
  zoom: number;
}

export interface WorldSceneProjection {
  placeId: string;
  placeName: string;
  spaceId: string;
  spaceName: string;
  viewId: string;
  viewName: string;
  assetId: string | null;
  normalMapAssetId: string | null;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  lighting: WorldLightingProjection;
  particles: WorldParticleProjection;
  anchors: WorldAnchorProjection[];
  availableViews: WorldViewSummary[];
  focus?: WorldCameraFocus | null;
  minuteOfDay?: number;
  isInterior?: boolean;
  windIntensity?: number;
  puddleZones?: PuddleZoneDef[];
  ambientMotions?: AmbientMotionDef[];
  authoredLights?: AuthoredLightDef[];
  spatialAudioSources?: SpatialAudioSourceDef[];
  listenerOrientation?: ListenerOrientation;
}

export type WorldInteractionIntentType =
  | 'INTERACTION'
  | 'VIEW_TRANSITION'
  | 'HOTSPOT_HOVER';

export interface WorldInteractionIntent {
  type: WorldInteractionIntentType;
  anchorId?: string;
  capability?: string;
  name?: string;
  targetViewId?: string;
  hoveredAnchorId?: string | null;
  payload?: Record<string, unknown>;
}

export interface PhysicalWorldHostProps {
  projection: WorldSceneProjection;
  onIntent?: (intent: WorldInteractionIntent) => void;
  overlaySlot?: React.ReactNode;
  className?: string;
  debug?: boolean;
}

export interface WorldFixtureCapabilityReport {
  reactLifecycle: boolean;
  noDuplicateCanvas: boolean;
  layeredRendering: boolean;
  normalMapLighting: boolean;
  movablePointLight: boolean;
  particles: boolean;
  renderTextureFilter: boolean;
  hotspotInteraction: boolean;
  cameraTransition: boolean;
  hidpiResize: boolean;
  dayPhaseInterpolation: boolean;
  ambientMotion: boolean;
  weatherOcclusion: boolean;
  puddleZones: boolean;
  spatialAudio: boolean;
}
