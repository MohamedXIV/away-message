import type { WorldSceneProjection } from './types';

export interface ProjectionVisualSelection {
  assetId: string | null;
  normalMapAssetId: string | null;
  usesAuthoredAsset: boolean;
}

/**
 * Resolves the visual authority for a projected world view.
 *
 * A view with no authored asset intentionally stays assetless. The runtime
 * must not silently substitute technical-fixture scenery, because doing so
 * makes fixture identities part of production world content.
 */
export function resolveProjectionVisual(
  projection: WorldSceneProjection,
): ProjectionVisualSelection {
  if (!projection.assetId) {
    return {
      assetId: null,
      normalMapAssetId: null,
      usesAuthoredAsset: false,
    };
  }

  return {
    assetId: projection.assetId,
    normalMapAssetId: projection.normalMapAssetId,
    usesAuthoredAsset: true,
  };
}
