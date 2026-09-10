// GENERATED — do not edit by hand.
// Source: content/store.json (content v18a6b04c). Regenerate: npm run content:pull.
export const WORLD_CONTENT_VERSION = '18a6b04c';

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

export interface GeneratedItemDef {
  id: string;
  name: string;
  kind: string;
  portable: boolean;
  volume: number;
  tags: string[];
}

export interface GeneratedContainerDef {
  id: string;
  name: string;
  capacity: number;
  allowedItemKinds: string[];
  tags: string[];
}

export const GENERATED_ITEMS: GeneratedItemDef[] = [
  {
    id: "item_a",
    name: "Item A",
    kind: "food",
    portable: true,
    volume: 1,
    tags: ["food", "perishable"],
  },
];

export const GENERATED_CONTAINERS: GeneratedContainerDef[] = [
  {
    id: "container_a",
    name: "Container A",
    capacity: 10,
    allowedItemKinds: ["food"],
    tags: ["storage"],
  },
];

export interface GeneratedSpaceDef {
  id: string;
  placeId: string;
  name: string;
  tags: string[];
}

export interface GeneratedViewDef {
  id: string;
  spaceId: string;
  name: string;
  neighbors: string[];
  tags: string[];
}

export const GENERATED_SPACES: GeneratedSpaceDef[] = [
  {
    id: "space_a1",
    placeId: "place_a1",
    name: "Space A1",
    tags: ["interior"],
  },
];

export const GENERATED_VIEWS: GeneratedViewDef[] = [
  {
    id: "view_a1",
    spaceId: "space_a1",
    name: "View A1",
    neighbors: ["view_a2"],
    tags: [],
  },
  {
    id: "view_a2",
    spaceId: "space_a1",
    name: "View A2",
    neighbors: ["view_a1"],
    tags: [],
  },
];
