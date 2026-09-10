// GENERATED — do not edit by hand.
// Source: content/store.json (content vf6d90422). Regenerate: npm run content:pull.
export const WORLD_CONTENT_VERSION = 'f6d90422';

export interface GeneratedDistrictDef {
  id: string;
  name: string;
  mapX: number;
  mapY: number;
  tags: string[];
}

export interface GeneratedPlaceTransitAccess {
  stopId: string;
  walkMinutes: number;
}

export interface GeneratedPlaceDef {
  id: string;
  districtId: string;
  name: string;
  transitAccess: GeneratedPlaceTransitAccess[];
}

export interface GeneratedTransitStopDef {
  id: string;
  districtId: string;
  name: string;
  placeId: string | null;
  mapX: number;
  mapY: number;
}

export interface GeneratedBusLineDef {
  id: string;
  name: string;
  stopIds: string[];
  serviceStartMinute: number;
  serviceEndMinute: number;
  headwayMinutes: number;
  segmentMinutes: number[];
  fare: number;
}

export const GENERATED_DISTRICTS: GeneratedDistrictDef[] = [
  {
    id: "district_a",
    name: "District A",
    mapX: 20,
    mapY: 60,
    tags: ["residential"],
  },
  {
    id: "district_b",
    name: "District B",
    mapX: 80,
    mapY: 40,
    tags: ["downtown"],
  },
];

export const GENERATED_PLACES: GeneratedPlaceDef[] = [
  {
    id: "place_a1",
    districtId: "district_a",
    name: "Place A1",
    transitAccess: [{ stopId: "stop_a", walkMinutes: 4 }],
  },
  {
    id: "place_b1",
    districtId: "district_b",
    name: "Place B1",
    transitAccess: [{ stopId: "stop_b", walkMinutes: 5 }],
  },
];

export const GENERATED_TRANSIT_STOPS: GeneratedTransitStopDef[] = [
  {
    id: "stop_a",
    districtId: "district_a",
    name: "Stop A",
    placeId: "place_a1",
    mapX: 22,
    mapY: 58,
  },
  {
    id: "stop_b",
    districtId: "district_b",
    name: "Stop B",
    placeId: "place_b1",
    mapX: 78,
    mapY: 42,
  },
];

export const GENERATED_BUS_LINES: GeneratedBusLineDef[] = [
  {
    id: "line_ab",
    name: "Line AB",
    stopIds: ["stop_a", "stop_b"],
    serviceStartMinute: 360,
    serviceEndMinute: 1380,
    headwayMinutes: 20,
    segmentMinutes: [12],
    fare: 2,
  },
];
