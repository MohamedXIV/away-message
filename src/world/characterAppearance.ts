import type { CharacterVisualState, SemanticAppearanceDescription } from './characterRenderer';

export interface CharacterVisualDna {
  readonly morphs: Readonly<Record<string, number>>;
  readonly baseTints: Readonly<Record<string, string>>;
  readonly observableTraits: readonly string[];
}

export interface CharacterCurrentAppearance {
  readonly parts: Readonly<Record<string, string>>;
  readonly tintOverrides?: Readonly<Record<string, string>>;
  readonly expression?: string;
  readonly pose?: string;
  readonly wardrobeDescription: readonly string[];
}

export interface CharacterRendererMapping {
  readonly profileId: string;
}

export function resolveCharacterVisualState(
  actorId: string,
  dna: Readonly<CharacterVisualDna>,
  appearance: Readonly<CharacterCurrentAppearance>,
  mapping: Readonly<CharacterRendererMapping>,
): Omit<CharacterVisualState, 'transform'> {
  return {
    actorId,
    profileId: mapping.profileId,
    morphs: { ...dna.morphs },
    parts: { ...appearance.parts },
    tints: { ...dna.baseTints, ...appearance.tintOverrides },
    expression: appearance.expression,
    pose: appearance.pose,
  };
}

export function describeCharacterAppearance(
  actorId: string,
  dna: Readonly<CharacterVisualDna>,
  appearance: Readonly<CharacterCurrentAppearance>,
): SemanticAppearanceDescription {
  return {
    actorId,
    observableTraits: [...dna.observableTraits],
    wardrobe: [...appearance.wardrobeDescription],
  };
}
