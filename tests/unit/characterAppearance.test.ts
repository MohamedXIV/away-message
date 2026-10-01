import { describe, expect, it } from 'vitest';
import {
  describeCharacterAppearance,
  resolveCharacterVisualState,
  type CharacterCurrentAppearance,
  type CharacterRendererMapping,
  type CharacterVisualDna,
} from '../../src/world/characterAppearance';

const dna: CharacterVisualDna = {
  morphs: { 'body.height': 0.2, 'face.jaw_width': -0.1 },
  baseTints: { skin: '#b98265', hair: '#2e211b', iris: '#4d6b63' },
  observableTraits: ['tall', 'dark hair'],
};

const mapping: CharacterRendererMapping = { profileId: 'profile.generic-adult' };

function appearance(hair: string, outer: string): CharacterCurrentAppearance {
  return {
    parts: {
      'hair.front': hair,
      'wardrobe.top': 'top.crew-neck',
      'wardrobe.outer': outer,
    },
    tintOverrides: { clothing: '#526273' },
    expression: 'expression.soft-smile',
    pose: 'pose.relaxed',
    wardrobeDescription: ['crew-neck top', outer === 'outer.light-jacket' ? 'light jacket' : 'coat'],
  };
}

describe('character appearance domains (#25)', () => {
  it('projects DNA, current wardrobe and renderer mapping independently', () => {
    const current = appearance('hair.short-layered', 'outer.light-jacket');
    const visual = resolveCharacterVisualState('actor-fixture', dna, current, mapping);

    expect(visual.actorId).toBe('actor-fixture');
    expect(visual.profileId).toBe('profile.generic-adult');
    expect(visual.morphs).toEqual(dna.morphs);
    expect(visual.parts).toEqual(current.parts);
    expect(visual.tints).toEqual({
      skin: '#b98265',
      hair: '#2e211b',
      iris: '#4d6b63',
      clothing: '#526273',
    });
    expect(describeCharacterAppearance('actor-fixture', dna, current)).toEqual({
      actorId: 'actor-fixture',
      observableTraits: ['tall', 'dark hair'],
      wardrobe: ['crew-neck top', 'light jacket'],
    });
  });

  it('supports two generic hairstyles and outerwear swaps without changing DNA or renderer profile', () => {
    const first = resolveCharacterVisualState(
      'actor-fixture',
      dna,
      appearance('hair.short-layered', 'outer.light-jacket'),
      mapping,
    );
    const second = resolveCharacterVisualState(
      'actor-fixture',
      dna,
      appearance('hair.long-wave', 'outer.long-coat'),
      mapping,
    );

    expect(second.actorId).toBe(first.actorId);
    expect(second.profileId).toBe(first.profileId);
    expect(second.morphs).toEqual(first.morphs);
    expect(second.parts['hair.front']).toBe('hair.long-wave');
    expect(second.parts['wardrobe.outer']).toBe('outer.long-coat');
  });
});
