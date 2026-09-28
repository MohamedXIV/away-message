// src/engine/transit/TownKnowledge.ts
// Knowledge-safe town and district navigation read-model (#36).
// Tracks discovery state for districts, places, stops, and bus lines without
// mutating the authoritative TransitNetwork or world definitions.

import type { TransitNetwork } from './TransitNetwork';
import type { BusLineId, DistrictId, PlaceId, TransitStopId, TravelPlan } from './types';

export type DistrictKnowledgeLevel = 'unknown' | 'known';
export type PlaceKnowledgeLevel = 'unknown' | 'heard' | 'mapped' | 'visited' | 'familiar';
export type StopKnowledgeLevel = 'unknown' | 'known' | 'used';
export type LineKnowledgeLevel = 'unknown' | 'known' | 'used';

export interface TownKnowledgeState {
  districts: Record<DistrictId, DistrictKnowledgeLevel>;
  places: Record<PlaceId, PlaceKnowledgeLevel>;
  stops: Record<TransitStopId, StopKnowledgeLevel>;
  lines: Record<BusLineId, LineKnowledgeLevel>;
}

export function createTownKnowledge(initial?: Partial<TownKnowledgeState>): TownKnowledgeState {
  return {
    districts: { ...(initial?.districts ?? {}) },
    places: { ...(initial?.places ?? {}) },
    stops: { ...(initial?.stops ?? {}) },
    lines: { ...(initial?.lines ?? {}) },
  };
}

export function isDistrictKnown(state: TownKnowledgeState, districtId: DistrictId): boolean {
  return state.districts[districtId] === 'known';
}

export function isPlaceKnown(state: TownKnowledgeState, placeId: PlaceId, includeHeard = false): boolean {
  const level = state.places[placeId];
  if (!level || level === 'unknown') return false;
  if (level === 'heard') return includeHeard;
  return level === 'mapped' || level === 'visited' || level === 'familiar';
}

export function isStopKnown(state: TownKnowledgeState, stopId: TransitStopId): boolean {
  const level = state.stops[stopId];
  return level === 'known' || level === 'used';
}

export function isLineKnown(state: TownKnowledgeState, lineId: BusLineId): boolean {
  const level = state.lines[lineId];
  return level === 'known' || level === 'used';
}

export function revealDistrict(
  state: TownKnowledgeState,
  districtId: DistrictId,
  level: DistrictKnowledgeLevel = 'known',
): TownKnowledgeState {
  if (state.districts[districtId] === level) return state;
  return {
    ...state,
    districts: {
      ...state.districts,
      [districtId]: level,
    },
  };
}

export function revealPlace(
  state: TownKnowledgeState,
  placeId: PlaceId,
  level: PlaceKnowledgeLevel,
  network?: TransitNetwork,
): TownKnowledgeState {
  const placeDef = network?.places.get(placeId);
  const districtId = placeDef?.districtId;

  let nextDistricts = state.districts;
  if (districtId && level !== 'unknown') {
    nextDistricts = {
      ...state.districts,
      [districtId]: 'known',
    };
  }

  return {
    ...state,
    districts: nextDistricts,
    places: {
      ...state.places,
      [placeId]: level,
    },
  };
}

export function revealStop(
  state: TownKnowledgeState,
  stopId: TransitStopId,
  level: StopKnowledgeLevel,
  network?: TransitNetwork,
): TownKnowledgeState {
  const stopDef = network?.stops.get(stopId);
  const districtId = stopDef?.districtId;

  let nextDistricts = state.districts;
  if (districtId && level !== 'unknown') {
    nextDistricts = {
      ...state.districts,
      [districtId]: 'known',
    };
  }

  return {
    ...state,
    districts: nextDistricts,
    stops: {
      ...state.stops,
      [stopId]: level,
    },
  };
}

export function revealLine(
  state: TownKnowledgeState,
  lineId: BusLineId,
  level: LineKnowledgeLevel,
): TownKnowledgeState {
  return {
    ...state,
    lines: {
      ...state.lines,
      [lineId]: level,
    },
  };
}

export function recordTravelCompletion(
  state: TownKnowledgeState,
  plan: TravelPlan,
  network?: TransitNetwork,
): TownKnowledgeState {
  let next = { ...state };

  // Destination place is marked visited
  next = revealPlace(next, plan.destinationPlaceId, 'visited', network);

  // Any used stops and lines are marked used
  for (const leg of plan.legs) {
    if (leg.kind === 'wait') {
      next = revealStop(next, leg.stopId, 'used', network);
      next = revealLine(next, leg.lineId, 'used');
    } else if (leg.kind === 'bus') {
      next = revealStop(next, leg.fromStopId, 'used', network);
      next = revealStop(next, leg.toStopId, 'used', network);
      next = revealLine(next, leg.lineId, 'used');
    }
  }

  return next;
}

export function createDefaultTownKnowledge(
  network?: TransitNetwork,
  startingPlaceId?: PlaceId,
): TownKnowledgeState {
  let state = createTownKnowledge();
  const start = startingPlaceId ?? (network?.places.has('room_104') ? 'room_104' : network?.places.keys().next().value);

  if (start && network?.places.has(start)) {
    state = revealPlace(state, start, 'familiar', network);
    const accessList = network.accessFromPlace(start);
    for (const access of accessList) {
      state = revealStop(state, access.stopId, 'known', network);
    }
  }

  return state;
}

export function serializeTownKnowledge(state: TownKnowledgeState): string {
  return JSON.stringify(state);
}

