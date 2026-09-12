import type {
  ContainerInstance,
  ItemInstance,
  PhysicalWorldState,
} from './PhysicalItemEngine';

export type Room104StorageTarget = 'desk' | 'wardrobe' | 'bedside' | 'kitchen';

export const ROOM104_STORAGE_INSTANCE_IDS: Readonly<Record<Room104StorageTarget, string>> = {
  desk: 'room104:desk-storage',
  wardrobe: 'room104:wardrobe',
  bedside: 'room104:bedside-storage',
  kitchen: 'room104:kitchen-storage',
};

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
