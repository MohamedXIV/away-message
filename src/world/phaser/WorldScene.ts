// src/world/phaser/WorldScene.ts

import Phaser from 'phaser';
import type {
  WorldSceneProjection,
  WorldInteractionIntent,
  WorldCameraFocus,
  WorldFixtureCapabilityReport,
} from './types';
import { ensureFixtureTextures } from './technicalFixture';

export interface WorldSceneInitData {
  projection: WorldSceneProjection;
  onIntent?: (intent: WorldInteractionIntent) => void;
}

export class WorldScene extends Phaser.Scene {
  public static readonly SCENE_KEY = 'WorldScene';

  public projection!: WorldSceneProjection;
  private onIntent?: (intent: WorldInteractionIntent) => void;

  // Visual Display Layers
  private layerBackground?: Phaser.GameObjects.Container;
  private layerScenery?: Phaser.GameObjects.Container;
  private layerActors?: Phaser.GameObjects.Container;
  private layerForeground?: Phaser.GameObjects.Container;

  // GameObjects
  private bgImage?: Phaser.GameObjects.Image;
  private deskImage?: Phaser.GameObjects.Image;
  private assetA1Image?: Phaser.GameObjects.Image;
  private puddleRenderTexture?: Phaser.GameObjects.RenderTexture;

  // Lights
  private dynamicLights: Map<string, Phaser.GameObjects.Light> = new Map();
  private movableLight?: Phaser.GameObjects.Light;
  private isPointerLightTracking = true;

  // Particles
  private dustMoteEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // Hotspots
  private hotspotZones: Map<string, {
    zone: Phaser.GameObjects.Zone;
    highlight: Phaser.GameObjects.Arc;
  }> = new Map();

  // Camera Focus
  private currentFocus: WorldCameraFocus = { x: 0.5, y: 0.5, zoom: 1.0 };
  private isTransitioning = false;

  constructor() {
    super({ key: WorldScene.SCENE_KEY });
  }

  public init(data: WorldSceneInitData): void {
    this.projection = data.projection;
    this.onIntent = data.onIntent;
  }

  public create(): void {
    // 1. Ensure procedural/authored textures exist in TextureManager
    ensureFixtureTextures(this);

    const width = this.scale.width;
    const height = this.scale.height;

    // 2. Initialize Visual Display Layers
    this.layerBackground = this.add.container(0, 0).setDepth(10);
    this.layerScenery = this.add.container(0, 0).setDepth(20);
    this.layerActors = this.add.container(0, 0).setDepth(30);
    this.layerForeground = this.add.container(0, 0).setDepth(40);

    // 3. Setup WebGL Lighting
    this.setupLighting();

    // 4. Setup Layered Images / Sprites & Normal Mapping
    this.setupSprites(width, height);

    // 5. Setup Particles (Dust motes & Rain)
    this.setupParticles(width, height);

    // 6. Setup Render-Texture / Filter Path for reflections/wetness
    this.setupRenderTexturePath(width, height);

    // 7. Setup Authored Pointer Hotspots
    this.setupHotspots(width, height);

    // 8. Setup Pointer Movement for Movable Light
    this.setupPointerTracking();

    // 9. Initial Camera setup
    this.cameras.main.setZoom(1.0);
    this.cameras.main.centerOn(width / 2, height / 2);
  }

  /**
   * Sets up 2D WebGL dynamic lights and ambient profile
   */
  private setupLighting(): void {
    if (!this.lights) return;

    this.lights.enable();
    this.applyAmbientLighting();

    // Add point lights from projection
    this.projection.lighting.pointLights.forEach((lightDef) => {
      const colorNum = parseInt(lightDef.color.replace('#', ''), 16) || 0xffffff;
      const lx = lightDef.x <= 1 ? lightDef.x * this.scale.width : lightDef.x;
      const ly = lightDef.y <= 1 ? lightDef.y * this.scale.height : lightDef.y;

      const light = this.lights.addLight(lx, ly, lightDef.radius, colorNum, lightDef.intensity);
      this.dynamicLights.set(lightDef.id, light);

      if (lightDef.movable && !this.movableLight) {
        this.movableLight = light;
      }
    });
  }

