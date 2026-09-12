import type { Room104WorldAnchorPresence } from '../engine/Room104Physical';
import type { WorldSceneProjection } from './phaser/types';

export interface Room104WorldAnchorMarker {
  physicalAnchorId: string;
  authoredAnchorId: string;
  x: number;
  y: number;
  itemCount: number;
  itemInstanceIds: string[];
  itemDefinitionIds: string[];
}

const AUTHORED_ANCHOR_BY_PHYSICAL_ANCHOR: Readonly<Record<string, string>> = {
  'room104:delivery': 'room104_delivery_anchor',
};

/**
 * Joins canonical physical world-anchor presence to authored Room 104 anchors
 * in the active projection. No marker exists when the corresponding authored
 * anchor is not visible in the current view.
 */
export function buildRoom104WorldAnchorMarkers(
  projection: WorldSceneProjection,
  presence: readonly Room104WorldAnchorPresence[],
): Room104WorldAnchorMarker[] {
  return presence.flatMap((entry) => {
    const authoredAnchorId = AUTHORED_ANCHOR_BY_PHYSICAL_ANCHOR[entry.physicalAnchorId];
    if (!authoredAnchorId) return [];

    const anchor = projection.anchors.find((candidate) => candidate.id === authoredAnchorId);
    if (!anchor) return [];

    return [{
      physicalAnchorId: entry.physicalAnchorId,
      authoredAnchorId,
      x: anchor.x,
      y: anchor.y,
      itemCount: entry.itemCount,
      itemInstanceIds: [...entry.itemInstanceIds],
      itemDefinitionIds: [...entry.itemDefinitionIds],
    }];
  });
}
