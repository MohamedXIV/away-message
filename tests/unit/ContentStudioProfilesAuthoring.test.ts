import { describe, expect, it } from 'vitest';
import {
  buildLightProfileRow,
  buildAudioProfileRow,
  buildAmbientProfileRow,
} from '../../src/tools/studio/profileAuthoring';

describe('Content Studio environmental profile authoring', () => {
  const assetIds = ['asset_audio_1'];

  it('creates light profile rows with time-of-day, color tint, and intensity', () => {
    expect(buildLightProfileRow('Sunset Glow', 'evening', '#ff8844', 1.2)).toEqual({
      name: 'Sunset Glow',
      timeOfDay: 'evening',
      colorTint: '#ff8844',
      intensity: 1.2,
      tags: '[]',
    });
  });

  it('creates audio profile rows with valid asset reference', () => {
    expect(buildAudioProfileRow('Rain Ambience', 'ambience', 'asset_audio_1', 0.75, assetIds)).toEqual({
      name: 'Rain Ambience',
      kind: 'ambience',
      assetId: 'asset_audio_1',
      volume: 0.75,
      tags: '[]',
    });

    expect(() => buildAudioProfileRow('Bad Audio', 'ambience', 'missing_asset', 0.5, assetIds)).toThrow(
      "Unknown audio asset 'missing_asset'",
    );
  });

  it('creates ambient profile rows with weather, timeOfDay, and density', () => {
    expect(buildAmbientProfileRow('Rainy Night', 'rain', 'night', 0.3)).toEqual({
      name: 'Rainy Night',
      weather: 'rain',
      timeOfDay: 'night',
      density: 0.3,
      tags: '[]',
    });
  });
});
