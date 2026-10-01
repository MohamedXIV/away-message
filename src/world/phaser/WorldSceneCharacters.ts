import type Phaser from 'phaser';
import type { CharacterRenderer, CharacterVisualState } from '../characterRenderer';
import type { WorldSceneProjection } from './types';
import { resolveCharacterAnchorTransform } from './PhaserCharacterSurface';

export interface WorldSceneCharacterMount {
  readonly actorId: string;
  readonly anchorId: string;
  readonly renderer: CharacterRenderer;
  readonly visualState: Omit<CharacterVisualState, 'transform'>;
  readonly scale?: number;
  readonly depth?: number;
  /** Optional late Phaser attachment for renderer surfaces created outside the Scene. */
  readonly attach?: (scene: Phaser.Scene, parent: Phaser.GameObjects.Container) => void;
}

export interface CharacterMountSyncResult {
  readonly mountedActorIds: readonly string[];
  readonly missingAnchorActorIds: readonly string[];
}

/**
 * Projects already-loaded character renderers into an authored Phaser view.
 * Actor identity and appearance remain owned by simulation/game state; this
 * function only derives transient view placement from CharacterAnchors.
 */
export function syncWorldSceneCharacterMounts(
  projection: Readonly<WorldSceneProjection>,
  width: number,
  height: number,
  mounts: readonly WorldSceneCharacterMount[],
): CharacterMountSyncResult {
  const anchors = new Map(projection.anchors.map((anchor) => [anchor.id, anchor]));
  const mountedActorIds: string[] = [];
  const missingAnchorActorIds: string[] = [];

  for (const mount of mounts) {
    if (mount.visualState.actorId !== mount.actorId) {
      throw new Error(`Character mount identity mismatch: ${mount.actorId}`);
    }

    const anchor = anchors.get(mount.anchorId);
    if (!anchor) {
      mount.renderer.setTransform({
        x: 0,
        y: 0,
        scale: mount.scale ?? 1,
        depth: mount.depth ?? 31,
        visible: false,
      });
      missingAnchorActorIds.push(mount.actorId);
      continue;
    }

    mount.renderer.apply({
      ...mount.visualState,
      transform: resolveCharacterAnchorTransform(
        anchor,
        width,
        height,
        mount.scale ?? 1,
        mount.depth ?? 31,
      ),
    });
    mountedActorIds.push(mount.actorId);
  }

  return { mountedActorIds, missingAnchorActorIds };
}

export function updateWorldSceneCharacterMounts(
  mounts: readonly WorldSceneCharacterMount[],
  deltaMs: number,
): void {
  for (const mount of mounts) mount.renderer.update(deltaMs);
}

export function destroyWorldSceneCharacterMounts(
  mounts: readonly WorldSceneCharacterMount[],
): void {
  const destroyed = new Set<CharacterRenderer>();
  for (const mount of mounts) {
    if (destroyed.has(mount.renderer)) continue;
    destroyed.add(mount.renderer);
    mount.renderer.destroy();
  }
}

/** Releases only renderers no longer present in the next projection. */
export function disposeRemovedWorldSceneCharacters(
  previous: readonly WorldSceneCharacterMount[],
  next: readonly WorldSceneCharacterMount[],
): void {
  const retained = new Set(next.map((mount) => mount.renderer));
  destroyWorldSceneCharacterMounts(previous.filter((mount) => !retained.has(mount.renderer)));
}
