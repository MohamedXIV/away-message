// src/world/transit/BusInteriorPresentation.ts
// Reusable bus-interior presentation projection bound to an active transit leg (#36).
// Proves exact-duration compression, window/exterior response, interior lighting,
// audio ambience, and #95 rider placement without renderer-owned travel authority.

import type { TransitNetwork } from '../../engine/transit/TransitNetwork';
import {
  activeTravelLegWindows,
  travelStateAtMinute,
} from '../../engine/transit/ActiveTravel';
import type { ActiveTravelState, TravelLeg } from '../../engine/transit/types';
import type { TimeOfDay, WeatherType } from '../types';
import type {
  WorldAnchorProjection,
  WorldPointLightDef,
  WorldSceneProjection,
} from '../phaser/types';
import {
  getLightingForTimeOfDay,
  getParticlesForWeather,
} from '../phaser/presentationAdapter';
import {
  type ActorViewPlacement,
  type ActorViewProjection,
  projectActorIntoView,
} from '../actorPresentation';
import type { AmbientMotionDef } from '../phaser/environment/ambientMotion';
import type { SpatialAudioSourceDef } from '../../audio/types';

export interface BusInteriorRiderActor {
  actorId: string;
  selected?: boolean;
  focused?: boolean;
}

export interface BusInteriorBindingOptions {
  activeTravel: ActiveTravelState;
  currentMinute: number;
  network: TransitNetwork;
  timeOfDay?: TimeOfDay;
  weather?: WeatherType;
  riders?: BusInteriorRiderActor[];
}

export interface BusInteriorBindingSuccess {
  ok: true;
  projection: WorldSceneProjection;
  activeLeg: Extract<TravelLeg, { kind: 'bus' }>;
  remainingMinutes: number;
  progressPercent: number;
  lineName: string;
  fromStopName: string;
  toStopName: string;
  districtId: string;
}

export interface BusInteriorBindingFailure {
  ok: false;
  reason: 'not_active' | 'not_on_bus_leg' | 'unknown_leg';
  projection?: undefined;
}

export type BusInteriorBindingResult = BusInteriorBindingSuccess | BusInteriorBindingFailure;

export interface BusRideCompressionResult {
  minutesAdvanced: number;
  targetMinute: number;
  completedLeg: TravelLeg;
  isDestinationArrival: boolean;
}

export const BUS_INTERIOR_RIDER_PLACEMENTS: ActorViewPlacement[] = [
  {
    viewId: 'bus_interior_hero',
    cameraMode: 'eye_level',
    x: 0.55,
    y: 0.60,
    distance: 0.35,
    facing: 'side_left',
    visible: true,
    anchorId: 'bus_seat_rider_1',
  },
  {
    viewId: 'bus_interior_hero',
    cameraMode: 'eye_level',
    x: 0.25,
    y: 0.58,
    distance: 0.45,
    facing: 'front_3q_right',
    visible: true,
    anchorId: 'bus_seat_rider_2',
  },
  {
    viewId: 'bus_interior_hero',
    cameraMode: 'eye_level',
    x: 0.72,
    y: 0.56,
    distance: 0.50,
    facing: 'front_3q_left',
    visible: true,
    anchorId: 'bus_seat_rider_3',
  },
  {
    viewId: 'bus_interior_hero',
    cameraMode: 'eye_level',
    x: 0.60,
    y: 0.48,
    distance: 0.65,
    facing: 'back_3q',
    visible: true,
    anchorId: 'bus_seat_rider_4',
  },
];

export function projectBusInteriorActors(riders: BusInteriorRiderActor[]): ActorViewProjection[] {
  const result: ActorViewProjection[] = [];
  const limit = Math.min(riders.length, BUS_INTERIOR_RIDER_PLACEMENTS.length);

  for (let i = 0; i < limit; i++) {
    const rider = riders[i]!;
    const placement = BUS_INTERIOR_RIDER_PLACEMENTS[i]!;
    result.push(
      projectActorIntoView(rider.actorId, placement, {
        focused: rider.focused ?? false,
        selected: rider.selected ?? false,
      }),
    );
  }

  return result;
}