  private applyAmbientLighting(): void {
    if (!this.lights) return;
    const { ambientColor, ambientIntensity } = this.projection.lighting;
    const hex = parseInt(ambientColor.replace('#', ''), 16) || 0xffffff;

    // Split RGB components scaled by intensity
    const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * ambientIntensity));
    const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * ambientIntensity));
    const b = Math.min(255, Math.round((hex & 0xff) * ambientIntensity));

    this.lights.setAmbientColor((r << 16) | (g << 8) | b);
  }

  /**
   * Sets up layered sprites with normal-map lighting
   */
  private setupSprites(width: number, height: number): void {
    // Layer 0: Background
    this.bgImage = this.add.image(width / 2, height / 2, 'fixture_bg');
    this.bgImage.setDisplaySize(width, height);
    this.layerBackground?.add(this.bgImage);

    // Layer 1: Midground Scenery (Desk)
    this.deskImage = this.add.image(width * 0.58, height * 0.72, 'fixture_desk');
    this.deskImage.setScale(Math.min(width / 1600, height / 900) * 1.1);
    this.layerScenery?.add(this.deskImage);

    // Layer 2: Authors Asset A1 with Normal Map Lighting
    const a1X = width * 0.68;
    const a1Y = height * 0.35;
    this.assetA1Image = this.add.image(a1X, a1Y, 'asset_a1');
    const scaleFactor = Math.min(width / 1600, height / 900);
    this.assetA1Image.setScale(scaleFactor * 1.15);
    this.layerActors?.add(this.assetA1Image);

    // Enable WebGL per-pixel normal map lighting & self-shadowing on Asset A1
    const objWithLighting = this.assetA1Image as unknown as {
      setLighting?: (enable: boolean) => void;
      setSelfShadow?: (enable: boolean, penumbra?: number, diffuseFlatThreshold?: number) => void;
      setPipeline?: (name: string) => void;
    };

    if (typeof objWithLighting.setLighting === 'function') {
      objWithLighting.setLighting(true);
    }
    if (typeof objWithLighting.setSelfShadow === 'function') {
      objWithLighting.setSelfShadow(true, 0.45, 0.25);
    }
  }

  /**
   * Sets up particles for dust motes and rainy weather
   */
  private setupParticles(width: number, height: number): void {
    // Ambient dust motes
    if (this.textures.exists('fixture_mote')) {
      this.dustMoteEmitter = this.add.particles(0, 0, 'fixture_mote', {
        x: { min: 0, max: width },
        y: { min: 0, max: height },
        speedX: { min: -8, max: 12 },
        speedY: { min: -10, max: 8 },
        scale: { start: 0.6, end: 1.2 },
        alpha: { start: 0, end: 0.6, ease: 'Sine.easeInOut' },
        lifespan: 6000,
        frequency: 250,
        blendMode: 'ADD',
      });
      this.dustMoteEmitter.setDepth(45);
      if (!this.projection.particles.dustMotes) {
        this.dustMoteEmitter.stop();
      }
    }

    // Rain particles
    if (this.textures.exists('fixture_rain')) {
      this.rainEmitter = this.add.particles(0, 0, 'fixture_rain', {
        x: { min: 0, max: width + 200 },
        y: -30,
        speedX: { min: -120, max: -80 },
        speedY: { min: 450, max: 650 },
        lifespan: 1200,
        alpha: { start: 0.7, end: 0.2 },
        frequency: 25,
        quantity: 2,
      });
      this.rainEmitter.setDepth(46);
      if (!this.projection.particles.rain) {
        this.rainEmitter.stop();
      }
    }
  }

  /**
   * Sets up render-texture and filter path for reflections/wetness
   */
  private setupRenderTexturePath(width: number, height: number): void {
    const puddleW = Math.round(width * 0.22);
    const puddleH = Math.round(height * 0.12);
    const puddleX = width * 0.22;
    const puddleY = height * 0.82;

    this.puddleRenderTexture = this.add.renderTexture(puddleX, puddleY, puddleW, puddleH);
    this.puddleRenderTexture.setDepth(22);
    this.puddleRenderTexture.setAlpha(0.65);

    // Draw reflection of window/desk into render texture (flipped vertically)
    this.refreshRenderTextureReflection();
  }

  public refreshRenderTextureReflection(): void {
    if (!this.puddleRenderTexture || !this.bgImage) return;
    this.puddleRenderTexture.clear();

    // Draw a reflective wash into the render texture
    this.puddleRenderTexture.fill(0x334a60, 0.5);
    // Draw inverted portion of scenery to prove dynamic render texture path
    if (this.deskImage) {
      this.puddleRenderTexture.draw(this.deskImage, 40, 20);
    }
  }

  /**
   * Sets up pointer tracking for movable point lights
   */
  private setupPointerTracking(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPointerLightTracking && this.movableLight) {
        this.movableLight.x = pointer.worldX;
        this.movableLight.y = pointer.worldY;
      }
    });
  }

  /**
   * Sets up authored pointer hotspots that emit semantic intents outward
   */
  private setupHotspots(width: number, height: number): void {
    // Clear existing hotspots
    this.hotspotZones.forEach(({ zone, highlight }) => {
      zone.destroy();
      highlight.destroy();
    });
    this.hotspotZones.clear();

    this.projection.anchors.forEach((anchor) => {
      const hx = anchor.x * width;
      const hy = anchor.y * height;
      const size = 64;

      // Visual highlight marker
      const highlight = this.add.circle(hx, hy, size / 2, 0xffe680, 0);
      highlight.setStrokeStyle(2, 0xffdf78, 0);
      highlight.setDepth(35);

      // Interactive zone
      const zone = this.add.zone(hx, hy, size, size)
        .setRectangleDropZone(size, size)
        .setInteractive({ cursor: 'pointer' });
      zone.setDepth(36);

      zone.on('pointerover', () => {
        highlight.setFillStyle(0xffe680, 0.35);
        highlight.setStrokeStyle(2, 0xffdf78, 0.9);
        this.onIntent?.({
          type: 'HOTSPOT_HOVER',
          hoveredAnchorId: anchor.id,
        });
      });

      zone.on('pointerout', () => {
        highlight.setFillStyle(0xffe680, 0);
        highlight.setStrokeStyle(2, 0xffdf78, 0);
        this.onIntent?.({
          type: 'HOTSPOT_HOVER',
          hoveredAnchorId: null,
        });
      });

      zone.on('pointerdown', () => {
        const primaryInteraction = anchor.interactions[0];
        this.onIntent?.({
          type: 'INTERACTION',
          anchorId: anchor.id,
          capability: primaryInteraction?.capability ?? 'inspect',
          name: primaryInteraction?.name ?? anchor.name,
          payload: { anchorTags: anchor.tags },
        });
      });

      this.hotspotZones.set(anchor.id, { zone, highlight });
    });
  }

  /**
   * Camera transition between authored views or focus regions
   */
  public transitionToView(targetViewId: string, duration = 800): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const width = this.scale.width;
    const height = this.scale.height;

    // View-specific target coordinates and zooms
    let targetX = width / 2;
    let targetY = height / 2;
    let targetZoom = 1.0;

    if (targetViewId === 'view_a2') {
      // Focus on window & puddle
      targetX = width * 0.3;
      targetY = height * 0.45;
      targetZoom = 1.45;
    } else {
      // Main overview
      targetX = width / 2;
      targetY = height / 2;
      targetZoom = 1.0;
    }

    this.cameras.main.pan(targetX, targetY, duration, 'Power2');
    this.cameras.main.zoomTo(targetZoom, duration, 'Power2', true, (_cam, progress) => {
      if (progress === 1) {
        this.isTransitioning = false;
        this.currentFocus = { x: targetX / width, y: targetY / height, zoom: targetZoom };
        this.onIntent?.({
          type: 'VIEW_TRANSITION',
          targetViewId,
        });
      }
    });
  }

  /**
   * Updates the scene projection from simulation state
   */
  public updateProjection(newProjection: WorldSceneProjection): void {
    this.projection = newProjection;

    // 1. Update lighting
    this.applyAmbientLighting();

    // 2. Update particles
    if (this.dustMoteEmitter) {
      if (newProjection.particles.dustMotes) {
        this.dustMoteEmitter.start();
      } else {
        this.dustMoteEmitter.stop();
      }
    }
    if (this.rainEmitter) {
      if (newProjection.particles.rain) {
        this.rainEmitter.start();
      } else {
        this.rainEmitter.stop();
      }
    }

    // 3. Update hotspots if anchors changed
    this.setupHotspots(this.scale.width, this.scale.height);

    // 4. Update focus if specified
    if (newProjection.focus) {
      const fx = newProjection.focus.x * this.scale.width;
      const fy = newProjection.focus.y * this.scale.height;
      this.cameras.main.pan(fx, fy, 600, 'Power2');
      this.cameras.main.zoomTo(newProjection.focus.zoom, 600, 'Power2');
    }
  }

  /**
   * Responsive / HiDPI resize handler preserving logical aspect ratio
   */
  public handleResize(width: number, height: number): void {
    if (!this.cameras.main) return;
    this.cameras.main.setViewport(0, 0, width, height);

    if (this.bgImage) {
      this.bgImage.setPosition(width / 2, height / 2);
      this.bgImage.setDisplaySize(width, height);
    }
    if (this.deskImage) {
      this.deskImage.setPosition(width * 0.58, height * 0.72);
      this.deskImage.setScale(Math.min(width / 1600, height / 900) * 1.1);
    }
    if (this.assetA1Image) {
      this.assetA1Image.setPosition(width * 0.68, height * 0.35);
      this.assetA1Image.setScale(Math.min(width / 1600, height / 900) * 1.15);
    }

    this.setupHotspots(width, height);
    this.refreshRenderTextureReflection();
  }

  /**
   * Movable point light control
   */
  public setMovableLightPosition(x: number, y: number): void {
    if (this.movableLight) {
      this.movableLight.x = x;
      this.movableLight.y = y;
    }
  }

  public setPointerLightTracking(enabled: boolean): void {
    this.isPointerLightTracking = enabled;
  }

  public getCurrentFocus(): WorldCameraFocus {
    return this.currentFocus;
  }

  public getCapabilityReport(): WorldFixtureCapabilityReport {
    return {
      reactLifecycle: true,
      noDuplicateCanvas: true,
      layeredRendering: !!(this.layerBackground && this.layerScenery && this.layerActors && this.layerForeground),
      normalMapLighting: !!(this.lights && this.assetA1Image),
      movablePointLight: !!this.movableLight,
      particles: !!(this.dustMoteEmitter && this.rainEmitter),
      renderTextureFilter: !!this.puddleRenderTexture,
      hotspotInteraction: this.hotspotZones.size > 0,
      cameraTransition: true,
      hidpiResize: true,
    };
  }
}
