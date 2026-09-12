// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveProjectionCameraTarget } from '../../src/world/phaser/WorldScene';
import type { WorldSceneProjection } from '../../src/world/phaser/types';

function projection(focus: WorldSceneProjection['focus']): WorldSceneProjection {
  return {
    placeId: 'room_104',
    placeName: 'Motel Room 104',
    spaceId: 'room104_main',
    spaceName: 'Room 104',
    viewId: 'room104_desk_window',
    viewName: 'Desk & Window',
    assetId: null,
    normalMapAssetId: null,
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
