// src/world/transit/BusStopPresentation.ts
// Authored living bus-stop presentation projection (#36).
// Adapts any generated TransitStop into a fully featured LivingPlace View with
// timetable interaction, posters, shelter lighting, weather/puddles, and
// actor placement via #95 derived presentation policies.

import type { TransitNetwork } from '../../engine/transit/TransitNetwork';
import type { BusLineId, TransitServiceState, TransitStopId } from '../../engine/transit/types';
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
import type { PuddleZoneDef } from '../phaser/environment/puddles';
import type { AmbientMotionDef } from '../phaser/environment/ambientMotion';
import type { SpatialAudioSourceDef } from '../../audio/types';

export interface BusStopWaitingActor {
  actorId: string;
  selected?: boolean;
  focused?: boolean;
}

export interface BusStopProjectionOptions {
  stopId: TransitStopId;
  network: TransitNetwork;
  timeOfDay?: TimeOfDay;
  minuteOfDay?: number;
  weather?: WeatherType;
  waitingActors?: BusStopWaitingActor[];
  service?: TransitServiceState;
}

export interface StopTimetableLineEntry {
  lineId: BusLineId;
  lineName: string;
  destinationStopId: TransitStopId;
  destinationStopName: string;
  nextArrivalMinute: number | null;
  minutesUntilNextArrival: number | null;
  status: 'on_time' | 'delayed' | 'service_ended' | 'stop_closed' | 'line_closed';
  delayMinutes?: number;
}

export interface StopTimetableProjection {
  stopId: TransitStopId;
  stopName: string;
  districtId: string;
  districtName: string;
  currentMinute: number;
  lines: StopTimetableLineEntry[];
}

export const BUS_STOP_RIDER_PLACEMENTS: ActorViewPlacement[] = [
  {
    viewId: 'bus_stop_hero',
    cameraMode: 'eye_level',
    x: 0.52,
    y: 0.56,
    distance: 0.28,
    facing: 'front_3q_right',
    visible: true,
    anchorId: 'bus_stop_shelter_bench',
  },
  {
    viewId: 'bus_stop_hero',
    cameraMode: 'eye_level',
    x: 0.68,
    y: 0.58,
    distance: 0.32,
    facing: 'front_3q_left',
    visible: true,
    anchorId: 'bus_stop_boarding_bay',
  },
  {
    viewId: 'bus_stop_hero',
    cameraMode: 'eye_level',
    x: 0.22,
    y: 0.54,
    distance: 0.55,
    facing: 'front',
    visible: true,
    anchorId: 'bus_stop_timetable_board',
  },
];

export function projectBusStopActors(waitingActors: BusStopWaitingActor[]): ActorViewProjection[] {
  const result: ActorViewProjection[] = [];
  const limit = Math.min(waitingActors.length, BUS_STOP_RIDER_PLACEMENTS.length);

  for (let i = 0; i < limit; i++) {
    const actor = waitingActors[i]!;
    const placement = BUS_STOP_RIDER_PLACEMENTS[i]!;
    result.push(
      projectActorIntoView(actor.actorId, placement, {
        focused: actor.focused ?? false,
        selected: actor.selected ?? false,
      }),
    );
  }

  return result;
}

