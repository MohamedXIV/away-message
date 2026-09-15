// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedAssetDef } from '../../src/engine/worldContent.generated';
import type { PhysicalWorldState } from '../../src/engine/PhysicalItemEngine';
import { buildProjectionAssetLoadPlan } from '../../src/world/phaser/projectionAssets';
import { resolveProjectionVisual } from '../../src/world/phaser/projectionVisual';
import { resolveSceneBackgroundTexture, WorldScene } from '../../src/world/phaser/WorldScene';
import { buildStorageMarkers, buildWorldAnchorMarkers } from '../../src/world/physicalPresencePresentation';
import type { WorldSceneProjection } from '../../src/world/phaser/types';
import { getLightingForTimeOfDay } from '../../src/world/phaser/presentationAdapter';
import { resolveWeatherLayers } from '../../src/world/phaser/environment/weatherLayers';
import { audioService } from '../../src/audio/AudioService';

function projection(overrides: Partial<WorldSceneProjection> = {}): WorldSceneProjection {
  return {
    placeId: 'lodge', placeName: 'Lodge', spaceId: 'suite', spaceName: 'Suite',
    viewId: 'window', viewName: 'Window', assetId: null, normalMapAssetId: null,
    timeOfDay: 'day', weather: 'clear',
    lighting: { ambientColor: '#ffffff', ambientIntensity: 1, pointLights: [] },
    particles: { dustMotes: false, rain: false, density: 0 },
    anchors: [], availableViews: [], ...overrides,
  };
}

const assets: GeneratedAssetDef[] = [
  { id: 'view_window', name: 'Window', kind: 'image', uri: 'assets/lodge/window.png', normalMapAssetId: 'flat_normal', tags: ['production'] },
  { id: 'view_bed', name: 'Bed', kind: 'image', uri: 'assets/lodge/bed.png', normalMapAssetId: 'flat_normal', tags: ['production'] },
  { id: 'flat_normal', name: 'Normal', kind: 'image', uri: 'assets/lodge/normal.png', normalMapAssetId: null, tags: ['production'] },
  { id: 'fixture_art', name: 'Fixture', kind: 'image', uri: 'assets/nonexistent-fixture.png', normalMapAssetId: null, tags: [] },
  { id: 'voice', name: 'Voice', kind: 'audio', uri: 'assets/voice.mp3', normalMapAssetId: null, tags: ['production'] },
];

describe('generic projection assets and fixture boundary', () => {
  it('loads two authored views and one shared normal map without requesting fixture URIs', () => {
    const plan = buildProjectionAssetLoadPlan(projection({
      assetId: 'view_window',
      availableViews: [
        { id: 'window', name: 'Window', assetId: 'view_window', neighbors: ['bed'] },
        { id: 'bed', name: 'Bed', assetId: 'view_bed', neighbors: ['window'] },
        { id: 'probe', name: 'Probe', assetId: 'fixture_art', neighbors: [] },
      ],
    }), assets);
    expect(plan.entries.map(({ key, url }) => ({ key, url }))).toEqual([
      { key: 'view_window', url: './assets/lodge/window.png' },
      { key: 'view_bed', url: './assets/lodge/bed.png' },
    ]);
    expect(plan.normalMaps).toEqual([{ key: 'flat_normal', url: './assets/lodge/normal.png' }]);
    expect(plan.errors).toEqual([expect.stringContaining('fixture_art')]);
    expect(JSON.stringify(plan)).not.toContain('nonexistent-fixture.png');
  });

  it('rejects audio and leaves assetless production projections empty', () => {
    expect(buildProjectionAssetLoadPlan(projection({ assetId: 'voice' }), assets).entries).toEqual([]);
    expect(buildProjectionAssetLoadPlan(projection(), assets).entries).toEqual([]);
    expect(resolveSceneBackgroundTexture(projection(), 'production')).toBeNull();
  });

  it('never renders an in-memory fixture texture or audio asset as production art', () => {
    expect(resolveProjectionVisual(projection({ assetId: 'fixture_art' }), assets)).toEqual({
      assetId: null, normalMapAssetId: null, usesAuthoredAsset: false,
    });
    expect(resolveProjectionVisual(projection({ assetId: 'voice' }), assets).usesAuthoredAsset).toBe(false);
    expect(resolveProjectionVisual(projection({ assetId: 'view_window' }), assets)).toEqual({
      assetId: 'view_window', normalMapAssetId: 'flat_normal', usesAuthoredAsset: true,
    });
  });

  it('shows procedural fixture art only in an explicit technical-fixture mode', () => {
    expect(resolveSceneBackgroundTexture(projection(), 'technical-fixture')).toBe('fixture_bg');
    expect(resolveSceneBackgroundTexture(projection({ assetId: 'view_window' }), 'production', assets)).toBe('view_window');
    expect(resolveSceneBackgroundTexture(projection({ assetId: 'fixture_art' }), 'production', assets)).toBeNull();
  });
});

