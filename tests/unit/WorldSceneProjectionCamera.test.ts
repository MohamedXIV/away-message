// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveProjectionCameraTarget, resolveWorldSceneVisualPlan } from '../../src/world/phaser/WorldScene';
import { resolveProjectionVisual } from '../../src/world/phaser/projectionVisual';
import type { WorldSceneProjection } from '../../src/world/phaser/types';

function projection(
  focus: WorldSceneProjection['focus'],
  assetId: string | null = null,
  normalMapAssetId: string | null = null,
): WorldSceneProjection {
  return {
    placeId: 'room_104',
    placeName: 'Motel Room 104',
    spaceId: 'room104_main',
    spaceName: 'Room 104',
    viewId: 'room104_desk_window',
    viewName: 'Desk & Window',
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
    expect(resolveProjectionVisual(projection(null, 'asset_a1', 'asset_a1_n'))).toEqual({
      assetId: 'asset_a1',
      normalMapAssetId: 'asset_a1_n',
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
    expect(resolveWorldSceneVisualPlan(projection(null, 'room104_desk_art', 'room104_desk_normal'), 1200, 800)).toEqual({
      textureKey: 'room104_desk_art',
      normalMapTextureKey: 'room104_desk_normal',
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