export function hydrateTownKnowledge(data: unknown): TownKnowledgeState {
  if (!data || typeof data !== 'object') {
    return createTownKnowledge();
  }
  const raw = data as Record<string, unknown>;
  const districts = (raw['districts'] && typeof raw['districts'] === 'object' ? raw['districts'] : {}) as Record<string, DistrictKnowledgeLevel>;
  const places = (raw['places'] && typeof raw['places'] === 'object' ? raw['places'] : {}) as Record<string, PlaceKnowledgeLevel>;
  const stops = (raw['stops'] && typeof raw['stops'] === 'object' ? raw['stops'] : {}) as Record<string, StopKnowledgeLevel>;
  const lines = (raw['lines'] && typeof raw['lines'] === 'object' ? raw['lines'] : {}) as Record<string, LineKnowledgeLevel>;

  return {
    districts: { ...districts },
    places: { ...places },
    stops: { ...stops },
    lines: { ...lines },
  };
}

export interface ProjectedDistrictPlace {
  placeId: PlaceId;
  name: string;
  knowledgeLevel: PlaceKnowledgeLevel;
  isCurrent: boolean;
  hasTransitAccess: boolean;
  accessStopIds: TransitStopId[];
  entryPosition?: { x: number; y: number; z: number };
}

export interface ProjectedDistrictStop {
  stopId: TransitStopId;
  name: string;
  knowledgeLevel: StopKnowledgeLevel;
  placeId: PlaceId | null;
  mapPosition: { x: number; y: number };
  lineIds: BusLineId[];
}

export interface ProjectedDistrict {
  districtId: DistrictId;
  name: string;
  mapPosition: { x: number; y: number };
  tags: string[];
  isCurrent: boolean;
  places: ProjectedDistrictPlace[];
  stops: ProjectedDistrictStop[];
  connectedDistrictIds: DistrictId[];
}

export interface ProjectedTownNavigation {
  currentPlaceId?: PlaceId;
  currentDistrictId?: DistrictId;
  districts: ProjectedDistrict[];
  knownPlaceCount: number;
  totalKnownDistricts: number;
}

/**
 * Knowledge-safe projection of the town into districts and known places/stops.
 * Never mutates simulation state or exposes undiscovered nodes.
 */
export function projectTownNavigation(
  network: TransitNetwork,
  knowledge: TownKnowledgeState,
  currentPlaceId?: PlaceId,
): ProjectedTownNavigation {
  const currentPlace = currentPlaceId ? network.places.get(currentPlaceId) : undefined;
  const currentDistrictId = currentPlace?.districtId;

  const projectedDistricts: ProjectedDistrict[] = [];
  let totalPlaces = 0;

  for (const [districtId, districtDef] of network.districts.entries()) {
    const isDistrictMarked = isDistrictKnown(knowledge, districtId);

    // Filter places in this district that are known
    const knownPlacesInDistrict: ProjectedDistrictPlace[] = [];
    for (const place of network.places.values()) {
      if (place.districtId !== districtId) continue;
      if (!isPlaceKnown(knowledge, place.id)) continue;

      knownPlacesInDistrict.push({
        placeId: place.id,
        name: place.name,
        knowledgeLevel: knowledge.places[place.id]!,
        isCurrent: place.id === currentPlaceId,
        hasTransitAccess: place.transitAccess.length > 0,
        accessStopIds: place.transitAccess.map((access) => access.stopId),
        ...(place.entryPosition ? { entryPosition: { ...place.entryPosition } } : {}),
      });
    }

    // Filter stops in this district that are known
    const knownStopsInDistrict: ProjectedDistrictStop[] = [];
    for (const stop of network.stops.values()) {
      if (stop.districtId !== districtId) continue;
      if (!isStopKnown(knowledge, stop.id)) continue;

      const linesAtThisStop = network.linesAtStop(stop.id).map((ref) => ref.lineId);
      knownStopsInDistrict.push({
        stopId: stop.id,
        name: stop.name,
        knowledgeLevel: knowledge.stops[stop.id]!,
        placeId: stop.placeId,
        mapPosition: { x: stop.mapX, y: stop.mapY },
        lineIds: linesAtThisStop,
      });
    }

    // A district is projected if it is known or has any known places or stops
    if (!isDistrictMarked && knownPlacesInDistrict.length === 0 && knownStopsInDistrict.length === 0) {
      continue;
    }

    // Find connected known districts
    const connectedDistrictSet = new Set<DistrictId>();
    for (const stop of knownStopsInDistrict) {
      const lineRefs = network.linesAtStop(stop.stopId);
      for (const ref of lineRefs) {
        const line = network.lines.get(ref.lineId);
        if (!line) continue;
        for (const otherStopId of line.stopIds) {
          const otherStop = network.stops.get(otherStopId);
          if (otherStop && otherStop.districtId !== districtId && isDistrictKnown(knowledge, otherStop.districtId)) {
            connectedDistrictSet.add(otherStop.districtId);
          }
        }
      }
    }

    totalPlaces += knownPlacesInDistrict.length;
    projectedDistricts.push({
      districtId,
      name: districtDef.name,
      mapPosition: { x: districtDef.mapX, y: districtDef.mapY },
      tags: [...districtDef.tags],
      isCurrent: districtId === currentDistrictId,
      places: knownPlacesInDistrict,
      stops: knownStopsInDistrict,
      connectedDistrictIds: Array.from(connectedDistrictSet).sort(),
    });
  }

  return {
    ...(currentPlaceId ? { currentPlaceId } : {}),
    ...(currentDistrictId ? { currentDistrictId } : {}),
    districts: projectedDistricts,
    knownPlaceCount: totalPlaces,
    totalKnownDistricts: projectedDistricts.length,
  };
}
