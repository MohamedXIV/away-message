import { describe, expect, it } from 'vitest';
import { LivingPlaceRuntime } from '../../src/world/phaser/LivingPlaceRuntime';
import type { WorldSceneProjection } from '../../src/world/phaser/types';

function projection(viewId: string, neighbors: string[] = []): WorldSceneProjection {
  return {
    placeId: 'place_a',
    placeName: 'Place A',
    spaceId: 'space_a',
    spaceName: 'Space A',
    viewId,
    viewName: viewId,
    assetId: `${viewId}_asset`,
    normalMapAssetId: null,
    timeOfDay: 'day',
    weather: 'clear',
    lighting: { ambientColor: '#fff', ambientIntensity: 1, pointLights: [] },
    particles: { dustMotes: false, rain: false, density: 0 },
    anchors: [
      {
        id: 'anchor_visible',
        name: 'Visible anchor',
        x: 0.4,
        y: 0.6,
        tags: [],
        interactions: [
          { id: 'inspect_visible', capability: 'inspect', name: 'Inspect', tags: [] },
        ],
      },
    ],
    availableViews: [
      { id: 'view_a', name: 'View A', assetId: 'view_a_asset', neighbors: ['view_b'] },
      { id: 'view_b', name: 'View B', assetId: 'view_b_asset', neighbors: ['view_a'] },
    ].filter((view) => view.id === viewId || neighbors.includes(view.id) || view.neighbors.includes(viewId)),
    focus: null,
  };
}

describe('LivingPlaceRuntime', () => {
  it('keeps a single-view place single-view without inventing navigation', () => {
    const single = projection('view_a');
    single.availableViews = [{ id: 'view_a', name: 'View A', assetId: 'view_a_asset', neighbors: [] }];
    const runtime = new LivingPlaceRuntime(single);

    expect(runtime.getCurrentProjection().viewId).toBe('view_a');
    expect(runtime.getNeighborViewIds()).toEqual([]);
  });

  it('allows only authored neighbor transitions and preserves runtime object state', () => {
    const runtime = new LivingPlaceRuntime(projection('view_a', ['view_b']));
    runtime.setObjectState('item:lamp', { switchedOn: true });

    expect(runtime.transitionToNeighbor('view_b')).toMatchObject({ type: 'VIEW_TRANSITION', targetViewId: 'view_b' });
    runtime.applyProjection(projection('view_b', ['view_a']));

    expect(runtime.getCurrentProjection().viewId).toBe('view_b');
    expect(runtime.getObjectState('item:lamp')).toEqual({ switchedOn: true });
    expect(() => runtime.transitionToNeighbor('view_missing')).toThrow(/authored neighbor/i);
  });

  it('opens and closes focus without mutating object state', () => {
    const runtime = new LivingPlaceRuntime(projection('view_a', ['view_b']));
    runtime.setObjectState('item:kettle', { filled: true });

    runtime.openFocus({ x: 0.5, y: 0.5, zoom: 1.8 });
    expect(runtime.getCurrentProjection().focus?.zoom).toBe(1.8);
    runtime.closeFocus();

    expect(runtime.getCurrentProjection().focus).toBeNull();
    expect(runtime.getObjectState('item:kettle')).toEqual({ filled: true });
  });

  it('emits semantic interaction intent without mutating runtime state', () => {
    const runtime = new LivingPlaceRuntime(projection('view_a'));
    const before = runtime.getSnapshot();

    const intent = runtime.interact('anchor_visible', 'inspect_visible');

    expect(intent).toEqual({
      type: 'INTERACTION',
      anchorId: 'anchor_visible',
      capability: 'inspect',
      name: 'Inspect',
      payload: undefined,
    });
    expect(runtime.getSnapshot()).toEqual(before);
  });

  it('projects only dynamic instances whose authored anchors are visible in the active view', () => {
    const runtime = new LivingPlaceRuntime(projection('view_a', ['view_b']));

    const visible = runtime.resolveVisibleObjects([
      {
        instanceId: 'item:lamp:1',
        definitionId: 'lamp',
        anchorId: 'anchor_visible',
        defaultAssetId: 'lamp_default',
        assetByView: { view_a: 'lamp_front', view_b: 'lamp_side' },
      },
      {
        instanceId: 'item:book:1',
        definitionId: 'book',
        anchorId: 'anchor_other_view',
        defaultAssetId: 'book_default',
      },
    ]);

    expect(visible).toEqual([
      {
        instanceId: 'item:lamp:1',
        definitionId: 'lamp',
        anchorId: 'anchor_visible',
        x: 0.4,
        y: 0.6,
        assetId: 'lamp_front',
      },
    ]);
  });

  it('resolves per-view art without changing dynamic object identity or state', () => {
    const runtime = new LivingPlaceRuntime(projection('view_a', ['view_b']));
    runtime.setObjectState('item:lamp:1', { switchedOn: true });
    const binding = {
      instanceId: 'item:lamp:1',
      definitionId: 'lamp',
      anchorId: 'anchor_visible',
      defaultAssetId: 'lamp_default',
      assetByView: { view_a: 'lamp_front', view_b: 'lamp_side' },
    };

    expect(runtime.resolveVisibleObjects([binding])[0]?.assetId).toBe('lamp_front');
    runtime.applyProjection(projection('view_b', ['view_a']));
    expect(runtime.resolveVisibleObjects([binding])[0]?.assetId).toBe('lamp_side');
    expect(runtime.resolveVisibleObjects([binding])[0]?.instanceId).toBe('item:lamp:1');
    expect(runtime.getObjectState('item:lamp:1')).toEqual({ switchedOn: true });
  });
});
