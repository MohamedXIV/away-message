import type { PhysicalRuntimeGraph } from '../../engine/physical/PhysicalContextRuntime';
import type { FixtureVisualProjection } from '../ResidenceFixtureProjection';
import type { WorldSceneProjection } from './types';

export interface PhaserFixtureVisualDescriptor {
  objectInstanceId: string;
  authoredPlacementId: string;
  textureKey: string;
  x: number;
  y: number;
  depth: number;
}

/**
 * Presentation-only bridge from canonical fixture projections into the active
 * authored Phaser view. Slot/anchor membership remains authored physical/view
 * data; this adapter neither validates placement nor owns interaction state.
 */
export function adaptFixtureVisualsForPhaserView(
  fixtures: readonly FixtureVisualProjection[],
  graph: PhysicalRuntimeGraph,
  projection: WorldSceneProjection,
): PhaserFixtureVisualDescriptor[] {
  const slots = new Map(graph.slots.map((slot) => [slot.id, slot]));
  const anchors = new Map(projection.anchors.map((anchor) => [anchor.id, anchor]));

  return fixtures.flatMap((fixture) => {
    const slot = slots.get(fixture.slotId);
    if (!slot?.anchorId) return [];

    const anchor = anchors.get(slot.anchorId);
    if (!anchor) return [];

    return [{
      objectInstanceId: fixture.objectInstanceId,
      authoredPlacementId: fixture.authoredPlacementId,
      textureKey: fixture.assetId,
      x: anchor.x,
      y: anchor.y,
      depth: fixture.depth,
    }];
  });
}
