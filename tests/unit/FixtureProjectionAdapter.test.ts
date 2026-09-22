import { describe, expect, it } from 'vitest';
import type { PhysicalRuntimeGraph } from '../../src/engine/physical/PhysicalContextRuntime';
import type { FixtureVisualProjection } from '../../src/world/ResidenceFixtureProjection';
import { adaptFixtureVisualsForPhaserView } from '../../src/world/phaser/fixtureProjectionAdapter';
import type { WorldSceneProjection } from '../../src/world/phaser/types';

const graph = {
  objectDefs: [],
  placements: [],
  slots: [
    { id: 'test_fixture_slot', name: 'Fixture Slot', spaceId: 'test_space', anchorId: 'test_fixture_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['bed'], tags: [] },
  ],
} satisfies PhysicalRuntimeGraph;

const fixture: FixtureVisualProjection = {
  objectInstanceId: 'test_object_instance',
  authoredPlacementId: 'test_fixture_placement',
  slotId: 'test_fixture_slot',
  objectDefId: 'test_fixture_def',
  variantId: 'test_variant',
  assetId: 'test_fixture_asset',
  depth: 17,
};

function projection(anchorVisible = true): WorldSceneProjection {
  return {
    placeId: 'test_place', placeName: 'Synthetic Place',
    spaceId: 'test_space', spaceName: 'Synthetic Space',
    viewId: 'test_view', viewName: 'Synthetic View',
    assetId: null, normalMapAssetId: null,
    timeOfDay: 'day', weather: 'clear',
    lighting: { ambientColor: '#fff', ambientIntensity: 1, pointLights: [] },
    particles: { dustMotes: false, rain: false, density: 0 },
    anchors: anchorVisible ? [{ id: 'test_fixture_anchor', name: 'Fixture Anchor', x: 0.25, y: 0.75, tags: [], interactions: [] }] : [],
    availableViews: [],
  };
}

describe('fixture projection Phaser adapter (#87)', () => {
  it('maps canonical fixture identity and authored anchor placement into a Phaser descriptor', () => {
    expect(adaptFixtureVisualsForPhaserView([fixture], graph, projection())).toEqual([{
      objectInstanceId: 'test_object_instance',
      authoredPlacementId: 'test_fixture_placement',
      textureKey: 'test_fixture_asset',
      x: 0.25,
      y: 0.75,
      depth: 17,
    }]);
  });

  it('fails closed when the active authored view does not expose the fixture anchor', () => {
    expect(adaptFixtureVisualsForPhaserView([fixture], graph, projection(false))).toEqual([]);
  });
});
