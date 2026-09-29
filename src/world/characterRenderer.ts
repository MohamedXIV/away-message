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

export interface CharacterMeshTexture {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Detached RGBA8 bytes owned by the character backend. */
  readonly rgba: Uint8ClampedArray;
}

export type CharacterMeshBlendMode = 'normal' | 'multiply' | 'screen' | 'add';

export interface CharacterMeshBatch {
  readonly id: string;
  readonly textureId: string;
  /** Flat [x, y, u, v] tuples in puppet-local coordinates. */
  readonly vertices: readonly number[];
  /** Flat triangle indices [a, b, c, ...]. */
  readonly triangles: readonly number[];
  readonly tint?: string;
  readonly alpha?: number;
  readonly blendMode?: CharacterMeshBlendMode;
}

export interface CharacterMeshFrame {
  readonly textures: readonly CharacterMeshTexture[];
  readonly batches: readonly CharacterMeshBatch[];
}

export interface SemanticAppearanceDescription {
  readonly actorId: string;
  readonly observableTraits: readonly string[];
  readonly wardrobe: readonly string[];
}

export interface CharacterAppearanceKnowledge {
  readonly actorId: string;
  readonly observableAppearance: SemanticAppearanceDescription | null;
  readonly source: 'physical' | 'shared' | 'unknown';
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
  if (context === 'physical') {
    return {
      actorId: physical.actorId,
      observableAppearance: physical,
      source: 'physical',
    };
  }

  if (remotelyShared) {
    if (remotelyShared.actorId !== physical.actorId) {
      throw new Error('Shared appearance actor does not match physical appearance actor');
    }
    return {
      actorId: physical.actorId,
      observableAppearance: remotelyShared,
      source: 'shared',
    };
  }

  return {
    actorId: physical.actorId,
    observableAppearance: null,
    source: 'unknown',
  };
}
