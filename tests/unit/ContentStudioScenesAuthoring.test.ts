import { describe, expect, it } from 'vitest';
import {
  buildSpaceRow,
  buildViewRow,
  buildAnchorRow,
  buildInteractionRow,
} from '../../src/tools/studio/sceneAuthoring';

describe('Content Studio scenes and hierarchy authoring', () => {
  const placeIds = ['place_a1', 'place_b1'];
  const spaceIds = ['space_a1'];
  const viewIds = ['view_a1', 'view_a2'];
  const anchorIds = ['anchor_a1'];
  const assetIds = ['asset_a1'];

  it('creates space rows referencing existing places', () => {
    expect(buildSpaceRow('Cafe Interior', 'place_a1', placeIds)).toEqual({
      placeId: 'place_a1',
      name: 'Cafe Interior',
      tags: '[]',
    });

    expect(() => buildSpaceRow('Lost Space', 'unknown_place', placeIds)).toThrow(
      "Unknown place 'unknown_place'",
    );
  });

  it('creates view rows referencing existing spaces and optional assets', () => {
    expect(buildViewRow('Counter View', 'space_a1', spaceIds, 'asset_a1', assetIds)).toEqual({
      spaceId: 'space_a1',
      name: 'Counter View',
      neighbors: '[]',
      assetId: 'asset_a1',
      tags: '[]',
    });

    expect(() => buildViewRow('Bad View', 'missing_space', spaceIds, '', assetIds)).toThrow(
      "Unknown space 'missing_space'",
    );
    expect(() => buildViewRow('Bad View', 'space_a1', spaceIds, 'bad_asset', assetIds)).toThrow(
      "Unknown asset 'bad_asset'",
    );
  });

  it('creates anchor rows with normalized coordinates and valid view reference', () => {
    expect(buildAnchorRow('Cash Register', 'view_a1', viewIds, 0.4, 0.6)).toEqual({
      viewId: 'view_a1',
      name: 'Cash Register',
      x: 0.4,
      y: 0.6,
      tags: '[]',
    });

    expect(() => buildAnchorRow('Bad Anchor', 'missing_view', viewIds, 0.5, 0.5)).toThrow(
      "Unknown view 'missing_view'",
    );
    expect(() => buildAnchorRow('Bad Coord', 'view_a1', viewIds, 1.5, 0.5)).toThrow(
      'Anchor coordinates must be between 0 and 1',
    );
  });

  it('creates interaction rows referencing valid anchors with capabilities', () => {
    expect(buildInteractionRow('Inspect Register', 'anchor_a1', anchorIds, 'inspect')).toEqual({
      anchorId: 'anchor_a1',
      capability: 'inspect',
      name: 'Inspect Register',
      tags: '[]',
    });

    expect(() => buildInteractionRow('Bad Interaction', 'missing_anchor', anchorIds, 'talk')).toThrow(
      "Unknown anchor 'missing_anchor'",
    );
    expect(() => buildInteractionRow('No Capability', 'anchor_a1', anchorIds, '')).toThrow(
      'Interaction requires a capability',
    );
  });
});
