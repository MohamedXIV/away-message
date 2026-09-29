import {
  GENERATED_ANCHORS,
  GENERATED_AUDIO_PROFILES,
  GENERATED_LIGHT_PROFILES,
  GENERATED_SCENE_PROPS,
  GENERATED_SHOP_FIXTURES,
} from '../../engine/worldContent.generated';
import type { TimeOfDay, WeatherType } from '../types';
import type { AmbientMotionDef } from './environment/ambientMotion';
import type { AuthoredLightDef } from './environment/lightingEngine';
import {
  createWorldSceneProjection,
  getDefaultSpatialAudioSources,
  getMinuteForTimeOfDay,
} from './presentationAdapter';
import type {
  WorldCameraFocus,
  WorldSceneProjection,
  WorldScenePropProjection,
  WorldWeatherWindowZone,
} from './types';
import type { SpatialAudioSourceDef } from '../../audio/types';

export interface GeneratedShopProjectionOptions {
  timeOfDay?: TimeOfDay;
  weather?: WeatherType;
  focusFixtureId?: string | null;
  actorByAnchorId?: Readonly<Record<string, string>>;
}

function lightForFixture(
  fixture: (typeof GENERATED_SHOP_FIXTURES)[number],
): AuthoredLightDef[] {
  const anchor = GENERATED_ANCHORS.find((candidate) => candidate.id === fixture.anchorId);
  if (!anchor) return [];

  return fixture.lightProfileIds.flatMap((profileId): AuthoredLightDef[] => {
    const profile = GENERATED_LIGHT_PROFILES.find((candidate) => candidate.id === profileId);
    if (!profile) return [];

    const fluorescent = profile.tags.includes('fluorescent');
    const subtle = profile.tags.includes('subtle');
    return [{
      id: `shop-light-${fixture.id}-${profile.id}`,
      kind: fixture.kind === 'fridge' ? 'fridge' : 'lamp',
      x: anchor.x,
      y: anchor.y,
      // Fluorescent fixtures are broad ceiling/fill sources rather than
      // point-like lamps. Keep deep late-night ambient dark while preserving
      // readable shelf detail through authored artificial-light prominence.
      radius: fixture.kind === 'fridge' ? 220 : fluorescent ? 900 : 430,
      color: profile.colorTint ?? '#ffffff',
      baseIntensity: profile.intensity,
      ...(fluorescent
        ? { flicker: { type: 'fluorescent' as const, frequency: 7.5, amplitude: 0.06 } }
        : subtle
          ? { flicker: { type: 'subtle' as const, frequency: 1.2, amplitude: 0.025 } }
          : {}),
      normalMapped: profile.tags.includes('normal-map'),
      isExterior: profile.tags.includes('exterior'),
    }];
  });
}

function audioForFixture(
  fixture: (typeof GENERATED_SHOP_FIXTURES)[number],
): SpatialAudioSourceDef[] {
  const anchor = GENERATED_ANCHORS.find((candidate) => candidate.id === fixture.anchorId);
  if (!anchor) return [];

  return fixture.audioProfileIds.flatMap((profileId): SpatialAudioSourceDef[] => {
    const profile = GENERATED_AUDIO_PROFILES.find((candidate) => candidate.id === profileId);
    if (!profile) return [];
    return [{
      id: `shop-audio-${fixture.id}-${profile.id}`,
      eventId: `ambience.fixture.${profile.kind}`,
      x: anchor.x,
      y: anchor.y,
      z: -0.1,
      loop: true,
      volume: profile.volume,
      bus: 'ambience',
      rolloffFactor: 0.65,
    }];
  });
}

function scenePropsForView(viewId: string): {
  props: WorldScenePropProjection[];
  motions: AmbientMotionDef[];
  weatherWindowZones: WorldWeatherWindowZone[];
} {
  const props: WorldScenePropProjection[] = [];
  const motions: AmbientMotionDef[] = [];
  const weatherWindowZones: WorldWeatherWindowZone[] = [];

  for (const prop of GENERATED_SCENE_PROPS.filter((candidate) => candidate.viewId === viewId)) {
    const anchor = GENERATED_ANCHORS.find((candidate) => candidate.id === prop.anchorId);
    if (!anchor) continue;
    props.push({
      id: prop.id,
      assetId: prop.assetId,
      x: anchor.x,
      y: anchor.y,
      width: prop.width,
      height: prop.height,
      depth: prop.depth,
    });
    if (prop.tags.includes('weather-window')) {
      weatherWindowZones.push({
        id: prop.id,
        x: anchor.x - prop.width / 2,
        y: anchor.y - prop.height / 2,
        width: prop.width,
        height: prop.height,
      });
    }
    if (prop.motionType) {
      motions.push({
        id: `motion-${prop.id}`,
        targetName: prop.id,
        type: prop.motionType as AmbientMotionDef['type'],
        speed: prop.motionSpeed,
        amplitude: prop.motionAmplitude,
      });
    }
  }
  return { props, motions, weatherWindowZones };
}

export function createGeneratedPhysicalShopProjection(
  placeId: string,
  options: GeneratedShopProjectionOptions = {},
): WorldSceneProjection {
  const fixtures = GENERATED_SHOP_FIXTURES.filter((fixture) => fixture.placeId === placeId);
  if (fixtures.length === 0) throw new Error(`No generated shop fixtures for place ${placeId}.`);

  const viewId = fixtures[0]!.viewId;
  if (fixtures.some((fixture) => fixture.viewId !== viewId)) {
    throw new Error(`Shop place ${placeId} spans multiple hero views; #28 requires one main view.`);
  }

  let focus: WorldCameraFocus | null = null;
  if (options.focusFixtureId) {
    const fixture = fixtures.find((candidate) => candidate.id === options.focusFixtureId);
    if (!fixture) throw new Error(`Unknown shop focus fixture ${options.focusFixtureId}.`);
    const anchor = GENERATED_ANCHORS.find((candidate) => candidate.id === fixture.anchorId);
    if (!anchor) throw new Error(`Shop fixture ${fixture.id} has no authored anchor.`);
    focus = { x: anchor.x, y: anchor.y, zoom: fixture.focusZoom };
  }

  const timeOfDay = options.timeOfDay ?? 'day';
  const weather = options.weather ?? 'clear';
  const { props, motions, weatherWindowZones } = scenePropsForView(viewId);
  const authoredLights = fixtures.flatMap(lightForFixture);
  const spatialAudioSources = [
    ...getDefaultSpatialAudioSources(weather, true),
    ...fixtures.flatMap(audioForFixture),
  ];

  return {
    ...createWorldSceneProjection({
      placeId,
      viewId,
      timeOfDay,
      minuteOfDay: getMinuteForTimeOfDay(timeOfDay),
      weather,
      focus,
      authoredLights,
      ambientMotions: motions,
      spatialAudioSources,
      listenerOrientation: 'forward',
      isInterior: true,
      windIntensity: weather === 'rain' ? 0.25 : 0.05,
      actorByAnchorId: options.actorByAnchorId,
    }),
    sceneProps: props,
    weatherWindowZones,
  };
}
