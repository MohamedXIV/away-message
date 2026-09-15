import { GENERATED_ASSETS, type GeneratedAssetDef } from '../../engine/worldContent.generated';
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
  assets: readonly GeneratedAssetDef[] = GENERATED_ASSETS,
): ProjectionVisualSelection {
  if (!projection.assetId) {
    return {
      assetId: null,
      normalMapAssetId: null,
      usesAuthoredAsset: false,
    };
  }

  const asset = assets.find((candidate) => candidate.id === projection.assetId);
  if (!asset || asset.kind !== 'image' || !asset.tags.includes('production')) {
    return { assetId: null, normalMapAssetId: null, usesAuthoredAsset: false };
  }

  return {
    assetId: asset.id,
    normalMapAssetId: asset.normalMapAssetId,
    usesAuthoredAsset: true,
  };
}
