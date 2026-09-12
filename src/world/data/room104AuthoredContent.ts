import type {
  GeneratedAnchorDef,
  GeneratedInteractionDef,
  GeneratedPlaceDef,
  GeneratedSpaceDef,
  GeneratedViewDef,
} from '../../engine/worldContent.generated';

export const ROOM104_PLACE_ID = 'room_104';
export const ROOM104_SPACE_ID = 'room104_main';

export const ROOM104_VIEW_IDS = {
  deskWindow: 'room104_desk_window',
  bedWardrobe: 'room104_bed_wardrobe',
  entranceKitchenette: 'room104_entrance_kitchenette',
} as const;

export const ROOM104_PLACES: GeneratedPlaceDef[] = [
  {
    id: ROOM104_PLACE_ID,
    districtId: 'district_a',
    name: 'Motel Room 104',
    transitAccess: [],
    legacyIds: ['home'],
  },
];

export const ROOM104_SPACES: GeneratedSpaceDef[] = [
  {
    id: ROOM104_SPACE_ID,
    placeId: ROOM104_PLACE_ID,
    name: 'Room 104',
    tags: ['interior', 'home', 'room104'],
  },
];

export const ROOM104_VIEWS: GeneratedViewDef[] = [
  {
    id: ROOM104_VIEW_IDS.deskWindow,
    spaceId: ROOM104_SPACE_ID,
    name: 'Desk & Window',
    neighbors: [ROOM104_VIEW_IDS.bedWardrobe, ROOM104_VIEW_IDS.entranceKitchenette],
    assetId: null,
    tags: ['room104', 'main-view', 'desk', 'window'],
  },
  {
    id: ROOM104_VIEW_IDS.bedWardrobe,
    spaceId: ROOM104_SPACE_ID,
    name: 'Bed & Wardrobe',
    neighbors: [ROOM104_VIEW_IDS.deskWindow, ROOM104_VIEW_IDS.entranceKitchenette],
    assetId: null,
    tags: ['room104', 'main-view', 'bed', 'storage'],
  },
  {
    id: ROOM104_VIEW_IDS.entranceKitchenette,
    spaceId: ROOM104_SPACE_ID,
    name: 'Entrance & Kitchenette',
    neighbors: [ROOM104_VIEW_IDS.deskWindow, ROOM104_VIEW_IDS.bedWardrobe],
    assetId: null,
    tags: ['room104', 'main-view', 'entrance', 'kitchenette'],
  },
];

export const ROOM104_ANCHORS: GeneratedAnchorDef[] = [
  {
    id: 'room104_pc',
    viewId: ROOM104_VIEW_IDS.deskWindow,
    name: 'Computer Desk',
    x: 0.62,
    y: 0.61,
    tags: ['hotspot', 'computer', 'surface'],
  },
  {
    id: 'room104_window',
    viewId: ROOM104_VIEW_IDS.deskWindow,
    name: 'Window',
    x: 0.28,
    y: 0.34,
    tags: ['hotspot', 'window', 'exterior-view'],
  },
  {
    id: 'room104_desk_storage',
    viewId: ROOM104_VIEW_IDS.deskWindow,
    name: 'Desk Storage',
    x: 0.72,
    y: 0.72,
    tags: ['hotspot', 'storage', 'container'],
  },
  {
    id: 'room104_bed',
    viewId: ROOM104_VIEW_IDS.bedWardrobe,
    name: 'Bed',
    x: 0.42,
    y: 0.67,
    tags: ['hotspot', 'bed', 'rest'],
  },
  {
    id: 'room104_wardrobe',
    viewId: ROOM104_VIEW_IDS.bedWardrobe,
    name: 'Wardrobe',
    x: 0.76,
    y: 0.48,
    tags: ['hotspot', 'wardrobe', 'storage', 'container'],
  },
  {
    id: 'room104_bedside_storage',
    viewId: ROOM104_VIEW_IDS.bedWardrobe,
    name: 'Bedside Storage',
    x: 0.58,
    y: 0.62,
    tags: ['hotspot', 'storage', 'container'],
  },
  {
    id: 'room104_kettle',
    viewId: ROOM104_VIEW_IDS.entranceKitchenette,
    name: 'Kettle',
    x: 0.64,
    y: 0.52,
    tags: ['hotspot', 'kettle', 'kitchenette'],
  },
  {
    id: 'room104_door',
    viewId: ROOM104_VIEW_IDS.entranceKitchenette,
    name: 'Door',
    x: 0.22,
    y: 0.48,
    tags: ['hotspot', 'door', 'exit'],
  },
  {
    id: 'room104_kitchen_storage',
    viewId: ROOM104_VIEW_IDS.entranceKitchenette,
    name: 'Kitchen Storage',
    x: 0.78,
    y: 0.68,
    tags: ['hotspot', 'storage', 'container'],
  },
  {
    id: 'room104_delivery_anchor',
    viewId: ROOM104_VIEW_IDS.entranceKitchenette,
    name: 'Delivery Spot',
    x: 0.34,
    y: 0.73,
    tags: ['hotspot', 'delivery', 'world-anchor'],
  },
];

export const ROOM104_INTERACTIONS: GeneratedInteractionDef[] = [
  {
    id: 'room104_use_computer',
    anchorId: 'room104_pc',
    capability: 'use_computer',
    name: 'Use computer',
    tags: ['computer'],
  },
  {
    id: 'room104_observe_window',
    anchorId: 'room104_window',
    capability: 'observe_window',
    name: 'Look outside',
    tags: ['observe'],
  },
  {
    id: 'room104_inspect_desk_storage',
    anchorId: 'room104_desk_storage',
    capability: 'inspect_desk_storage',
    name: 'Inspect desk storage',
    tags: ['storage'],
  },
  {
    id: 'room104_sleep',
    anchorId: 'room104_bed',
    capability: 'sleep',
    name: 'Sleep',
    tags: ['rest'],
  },
  {
    id: 'room104_open_wardrobe',
    anchorId: 'room104_wardrobe',
    capability: 'open_wardrobe',
    name: 'Open wardrobe',
    tags: ['storage'],
  },
  {
    id: 'room104_inspect_bedside_storage',
    anchorId: 'room104_bedside_storage',
    capability: 'inspect_bedside_storage',
    name: 'Inspect bedside storage',
    tags: ['storage'],
  },
  {
    id: 'room104_prepare_drink',
    anchorId: 'room104_kettle',
    capability: 'prepare_drink',
    name: 'Use kettle',
    tags: ['kitchenette'],
  },
  {
    id: 'room104_leave_room',
    anchorId: 'room104_door',
    capability: 'leave_room',
    name: 'Leave room',
    tags: ['exit'],
  },
  {
    id: 'room104_open_kitchen_storage',
    anchorId: 'room104_kitchen_storage',
    capability: 'open_kitchen_storage',
    name: 'Open kitchen storage',
    tags: ['storage'],
  },
  {
    id: 'room104_inspect_delivery_anchor',
    anchorId: 'room104_delivery_anchor',
    capability: 'inspect_delivery_anchor',
    name: 'Inspect deliveries',
    tags: ['delivery'],
  },
];
