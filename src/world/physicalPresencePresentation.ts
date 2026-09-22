import type { PhysicalWorldState } from '../engine/PhysicalItemEngine';
import type { WorldSceneProjection } from './phaser/types';

export interface PhysicalPresenceMarker {
  authoredAnchorId: string;
  x: number;
  y: number;
  itemCount: number;
  itemInstanceIds: string[];
  itemDefinitionIds: string[];
}

export interface StorageMarker extends PhysicalPresenceMarker {
  containerInstanceId: string;
}

export interface WorldAnchorMarker extends PhysicalPresenceMarker {
  physicalAnchorId: string;
}

/** Reads canonical item locations; an absent mapped anchor cannot appear in another view. */
export function buildStorageMarkers(
  projection: WorldSceneProjection,
  state: Readonly<PhysicalWorldState>,
  authoredAnchorByContainer: Readonly<Record<string, string>>,
): StorageMarker[] {
  return Object.keys(state.containers).flatMap((containerInstanceId) => {
    const authoredAnchorId = authoredAnchorByContainer[containerInstanceId];
    if (!authoredAnchorId) return [];
    const anchor = projection.anchors.find((candidate) => candidate.id === authoredAnchorId);
    if (!anchor) return [];
    const contents = Object.values(state.items).filter(
      (item) => item.location.kind === 'container' && item.location.containerInstanceId === containerInstanceId,
    );
    return [{
      containerInstanceId,
      authoredAnchorId,
      x: anchor.x,
      y: anchor.y,
      itemCount: contents.length,
      itemInstanceIds: contents.map((item) => item.instanceId),
      itemDefinitionIds: contents.map((item) => item.definitionId),
    }];
  });
}

/** Joins physical world-anchor locations to authored anchors without mutating delivery or ownership. */
export function buildWorldAnchorMarkers(
  projection: WorldSceneProjection,
  state: Readonly<PhysicalWorldState>,
  authoredAnchorByPhysicalAnchor: Readonly<Record<string, string>>,
): WorldAnchorMarker[] {
  return Object.entries(authoredAnchorByPhysicalAnchor).flatMap(([physicalAnchorId, authoredAnchorId]) => {
    const anchor = projection.anchors.find((candidate) => candidate.id === authoredAnchorId);
    if (!anchor) return [];
    const contents = Object.values(state.items).filter(
      (item) => item.location.kind === 'worldAnchor' && item.location.anchorId === physicalAnchorId,
    );
    if (contents.length === 0) return [];
    return [{
      physicalAnchorId,
      authoredAnchorId,
      x: anchor.x,
      y: anchor.y,
      itemCount: contents.length,
      itemInstanceIds: contents.map((item) => item.instanceId),
      itemDefinitionIds: contents.map((item) => item.definitionId),
    }];
  });
}
