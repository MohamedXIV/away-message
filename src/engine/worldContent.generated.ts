// GENERATED — do not edit by hand.
// Source: content/store.json (content v3bab254c). Regenerate: npm run content:pull.
export const WORLD_CONTENT_VERSION = '3bab254c';

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
  assetId: string | null;
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
    assetId: "asset_a1",
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
  assetId: string | null;
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
    assetId: "asset_a1",
    tags: [],
  },
  {
    id: "view_a2",
    spaceId: "space_a1",
    name: "View A2",
    neighbors: ["view_a1"],
    assetId: null,
    tags: [],
  },
];

export interface GeneratedAnchorDef {
  id: string;
  viewId: string;
  name: string;
  x: number;
  y: number;
  tags: string[];
}

export interface GeneratedInteractionDef {
  id: string;
  anchorId: string;
  capability: string;
  name: string;
  tags: string[];
}

export const GENERATED_ANCHORS: GeneratedAnchorDef[] = [
  {
    id: "anchor_a1",
    viewId: "view_a1",
    name: "Anchor A1",
    x: 0.5,
    y: 0.5,
    tags: ["hotspot"],
  },
];

export const GENERATED_INTERACTIONS: GeneratedInteractionDef[] = [
  {
    id: "interaction_a1",
    anchorId: "anchor_a1",
    capability: "inspect",
    name: "Interaction A1",
    tags: [],
  },
];

export interface GeneratedAssetDef {
  id: string;
  name: string;
  kind: string;
  uri: string;
  normalMapAssetId: string | null;
  tags: string[];
}

export const GENERATED_ASSETS: GeneratedAssetDef[] = [
  {
    id: "asset_a1",
    name: "Asset A1",
    kind: "image",
    uri: "assets/world/a1.png",
    normalMapAssetId: "asset_a1_n",
    tags: [],
  },
  {
    id: "asset_a1_n",
    name: "Asset A1 Normal",
    kind: "image",
    uri: "assets/world/a1_n.png",
    normalMapAssetId: null,
    tags: [],
  },
  {
    id: "asset_a2",
    name: "Asset A2",
    kind: "audio",
    uri: "assets/world/a2.mp3",
    normalMapAssetId: null,
    tags: [],
  },
];

export interface GeneratedLightProfileDef {
  id: string;
  name: string;
  timeOfDay: string | null;
  colorTint: string | null;
  intensity: number;
  tags: string[];
}

export interface GeneratedAudioProfileDef {
  id: string;
  name: string;
  kind: string;
  assetId: string | null;
  volume: number;
  tags: string[];
}

export interface GeneratedAmbientProfileDef {
  id: string;
  name: string;
  weather: string | null;
  timeOfDay: string | null;
  density: number;
  tags: string[];
}

export const GENERATED_LIGHT_PROFILES: GeneratedLightProfileDef[] = [
  {
    id: "light_a1",
    name: "Light A1",
    timeOfDay: "day",
    colorTint: "#fff2d9",
    intensity: 1,
    tags: [],
  },
];

export const GENERATED_AUDIO_PROFILES: GeneratedAudioProfileDef[] = [
  {
    id: "audio_a1",
    name: "Audio A1",
    kind: "ambience",
    assetId: "asset_a2",
    volume: 0.6,
    tags: [],
  },
];

export const GENERATED_AMBIENT_PROFILES: GeneratedAmbientProfileDef[] = [
  {
    id: "ambient_a1",
    name: "Ambient A1",
    weather: "clear",
    timeOfDay: "evening",
    density: 0.5,
    tags: [],
  },
];

export interface GeneratedEventModifierDef {
  id: string;
  eventId: string;
  domain: string;
  kind: string;
  durationMinutes: number;
  targetIds: string[];
  value?: number | string | boolean;
}

export const GENERATED_EVENT_MODIFIERS: GeneratedEventModifierDef[] = [
  {
    id: "festival_courier_backlog",
    eventId: "city_canal_festival",
    domain: "delivery",
    kind: "courier_backlog",
    durationMinutes: 2880,
    targetIds: [],
    value: 360,
  },
  {
    id: "festival_night_opportunity",
    eventId: "city_canal_festival",
    domain: "life",
    kind: "festival_opportunity",
    durationMinutes: 2880,
    targetIds: [],
    value: 60,
  },
  {
    id: "os7_upgrade_opportunity",
    eventId: "orion_os_7_release",
    domain: "life",
    kind: "upgrade_opportunity",
    durationMinutes: 4320,
    targetIds: [],
    value: 40,
  },
];
