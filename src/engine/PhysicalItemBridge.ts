import type { OwnedItem, PlayerInventoryState } from './types';
import type { ItemInstance, PhysicalItemLocation, PhysicalWorldState } from './PhysicalItemEngine';

export const PLAYER_INVENTORY_CONTAINER_ID = 'player-inventory';

function locationForOwnedItem(item: OwnedItem): PhysicalItemLocation {
  switch (item.location) {
    case 'inventory':
      return { kind: 'container', containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID };
    case 'room_package':
      return { kind: 'worldAnchor', anchorId: 'room104:hardware-package' };
    case 'installed': {
      const slotId = typeof (item as OwnedItem & { installSlot?: unknown }).installSlot === 'string'
        ? String((item as OwnedItem & { installSlot?: string }).installSlot)
        : `installed:${item.kind}`;
      return { kind: 'installed', hostInstanceId: 'computer:primary', slotId };
    }
    case 'inserted':
      return { kind: 'installed', hostInstanceId: 'computer:primary', slotId: 'media:inserted' };
  }
}

function clonePhysicalState(state: PhysicalWorldState): PhysicalWorldState {
  return {
    items: Object.fromEntries(
      Object.entries(state.items).map(([id, item]) => [id, { ...item, location: { ...item.location } }]),
    ),
    containers: Object.fromEntries(
      Object.entries(state.containers).map(([id, container]) => [id, { ...container }]),
    ),
  };
}

/**
 * Compatibility projection from the existing v6 ownership records into the
 * universal physical-world model. Existing instance IDs are reused verbatim;
 * this never allocates a second copy of an owned PC/display/media item.
 */
export function bridgeOwnedInventoryIntoPhysicalWorld(
  physical: PhysicalWorldState,
  inventory: PlayerInventoryState,
): PhysicalWorldState {
  const candidate = clonePhysicalState(physical);

  for (const owned of inventory.items) {
    const existing = candidate.items[owned.instanceId];
    if (existing) {
      if (existing.definitionId !== owned.catalogItemId) {
        throw new Error(
          `Physical ownership identity conflict for ${owned.instanceId}: ${existing.definitionId} != ${owned.catalogItemId}.`,
        );
      }
      continue;
    }

    const bridged: ItemInstance = {
      instanceId: owned.instanceId,
      definitionId: owned.catalogItemId,
      location: locationForOwnedItem(owned),
    };
    candidate.items[owned.instanceId] = bridged;
  }

  return candidate;
}
