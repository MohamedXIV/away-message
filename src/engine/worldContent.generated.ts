// GENERATED — do not edit by hand.
// Source: content/store.json (content vaa79ad61). Regenerate: npm run content:pull.
export const WORLD_CONTENT_VERSION = 'aa79ad61';

export interface GeneratedSpatialPoint {
  x: number;
  y: number;
}

export interface GeneratedSpatialPosition {
  x: number;
  y: number;
  z: number;
}

export interface GeneratedSpatialBounds {
  polygon: GeneratedSpatialPoint[];
  minZ?: number;
  maxZ?: number;
  priority?: number;
}

export interface GeneratedDistrictDef {
  id: string;
  name: string;
  mapX: number;
  mapY: number;
  tags: string[];
  spatialBounds?: GeneratedSpatialBounds;
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
  spatialBounds?: GeneratedSpatialBounds;
  entryPosition?: GeneratedSpatialPosition;
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
    spatialBounds: { polygon: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 0, y: 100 }], minZ: 0, maxZ: 0, priority: 0 },
  },
  {
    id: "district_b",
    name: "District B",
    mapX: 80,
    mapY: 40,
    tags: ["downtown"],
    spatialBounds: { polygon: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 100 }], minZ: 0, maxZ: 0, priority: 0 },
  },
];

