// src/world/phaser/PhaserWorldRuntime.ts

import Phaser from 'phaser';
import { WorldScene, type WorldSceneInitData } from './WorldScene';
import type {
  WorldSceneProjection,
  WorldInteractionIntent,
} from './types';

export interface PhaserWorldRuntimeOptions {
  parent: HTMLElement;
  projection: WorldSceneProjection;
  onIntent?: (intent: WorldInteractionIntent) => void;
  renderType?: number;
}

export class PhaserWorldRuntime {
  private game: Phaser.Game | null = null;
  private isDestroyed = false;
  private parent: HTMLElement;
  private onIntent?: (intent: WorldInteractionIntent) => void;
  private currentProjection: WorldSceneProjection;
  private renderType?: number;

  constructor(options: PhaserWorldRuntimeOptions) {
    this.parent = options.parent;
    this.onIntent = options.onIntent;
    this.currentProjection = options.projection;
    this.renderType = options.renderType;

    this.initGame();
  }

  private initGame(): void {
    if (this.isDestroyed) return;

    const width = this.parent.clientWidth || 1600;
    const height = this.parent.clientHeight || 900;

    const sceneData: WorldSceneInitData = {
      projection: this.currentProjection,
      onIntent: (intent) => this.onIntent?.(intent),
    };

    const sceneInstance = new WorldScene();
    sceneInstance.init(sceneData);

    const config: Phaser.Types.Core.GameConfig = {
      type: this.renderType ?? Phaser.AUTO,
      parent: this.parent,
      width,
      height,
      backgroundColor: '#11151c',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
      },
      render: {
        pixelArt: false,
        antialias: true,
        roundPixels: true,
      },
      scene: [sceneInstance],
    };

    this.game = new Phaser.Game(config);

    // Boot hook: ensure scene data is synchronized when game boots
    this.game.events.once(Phaser.Core.Events.READY, () => {
      if (this.isDestroyed || !this.game) return;
      const activeScene = this.game.scene.getScene(WorldScene.SCENE_KEY) as WorldScene | null;
      if (activeScene) {
        activeScene.init(sceneData);
      }
    });
  }

  public getScene(): WorldScene | null {
    if (!this.game || this.isDestroyed) return null;
    return (this.game.scene.getScene(WorldScene.SCENE_KEY) as WorldScene) ?? null;
  }

  public updateProjection(newProjection: WorldSceneProjection): void {
    if (this.isDestroyed) return;
    this.currentProjection = newProjection;
    const scene = this.getScene();
    if (scene && typeof scene.updateProjection === 'function') {
      scene.updateProjection(newProjection);
    }
  }

  public transitionToView(targetViewId: string, _duration?: number): void {
    if (this.isDestroyed) return;
    const scene = this.getScene();
    if (scene && typeof scene.transitionToView === 'function') {
      scene.transitionToView(targetViewId);
    }
  }

  public resize(width: number, height: number): void {
    if (!this.game || this.isDestroyed) return;
    this.game.scale.resize(width, height);
    const scene = this.getScene();
    if (scene && typeof scene.handleResize === 'function') {
      scene.handleResize(width, height);
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.game) {
      // Phaser's destroy(true, false):
      // true = remove canvas from DOM
      // false = do not clear WebGL context cache prematurely
      this.game.destroy(true, false);
      this.game = null;
    }

    // Ensure any leftover canvas elements inside parent are cleanly purged
    const canvases = this.parent.querySelectorAll('canvas');
    canvases.forEach((c) => c.remove());
  }
}
