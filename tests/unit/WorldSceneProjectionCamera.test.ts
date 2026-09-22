// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveProjectionCameraTarget, resolveWorldSceneVisualPlan } from '../../src/world/phaser/WorldScene';
import { resolveProjectionVisual } from '../../src/world/phaser/projectionVisual';
import type { GeneratedAssetDef } from '../../src/engine/worldContent.generated';
import type { WorldSceneProjection } from '../../src/world/phaser/types';

function projection(
  focus: WorldSceneProjection['focus'],
  assetId: string | null = null,
  normalMapAssetId: string | null = null,
): WorldSceneProjection {
  return {
    placeId: 'lodge',
    placeName: 'Lodge',
    spaceId: 'suite',
    spaceName: 'Suite',
    viewId: 'window',
    viewName: 'Window',
    assetId,
    normalMapAssetId,
    timeOfDay: 'day',
    weather: 'clear',
    lighting: { ambientColor: '#ffffff', ambientIntensity: 1, pointLights: [] },
    particles: { dustMotes: false, rain: false, density: 0 },
    anchors: [],
    availableViews: [],
    focus,
  };
}

const productionAssets: GeneratedAssetDef[] = [
  { id: 'lodge_window_art', name: 'Window', kind: 'image', uri: 'assets/lodge/window.png', normalMapAssetId: 'lodge_window_normal', tags: ['production'] },
  { id: 'lodge_window_normal', name: 'Normal', kind: 'image', uri: 'assets/lodge/normal.png', normalMapAssetId: null, tags: ['production'] },
];

describe('WorldScene projection-driven camera target', () => {
  it('uses authored projection focus rather than a hardcoded view id', () => {
    expect(resolveProjectionCameraTarget(projection({ x: 0.22, y: 0.64, zoom: 1.35 }), 1200, 800)).toEqual({
      x: 264,
      y: 512,
      zoom: 1.35,
    });
  });

  it('falls back to a centered overview when the projection has no focus', () => {
    expect(resolveProjectionCameraTarget(projection(null), 1200, 800)).toEqual({
      x: 600,
      y: 400,
      zoom: 1,
    });
  });
});

describe('WorldScene projection-driven visual selection', () => {
  it('uses the authored projected asset and normal map when present', () => {
    expect(resolveProjectionVisual(projection(null, 'lodge_window_art', 'lodge_window_normal'), productionAssets)).toEqual({
      assetId: 'lodge_window_art',
      normalMapAssetId: 'lodge_window_normal',
      usesAuthoredAsset: true,
    });
  });

  it('does not substitute fixture-specific scenery when a view has no authored asset', () => {
    expect(resolveProjectionVisual(projection(null))).toEqual({
      assetId: null,
      normalMapAssetId: null,
      usesAuthoredAsset: false,
    });
  });

  it('builds the renderer plan from projection data without fixture identities', () => {
    expect(resolveWorldSceneVisualPlan(projection(null, 'lodge_window_art', 'lodge_window_normal'), 1200, 800, productionAssets)).toEqual({
      textureKey: 'lodge_window_art',
      normalMapTextureKey: 'lodge_window_normal',
      x: 600,
      y: 400,
      width: 1200,
      height: 800,
    });
  });

  it('renders no scenery image when the projection has no authored asset', () => {
    expect(resolveWorldSceneVisualPlan(projection(null), 1200, 800)).toBeNull();
  });
});
