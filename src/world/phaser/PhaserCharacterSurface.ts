import Phaser from 'phaser';
import type {
  CharacterMeshBatch,
  CharacterMeshBlendMode,
  CharacterMeshFrame,
  CharacterMeshTexture,
  CharacterRenderTransform,
} from '../characterRenderer';
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

export function toPhaserMeshIndices(triangles: readonly number[]): number[] {
  if (triangles.length % 3 !== 0) {
    throw new Error('Character mesh triangles must contain complete triples');
  }
  const result: number[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    result.push(triangles[i]!, triangles[i + 1]!, triangles[i + 2]!, 0);
  }
  return result;
}

function parseTint(value = '#ffffff'): number {
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid character mesh tint: ${value}`);
  }
  return Number.parseInt(normalized, 16);
}

function mapBlendMode(mode: CharacterMeshBlendMode | undefined): number {
  switch (mode) {
    case 'multiply': return Phaser.BlendModes.MULTIPLY;
    case 'screen': return Phaser.BlendModes.SCREEN;
    case 'add': return Phaser.BlendModes.ADD;
    default: return Phaser.BlendModes.NORMAL;
  }
}

function textureCanvas(texture: Readonly<CharacterMeshTexture>): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('Character texture upload requires a browser canvas');
  }
  if (texture.width <= 0 || texture.height <= 0 || !Number.isInteger(texture.width) || !Number.isInteger(texture.height)) {
    throw new Error(`Invalid character texture dimensions for ${texture.id}`);
  }
  if (texture.rgba.length !== texture.width * texture.height * 4) {
    throw new Error(`Character texture ${texture.id} is not RGBA8`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = texture.width;
  canvas.height = texture.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Character texture upload could not acquire a 2D canvas context');
  const image = ctx.createImageData(texture.width, texture.height);
  image.data.set(texture.rgba);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

let surfaceSequence = 0;

/**
 * Phaser-only renderer-neutral mesh surface.
 *
 * It can be constructed before the Phaser Scene exists, then attached by
 * WorldScene. This keeps React/simulation callers free of Phaser objects while
 * still allowing the character renderer to own one persistent identity.
 */
export class PhaserCharacterSurface implements CharacterRenderSurface {
  private readonly surfaceId = ++surfaceSequence;
  private displayObject: any | null;
  private scene: Phaser.Scene | null = null;
  private root: Phaser.GameObjects.Container | null = null;
  private meshes = new Map<string, Phaser.GameObjects.Mesh2D>();
  private textureKeys = new Map<string, string>();
  private lastTransform: CharacterRenderTransform | null = null;
  private pendingFrame: Readonly<CharacterMeshFrame> | undefined;
  private destroyed = false;

  constructor(displayObject?: any) {
    this.displayObject = displayObject ?? null;
  }

  attach(scene: Phaser.Scene, parent?: Phaser.GameObjects.Container): void {
    if (this.destroyed) throw new Error('Character surface is destroyed');
    if (this.scene === scene && this.root) return;
    if (this.scene && this.scene !== scene) {
      throw new Error('Character surface cannot move between live Phaser scenes');
    }

    this.scene = scene;
    this.root = new Phaser.GameObjects.Container(scene, 0, 0);
    this.root.setName(`away-puppet-surface-${this.surfaceId}`);
    if (parent) parent.add(this.root);
    else scene.add.existing(this.root);
    this.displayObject = this.root;

    if (this.lastTransform) this.applyTransform(this.lastTransform);
    if (this.pendingFrame) this.syncFrame(this.pendingFrame);
  }

  setTransform(transform: Readonly<CharacterRenderTransform>): void {
    if (this.destroyed) throw new Error('Character surface is destroyed');
    this.lastTransform = { ...transform };
    if (this.displayObject) this.applyTransform(transform);
  }

  update(_deltaMs: number, frame?: Readonly<CharacterMeshFrame>): void {
    if (this.destroyed) throw new Error('Character surface is destroyed');
    if (!frame) return;
    this.pendingFrame = frame;
    if (this.scene && this.root) this.syncFrame(frame);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const mesh of this.meshes.values()) mesh.destroy();
    this.meshes.clear();
    this.root?.destroy(true);

    if (this.scene) {
      for (const key of this.textureKeys.values()) {
        if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      }
    }
    this.textureKeys.clear();

    if (!this.root && this.displayObject) this.displayObject.destroy();
    this.root = null;
    this.displayObject = null;
    this.scene = null;
  }

  private applyTransform(transform: Readonly<CharacterRenderTransform>): void {
    this.displayObject.setPosition(transform.x, transform.y);
    this.displayObject.setScale(transform.scale);
    this.displayObject.setDepth(transform.depth ?? 31);
    this.displayObject.setVisible(transform.visible);
  }

  private ensureTexture(texture: Readonly<CharacterMeshTexture>): string {
    if (!this.scene) throw new Error('Character surface is not attached');
    const existing = this.textureKeys.get(texture.id);
    if (existing) return existing;

    const key = `away-puppet-${this.surfaceId}-${texture.id}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addCanvas(key, textureCanvas(texture));
    this.textureKeys.set(texture.id, key);
    return key;
  }

  private syncFrame(frame: Readonly<CharacterMeshFrame>): void {
    if (!this.scene || !this.root) return;
    const textureById = new Map(frame.textures.map((texture) => [texture.id, this.ensureTexture(texture)]));
    const liveBatchIds = new Set<string>();

    for (const batch of frame.batches) {
      liveBatchIds.add(batch.id);
      this.syncBatch(batch, textureById);
    }

    for (const [id, mesh] of this.meshes) {
      if (liveBatchIds.has(id)) continue;
      mesh.destroy();
      this.meshes.delete(id);
    }
  }

  private syncBatch(batch: Readonly<CharacterMeshBatch>, textureById: ReadonlyMap<string, string>): void {
    if (!this.scene || !this.root) return;
    const textureKey = textureById.get(batch.textureId);
    if (!textureKey) throw new Error(`Character mesh ${batch.id} references missing texture ${batch.textureId}`);
    if (batch.vertices.length % 4 !== 0) throw new Error(`Character mesh ${batch.id} has invalid vertex tuples`);

    const indices = toPhaserMeshIndices(batch.triangles);
    let mesh = this.meshes.get(batch.id);
    if (!mesh) {
      mesh = new Phaser.GameObjects.Mesh2D(
        this.scene,
        0,
        0,
        textureKey,
        [...batch.vertices],
        indices,
        false,
      );
      mesh.setName(`away-puppet-mesh-${batch.id}`);
      mesh.setRenderAsTriangles(true);
      this.root.add(mesh);
      this.meshes.set(batch.id, mesh);
    } else {
      mesh.setTexture(textureKey);
      mesh.vertices = [...batch.vertices];
      mesh.indices = indices;
    }

    // Phaser 4.2.1 runtime exposes Mesh2D.setTint(), but its generated
    // TypeScript declaration omits that method. Keep the compatibility cast
    // local to this exact runtime seam rather than widening Mesh2D globally.
    (mesh as Phaser.GameObjects.Mesh2D & {
      setTint(color: number): Phaser.GameObjects.Mesh2D;
    }).setTint(parseTint(batch.tint));
    mesh.setAlpha(batch.alpha ?? 1);
    mesh.setBlendMode(mapBlendMode(batch.blendMode));
  }
}