export const GENERATED_PLACES: GeneratedPlaceDef[] = [
  {
    id: "place_a1",
    districtId: "district_a",
    name: "Place A1",
    transitAccess: [{ stopId: "stop_a", walkMinutes: 4 }],
    legacyIds: [],
    spatialBounds: { polygon: [{ x: 15, y: 55 }, { x: 25, y: 55 }, { x: 25, y: 65 }, { x: 15, y: 65 }], minZ: 0, maxZ: 0, priority: 0 },
    entryPosition: { x: 20, y: 60, z: 0 },
  },
  {
    id: "place_b1",
    districtId: "district_b",
    name: "CornerMart",
    transitAccess: [{ stopId: "stop_b", walkMinutes: 5 }],
    legacyIds: [],
    spatialBounds: { polygon: [{ x: 75, y: 35 }, { x: 85, y: 35 }, { x: 85, y: 45 }, { x: 75, y: 45 }], minZ: 0, maxZ: 0, priority: 0 },
    entryPosition: { x: 80, y: 40, z: 0 },
  },
  {
    id: "room_104",
    districtId: "district_a",
    name: "Motel Room 104",
    transitAccess: [],
    legacyIds: ["home"],
  },
  {
    id: "room_208",
    districtId: "district_a",
    name: "Courtyard Room 208",
    transitAccess: [],
    legacyIds: [],
  },
  {
    id: "room_305",
    districtId: "district_a",
    name: "Upstairs Room 305",
    transitAccess: [],
    legacyIds: [],
  },
  {
    id: "tiny_apartment_1",
    districtId: "district_a",
    name: "Harbor Tiny Apartment",
    transitAccess: [],
    legacyIds: [],
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
  spatialBounds?: GeneratedSpatialBounds;
  entryPosition?: GeneratedSpatialPosition;
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
    id: "room208_main",
    placeId: "room_208",
    name: "Room 208",
    tags: ["interior", "home", "motel_room", "starter_option"],
  },
  {
    id: "room305_main",
    placeId: "room_305",
    name: "Room 305",
    tags: ["interior", "home", "motel_room", "upgrade"],
  },
  {
    id: "space_a1",
    placeId: "place_a1",
    name: "Space A1",
    tags: ["interior"],
    spatialBounds: { polygon: [{ x: 17, y: 57 }, { x: 23, y: 57 }, { x: 23, y: 63 }, { x: 17, y: 63 }], minZ: 0, maxZ: 0, priority: 0 },
    entryPosition: { x: 20, y: 60, z: 0 },
  },
  {
    id: "space_b1",
    placeId: "place_b1",
    name: "CornerMart Floor",
    tags: ["interior", "shop", "public"],
  },
  {
    id: "tiny_apartment_main",
    placeId: "tiny_apartment_1",
    name: "Tiny Apartment",
    tags: ["interior", "home", "apartment", "upgrade"],
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
    id: "room208_main_view",
    spaceId: "room208_main",
    name: "Courtyard Room",
    neighbors: [],
    assetId: null,
    tags: ["home", "single_view", "starter_option"],
  },
  {
    id: "room305_main_view",
    spaceId: "room305_main",
    name: "Upstairs Room",
    neighbors: [],
    assetId: null,
    tags: ["home", "single_view", "upgrade"],
  },
  {
    id: "tiny_apartment_main_view",
    spaceId: "tiny_apartment_main",
    name: "Tiny Apartment",
    neighbors: [],
    assetId: null,
    tags: ["home", "single_view", "upgrade"],
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
  {
    id: "view_b1",
    spaceId: "space_b1",
    name: "CornerMart Hero",
    neighbors: [],
    assetId: "corner_mart_hero",
    tags: ["shop", "hero", "single_view"],
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
    id: "corner_mart_door",
    viewId: "view_b1",
    name: "Front Door",
    x: 0.91,
    y: 0.67,
    tags: ["hotspot", "door", "exit"],
  },
  {
    id: "corner_mart_fan",
    viewId: "view_b1",
    name: "Ceiling Fan",
    x: 0.52,
    y: 0.17,
    tags: ["ambient", "fan"],
  },
  {
    id: "corner_mart_fridge",
    viewId: "view_b1",
    name: "Drink Fridge",
    x: 0.8,
    y: 0.43,
    tags: ["hotspot", "shop", "fridge"],
  },
  {
    id: "corner_mart_notice",
    viewId: "view_b1",
    name: "Notice Board",
    x: 0.1,
    y: 0.33,
    tags: ["hotspot", "notice"],
  },
  {
    id: "corner_mart_shelf_center",
    viewId: "view_b1",
    name: "Center Shelf",
    x: 0.45,
    y: 0.5,
    tags: ["hotspot", "shop", "shelf"],
  },
  {
    id: "corner_mart_shelf_left",
    viewId: "view_b1",
    name: "Left Shelf",
    x: 0.22,
    y: 0.52,
    tags: ["hotspot", "shop", "shelf"],
  },
  {
    id: "corner_mart_window",
    viewId: "view_b1",
    name: "Front Window",
    x: 0.929,
    y: 0.35,
    tags: ["ambient", "window", "weather"],
  },
  {
    id: "fixture_cafe_customer_anchor",
    viewId: "view_a1",
    name: "Fixture Cafe Customer",
    x: 0.65,
    y: 0.5,
    tags: ["fixture", "customer"],
  },
  {
    id: "fixture_cafe_staff_anchor",
    viewId: "view_a1",
    name: "Fixture Cafe Staff",
    x: 0.35,
    y: 0.5,
    tags: ["fixture", "staff"],
  },
  {
    id: "fixture_shop_customer_anchor",
    viewId: "view_b1",
    name: "Checkout Queue",
    x: 0.6,
    y: 0.73,
    tags: ["customer", "checkout"],
  },
  {
    id: "fixture_shop_staff_anchor",
    viewId: "view_b1",
    name: "CornerMart Cashier",
    x: 0.72,
    y: 0.67,
    tags: ["hotspot", "staff", "cashier", "npc"],
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
  {
    id: "room208_bed",
    viewId: "room208_main_view",
    name: "Bed",
    x: 0.4,
    y: 0.7,
    tags: ["hotspot", "bed", "rest"],
  },
  {
    id: "room208_delivery",
    viewId: "room208_main_view",
    name: "Delivery Spot",
    x: 0.24,
    y: 0.78,
    tags: ["hotspot", "delivery", "world-anchor"],
  },
  {
    id: "room208_door",
    viewId: "room208_main_view",
    name: "Door",
    x: 0.12,
    y: 0.52,
    tags: ["hotspot", "door", "exit"],
  },
  {
    id: "room208_kettle",
    viewId: "room208_main_view",
    name: "Kitchenette",
    x: 0.62,
    y: 0.5,
    tags: ["hotspot", "kettle", "kitchenette"],
  },
  {
    id: "room208_pc",
    viewId: "room208_main_view",
    name: "Computer Desk",
    x: 0.7,
    y: 0.62,
    tags: ["hotspot", "computer", "surface"],
  },
  {
    id: "room208_shower",
    viewId: "room208_main_view",
    name: "Shower",
    x: 0.83,
    y: 0.5,
    tags: ["hotspot", "shower", "bathroom"],
  },
  {
    id: "room208_window",
    viewId: "room208_main_view",
    name: "Window",
    x: 0.25,
    y: 0.32,
    tags: ["hotspot", "window", "exterior-view"],
  },
  {
    id: "room305_bed",
    viewId: "room305_main_view",
    name: "Bed",
    x: 0.4,
    y: 0.7,
    tags: ["hotspot", "bed", "rest"],
  },
  {
    id: "room305_delivery",
    viewId: "room305_main_view",
    name: "Delivery Spot",
    x: 0.24,
    y: 0.78,
    tags: ["hotspot", "delivery", "world-anchor"],
  },
  {
    id: "room305_door",
    viewId: "room305_main_view",
    name: "Door",
    x: 0.12,
    y: 0.52,
    tags: ["hotspot", "door", "exit"],
  },
  {
    id: "room305_kettle",
    viewId: "room305_main_view",
    name: "Kitchenette",
    x: 0.62,
    y: 0.5,
    tags: ["hotspot", "kettle", "kitchenette"],
  },
  {
    id: "room305_pc",
    viewId: "room305_main_view",
    name: "Computer Desk",
    x: 0.7,
    y: 0.62,
    tags: ["hotspot", "computer", "surface"],
  },
  {
    id: "room305_shower",
    viewId: "room305_main_view",
    name: "Shower",
    x: 0.83,
    y: 0.5,
    tags: ["hotspot", "shower", "bathroom"],
  },
  {
    id: "room305_window",
    viewId: "room305_main_view",
    name: "Window",
    x: 0.25,
    y: 0.32,
    tags: ["hotspot", "window", "exterior-view"],
  },
  {
    id: "tinyapt_bed",
    viewId: "tiny_apartment_main_view",
    name: "Bed",
    x: 0.4,
    y: 0.7,
    tags: ["hotspot", "bed", "rest"],
  },
  {
    id: "tinyapt_delivery",
    viewId: "tiny_apartment_main_view",
    name: "Delivery Spot",
    x: 0.24,
    y: 0.78,
    tags: ["hotspot", "delivery", "world-anchor"],
  },
  {
    id: "tinyapt_door",
    viewId: "tiny_apartment_main_view",
    name: "Door",
    x: 0.12,
    y: 0.52,
    tags: ["hotspot", "door", "exit"],
  },
  {
    id: "tinyapt_kettle",
    viewId: "tiny_apartment_main_view",
    name: "Kitchenette",
    x: 0.62,
    y: 0.5,
    tags: ["hotspot", "kettle", "kitchenette"],
  },
  {
    id: "tinyapt_pc",
    viewId: "tiny_apartment_main_view",
    name: "Computer Desk",
    x: 0.7,
    y: 0.62,
    tags: ["hotspot", "computer", "surface"],
  },
  {
    id: "tinyapt_shower",
    viewId: "tiny_apartment_main_view",
    name: "Shower",
    x: 0.83,
    y: 0.5,
    tags: ["hotspot", "shower", "bathroom"],
  },
  {
    id: "tinyapt_window",
    viewId: "tiny_apartment_main_view",
    name: "Window",
    x: 0.25,
    y: 0.32,
    tags: ["hotspot", "window", "exterior-view"],
  },
];

export const GENERATED_INTERACTIONS: GeneratedInteractionDef[] = [
  {
    id: "corner_mart_cashier",
    anchorId: "fixture_shop_staff_anchor",
    capability: "cashier",
    name: "Talk / Checkout",
    tags: ["shop", "cashier"],
  },
  {
    id: "corner_mart_focus_fridge",
    anchorId: "corner_mart_fridge",
    capability: "focus_fixture",
    name: "Inspect fridge",
    tags: ["shop", "focus"],
  },
  {
    id: "corner_mart_focus_shelf_center",
    anchorId: "corner_mart_shelf_center",
    capability: "focus_fixture",
    name: "Inspect center shelf",
    tags: ["shop", "focus"],
  },
  {
    id: "corner_mart_focus_shelf_left",
    anchorId: "corner_mart_shelf_left",
    capability: "focus_fixture",
    name: "Inspect left shelf",
    tags: ["shop", "focus"],
  },
  {
    id: "corner_mart_leave",
    anchorId: "corner_mart_door",
    capability: "leave_store",
    name: "Leave CornerMart",
    tags: ["shop", "exit"],
  },
  {
    id: "corner_mart_notice",
    anchorId: "corner_mart_notice",
    capability: "inspect",
    name: "Read notice board",
    tags: ["shop", "notice"],
  },
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
  {
    id: "room208_inspect_delivery",
    anchorId: "room208_delivery",
    capability: "inspect_delivery_anchor",
    name: "Inspect deliveries",
    tags: ["delivery"],
  },
  {
    id: "room208_leave",
    anchorId: "room208_door",
    capability: "leave_room",
    name: "Leave residence",
    tags: ["exit"],
  },
  {
    id: "room208_observe_window",
    anchorId: "room208_window",
    capability: "observe_window",
    name: "Look outside",
    tags: ["observe"],
  },
  {
    id: "room208_prepare_drink",
    anchorId: "room208_kettle",
    capability: "prepare_drink",
    name: "Use kitchenette",
    tags: ["kitchenette"],
  },
  {
    id: "room208_shower_interaction",
    anchorId: "room208_shower",
    capability: "shower",
    name: "Take shower",
    tags: ["bathroom"],
  },
  {
    id: "room208_sleep",
    anchorId: "room208_bed",
    capability: "sleep",
    name: "Sleep",
    tags: ["rest"],
  },
  {
    id: "room208_use_computer",
    anchorId: "room208_pc",
    capability: "use_computer",
    name: "Use computer",
    tags: ["computer"],
  },
  {
    id: "room305_inspect_delivery",
    anchorId: "room305_delivery",
    capability: "inspect_delivery_anchor",
    name: "Inspect deliveries",
    tags: ["delivery"],
  },
  {
    id: "room305_leave",
    anchorId: "room305_door",
    capability: "leave_room",
    name: "Leave residence",
    tags: ["exit"],
  },
  {
    id: "room305_observe_window",
    anchorId: "room305_window",
    capability: "observe_window",
    name: "Look outside",
    tags: ["observe"],
  },
  {
    id: "room305_prepare_drink",
    anchorId: "room305_kettle",
    capability: "prepare_drink",
    name: "Use kitchenette",
    tags: ["kitchenette"],
  },
  {
    id: "room305_shower_interaction",
    anchorId: "room305_shower",
    capability: "shower",
    name: "Take shower",
    tags: ["bathroom"],
  },
  {
    id: "room305_sleep",
    anchorId: "room305_bed",
    capability: "sleep",
    name: "Sleep",
    tags: ["rest"],
  },
  {
    id: "room305_use_computer",
    anchorId: "room305_pc",
    capability: "use_computer",
    name: "Use computer",
    tags: ["computer"],
  },
  {
    id: "tinyapt_inspect_delivery",
    anchorId: "tinyapt_delivery",
    capability: "inspect_delivery_anchor",
    name: "Inspect deliveries",
    tags: ["delivery"],
  },
  {
    id: "tinyapt_leave",
    anchorId: "tinyapt_door",
    capability: "leave_room",
    name: "Leave residence",
    tags: ["exit"],
  },
  {
    id: "tinyapt_observe_window",
    anchorId: "tinyapt_window",
    capability: "observe_window",
    name: "Look outside",
    tags: ["observe"],
  },
  {
    id: "tinyapt_prepare_drink",
    anchorId: "tinyapt_kettle",
    capability: "prepare_drink",
    name: "Use kitchenette",
    tags: ["kitchenette"],
  },
  {
    id: "tinyapt_shower_interaction",
    anchorId: "tinyapt_shower",
    capability: "shower",
    name: "Take shower",
    tags: ["bathroom"],
  },
  {
    id: "tinyapt_sleep",
    anchorId: "tinyapt_bed",
    capability: "sleep",
    name: "Sleep",
    tags: ["rest"],
  },
  {
    id: "tinyapt_use_computer",
    anchorId: "tinyapt_pc",
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
  {
    id: "corner_mart_fan",
    name: "CornerMart Ceiling Fan",
    kind: "image",
    uri: "assets/world/corner_mart_fan.svg",
    normalMapAssetId: null,
    tags: ["production", "shop", "prop"],
  },
  {
    id: "corner_mart_hero",
    name: "CornerMart Hero View",
    kind: "image",
    uri: "assets/world/corner_mart_hero.svg",
    normalMapAssetId: "corner_mart_hero_normal",
    tags: ["production", "shop", "hero"],
  },
  {
    id: "corner_mart_hero_normal",
    name: "CornerMart Hero Normal Map",
    kind: "image",
    uri: "assets/world/corner_mart_hero_normal.svg",
    normalMapAssetId: null,
    tags: ["production", "shop", "normal"],
  },
  {
    id: "corner_mart_window_glass",
    name: "CornerMart Window Glass",
    kind: "image",
    uri: "assets/world/corner_mart_window_glass.svg",
    normalMapAssetId: null,
    tags: ["production", "shop", "prop", "window"],
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
    id: "corner_mart_fluorescent",
    name: "CornerMart Fluorescent",
    timeOfDay: null,
    colorTint: "#e9f7ff",
    intensity: 1.05,
    tags: ["shop", "fluorescent", "normal-map"],
  },
  {
    id: "corner_mart_fridge_light",
    name: "CornerMart Fridge Light",
    timeOfDay: null,
    colorTint: "#d8f4ff",
    intensity: 0.85,
    tags: ["shop", "fridge", "subtle", "normal-map"],
  },
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
  {
    id: "corner_mart_fridge_audio",
    name: "CornerMart Fridge Compressor",
    kind: "fridge",
    assetId: null,
    volume: 0.18,
    tags: ["shop", "fridge", "loop"],
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
    id: "canal_storm_front",
    eventId: "canal_storm_warning",
    domain: "environment",
    kind: "condition_override",
    durationMinutes: 180,
    targetIds: [],
    value: "storm",
  },
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

export interface GeneratedPhysicalObjectDef {
  id: string;
  name: string;
  kind: string;
  containerId: string | null;
  affordances: string[];
  toolCapabilities: string[];
  resourceCapabilities: string[];
  tags: string[];
}

export interface GeneratedPlacementSlotDef {
  id: string;
  name: string;
  spaceId: string | null;
  anchorId: string | null;
  parentPlacementId: string | null;
  slotKind: string;
  allowedObjectKinds: string[];
  tags: string[];
}

export interface GeneratedObjectPlacementDef {
  id: string;
  objectDefId: string;
  slotId: string;
}

export interface GeneratedPlaceServicePolicy {
  id: string;
  placeId: string;
  acceptsDelivery: boolean;
  deliveryTargetSlotId: string | null;
}

export interface GeneratedHousingOfferDef {
  id: string;
  placeId: string;
  available: boolean;
  monthlyRent: number;
  moveInCost: number;
  starterEligible: boolean;
  starterDefault: boolean;
}

export const GENERATED_PHYSICAL_OBJECT_DEFS: GeneratedPhysicalObjectDef[] = [
  {
    id: "fixture_drawer_def",
    name: "Fixture Drawer",
    kind: "storage",
    containerId: "container_a",
    affordances: ["open"],
    toolCapabilities: [],
    resourceCapabilities: [],
    tags: ["fixture", "storage"],
  },
  {
    id: "fixture_workbench_def",
    name: "Fixture Workbench",
    kind: "furniture",
    containerId: null,
    affordances: ["inspect"],
    toolCapabilities: ["work_surface"],
    resourceCapabilities: ["power"],
    tags: ["fixture", "work"],
  },
];

export const GENERATED_PLACEMENT_SLOTS: GeneratedPlacementSlotDef[] = [
  {
    id: "delivery_target_primary",
    name: "Primary Delivery Target",
    spaceId: "room104_main",
    anchorId: "room104_delivery_anchor",
    parentPlacementId: null,
    slotKind: "delivery",
    allowedObjectKinds: [],
    tags: ["delivery"],
  },
  {
    id: "delivery_target_room208",
    name: "Room 208 Delivery Target",
    spaceId: "room208_main",
    anchorId: "room208_delivery",
    parentPlacementId: null,
    slotKind: "delivery",
    allowedObjectKinds: [],
    tags: ["delivery"],
  },
  {
    id: "delivery_target_room305",
    name: "Room 305 Delivery Target",
    spaceId: "room305_main",
    anchorId: "room305_delivery",
    parentPlacementId: null,
    slotKind: "delivery",
    allowedObjectKinds: [],
    tags: ["delivery"],
  },
  {
    id: "delivery_target_tiny_apartment",
    name: "Tiny Apartment Delivery Target",
    spaceId: "tiny_apartment_main",
    anchorId: "tinyapt_delivery",
    parentPlacementId: null,
    slotKind: "delivery",
    allowedObjectKinds: [],
    tags: ["delivery"],
  },
  {
    id: "fixture_drawer_slot",
    name: "Fixture Drawer Slot",
    spaceId: null,
    anchorId: null,
    parentPlacementId: "fixture_workbench_placement",
    slotKind: "nested",
    allowedObjectKinds: ["storage"],
    tags: ["fixture"],
  },
  {
    id: "fixture_workbench_slot",
    name: "Fixture Workbench Slot",
    spaceId: "space_a1",
    anchorId: "anchor_a1",
    parentPlacementId: null,
    slotKind: "floor",
    allowedObjectKinds: ["furniture"],
    tags: ["fixture"],
  },
];

export const GENERATED_OBJECT_PLACEMENTS: GeneratedObjectPlacementDef[] = [
  {
    id: "fixture_drawer_placement",
    objectDefId: "fixture_drawer_def",
    slotId: "fixture_drawer_slot",
  },
  {
    id: "fixture_workbench_placement",
    objectDefId: "fixture_workbench_def",
    slotId: "fixture_workbench_slot",
  },
];

export const GENERATED_PLACE_SERVICE_POLICIES: GeneratedPlaceServicePolicy[] = [
  {
    id: "primary_delivery_policy",
    placeId: "room_104",
    acceptsDelivery: true,
    deliveryTargetSlotId: "delivery_target_primary",
  },
  {
    id: "room208_delivery_policy",
    placeId: "room_208",
    acceptsDelivery: true,
    deliveryTargetSlotId: "delivery_target_room208",
  },
  {
    id: "room305_delivery_policy",
    placeId: "room_305",
    acceptsDelivery: true,
    deliveryTargetSlotId: "delivery_target_room305",
  },
  {
    id: "tiny_apartment_delivery_policy",
    placeId: "tiny_apartment_1",
    acceptsDelivery: true,
    deliveryTargetSlotId: "delivery_target_tiny_apartment",
  },
];

export const GENERATED_HOUSING_OFFERS: GeneratedHousingOfferDef[] = [
  {
    id: "better_room_305",
    placeId: "room_305",
    available: true,
    monthlyRent: 185,
    moveInCost: 90,
    starterEligible: false,
    starterDefault: false,
  },
  {
    id: "starter_room_104",
    placeId: "room_104",
    available: true,
    monthlyRent: 140,
    moveInCost: 0,
    starterEligible: true,
    starterDefault: true,
  },
  {
    id: "starter_room_208",
    placeId: "room_208",
    available: true,
    monthlyRent: 125,
    moveInCost: 18,
    starterEligible: true,
    starterDefault: false,
  },
  {
    id: "tiny_apartment_harbor",
    placeId: "tiny_apartment_1",
    available: true,
    monthlyRent: 260,
    moveInCost: 220,
    starterEligible: false,
    starterDefault: false,
  },
];

export interface GeneratedVenueRoleDef {
  id: string;
  placeId: string;
  name: string;
  roleKind: string;
  stationIds: string[];
  tags: string[];
}

export interface GeneratedVenueStationDef {
  id: string;
  placeId: string;
  spaceId: string;
  anchorId: string | null;
  name: string;
  capacity: number;
  roleKinds: string[];
  tags: string[];
}

export type GeneratedVenueContextRequirement =
  | { kind: "item"; itemKind: string; quantity: number }
  | { kind: "tool"; capability: string }
  | { kind: "resource"; capability: string };

export interface GeneratedVenueServiceDef {
  id: string;
  placeId: string;
  spaceId: string;
  name: string;
  intentKinds: string[];
  activityTemplateId: string;
  requiredRoleKinds: string[];
  requiredStationIds: string[];
  contextRequirements: GeneratedVenueContextRequirement[];
  tags: string[];
}

export interface GeneratedVenueActivityPhaseDef {
  id: string;
  durationMinutes: number;
  stationId: string | null;
}

export interface GeneratedVenueActivityTemplateDef {
  id: string;
  placeId: string;
  name: string;
  purpose: string;
  activityKind: string;
  phases: GeneratedVenueActivityPhaseDef[];
  completionOwner: string;
  completionKind: string;
  tags: string[];
}

export const GENERATED_VENUE_ROLES: GeneratedVenueRoleDef[] = [
  {
    id: "fixture_barista_role",
    placeId: "place_a1",
    name: "Fixture Barista",
    roleKind: "barista",
    stationIds: ["fixture_cafe_staff_station"],
    tags: ["fixture"],
  },
  {
    id: "fixture_cashier_role",
    placeId: "place_b1",
    name: "Fixture Cashier",
    roleKind: "cashier",
    stationIds: ["fixture_shop_staff_station"],
    tags: ["fixture"],
  },
];

export const GENERATED_VENUE_STATIONS: GeneratedVenueStationDef[] = [
  {
    id: "fixture_cafe_customer_station",
    placeId: "place_a1",
    spaceId: "space_a1",
    anchorId: "fixture_cafe_customer_anchor",
    name: "Fixture Cafe Customer Station",
    capacity: 1,
    roleKinds: ["customer"],
    tags: ["fixture", "customer"],
  },
  {
    id: "fixture_cafe_staff_station",
    placeId: "place_a1",
    spaceId: "space_a1",
    anchorId: "fixture_cafe_staff_anchor",
    name: "Fixture Cafe Staff Station",
    capacity: 1,
    roleKinds: ["barista"],
    tags: ["fixture", "staff"],
  },
  {
    id: "fixture_shop_customer_station",
    placeId: "place_b1",
    spaceId: "space_b1",
    anchorId: "fixture_shop_customer_anchor",
    name: "Fixture Shop Customer Station",
    capacity: 1,
    roleKinds: ["customer"],
    tags: ["fixture", "customer"],
  },
  {
    id: "fixture_shop_staff_station",
    placeId: "place_b1",
    spaceId: "space_b1",
    anchorId: "fixture_shop_staff_anchor",
    name: "Fixture Shop Staff Station",
    capacity: 1,
    roleKinds: ["cashier"],
    tags: ["fixture", "staff"],
  },
];

export const GENERATED_VENUE_SERVICES: GeneratedVenueServiceDef[] = [
  {
    id: "fixture_cafe_service",
    placeId: "place_a1",
    spaceId: "space_a1",
    name: "Fixture Cafe Service",
    intentKinds: ["shop_for_need"],
    activityTemplateId: "fixture_cafe_customer_activity",
    requiredRoleKinds: ["barista"],
    requiredStationIds: ["fixture_cafe_staff_station", "fixture_cafe_customer_station"],
    contextRequirements: [{ kind: "tool", capability: "work_surface" }, { kind: "resource", capability: "power" }],
    tags: ["fixture", "cafe"],
  },
  {
    id: "fixture_shop_service",
    placeId: "place_b1",
    spaceId: "space_b1",
    name: "Fixture Shop Service",
    intentKinds: ["shop_for_need"],
    activityTemplateId: "fixture_shop_customer_activity",
    requiredRoleKinds: ["cashier"],
    requiredStationIds: ["fixture_shop_staff_station", "fixture_shop_customer_station"],
    contextRequirements: [],
    tags: ["fixture", "shop"],
  },
];

export const GENERATED_ACTIVITY_TEMPLATES: GeneratedVenueActivityTemplateDef[] = [
  {
    id: "fixture_cafe_customer_activity",
    placeId: "place_a1",
    name: "Fixture Cafe Order",
    purpose: "shop",
    activityKind: "ordering",
    phases: [{ id: "order", durationMinutes: 2, stationId: "fixture_cafe_customer_station" }, { id: "receive", durationMinutes: 2, stationId: "fixture_cafe_customer_station" }],
    completionOwner: "shop",
    completionKind: "order_ready",
    tags: ["fixture", "cafe"],
  },
  {
    id: "fixture_shop_customer_activity",
    placeId: "place_b1",
    name: "Fixture Shop Checkout",
    purpose: "shop",
    activityKind: "checkout",
    phases: [{ id: "checkout", durationMinutes: 3, stationId: "fixture_shop_customer_station" }],
    completionOwner: "shop",
    completionKind: "checkout_ready",
    tags: ["fixture", "shop"],
  },
];

export interface GeneratedShopFixtureDef {
  id: string;
  placeId: string;
  viewId: string;
  anchorId: string;
  name: string;
  kind: string;
  focusZoom: number;
  lightProfileIds: string[];
  audioProfileIds: string[];
  effectTags: string[];
}

export interface GeneratedShopSlotDef {
  id: string;
  fixtureId: string;
  eligibleSkuIds: string[];
}

export interface GeneratedScenePropDef {
  id: string;
  viewId: string;
  anchorId: string;
  assetId: string;
  depth: number;
  width: number;
  height: number;
  motionType: string | null;
  motionSpeed: number;
  motionAmplitude: number;
  tags: string[];
}

export const GENERATED_SHOP_FIXTURES: GeneratedShopFixtureDef[] = [
  {
    id: "corner_mart_cashier_counter",
    placeId: "place_b1",
    viewId: "view_b1",
    anchorId: "fixture_shop_staff_anchor",
    name: "Cashier Counter",
    kind: "cashierCounter",
    focusZoom: 1.35,
    lightProfileIds: ["corner_mart_fluorescent"],
    audioProfileIds: [],
    effectTags: [],
  },
  {
    id: "corner_mart_fridge",
    placeId: "place_b1",
    viewId: "view_b1",
    anchorId: "corner_mart_fridge",
    name: "Refrigerated Case",
    kind: "fridge",
    focusZoom: 1.75,
    lightProfileIds: ["corner_mart_fridge_light"],
    audioProfileIds: ["corner_mart_fridge_audio"],
    effectTags: ["condensation"],
  },
  {
    id: "corner_mart_shelf_center",
    placeId: "place_b1",
    viewId: "view_b1",
    anchorId: "corner_mart_shelf_center",
    name: "Center Grocery Shelf",
    kind: "shelf",
    focusZoom: 1.65,
    lightProfileIds: ["corner_mart_fluorescent"],
    audioProfileIds: [],
    effectTags: [],
  },
  {
    id: "corner_mart_shelf_left",
    placeId: "place_b1",
    viewId: "view_b1",
    anchorId: "corner_mart_shelf_left",
    name: "Left Grocery Shelf",
    kind: "shelf",
    focusZoom: 1.65,
    lightProfileIds: ["corner_mart_fluorescent"],
    audioProfileIds: [],
    effectTags: [],
  },
];

export const GENERATED_SHOP_SLOTS: GeneratedShopSlotDef[] = [
  {
    id: "corner_mart_fridge_a",
    fixtureId: "corner_mart_fridge",
    eligibleSkuIds: ["grocery_bag"],
  },
  {
    id: "corner_mart_fridge_b",
    fixtureId: "corner_mart_fridge",
    eligibleSkuIds: ["grocery_bag", "noodles_cup"],
  },
  {
    id: "corner_mart_shelf_center_a",
    fixtureId: "corner_mart_shelf_center",
    eligibleSkuIds: ["grocery_bag", "noodle_6pack"],
  },
  {
    id: "corner_mart_shelf_center_b",
    fixtureId: "corner_mart_shelf_center",
    eligibleSkuIds: ["noodles_cup", "grocery_bag"],
  },
  {
    id: "corner_mart_shelf_left_a",
    fixtureId: "corner_mart_shelf_left",
    eligibleSkuIds: ["noodles_cup", "grocery_bag"],
  },
  {
    id: "corner_mart_shelf_left_b",
    fixtureId: "corner_mart_shelf_left",
    eligibleSkuIds: ["noodle_6pack", "noodles_cup"],
  },
];

export const GENERATED_SCENE_PROPS: GeneratedScenePropDef[] = [
  {
    id: "corner_mart_fan_prop",
    viewId: "view_b1",
    anchorId: "corner_mart_fan",
    assetId: "corner_mart_fan",
    depth: 24,
    width: 0.11,
    height: 0.2,
    motionType: "rotation",
    motionSpeed: 72,
    motionAmplitude: 0,
    tags: ["shop", "fan", "ambient"],
  },
  {
    id: "corner_mart_window_prop",
    viewId: "view_b1",
    anchorId: "corner_mart_window",
    assetId: "corner_mart_window_glass",
    depth: 18,
    width: 0.055,
    height: 0.333,
    motionType: null,
    motionSpeed: 0,
    motionAmplitude: 0,
    tags: ["shop", "window", "weather-window"],
  },
];
