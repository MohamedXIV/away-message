// src/world/phaser/layeredRoom/LivingRoomSpikePresentation.ts
//
// Issue #167 — Layered Living Starter-Room Phaser Spike.
//
// Presentation-only projection builder for one representative starter room.
// It reads authored content (the generated registries) plus QA/runtime
// display options and produces the same generic WorldSceneProjection the
// existing Phaser runtime already consumes.
//
// It owns no simulation truth: money, location, needs, sleep completion,
// inventory and time authority all stay in the engine. Everything here is
// "HOW SHOWN" and is recomputable from authored content plus a presentation
// snapshot at any time.

import {
  GENERATED_ANCHORS,
  GENERATED_ASSETS,
  GENERATED_AUDIO_PROFILES,
  GENERATED_LIGHT_PROFILES,
  GENERATED_SCENE_PROPS,
  GENERATED_SPACES,
  GENERATED_VIEWS,
  type GeneratedScenePropDef,
} from '../../../engine/worldContent.generated';
import type { EnvironmentSnapshot } from '../../../engine/GameContext';
import type { TimeOfDay, WeatherType } from '../../types';
import type { AmbientMotionDef, SoftSurfaceMotionDef } from '../environment/ambientMotion';
import type { AuthoredLightDef } from '../environment/lightingEngine';
import { projectEnvironmentPresentation } from '../environment/environmentProjection';
import {
  ART_TREATMENTS,
  BLOCKOUT_TREATMENT,
  resolveTreatmentAssetId,
  type ArtTreatment,
} from './artTreatments';
import {
  createWorldSceneProjection,
  getMinuteForTimeOfDay,
} from '../presentationAdapter';
import { textureHasLinkedNormalMap } from '../projectionAssets';
import type {
  WorldCameraFocus,
  WorldSceneProjection,
  WorldScenePropProjection,
  WorldWeatherWindowZone,
} from '../types';
import type { SpatialAudioSourceDef } from '../../../audio/types';

export type LivingRoomFocusTarget = 'hero' | 'desk' | 'window';

export const LIVING_ROOM_LAMP_LIGHT_ID = 'room-lamp-practical';

export interface LivingRoomSpikeOptions {
  placeId?: string;
  /** Coarse label; `minuteOfDay` refines it through the same day-phase curve. */
  timeOfDay?: TimeOfDay;
  minuteOfDay?: number;
  /** QA/manual weather override. Ignored when `environment` is supplied. */
  weather?: WeatherType;
  /** Canonical runtime environment snapshot; owns weather/wind semantics. */
  environment?: EnvironmentSnapshot;
  rainIntensity?: number;
  windIntensity?: number;
  /** Bedside practical state (a presentation toggle, never a sleep decision). */
  lampOn?: boolean;
  /**
   * Visible variant per authored swap group. `null` hides the whole group;
   * an unknown variant keeps the authored first variant.
   */
  fixtureVariants?: Readonly<Record<string, string | null>>;
  focus?: LivingRoomFocusTarget;
  focusZoom?: number;
  /** Runtime-resolved authored prop ids to hide without repainting the room. */
  hiddenPropIds?: readonly string[];
  /**
   * QA/runtime geometry overrides (movable furnishings). Only the named props
   * move/resize; authored content stays the source of truth for everything
   * else. Geometry is part of the room structure signature, so a change here
   * takes the rebuild path instead of leaving stale sprites behind.
   */
  propGeometryOverrides?: Readonly<Record<string, RoomPropGeometry>>;
  /**
   * #159 art-direction comparison: swap every authored layer to one
   * treatment's production variants (same ids, same geometry, different
   * art). Defaults to the blockout/shared-reference baseline.
   */
  artTreatment?: ArtTreatment;
  actorByAnchorId?: Readonly<Record<string, string>>;
}

export interface RoomPropGeometry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
}

export interface RoomPresentationInput {
  viewId: string;
  weather?: WeatherType;
  rainIntensity?: number;
  windIntensity?: number;
  lampOn?: boolean;
  fixtureVariants?: Readonly<Record<string, string | null>>;
  hiddenPropIds?: readonly string[];
  propGeometryOverrides?: Readonly<Record<string, RoomPropGeometry>>;
  /** #159: authored art treatment for every layer in this view. */
  artTreatment?: ArtTreatment;
}