export function projectStopTimetable(
  network: TransitNetwork,
  stopId: TransitStopId,
  currentMinute: number,
  service?: TransitServiceState,
): StopTimetableProjection {
  const stop = network.stops.get(stopId);
  if (!stop) {
    throw new Error(`TransitStop '${stopId}' not found in network.`);
  }

  const district = network.districts.get(stop.districtId);
  const lineRefs = network.linesAtStop(stopId);
  const entries: StopTimetableLineEntry[] = [];

  for (const ref of lineRefs) {
    const line = network.lines.get(ref.lineId);
    if (!line) continue;

    const lastStopId = line.stopIds[line.stopIds.length - 1]!;
    const lastStop = network.stops.get(lastStopId);
    const destName = lastStop?.name ?? lastStopId;

    const isStopClosed = service?.closedStopIds.includes(stopId) ?? false;
    const isLineClosed = service?.closedLineIds.includes(line.id) ?? false;

    if (isStopClosed) {
      entries.push({
        lineId: line.id,
        lineName: line.name,
        destinationStopId: lastStopId,
        destinationStopName: destName,
        nextArrivalMinute: null,
        minutesUntilNextArrival: null,
        status: 'stop_closed',
      });
      continue;
    }

    if (isLineClosed) {
      entries.push({
        lineId: line.id,
        lineName: line.name,
        destinationStopId: lastStopId,
        destinationStopName: destName,
        nextArrivalMinute: null,
        minutesUntilNextArrival: null,
        status: 'line_closed',
      });
      continue;
    }

    const delay = service?.lineDelayMinutes[line.id] ?? 0;
    const headway = Math.max(1, line.headwayMinutes * Math.max(1, service?.headwayMultiplier[line.id] ?? 1));

    // Cumulative minutes to this stop index
    let cumulatedMinutes = 0;
    for (let i = 0; i < ref.stopIndex; i++) {
      cumulatedMinutes += line.segmentMinutes[i] ?? 0;
    }

    // Find next arrival
    let nextArrival: number | null = null;
    const totalLineMinutes = line.segmentMinutes.reduce((sum, seg) => sum + seg, 0);

    for (let base = line.serviceStartMinute; base + totalLineMinutes <= line.serviceEndMinute; base += headway) {
      const arr = base + delay + cumulatedMinutes;
      if (arr >= currentMinute) {
        nextArrival = arr;
        break;
      }
    }

    if (nextArrival === null) {
      entries.push({
        lineId: line.id,
        lineName: line.name,
        destinationStopId: lastStopId,
        destinationStopName: destName,
        nextArrivalMinute: null,
        minutesUntilNextArrival: null,
        status: 'service_ended',
      });
    } else {
      entries.push({
        lineId: line.id,
        lineName: line.name,
        destinationStopId: lastStopId,
        destinationStopName: destName,
        nextArrivalMinute: nextArrival,
        minutesUntilNextArrival: nextArrival - currentMinute,
        status: delay > 0 ? 'delayed' : 'on_time',
        ...(delay > 0 ? { delayMinutes: delay } : {}),
      });
    }
  }

  return {
    stopId,
    stopName: stop.name,
    districtId: stop.districtId,
    districtName: district?.name ?? stop.districtId,
    currentMinute,
    lines: entries,
  };
}

