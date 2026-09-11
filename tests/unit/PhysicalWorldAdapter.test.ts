// tests/unit/PhysicalWorldAdapter.test.ts

import { describe, it, expect } from 'vitest';
import {
  createWorldSceneProjection,
  createSemanticInteractionIntent,
  createViewTransitionIntent,
  getLightingForTimeOfDay,
} from '../../src/world/phaser/presentationAdapter';

describe('Physical World Presentation Adapter', () => {
  it('projects place_a1 and view_a1 deterministically from generated #51 world definitions', () => {
    const projection = createWorldSceneProjection({
      placeId: 'place_a1',
      viewId: 'view_a1',
      timeOfDay: 'day',
      weather: 'clear',
    });

    expect(projection.placeId).toBe('place_a1');
    expect(projection.placeName).toBe('Place A1');
    expect(projection.spaceId).toBe('space_a1');
    expect(projection.spaceName).toBe('Space A1');
    expect(projection.viewId).toBe('view_a1');
    expect(projection.viewName).toBe('View A1');
    expect(projection.assetId).toBe('asset_a1');
    expect(projection.normalMapAssetId).toBe('asset_a1_n');
    expect(projection.timeOfDay).toBe('day');
    expect(projection.weather).toBe('clear');

    // Anchors & Interactions from generated #51
    expect(projection.anchors.length).toBeGreaterThanOrEqual(1);
    const anchor = projection.anchors.find((a) => a.id === 'anchor_a1');
    expect(anchor).toBeDefined();
    expect(anchor?.name).toBe('Anchor A1');
    expect(anchor?.x).toBe(0.5);
    expect(anchor?.y).toBe(0.5);
    expect(anchor?.interactions).toEqual([
      {
        id: 'interaction_a1',
        capability: 'inspect',
        name: 'Interaction A1',
        tags: [],
      },
    ]);

    // Available sibling views
    expect(projection.availableViews.map((v) => v.id)).toContain('view_a2');
  });

  it('maps weather conditions to particle requirements without mutating domain state', () => {
    const clearProj = createWorldSceneProjection({
      placeId: 'place_a1',
      viewId: 'view_a1',
      timeOfDay: 'morning',
      weather: 'clear',
    });
    expect(clearProj.particles.rain).toBe(false);
    expect(clearProj.particles.dustMotes).toBe(true);

    const rainProj = createWorldSceneProjection({
      placeId: 'place_a1',
      viewId: 'view_a1',
      timeOfDay: 'evening',
      weather: 'rain',
    });
    expect(rainProj.particles.rain).toBe(true);
    expect(rainProj.particles.density).toBeGreaterThan(0);
  });

  it('computes lighting parameters from light profile and time of day', () => {
    const dayLight = getLightingForTimeOfDay('day');
    expect(dayLight.ambientIntensity).toBeGreaterThan(0.6);
    expect(dayLight.ambientColor).toBeTruthy();

    const nightLight = getLightingForTimeOfDay('night');
    expect(nightLight.ambientIntensity).toBeLessThan(dayLight.ambientIntensity);

    const lateNightLight = getLightingForTimeOfDay('late_night');
    expect(lateNightLight.ambientIntensity).toBeLessThanOrEqual(nightLight.ambientIntensity);
  });

  it('formats semantic interaction intents outward cleanly', () => {
    const intent = createSemanticInteractionIntent('anchor_a1', 'inspect', 'Interaction A1', { source: 'pointer' });
    expect(intent).toEqual({
      type: 'INTERACTION',
      anchorId: 'anchor_a1',
      capability: 'inspect',
      name: 'Interaction A1',
      payload: { source: 'pointer' },
    });
  });

  it('formats view transition intents outward cleanly', () => {
    const intent = createViewTransitionIntent('view_a2');
    expect(intent).toEqual({
      type: 'VIEW_TRANSITION',
      targetViewId: 'view_a2',
    });
  });

  it('provides safe fallbacks for unauthored/missing places without crashing', () => {
    const fallback = createWorldSceneProjection({
      placeId: 'unknown_place',
      viewId: 'unknown_view',
      timeOfDay: 'day',
      weather: 'clear',
    });

    expect(fallback.placeId).toBe('unknown_place');
    expect(fallback.viewId).toBe('unknown_view');
    expect(fallback.anchors).toEqual([]);
    expect(fallback.availableViews).toEqual([]);
  });
});