export interface RoomPresentationResult {
  props: WorldScenePropProjection[];
  motions: AmbientMotionDef[];
  softSurfaces: SoftSurfaceMotionDef[];
  weatherWindowZones: WorldWeatherWindowZone[];
  authoredLights: AuthoredLightDef[];
  spatialAudioSources: SpatialAudioSourceDef[];
  backdropPropIds: string[];
  maskedContainerIds: string[];
  swapGroups: Record<string, { variants: string[]; active: string | null }>;
}

const DEFAULT_PLACE_ID = 'room_spike_a';
const DEFAULT_FOCUS_ZOOM = 1.35;
const SOFT_SURFACE_SEGMENTS = 14;

/** Generated rows carry blend mode as a string; validators pin the domain. */
function asBlendMode(value: string): 'normal' | 'add' | 'screen' {
  return value === 'add' || value === 'screen' ? value : 'normal';
}

/** The authored view for the representative room, or null when absent. */
export function resolveLivingRoomSpikeViewId(placeId: string = DEFAULT_PLACE_ID): string | null {
  const spaceIds = new Set(
    GENERATED_SPACES.filter((space) => space.placeId === placeId).map((space) => space.id),
  );
  if (spaceIds.size === 0) return null;
  const view = GENERATED_VIEWS.find(
    (candidate) => spaceIds.has(candidate.spaceId)
      && GENERATED_SCENE_PROPS.some((prop) => prop.viewId === candidate.id),
  );
  return view?.id ?? null;
}

function propLightForProfile(
  prop: GeneratedScenePropDef,
  profileId: string,
  anchor: { x: number; y: number },
  variantOwner: boolean,
): AuthoredLightDef | null {
  const profile = GENERATED_LIGHT_PROFILES.find((candidate) => candidate.id === profileId);
  if (!profile) return null;
  const isWindow = profile.tags.includes('window') || profile.tags.includes('daylight');
  const isExterior = isWindow || profile.tags.includes('exterior');
  const flicker = profile.tags.includes('fluorescent')
    ? ({ type: 'fluorescent', frequency: 7.5, amplitude: 0.06 } as const)
    : profile.tags.includes('subtle') || profile.tags.includes('lamp')
      ? ({ type: 'subtle', frequency: 1.1, amplitude: 0.035 } as const)
      : null;

  return {
    // Swap-group members share one authored light id so a variant swap never
    // creates or destroys a light — the light is presentation-stable.
    id: isWindow ? `room-window-light-${prop.id}` : (variantOwner ? LIVING_ROOM_LAMP_LIGHT_ID : `room-light-${prop.id}`),
    kind: isWindow ? 'window' : 'lamp',
    x: anchor.x,
    y: anchor.y,
    radius: isWindow ? 340 : 300,
    color: profile.colorTint ?? '#ffffff',
    baseIntensity: profile.intensity,
    ...(flicker ? { flicker } : {}),
    normalMapped: profile.tags.includes('normal-map'),
    movable: false,
    isExterior,
  };
}

function propAudioForProfile(
  prop: GeneratedScenePropDef,
  profileId: string,
  anchor: { x: number; y: number },
): SpatialAudioSourceDef | null {
  const profile = GENERATED_AUDIO_PROFILES.find((candidate) => candidate.id === profileId);
  if (!profile) return null;
  return {
    id: `room-audio-${prop.id}-${profile.id}`,
    eventId: `ambience.fixture.${profile.kind}`,
    x: anchor.x,
    y: anchor.y,
    z: -0.1,
    loop: true,
    volume: profile.volume,
    bus: 'ambience',
    rolloffFactor: 0.65,
  };
}

/**
 * Generic layered-room presentation projection. Any authored view whose
 * scene props carry the new presentation columns renders through this same
 * path — nothing here names a specific prop, variant, or room id.
 */
