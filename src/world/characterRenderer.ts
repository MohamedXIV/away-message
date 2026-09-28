export interface CharacterRenderTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly depth?: number;
  readonly visible: boolean;
}

export interface CharacterVisualState {
  readonly actorId: string;
  readonly profileId: string;
  readonly morphs: Readonly<Record<string, number>>;
  readonly parts: Readonly<Record<string, string>>;
  readonly tints: Readonly<Record<string, string>>;
  readonly expression?: string;
  readonly pose?: string;
  readonly transform: CharacterRenderTransform;
}

export interface SemanticAppearanceDescription {
  readonly actorId: string;
  readonly observableTraits: readonly string[];
  readonly wardrobe: readonly string[];
}

export interface CharacterAppearanceKnowledge {
  readonly physical: SemanticAppearanceDescription;
  readonly online: SemanticAppearanceDescription | null;
}

export interface CharacterRenderer {
  load(profileId: string): Promise<void>;
  apply(state: Readonly<CharacterVisualState>): void;
  setMorph(name: string, value: number): void;
  setPart(slot: string, assetId: string): void;
  setTint(channel: string, color: string): void;
  setExpression(id: string): void;
  setPose(id: string): void;
  setVisibility(partId: string, visible: boolean): void;
  setTransform(transform: Readonly<CharacterRenderTransform>): void;
  update(deltaMs: number): void;
  destroy(): void;
}

export function resolveAppearanceKnowledge(
  physical: Readonly<SemanticAppearanceDescription>,
  context: 'physical' | 'online',
  remotelyShared?: Readonly<SemanticAppearanceDescription> | null,
): CharacterAppearanceKnowledge {
  return {
    physical,
    online: context === 'physical' ? physical : (remotelyShared ?? null),
  };
}
