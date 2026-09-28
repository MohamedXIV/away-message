import { describe, expect, it, vi } from 'vitest';
import type { CharacterRenderer, CharacterVisualState } from '../../src/world/characterRenderer';
import {
  destroyWorldSceneCharacterMounts,
  disposeRemovedWorldSceneCharacters,
  syncWorldSceneCharacterMounts,
  updateWorldSceneCharacterMounts,
  type WorldSceneCharacterMount,
} from '../../src/world/phaser/WorldSceneCharacters';
import type { WorldSceneProjection } from '../../src/world/phaser/types';

function rendererSpy(): CharacterRenderer {
  return {
    load: vi.fn(async () => undefined),
    apply: vi.fn(),
    setMorph: vi.fn(),
    setPart: vi.fn(),
    setTint: vi.fn(),
    setExpression: vi.fn(),
    setPose: vi.fn(),
    setVisibility: vi.fn(),
    setTransform: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  };
}

const visualState: Omit<CharacterVisualState, 'transform'> = {
  actorId: 'actor-fixture-1',
  profileId: 'profile.generic-adult',
  morphs: { 'body.height': 0.25 },
  parts: {
    'hair.front': 'hair.short-layered',
    'wardrobe.top': 'top.crew-neck',
    'wardrobe.outer': 'outer.light-jacket',
  },
  tints: {
    skin: '#b98265',
    hair: '#2e211b',
    iris: '#4d6b63',
    clothing: '#526273',
  },
  expression: 'expression.soft-smile',
  pose: 'pose.relaxed',
};

function projection(anchorId = 'customer'): WorldSceneProjection {
  return {
    placeId: 'place.fixture',
    placeName: 'Fixture Place',
    spaceId: 'space.fixture',
    spaceName: 'Fixture Space',
    viewId: 'view.counter',
    viewName: 'Counter',
    assetId: null,
    normalMapAssetId: null,
    timeOfDay: 'day',
    weather: 'clear',
    lighting: { ambientColor: '#ffffff', ambientIntensity: 1, pointLights: [] },
    particles: { dustMotes: false, rain: false, density: 0 },
    anchors: [{
      id: anchorId,
      name: 'Customer',
      x: 0.65,
      y: 0.5,
      tags: ['character'],
      interactions: [],
    }],
    availableViews: [],
  };
}

describe('WorldSceneCharacters (#25)', () => {
  it('mounts a generic modular character at an authored CharacterAnchor', () => {
    const renderer = rendererSpy();
    const mount: WorldSceneCharacterMount = {
      actorId: 'actor-fixture-1',
      anchorId: 'customer',
      renderer,
      visualState,
      scale: 0.9,
    };

    expect(syncWorldSceneCharacterMounts(projection(), 1600, 900, [mount])).toEqual({
      mountedActorIds: ['actor-fixture-1'],
      missingAnchorActorIds: [],
    });
    expect(renderer.apply).toHaveBeenCalledWith({
      ...visualState,
      transform: { x: 1040, y: 450, scale: 0.9, depth: 31, visible: true },
    });
  });

  it('preserves renderer and actor identity while authored views move the anchor', () => {
    const renderer = rendererSpy();
    const mount: WorldSceneCharacterMount = {
      actorId: 'actor-fixture-1',
      anchorId: 'customer',
      renderer,
      visualState,
    };

    syncWorldSceneCharacterMounts(projection(), 1000, 600, [mount]);
    const next = projection();
    next.viewId = 'view.window';
    next.anchors[0] = { ...next.anchors[0]!, x: 0.2, y: 0.7 };
    syncWorldSceneCharacterMounts(next, 1000, 600, [mount]);

    expect(renderer.apply).toHaveBeenCalledTimes(2);
    expect(renderer.apply).toHaveBeenLastCalledWith({
      ...visualState,
      transform: { x: 200, y: 420, scale: 1, depth: 31, visible: true },
    });
    expect(mount.actorId).toBe('actor-fixture-1');
  });

  it('hides actors whose anchor is absent instead of inventing placement', () => {
    const renderer = rendererSpy();
    const mount: WorldSceneCharacterMount = {
      actorId: 'actor-fixture-1',
      anchorId: 'other-anchor',
      renderer,
      visualState,
    };

    expect(syncWorldSceneCharacterMounts(projection(), 1000, 600, [mount])).toEqual({
      mountedActorIds: [],
      missingAnchorActorIds: ['actor-fixture-1'],
    });
    expect(renderer.apply).not.toHaveBeenCalled();
    expect(renderer.setTransform).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      scale: 1,
      depth: 31,
      visible: false,
    });
  });

  it('ticks and disposes the same renderer once even if referenced twice', () => {
    const renderer = rendererSpy();
    const mount: WorldSceneCharacterMount = {
      actorId: 'actor-fixture-1',
      anchorId: 'customer',
      renderer,
      visualState,
    };

    updateWorldSceneCharacterMounts([mount], 16.67);
    expect(renderer.update).toHaveBeenCalledWith(16.67);

    destroyWorldSceneCharacterMounts([mount, mount]);
    expect(renderer.destroy).toHaveBeenCalledOnce();
  });

  it('retains the same actor renderer across presence changes and disposes departures once', () => {
    const retained = rendererSpy();
    const removed = rendererSpy();
    const previous: WorldSceneCharacterMount[] = [
      { actorId: 'actor-fixture-1', anchorId: 'customer', renderer: retained, visualState },
      { actorId: 'actor-fixture-2', anchorId: 'customer', renderer: removed,
        visualState: { ...visualState, actorId: 'actor-fixture-2' } },
    ];
    const next: WorldSceneCharacterMount[] = [
      { ...previous[0]!, anchorId: 'window' },
    ];

    disposeRemovedWorldSceneCharacters(previous, next);
    expect(retained.destroy).not.toHaveBeenCalled();
    expect(removed.destroy).toHaveBeenCalledOnce();
  });

  it('rejects renderer mounts that could cross-wire simulation identity', () => {
    const renderer = rendererSpy();
    const mount: WorldSceneCharacterMount = {
      actorId: 'actor-other',
      anchorId: 'customer',
      renderer,
      visualState,
    };

    expect(() => syncWorldSceneCharacterMounts(projection(), 1000, 600, [mount]))
      .toThrow(/identity mismatch/i);
  });
});
