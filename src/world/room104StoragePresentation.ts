import type {
  Room104StoragePresence,
  Room104StorageTarget,
} from '../engine/Room104Physical';
import type { WorldSceneProjection } from './phaser/types';

export interface Room104StorageMarker {
  target: Room104StorageTarget;
  anchorId: string;
  x: number;
  y: number;
  itemCount: number;
  itemInstanceIds: string[];
  itemDefinitionIds: string[];
}

const STORAGE_ANCHOR_BY_TARGET: Readonly<Record<Room104StorageTarget, string>> = {
  desk: 'room104_desk_storage',
  wardrobe: 'room104_wardrobe',
  bedside: 'room104_bedside_storage',
  kitchen: 'room104_kitchen_storage',
};

/**
 * Joins canonical physical storage presence to authored anchors in the current
 * projection. It does not invent location state: if a storage anchor is not in
 * the active view, it is not presented there.
 */
export function buildRoom104StorageMarkers(
  projection: WorldSceneProjection,
  presence: readonly Room104StoragePresence[],
): Room104StorageMarker[] {
  return presence.flatMap((entry) => {
    const anchorId = STORAGE_ANCHOR_BY_TARGET[entry.target];
    const anchor = projection.anchors.find((candidate) => candidate.id === anchorId);
    if (!anchor) return [];

    return [{
      target: entry.target,
      anchorId,
      x: anchor.x,
      y: anchor.y,
      itemCount: entry.itemCount,
      itemInstanceIds: [...entry.itemInstanceIds],
      itemDefinitionIds: [...entry.itemDefinitionIds],
    }];
  });
}
