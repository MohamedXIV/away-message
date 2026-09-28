import type { CharacterRenderTransform } from '../characterRenderer';
import type { CharacterRenderSurface } from '../AwayPuppetCharacterRenderer';
import type { WorldAnchorProjection } from './types';

export function resolveCharacterAnchorTransform(
  anchor: Readonly<WorldAnchorProjection>,
  width: number,
  height: number,
  scale = 1,
  depth = 31,
): CharacterRenderTransform {
  return {
    x: anchor.x <= 1 ? anchor.x * width : anchor.x,
    y: anchor.y <= 1 ? anchor.y * height : anchor.y,
    scale,
    depth,
    visible: true,
  };
}

export class PhaserCharacterSurface implements CharacterRenderSurface {
  constructor(private readonly displayObject: any) {}

  setTransform(transform: Readonly<CharacterRenderTransform>): void {
    this.displayObject.setPosition(transform.x, transform.y);
    this.displayObject.setScale(transform.scale);
    this.displayObject.setDepth(transform.depth ?? 31);
    this.displayObject.setVisible(transform.visible);
  }

  update(_deltaMs: number): void {}

  destroy(): void {
    this.displayObject.destroy();
  }
}