export function projectRoomPresentation(input: RoomPresentationInput): RoomPresentationResult {
  const authoredProps = GENERATED_SCENE_PROPS
    .filter((prop) => prop.viewId === input.viewId)
    .slice()
    .sort((a, b) => (a.depth - b.depth) || a.id.localeCompare(b.id));

  const props: WorldScenePropProjection[] = [];
  const motions: AmbientMotionDef[] = [];
  const softSurfaces: SoftSurfaceMotionDef[] = [];
  const weatherWindowZones: WorldWeatherWindowZone[] = [];
  const authoredLights: AuthoredLightDef[] = [];
  const spatialAudioSources: SpatialAudioSourceDef[] = [];
  const backdropPropIds: string[] = [];
  const maskedContainerIds: string[] = [];
  const hidden = new Set(input.hiddenPropIds ?? []);

  // Resolve swap groups first so a variant change only touches that group.
  const groups = new Map<string, GeneratedScenePropDef[]>();
  for (const prop of authoredProps) {
    if (!prop.swapGroup) continue;
    const bucket = groups.get(prop.swapGroup) ?? [];
    bucket.push(prop);
    groups.set(prop.swapGroup, bucket);
  }
  const activeByGroup = new Map<string, string | null>();
  const swapGroups: Record<string, { variants: string[]; active: string | null }> = {};
  for (const [group, members] of groups) {
    const variants = members.map((member) => member.variant ?? member.id);
    const requested = input.fixtureVariants?.[group];
    const active = requested === null
      ? null
      : requested !== undefined && variants.includes(requested)
        ? requested
        : (variants[0] ?? null);
    activeByGroup.set(group, active);
    swapGroups[group] = { variants, active };
  }

  let windowCenter: { x: number; y: number } | null = null;

  for (const prop of authoredProps) {
    const anchor = GENERATED_ANCHORS.find((candidate) => candidate.id === prop.anchorId);
    if (!anchor) continue;

    const asset = GENERATED_ASSETS.find((candidate) => candidate.id === prop.assetId);
    if (!asset || asset.kind !== 'image' || !asset.tags.includes('production')) continue;

    const variant = prop.swapGroup ? (prop.variant ?? prop.id) : null;
    const groupActive = prop.swapGroup
      ? activeByGroup.get(prop.swapGroup) === variant
      : true;
    const isSoftSurface = prop.motionType === 'soft_sway';
    const isMasked = prop.maskZone;
    // Geometry overrides (movable furnishings) replace the effective anchor
    // and size BEFORE any derivation, so the emitted prop, its window zone,
    // and its light/audio placements all move together — a moved window
    // cannot leave a stale clip rect behind.
    const geometry = input.propGeometryOverrides?.[prop.id];
    const ax = geometry?.x ?? anchor.x;
    const ay = geometry?.y ?? anchor.y;
    const pw = geometry?.width ?? prop.width;
    const ph = geometry?.height ?? prop.height;
    const pdepth = geometry?.depth ?? prop.depth;
    if (isMasked) maskedContainerIds.push(prop.id);
    if (prop.renderLayer === 'backdrop') backdropPropIds.push(prop.id);
    if (prop.tags.includes('weather-window')) {
      const zone = {
        x: ax - pw / 2,
        y: ay - ph / 2,
        width: pw,
        height: ph,
      };
      weatherWindowZones.push({ id: prop.id, ...zone });
      if (!windowCenter) windowCenter = { x: ax, y: ay };
    }

    for (const profileId of prop.lightProfileIds) {
      const light = propLightForProfile(
        prop,
        profileId,
        { x: ax, y: ay },
        // Only the active member of a swap group contributes the shared light.
        !prop.swapGroup || groupActive,
      );
      // Interior practicals are gated by the lamp toggle; daylight is not.
      if (!light) continue;
      const isLamp = light.kind === 'lamp';
      if (isLamp && input.lampOn === false) continue;
      authoredLights.push(light);
    }

    for (const profileId of prop.audioProfileIds) {
      const source = propAudioForProfile(prop, profileId, { x: ax, y: ay });
      if (source) spatialAudioSources.push(source);
    }

    // All swap-group members are emitted; the inactive ones carry hidden
    // flags. A fixture swap is then a visibility change on two images
    // instead of an asset re-resolve, so the rest of the room keeps its
    // exact runtime identity.
    props.push({
      id: prop.id,
      // #159: one authored layer id per treatment. Unauthored variants
      // fall back to the blockout row, so a partially produced treatment
      // set still renders through the same generic pipeline.
      assetId: resolveTreatmentAssetId(prop.assetId, input.artTreatment ?? BLOCKOUT_TREATMENT),
      x: ax,
      // A hanging soft surface is pinned at its top edge, so its anchor is
      // the header, not the centre.
      y: isSoftSurface ? ay - ph / 2 : ay,
      width: pw,
      height: ph,
      depth: pdepth,
      renderLayer: prop.renderLayer === 'backdrop' ? 'backdrop' : 'auto',
      maskZone: isMasked,
      // Runtime membership in the window-mask group: masked glass AND the
      // hanging soft surface both clip to the authored window rects.
      maskedMember: isMasked || isSoftSurface,
      swapGroup: prop.swapGroup ?? null,
      variant: variant,
      blendMode: asBlendMode(prop.blendMode),
      softSurface: isSoftSurface,
      // Masked glass belongs to its window group; soft surfaces deform
      // instead of taking a rigid transform. Neither gets rigid motion.
      motionSuppressed: isMasked || isSoftSurface,
      hidden: !groupActive || hidden.has(prop.id),
    });

    if (isSoftSurface) {
      softSurfaces.push({
        id: `soft-${prop.id}`,
        targetName: prop.id,
        type: 'soft_sway',
        speed: prop.motionSpeed,
        amplitude: prop.motionAmplitude,
        segments: SOFT_SURFACE_SEGMENTS,
      });
    } else if (prop.motionType) {
      motions.push({
        id: `motion-${prop.id}`,
        targetName: prop.id,
        type: prop.motionType as AmbientMotionDef['type'],
        speed: prop.motionSpeed,
        amplitude: prop.motionAmplitude,
      });
    }
  }

  const weather = input.weather ?? 'clear';
  const rainIntensity = input.rainIntensity ?? (weather === 'rain' ? 1 : 0);

  // Room tone bed first, so authored fixture loops join a stable order.
  spatialAudioSources.unshift({
    id: 'environment_room_tone',
    eventId: 'ambience.room_tone',
    x: 0.5,
    y: 0.65,
    z: -0.35,
    loop: true,
    volume: 0.12,
    bus: 'ambience',
  });

  // Interior rain stays outside and window-aware: it only joins the source
  // list when the view actually authors a window zone.
  if (weather === 'rain' && rainIntensity > 0 && weatherWindowZones.length > 0) {
    const at = windowCenter ?? { x: 0.5, y: 0.3 };
    spatialAudioSources.push({
      id: 'environment_window_rain',
      eventId: 'ambience.weather.rain',
      x: at.x,
      y: at.y,
      z: 0.8,
      loop: true,
      volume: 0.25,
      bus: 'ambience',
      parameters: {
        rainIntensity: rainIntensity * 0.35,
        windIntensity: input.windIntensity ?? 0,
        muffled: 1,
      },
    });
  }

  return {
    props,
    motions,
    softSurfaces,
    weatherWindowZones,
    authoredLights,
    spatialAudioSources,
    backdropPropIds,
    maskedContainerIds,
    swapGroups,
  };
}

