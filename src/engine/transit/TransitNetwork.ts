// src/engine/transit/TransitNetwork.ts
// Immutable runtime projection of generated district/place/stop/line
// definitions (#35). Built once from #51 content; the planner reads only
// this network plus caller inputs. Throws loudly on dangling references
// (content validation is the primary gate; this is defense in depth).

import type { GeneratedPlaceTransitAccess } from '../worldContent.generated';
import type {
  BusLineId,
  PlaceId,
  TransitNetworkInput,
  TransitStopId,
} from './types';

export interface StopLineRef {
  lineId: BusLineId;
  stopIndex: number;
}

export interface TransitNetwork {
  districts: ReadonlyMap<string, TransitNetworkInput['districts'][number]>;
  places: ReadonlyMap<string, TransitNetworkInput['places'][number]>;
  stops: ReadonlyMap<string, TransitNetworkInput['stops'][number]>;
  lines: ReadonlyMap<string, TransitNetworkInput['lines'][number]>;
  accessFromPlace(placeId: PlaceId): GeneratedPlaceTransitAccess[];
  linesAtStop(stopId: TransitStopId): StopLineRef[];
}

export function buildTransitNetwork(input: TransitNetworkInput): TransitNetwork {
  const districts = new Map(input.districts.map((district) => [district.id, district]));
  const places = new Map(input.places.map((place) => [place.id, place]));
  const stops = new Map(input.stops.map((stop) => [stop.id, stop]));
  const lines = new Map(input.lines.map((line) => [line.id, line]));

  for (const place of places.values()) {
    if (!districts.has(place.districtId)) {
      throw new Error(`TransitNetwork: places/${place.id}.districtId references unknown district '${place.districtId}'.`);
    }
    for (const access of place.transitAccess) {
      if (!stops.has(access.stopId)) {
        throw new Error(
          `TransitNetwork: places/${place.id}.transitAccess references unknown stop '${access.stopId}'.`,
        );
      }
    }
  }
  for (const stop of stops.values()) {
    if (!districts.has(stop.districtId)) {
      throw new Error(
        `TransitNetwork: transitStops/${stop.id}.districtId references unknown district '${stop.districtId}'.`,
      );
    }
    if (stop.placeId !== null && !places.has(stop.placeId)) {
      throw new Error(`TransitNetwork: transitStops/${stop.id}.placeId references unknown place '${stop.placeId}'.`);
    }
  }
  for (const line of lines.values()) {
    for (const stopId of line.stopIds) {
      if (!stops.has(stopId)) {
        throw new Error(`TransitNetwork: busLines/${line.id}.stopIds references unknown stop '${stopId}'.`);
      }
    }
  }

  const stopIndex = new Map<TransitStopId, StopLineRef[]>();
  for (const line of lines.values()) {
    line.stopIds.forEach((stopId, index) => {
      const refs = stopIndex.get(stopId) ?? [];
      refs.push({ lineId: line.id, stopIndex: index });
      stopIndex.set(stopId, refs);
    });
  }

  return {
    districts,
    places,
    stops,
    lines,
    accessFromPlace(placeId: PlaceId): GeneratedPlaceTransitAccess[] {
      return places.get(placeId)?.transitAccess.map((access) => ({ ...access })) ?? [];
    },
    linesAtStop(stopId: TransitStopId): StopLineRef[] {
      return (stopIndex.get(stopId) ?? []).map((ref) => ({ ...ref }));
    },
  };
}