export function bindBusInteriorProjection(options: BusInteriorBindingOptions): BusInteriorBindingResult {
  const {
    activeTravel,
    currentMinute,
    network,
    timeOfDay = 'day',
    weather = 'clear',
  } = options;

  if (activeTravel.status !== 'active') {
    return { ok: false, reason: 'not_active' };
  }

  const travelState = travelStateAtMinute(activeTravel, currentMinute);
  if (travelState.status !== 'active') {
    return { ok: false, reason: 'not_active' };
  }

  const activeLeg = activeTravel.plan.legs[travelState.currentLegIndex];
  if (!activeLeg || activeLeg.kind !== 'bus') {
    return { ok: false, reason: 'not_on_bus_leg' };
  }

  const windows = activeTravelLegWindows(activeTravel);
  const currentWindow = windows[travelState.currentLegIndex];
  if (!currentWindow) {
    return { ok: false, reason: 'unknown_leg' };
  }

  const line = network.lines.get(activeLeg.lineId);
  const fromStop = network.stops.get(activeLeg.fromStopId);
  const toStop = network.stops.get(activeLeg.toStopId);
  const lineName = line?.name ?? activeLeg.lineId;
  const fromStopName = fromStop?.name ?? activeLeg.fromStopId;
  const toStopName = toStop?.name ?? activeLeg.toStopId;
  const districtId = toStop?.districtId ?? fromStop?.districtId ?? 'district_a';

  const elapsedMinutes = Math.max(0, currentMinute - currentWindow.startMinute);
  const remainingMinutes = Math.max(0, currentWindow.endMinute - currentMinute);
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / Math.max(1, activeLeg.minutes)) * 100));

  // Bus interior anchors
  const anchors: WorldAnchorProjection[] = [
    {
      id: 'bus_window_view',
      name: 'Bus Window',
      x: 0.35,
      y: 0.38,
      tags: ['window', 'scenery'],
      interactions: [
        { id: 'look_window', capability: 'look_window', name: 'Look out Window', tags: ['view'] },
      ],
    },
    {
      id: 'bus_bell_cord',
      name: 'Stop Request Cord',
      x: 0.70,
      y: 0.20,
      tags: ['transit', 'bell'],
      interactions: [
        { id: 'request_stop', capability: 'request_stop', name: 'Request Stop', tags: ['transit'] },
      ],
    },
    {
      id: 'bus_exit_doors',
      name: 'Exit Doors',
      x: 0.88,
      y: 0.55,
      tags: ['door', 'exit'],
      interactions: [
        { id: 'alight_bus', capability: 'alight_bus', name: 'Alight Bus', tags: ['transit'] },
      ],
    },
    {
      id: 'bus_farebox',
      name: 'Farebox',
      x: 0.12,
      y: 0.52,
      tags: ['farebox'],
      interactions: [
        { id: 'inspect_farebox', capability: 'inspect', name: 'Farebox', tags: ['farebox'] },
      ],
    },
    {
      id: 'bus_seat_player',
      name: 'Your Seat',
      x: 0.40,
      y: 0.65,
      tags: ['seat'],
      interactions: [],
    },
  ];

  // Authored interior lights
  const ceilingIntensity = timeOfDay === 'night' || timeOfDay === 'late_night' ? 1.6 : 0.8;
  const customLights: WorldPointLightDef[] = [
    {
      id: 'bus_ceiling_light_1',
      x: 0.35,
      y: 0.15,
      radius: 240,
      color: '#eef6ff',
      intensity: ceilingIntensity,
      movable: false,
    },
    {
      id: 'bus_ceiling_light_2',
      x: 0.65,
      y: 0.15,
      radius: 240,
      color: '#eef6ff',
      intensity: ceilingIntensity,
      movable: false,
    },
  ];

  const lighting = getLightingForTimeOfDay(timeOfDay, customLights);
  const particles = getParticlesForWeather(weather, true); // isInterior = true

  const ambientMotions: AmbientMotionDef[] = [
    {
      id: 'bus_window_scenery',
      targetName: 'bus_window_view',
      type: 'drift',
      amplitude: 120,
      speed: 1.5,
    },
  ];

  const spatialAudioSources: SpatialAudioSourceDef[] = [
    {
      id: 'bus_engine_loop',
      eventId: 'ambience.room_tone',
      x: 0.5,
      y: 0.8,
      z: 0.2,
      loop: true,
      volume: 0.35,
      bus: 'ambience',
    },
    {
      id: 'bus_cabin_hum',
      eventId: 'ambience.room_tone',
      x: 0.5,
      y: 0.2,
      z: 0,
      loop: true,
      volume: 0.15,
      bus: 'ambience',
    },
  ];

  if (weather === 'rain') {
    spatialAudioSources.push({
      id: 'bus_window_rain',
      eventId: 'ambience.weather.rain',
      x: 0.35,
      y: 0.35,
      z: 0.5,
      loop: true,
      volume: 0.35,
      bus: 'ambience',
      parameters: {
        rainIntensity: 0.7,
        muffled: 1,
      },
    });
  }

  const projection: WorldSceneProjection = {
    placeId: 'bus_transit_interior',
    placeName: `${lineName} Bus`,
    spaceId: 'bus_cabin',
    spaceName: `${lineName} Cabin`,
    viewId: 'bus_interior_hero',
    viewName: `${lineName} Interior`,
    assetId: null,
    normalMapAssetId: null,
    timeOfDay,
    weather,
    isInterior: true,
    lighting,
    particles,
    anchors,
    availableViews: [
      {
        id: 'bus_interior_hero',
        name: `${lineName} Interior`,
        assetId: null,
        neighbors: [],
      },
    ],
    focus: null,
    ambientMotions,
    spatialAudioSources,
  };

  return {
    ok: true,
    projection,
    activeLeg,
    remainingMinutes,
    progressPercent,
    lineName,
    fromStopName,
    toStopName,
    districtId,
  };
}

/**
 * Compresses an active bus ride by resolving the exact remaining minutes
 * on this leg or to final destination. Never computes a new fare or alters the plan.
 */
export function compressBusRide(
  activeTravel: ActiveTravelState,
  currentMinute: number,
  skipToDestination = true,
): BusRideCompressionResult {
  const windows = activeTravelLegWindows(activeTravel);
  const travelState = travelStateAtMinute(activeTravel, currentMinute);
  const currentLegIndex = travelState.currentLegIndex;
  const completedLeg = activeTravel.plan.legs[currentLegIndex]!;

  const targetMinute = skipToDestination
    ? windows[windows.length - 1]!.endMinute
    : windows[currentLegIndex]!.endMinute;

  const minutesAdvanced = Math.max(0, targetMinute - currentMinute);
  const isDestinationArrival = skipToDestination || currentLegIndex === windows.length - 1;

  return {
    minutesAdvanced,
    targetMinute,
    completedLeg,
    isDestinationArrival,
  };
}