export function createBusStopProjection(options: BusStopProjectionOptions): WorldSceneProjection {
  const {
    stopId,
    network,
    timeOfDay = 'day',
    minuteOfDay,
    weather = 'clear',
  } = options;

  const stop = network.stops.get(stopId);
  if (!stop) {
    throw new Error(`TransitStop '${stopId}' not found in network.`);
  }

  const district = network.districts.get(stop.districtId);
  const placeId = stop.placeId ?? `place_${stop.id}`;
  const placeName = stop.name;
  const viewId = `${stop.id}_hero`;

  // Standard living bus stop anchors
  const anchors: WorldAnchorProjection[] = [
    {
      id: 'bus_stop_timetable_board',
      name: 'Route & Timetable Board',
      x: 0.28,
      y: 0.45,
      tags: ['hotspot', 'timetable'],
      interactions: [
        { id: 'inspect_timetable', capability: 'inspect_timetable', name: 'Check Schedule', tags: ['timetable'] },
        { id: 'view_network_map', capability: 'view_network_map', name: 'View Transit Map', tags: ['transit_map'] },
      ],
    },
    {
      id: 'bus_stop_shelter_bench',
      name: 'Shelter Bench',
      x: 0.50,
      y: 0.58,
      tags: ['shelter', 'bench', 'rest'],
      interactions: [
        { id: 'sit_bench', capability: 'sit', name: 'Sit & Rest', tags: ['rest'] },
      ],
    },
    {
      id: 'bus_stop_sign',
      name: 'Bus Stop Sign',
      x: 0.15,
      y: 0.40,
      tags: ['sign'],
      interactions: [
        { id: 'inspect_sign', capability: 'inspect', name: 'Inspect Sign', tags: ['sign'] },
      ],
    },
    {
      id: 'bus_stop_posters',
      name: 'Community Notices',
      x: 0.38,
      y: 0.48,
      tags: ['posters', 'ads'],
      interactions: [
        { id: 'read_notices', capability: 'read', name: 'Read Notices', tags: ['notices'] },
      ],
    },
    {
      id: 'bus_stop_boarding_bay',
      name: 'Bus Boarding Bay',
      x: 0.82,
      y: 0.60,
      tags: ['transit', 'bay'],
      interactions: [
        { id: 'board_bus', capability: 'board_bus', name: 'Board Bus', tags: ['transit'] },
      ],
    },
  ];

  // Authored stop lighting
  const shelterLampIntensity =
    timeOfDay === 'night' || timeOfDay === 'late_night'
      ? 1.9
      : timeOfDay === 'evening'
        ? 1.4
        : 0.5;

  const customLights: WorldPointLightDef[] = [
    {
      id: 'shelter_overhead_lamp',
      x: 0.50,
      y: 0.25,
      radius: 320,
      color: '#ffea9f',
      intensity: shelterLampIntensity,
      movable: false,
    },
  ];

  const lighting = getLightingForTimeOfDay(timeOfDay, customLights, minuteOfDay);
  const particles = getParticlesForWeather(weather, false);

  const puddleZones: PuddleZoneDef[] =
    weather === 'rain'
      ? [
          {
            id: 'curb_puddle_1',
            x: 0.75,
            y: 0.72,
            width: 90,
            height: 25,
            threshold: 0.2,
            fillRate: 0.1,
            drainRate: 0.05,
            maxCapacity: 0.8,
            rippleIntensity: 0.8,
          },
          {
            id: 'bench_puddle_2',
            x: 0.42,
            y: 0.68,
            width: 60,
            height: 18,
            threshold: 0.2,
            fillRate: 0.1,
            drainRate: 0.05,
            maxCapacity: 0.5,
            rippleIntensity: 0.5,
          },
        ]
      : [];

  const ambientMotions: AmbientMotionDef[] = [
    {
      id: 'ambient_street_traffic',
      targetName: 'street_backdrop',
      type: 'drift',
      amplitude: 180,
      speed: 1,
    },
    {
      id: 'poster_flutter',
      targetName: 'bus_stop_posters',
      type: 'sway',
      amplitude: 4,
      speed: 2,
    },
  ];


  const spatialAudioSources: SpatialAudioSourceDef[] = [
    {
      id: 'stop_street_ambience',
      eventId: 'ambience.room_tone',
      x: 0.5,
      y: 0.5,
      z: 0,
      loop: true,
      volume: 0.15,
      bus: 'ambience',
    },
  ];

  if (weather === 'rain') {
    spatialAudioSources.push({
      id: 'stop_rain_shelter',
      eventId: 'ambience.weather.rain',
      x: 0.5,
      y: 0.2,
      z: 0.2,
      loop: true,
      volume: 0.5,
      bus: 'ambience',
      parameters: {
        rainIntensity: 1,
        muffled: 0,
      },
    });
  }

  return {
    placeId,
    placeName,
    spaceId: `${stop.id}_exterior`,
    spaceName: `${district?.name ?? 'District'} Street`,
    viewId,
    viewName: `${stop.name} View`,
    assetId: null,
    normalMapAssetId: null,
    timeOfDay,
    minuteOfDay,
    weather,
    isInterior: false,
    lighting,
    particles,
    anchors,
    availableViews: [
      {
        id: viewId,
        name: `${stop.name} View`,
        assetId: null,
        neighbors: [],
      },
    ],
    focus: null,
    puddleZones,
    ambientMotions,
    spatialAudioSources,
  };
}
