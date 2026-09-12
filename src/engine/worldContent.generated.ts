// GENERATED — do not edit by hand.
// Source: content/store.json (content v59b86490). Regenerate: npm run content:pull.
export const WORLD_CONTENT_VERSION = '59b86490';

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
  legacyIds?: string[];
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
    legacyIds: [],
  },
  {
    id: "place_b1",
    districtId: "district_b",
    name: "Place B1",
    transitAccess: [{ stopId: "stop_b", walkMinutes: 5 }],
    legacyIds: [],
  },
  {
    id: "room_104",
    districtId: "district_a",
    name: "Motel Room 104",
    transitAccess: [],
    legacyIds: ["home"],
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
  {
    id: "room104_storage_bedside",
    name: "Bedside Storage",
    capacity: 8,
    allowedItemKinds: [],
    tags: ["storage"],
  },
  {
    id: "room104_storage_desk",
    name: "Desk Storage",
    capacity: 12,
    allowedItemKinds: [],
    tags: ["storage"],
  },
  {
    id: "room104_storage_kitchen",
    name: "Kitchen Storage",
    capacity: 24,
    allowedItemKinds: [],
    tags: ["storage"],
  },
  {
    id: "room104_storage_wardrobe",
    name: "Wardrobe",
    capacity: 24,
    allowedItemKinds: [],
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
    id: "room104_main",
    placeId: "room_104",
    name: "Room 104",
    tags: ["interior", "home", "room104"],
  },
  {
    id: "space_a1",
    placeId: "place_a1",
    name: "Space A1",
    tags: ["interior"],
  },
];

export const GENERATED_VIEWS: GeneratedViewDef[] = [
  {
    id: "room104_bed_wardrobe",
    spaceId: "room104_main",
    name: "Bed & Wardrobe",
    neighbors: ["room104_desk_window", "room104_entrance_kitchenette"],
    assetId: null,
    tags: ["room104", "main-view", "bed", "storage"],
  },
  {
    id: "room104_desk_window",
    spaceId: "room104_main",
    name: "Desk & Window",
    neighbors: ["room104_bed_wardrobe", "room104_entrance_kitchenette"],
    assetId: null,
    tags: ["room104", "main-view", "desk", "window"],
  },
  {
    id: "room104_entrance_kitchenette",
    spaceId: "room104_main",
    name: "Entrance & Kitchenette",
    neighbors: ["room104_desk_window", "room104_bed_wardrobe"],
    assetId: null,
    tags: ["room104", "main-view", "entrance", "kitchenette"],
  },
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
  {
    id: "room104_bed",
    viewId: "room104_bed_wardrobe",
    name: "Bed",
    x: 0.42,
    y: 0.67,
    tags: ["hotspot", "bed", "rest"],
  },
  {
    id: "room104_bedside_storage",
    viewId: "room104_bed_wardrobe",
    name: "Bedside Storage",
    x: 0.58,
    y: 0.62,
    tags: ["hotspot", "storage", "container"],
  },
  {
    id: "room104_delivery_anchor",
    viewId: "room104_entrance_kitchenette",
    name: "Delivery Spot",
    x: 0.34,
    y: 0.73,
    tags: ["hotspot", "delivery", "world-anchor"],
  },
  {
    id: "room104_desk_storage",
    viewId: "room104_desk_window",
    name: "Desk Storage",
    x: 0.72,
    y: 0.72,
    tags: ["hotspot", "storage", "container"],
  },
  {
    id: "room104_door",
    viewId: "room104_entrance_kitchenette",
    name: "Door",
    x: 0.22,
    y: 0.48,
    tags: ["hotspot", "door", "exit"],
  },
  {
    id: "room104_kettle",
    viewId: "room104_entrance_kitchenette",
    name: "Kettle",
    x: 0.64,
    y: 0.52,
    tags: ["hotspot", "kettle", "kitchenette"],
  },
  {
    id: "room104_kitchen_storage",
    viewId: "room104_entrance_kitchenette",
    name: "Kitchen Storage",
    x: 0.78,
    y: 0.68,
    tags: ["hotspot", "storage", "container"],
  },
  {
    id: "room104_pc",
    viewId: "room104_desk_window",
    name: "Computer Desk",
    x: 0.62,
    y: 0.61,
    tags: ["hotspot", "computer", "surface"],
  },
  {
    id: "room104_wardrobe",
    viewId: "room104_bed_wardrobe",
    name: "Wardrobe",
    x: 0.76,
    y: 0.48,
    tags: ["hotspot", "wardrobe", "storage", "container"],
  },
  {
    id: "room104_window",
    viewId: "room104_desk_window",
    name: "Window",
    x: 0.28,
    y: 0.34,
    tags: ["hotspot", "window", "exterior-view"],
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
  {
    id: "room104_inspect_bedside_storage",
    anchorId: "room104_bedside_storage",
    capability: "inspect_bedside_storage",
    name: "Inspect bedside storage",
    tags: ["storage"],
  },
  {
    id: "room104_inspect_delivery_anchor",
    anchorId: "room104_delivery_anchor",
    capability: "inspect_delivery_anchor",
    name: "Inspect deliveries",
    tags: ["delivery"],
  },
  {
    id: "room104_inspect_desk_storage",
    anchorId: "room104_desk_storage",
    capability: "inspect_desk_storage",
    name: "Inspect desk storage",
    tags: ["storage"],
  },
  {
    id: "room104_leave_room",
    anchorId: "room104_door",
    capability: "leave_room",
    name: "Leave room",
    tags: ["exit"],
  },
  {
    id: "room104_observe_window",
    anchorId: "room104_window",
    capability: "observe_window",
    name: "Look outside",
    tags: ["observe"],
  },
  {
    id: "room104_open_kitchen_storage",
    anchorId: "room104_kitchen_storage",
    capability: "open_kitchen_storage",
    name: "Open kitchen storage",
    tags: ["storage"],
  },
  {
    id: "room104_open_wardrobe",
    anchorId: "room104_wardrobe",
    capability: "open_wardrobe",
    name: "Open wardrobe",
    tags: ["storage"],
  },
  {
    id: "room104_prepare_drink",
    anchorId: "room104_kettle",
    capability: "prepare_drink",
    name: "Use kettle",
    tags: ["kitchenette"],
  },
  {
    id: "room104_sleep",
    anchorId: "room104_bed",
    capability: "sleep",
    name: "Sleep",
    tags: ["rest"],
  },
  {
    id: "room104_use_computer",
    anchorId: "room104_pc",
    capability: "use_computer",
    name: "Use computer",
    tags: ["computer"],
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
