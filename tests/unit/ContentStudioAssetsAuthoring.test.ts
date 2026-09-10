import { describe, expect, it } from 'vitest';
import {
  buildAssetRow,
  validateNormalMapReference,
} from '../../src/tools/studio/assetAuthoring';

describe('Content Studio assets authoring', () => {
  const assetIds = ['asset_a1', 'asset_a1_n'];

  it('creates asset rows with kind, uri, and optional normal map', () => {
    expect(
      buildAssetRow('Cafe Hero', 'image', 'assets/world/cafe.png', 'asset_a1_n', assetIds),
    ).toEqual({
      name: 'Cafe Hero',
      kind: 'image',
      uri: 'assets/world/cafe.png',
      normalMapAssetId: 'asset_a1_n',
      tags: '[]',
    });
  });

  it('allows empty normal map reference', () => {
    expect(
      buildAssetRow('Cafe Ambience', 'audio', 'assets/audio/cafe.mp3', '', assetIds),
    ).toEqual({
      name: 'Cafe Ambience',
      kind: 'audio',
      uri: 'assets/audio/cafe.mp3',
      normalMapAssetId: '',
      tags: '[]',
    });
  });

  it('rejects nonexistent normal map asset references', () => {
    expect(() =>
      buildAssetRow('Bad Normal', 'image', 'assets/test.png', 'nonexistent', assetIds),
    ).toThrow("Unknown normal-map asset 'nonexistent'");
  });

  it('validates normal map reference correctly', () => {
    expect(validateNormalMapReference('', assetIds)).toBe(true);
    expect(validateNormalMapReference('asset_a1_n', assetIds)).toBe(true);
    expect(validateNormalMapReference('missing', assetIds)).toBe(false);
  });
});