function focusForTarget(
  target: LivingRoomFocusTarget,
  viewId: string,
  zoom: number,
): WorldCameraFocus {
  if (target === 'hero') return { x: 0.5, y: 0.5, zoom: 1 };
  const wanted = target === 'desk' ? 'desk' : 'window';
  const anchor = GENERATED_ANCHORS.find(
    (candidate) => candidate.viewId === viewId && candidate.tags.includes(wanted),
  );
  if (!anchor) return { x: 0.5, y: 0.5, zoom: 1 };
  return { x: anchor.x, y: anchor.y, zoom };
}

/**
 * Builds the full WorldSceneProjection for the layered starter room. The
 * projection stays a generic presentation object; WorldScene needs no
 * place-specific logic to render it.
 */
export function createLivingRoomSpikeProjection(
  options: LivingRoomSpikeOptions = {},
): WorldSceneProjection {
  const placeId = options.placeId ?? DEFAULT_PLACE_ID;
  const viewId = resolveLivingRoomSpikeViewId(placeId);
  if (!viewId) throw new Error(`Layered room spike place '${placeId}' has no authored scene props.`);

  const timeOfDay = options.timeOfDay ?? 'day';
  const minuteOfDay = options.minuteOfDay ?? getMinuteForTimeOfDay(timeOfDay);
  const environment = options.environment;
  const presentation = environment ? projectEnvironmentPresentation(environment) : null;
  const weather: WeatherType = presentation?.weather ?? options.weather ?? 'clear';
  const rainIntensity = presentation?.rainIntensity
    ?? options.rainIntensity
    ?? (weather === 'rain' ? 1 : 0);
  const windIntensity = presentation?.windIntensity
    ?? options.windIntensity
    ?? (weather === 'rain' ? 0.35 : 0.06);
  const lampOn = options.lampOn ?? true;

  // Interior rain stays outside and window-aware. The generic adapter keeps
  // the fullscreen foreground streak layer off for interiors; a layered
  // room with an authored window zone re-enables a window-bounded streak
  // path in the runtime instead (see WorldScene.setupWindowRain), so the
  // particles flag deliberately stays authored-resolved.
  const room = projectRoomPresentation({
    viewId,
    weather,
    rainIntensity,
    windIntensity,
    lampOn,
    fixtureVariants: options.fixtureVariants,
    hiddenPropIds: options.hiddenPropIds,
    propGeometryOverrides: options.propGeometryOverrides,
    artTreatment: options.artTreatment,
  });

  const base = createWorldSceneProjection({
    placeId,
    viewId,
    timeOfDay,
    minuteOfDay,
    weather,
    ...(environment ? { environment } : {}),
    customLights: [],
    authoredLights: room.authoredLights,
    ambientMotions: room.motions,
    // Explicit list wins over the adapter default, so interior rain audio
    // is authored-window-placed and only present when a window exists.
    spatialAudioSources: room.spatialAudioSources,
    listenerOrientation: 'forward',
    isInterior: true,
    windIntensity,
    focus: focusForTarget(options.focus ?? 'hero', viewId, options.focusZoom ?? DEFAULT_FOCUS_ZOOM),
    actorByAnchorId: options.actorByAnchorId,
  });

  // #159: the view background (static architecture) follows the same
  // treatment convention as the props. The variant row owns its normal map,
  // so both are re-read from the generated registry rather than inherited
  // from the blockout row.
  const treatment = options.artTreatment ?? BLOCKOUT_TREATMENT;
  const backgroundAssetId = base.assetId
    ? resolveTreatmentAssetId(base.assetId, treatment, GENERATED_ASSETS)
    : null;
  const backgroundNormalMapId = backgroundAssetId
    ? GENERATED_ASSETS.find((candidate) => candidate.id === backgroundAssetId)?.normalMapAssetId ?? null
    : null;

  // Load every authored treatment up front so the QA comparison switches
  // treatments on the rebuild path without a visible download hitch. Base
  // ids come from the authored rows (room.props already carries resolved
  // variant ids), and the generic plan still gates each id through the
  // production tag.
  const authoredBaseAssetIds = new Set<string>();
  if (base.assetId) authoredBaseAssetIds.add(base.assetId);
  for (const prop of GENERATED_SCENE_PROPS) {
    if (prop.viewId === viewId && prop.assetId) authoredBaseAssetIds.add(prop.assetId);
  }
  const preloadAssetIds = new Set<string>();
  for (const variant of ART_TREATMENTS) {
    for (const baseId of authoredBaseAssetIds) {
      preloadAssetIds.add(resolveTreatmentAssetId(baseId, variant.id, GENERATED_ASSETS));
    }
  }

  return {
    ...base,
    ...(base.assetId ? { assetId: backgroundAssetId, normalMapAssetId: backgroundNormalMapId } : {}),
    preloadAssetIds: [...preloadAssetIds],
    sceneProps: room.props,
    weatherWindowZones: room.weatherWindowZones,
    softSurfaces: room.softSurfaces,
    roomPresentation: {
      backdropPropIds: room.backdropPropIds,
      maskedContainerIds: room.maskedContainerIds,
      swapGroups: room.swapGroups,
      lampOn,
      rainIntensity,
      hasWindowZone: room.weatherWindowZones.length > 0,
    },
  };
}

/**
 * Reports whether a projection's authored normal map is actually usable by
 * the runtime lighting path (diffuse texture loaded with a linked data
 * source). Presentation evidence only — never a substitute for the gate.
 */
export function roomNormalMapIsLit(
  projection: WorldSceneProjection,
  textures: { exists(key: string): boolean; get?(key: string): unknown } | null | undefined,
): boolean {
  if (!projection.assetId || !projection.normalMapAssetId) return false;
  return textureHasLinkedNormalMap(textures, projection.assetId);
}
