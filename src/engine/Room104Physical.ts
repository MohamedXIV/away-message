import type {
  ContainerInstance,
  PhysicalContainerDefinition,
  PhysicalWorldState,
} from './PhysicalItemEngine';

export const ROOM104_STORAGE_DEFINITIONS = [
  {
    id: 'room104_storage_desk',
    capacity: 12,
    allowedItemKinds: [],
  },
  {
    id: 'room104_storage_wardrobe',
    capacity: 24,
    allowedItemKinds: [],
  },
  {
    id: 'room104_storage_bedside',
    capacity: 8,
    allowedItemKinds: [],
  },
  {
    id: 'room104_storage_kitchen',
    capacity: 24,
    allowedItemKinds: [],
  },
] as const satisfies readonly PhysicalContainerDefinition[];

export const ROOM104_STORAGE_INSTANCES = [
  {
    instanceId: 'room104:desk-storage',
    definitionId: 'room104_storage_desk',
  },
  {
    instanceId: 'room104:wardrobe',
    definitionId: 'room104_storage_wardrobe',
  },
  {
    instanceId: 'room104:bedside-storage',
    definitionId: 'room104_storage_bedside',
  },
  {
    instanceId: 'room104:kitchen-storage',
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