describe('generic minute, weather, and audio lifecycle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not freeze late afternoon at the noon coarse day tint', () => {
    const noon = getLightingForTimeOfDay('day', [], 720);
    const afternoon = getLightingForTimeOfDay('day', [], 990);
    expect(afternoon.ambientColor).not.toBe(noon.ambientColor);
    expect(afternoon.ambientIntensity).not.toBe(noon.ambientIntensity);
  });

  it('does not draw unmasked rain over an opaque authored interior image', () => {
    const layers = resolveWeatherLayers({
      weather: 'rain', isInterior: true, allowUnmaskedInteriorRain: false,
    });
    expect(layers.backgroundRain).toBe(false);
    expect(layers.foregroundRain).toBe(false);
    expect(layers.windowDroplets).toBe(false);
    expect(resolveWeatherLayers({ weather: 'rain', isInterior: false }).foregroundRain).toBe(true);
  });

  it('reuses one ambience handle across view updates and stops it on shutdown', () => {
    let nextHandle = 0;
    const active = new Set<string>();
    const play = vi.spyOn(audioService, 'play').mockImplementation(() => {
      const handle = `handle_${++nextHandle}`;
      active.add(handle);
      return handle;
    });
    const stop = vi.spyOn(audioService, 'stop').mockImplementation((handle) => { active.delete(handle); });
    vi.spyOn(audioService, 'isInstanceActive').mockImplementation((handle) => active.has(handle));
    vi.spyOn(audioService, 'setSourcePosition').mockImplementation(() => {});
    vi.spyOn(audioService, 'setParameter').mockImplementation(() => {});

    const scene = new WorldScene() as unknown as {
      projection: WorldSceneProjection;
      syncSpatialAudioSources(): void;
      handleShutdown(): void;
    };
    const source = { id: 'lodge_hum', eventId: 'ambience.room_tone', x: 0.2, y: 0.4, loop: true };
    scene.projection = projection({ spatialAudioSources: [source] });
    scene.syncSpatialAudioSources();
    scene.projection = projection({ viewId: 'bed', spatialAudioSources: [{ ...source, x: 0.8 }] });
    scene.syncSpatialAudioSources();
    expect(play).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    scene.projection = projection({ spatialAudioSources: [] });
    scene.syncSpatialAudioSources();
    expect(stop).toHaveBeenCalledTimes(1);
    scene.projection = projection({ spatialAudioSources: [source] });
    scene.syncSpatialAudioSources();
    scene.handleShutdown();
    expect(play).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(active.size).toBe(0);
  });
});

describe('generic read-only physical presence joins', () => {
  const state: PhysicalWorldState = {
    containers: { chest_1: { instanceId: 'chest_1', definitionId: 'chest' } },
    items: {
      letter: { instanceId: 'letter', definitionId: 'letter_def', location: { kind: 'container', containerInstanceId: 'chest_1' } },
      parcel: { instanceId: 'parcel', definitionId: 'parcel_def', location: { kind: 'worldAnchor', anchorId: 'delivery:door' } },
    },
  };
  const view = projection({ anchors: [
    { id: 'chest_marker', name: 'Chest', x: 0.2, y: 0.5, tags: [], interactions: [] },
    { id: 'door_marker', name: 'Door', x: 0.8, y: 0.7, tags: [], interactions: [] },
  ] });

  it('derives counts from physical state, never creates containers, and only shows active-view anchors', () => {
    const mapping = { chest_1: 'chest_marker' };
    expect(buildStorageMarkers(view, state, mapping)).toEqual([{
      containerInstanceId: 'chest_1', authoredAnchorId: 'chest_marker', x: 0.2, y: 0.5,
      itemCount: 1, itemInstanceIds: ['letter'], itemDefinitionIds: ['letter_def'],
    }]);
    expect(buildStorageMarkers(projection(), state, mapping)).toEqual([]);
    expect(Object.keys(state.containers)).toEqual(['chest_1']);
    expect(buildStorageMarkers(view, state, mapping)).toEqual(buildStorageMarkers(view, state, mapping));
  });

  it('shows world-anchor parcels at mapped anchors and removes markers when physical state changes', () => {
    const mapping = { 'delivery:door': 'door_marker' };
    expect(buildWorldAnchorMarkers(view, state, mapping)).toEqual([{
      physicalAnchorId: 'delivery:door', authoredAnchorId: 'door_marker', x: 0.8, y: 0.7,
      itemCount: 1, itemInstanceIds: ['parcel'], itemDefinitionIds: ['parcel_def'],
    }]);
    expect(buildWorldAnchorMarkers(projection(), state, mapping)).toEqual([]);
    expect(buildWorldAnchorMarkers(view, { ...state, items: { letter: state.items.letter! } }, mapping)).toEqual([]);
  });
});
