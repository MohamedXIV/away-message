// src/world/phaser/types.ts

import type React from 'react';
import type { WorldSceneCharacterMount } from './WorldSceneCharacters';
import type { TimeOfDay, WeatherType } from '../types';
import type { PuddleZoneDef } from './environment/puddles';
import type { AmbientMotionDef, SoftSurfaceMotionDef } from './environment/ambientMotion';
import type { AuthoredLightDef } from './environment/lightingEngine';
import type { SpatialAudioSourceDef, ListenerOrientation } from '../../audio/types';
import type { EnvironmentSnapshot } from '../../engine/GameContext';

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
  actorId?: string;
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

export interface WorldScenePropProjection {
  id: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  /** 'backdrop' renders below the view image; default routes by depth. */
  renderLayer?: 'auto' | 'backdrop';
  /** Clip this prop's scene container to the authored weather-window zones. */
  maskZone?: boolean;
  /**
   * Runtime-assigned: this prop draws inside the window-mask group because
   * it is masked or is a hanging soft surface. Never authored.
   */
  maskedMember?: boolean;
  /** Presentation variant group: one visible member at a time. */
  swapGroup?: string | null;
  /** This prop's variant name within its swap group. */
  variant?: string | null;
  /** Additive practical glow renders with the ADD blend mode. */
  blendMode?: 'normal' | 'add' | 'screen';
  /** Soft-surface vertex sway (Phaser Rope) instead of a rigid transform. */
  softSurface?: boolean;
  softSegments?: number;
  /** Override the shared authored-light id for swap-group members. */
  lightId?: string | null;
  /** Skip the rigid ambient-motion transform for this prop. */
  motionSuppressed?: boolean;
  /** Hide the prop without rebuilding the room presentation. */
  hidden?: boolean;
}

export interface WorldWeatherWindowZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  /** Canonical semantic Environment truth. Legacy coarse weather remains presentation-only. */
  environment?: EnvironmentSnapshot;
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
  sceneProps?: WorldScenePropProjection[];
  weatherWindowZones?: WorldWeatherWindowZone[];
  /** Hanging soft surfaces (Phaser Rope); never a rigid transform or physics cloth. */
  softSurfaces?: SoftSurfaceMotionDef[];
  /** Presentation-only layered-room evidence used by QA stats. */
  roomPresentation?: WorldRoomPresentationProjection;
  listenerOrientation?: ListenerOrientation;
}

/**
 * Presentation-only summary of how a layered room projection was composed.
 * It carries no simulation state; it exists so runtime stats and browser QA
 * can prove fixture/layer independence without inventing new authorities.
 */
export interface WorldRoomPresentationProjection {
  backdropPropIds: string[];
  maskedContainerIds: string[];
  swapGroups: Record<string, { variants: string[]; active: string | null }>;
  lampOn: boolean;
  rainIntensity: number;
  hasWindowZone: boolean;
}

export type WorldInteractionIntentType =
  | 'INTERACTION'
  | 'VIEW_TRANSITION'
  | 'HOTSPOT_HOVER';

export interface WorldInteractionIntent {
  type: WorldInteractionIntentType;
  anchorId?: string;
  actorId?: string;
  capability?: string;
  name?: string;
  targetViewId?: string;
  hoveredAnchorId?: string | null;
  payload?: Record<string, unknown>;
}

export interface PhysicalWorldHostProps {
  projection: WorldSceneProjection;
  /** Preloaded full-character renderers for the active authored view. The scene owns their disposal. */
  characters?: readonly WorldSceneCharacterMount[];
  onIntent?: (intent: WorldInteractionIntent) => void;
  overlaySlot?: React.ReactNode;
  className?: string;
  debug?: boolean;
  /** Exposes the runtime to browser QA without rendering the debug panel. */
  exposeRuntime?: boolean;
  visualMode?: 'production' | 'technical-fixture';
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
  /** A projection carrying layered-room data is actually driving the scene. */
  layeredRoom: boolean;
  /** #167: at least one Rope-backed soft surface is live. */
  softSurfaceMotion: boolean;
  /**
   * #167: the WebGL stencil window group is live. Canvas fallback and
   * stencil-less environments must report false rather than claim masking.
   */
  windowStencilMask: boolean;
  /** #167: independent fixture visibility (swap/hide) is available. */
  fixtureIndependence: boolean;
}
