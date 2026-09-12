import type {
  ContainerInstance,
  ItemInstance,
  PhysicalWorldState,
} from './PhysicalItemEngine';

export type Room104StorageTarget = 'desk' | 'wardrobe' | 'bedside' | 'kitchen';

export interface Room104StoragePresence {
  target: Room104StorageTarget;
  containerInstanceId: string;
  itemCount: number;
  itemInstanceIds: string[];
  itemDefinitionIds: string[];
}

export interface Room104WorldAnchorPresence {
  physicalAnchorId: string;
  itemCount: number;
  itemInstanceIds: string[];
  itemDefinitionIds: string[];
}

export const ROOM104_STORAGE_INSTANCE_IDS: Readonly<Record<Room104StorageTarget, string>> = {
  desk: 'room104:desk-storage',
  wardrobe: 'room104:wardrobe',
  bedside: 'room104:bedside-storage',
  kitchen: 'room104:kitchen-storage',
};

export const ROOM104_DELIVERY_PHYSICAL_ANCHOR_ID = 'room104:delivery';

export const ROOM104_STORAGE_INSTANCES = [
  {
    instanceId: ROOM104_STORAGE_INSTANCE_IDS.desk,
    definitionId: 'room104_storage_desk',
  },
  {
    instanceId: ROOM104_STORAGE_INSTANCE_IDS.wardrobe,
    definitionId: 'room104_storage_wardrobe',
  },
  {
    instanceId: ROOM104_STORAGE_INSTANCE_IDS.bedside,
    definitionId: 'room104_storage_bedside',
  },
  {
    instanceId: ROOM104_STORAGE_INSTANCE_IDS.kitchen,
    definitionId: 'room104_storage_kitchen',
  },
] as const satisfies readonly ContainerInstance[];

/**
 * Room furniture has stable physical identities. Old saves that predate the
 * flagship room keep every existing item/container untouched and receive only
 * missing fixed furniture instances.
 */
export function ensureRoom104StorageContainers(state: PhysicalWorldState): PhysicalWorldState {
  const containers = Object.fromEntries(
    Object.entries(state.containers).map(([id, container]) => [id, { ...container }]),
  );

  for (const container of ROOM104_STORAGE_INSTANCES) {
    if (!containers[container.instanceId]) {
      containers[container.instanceId] = { ...container };
    }
  }

  return {
    items: state.items,
    containers,
  };
}

/** Read-only projection of the exact physical items currently stored in one Room 104 container. */
export function getRoom104StorageContents(
  state: PhysicalWorldState,
  target: Room104StorageTarget,
): ItemInstance[] {
  const containerInstanceId = ROOM104_STORAGE_INSTANCE_IDS[target];
  return Object.values(state.items)
    .filter((item) =>
      item.location.kind === 'container'
      && item.location.containerInstanceId === containerInstanceId
    )
    .map((item) => ({ ...item, location: { ...item.location } }));
}

/**
 * Presentation-safe storage summary derived only from canonical physical state.
 * It preserves exact instance identities so a renderer can update when an item
 * moves without inventing a second room inventory or storage authority.
 */
export function getRoom104StoragePresence(state: PhysicalWorldState): Room104StoragePresence[] {
  return (Object.keys(ROOM104_STORAGE_INSTANCE_IDS) as Room104StorageTarget[]).map((target) => {
    const containerInstanceId = ROOM104_STORAGE_INSTANCE_IDS[target];
    const contents = getRoom104StorageContents(state, target);
    return {
      target,
      containerInstanceId,
      itemCount: contents.length,
      itemInstanceIds: contents.map((item) => item.instanceId),
      itemDefinitionIds: contents.map((item) => item.definitionId),
    };
  });
}

/**
 * Presentation-safe Room 104 world-anchor summary derived only from canonical
 * physical state. Today the room owns the delivery floor anchor; keeping this
 * as a read model means future authored surfaces can join the same state without
 * creating a second placement authority.
 */
export function getRoom104WorldAnchorPresence(state: PhysicalWorldState): Room104WorldAnchorPresence[] {
  const items = Object.values(state.items).filter((item) =>
    item.location.kind === 'worldAnchor'
    && item.location.anchorId === ROOM104_DELIVERY_PHYSICAL_ANCHOR_ID
  );

  if (items.length === 0) return [];

  return [{
    physicalAnchorId: ROOM104_DELIVERY_PHYSICAL_ANCHOR_ID,
    itemCount: items.length,
    itemInstanceIds: items.map((item) => item.instanceId),
    itemDefinitionIds: items.map((item) => item.definitionId),
  }];
}
