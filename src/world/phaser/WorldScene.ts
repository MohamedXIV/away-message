// src/world/phaser/WorldScene.ts

import Phaser from 'phaser';
import type {
  WorldSceneProjection,
  WorldInteractionIntent,
  WorldCameraFocus,
  WorldFixtureCapabilityReport,
} from './types';
import { ensureFixtureTextures, createTechnicalFixtureProjection } from './technicalFixture';
import { EnvironmentManager } from './environment/EnvironmentManager';
import { audioService, type AudioService } from '../../audio/AudioService';
import { mapViewCoordinatesToAudioPosition } from '../../audio/spatialMapping';

export interface WorldSceneInitData {
  projection: WorldSceneProjection;
  onIntent?: (intent: WorldInteractionIntent) => void;
}

export function resolveProjectionCameraTarget(
  projection: WorldSceneProjection,
  width: number,
  height: number,
): { x: number; y: number; zoom: number } {
  const focus = projection.focus ?? { x: 0.5, y: 0.5, zoom: 1 };
  return {
    x: focus.x <= 1 ? focus.x * width : focus.x,
    y: focus.y <= 1 ? focus.y * height : focus.y,
    zoom: focus.zoom,
  };
}

export class WorldScene extends Phaser.Scene {
  public static readonly SCENE_KEY = 'WorldScene';

  public projection: WorldSceneProjection = createTechnicalFixtureProjection();
  private onIntent?: (intent: WorldInteractionIntent) => void;
  private environmentManager?: EnvironmentManager;
  private audioHandles: string[] = [];

  // Visual Display Layers
  private layerBackground?: Phaser.GameObjects.Container;
  private layerScenery?: Phaser.GameObjects.Container;
  private layerActors?: Phaser.GameObjects.Container;
  private layerForeground?: Phaser.GameObjects.Container;

  // GameObjects
  private bgImage?: Phaser.GameObjects.Image;
  private deskImage?: Phaser.GameObjects.Image;
  private assetA1Image?: Phaser.GameObjects.Image;
  private curtainImage?: Phaser.GameObjects.Image;
  private clockHandImage?: Phaser.GameObjects.Image;
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

  constructor() {
    super({ key: WorldScene.SCENE_KEY });
  }

  public init(data?: Partial<WorldSceneInitData>): void {
    if (data?.projection) {
      this.projection = data.projection;
    }
    if (data?.onIntent) {
      this.onIntent = data.onIntent;
    }
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

    // 7. Setup Living Environment Subsystem
    this.environmentManager = new EnvironmentManager(this, this.projection);
    this.environmentManager.init();
    if (this.curtainImage) this.environmentManager.registerMotionTarget('fixture_curtain', this.curtainImage);
    if (this.clockHandImage) this.environmentManager.registerMotionTarget('fixture_clock_hand', this.clockHandImage);
    if (this.deskImage) this.environmentManager.registerMotionTarget('fixture_desk', this.deskImage);
    if (this.assetA1Image) this.environmentManager.registerMotionTarget('asset_a1', this.assetA1Image);

    // 8. Setup Authored Pointer Hotspots
    this.setupHotspots(width, height);

    // 9. Setup Pointer Movement for Movable Light
    this.setupPointerTracking();

    // 10. Initial Camera setup from projection
    const initialCamera = resolveProjectionCameraTarget(this.projection, width, height);
    this.cameras.main.setZoom(initialCamera.zoom);
    this.cameras.main.centerOn(initialCamera.x, initialCamera.y);
    this.currentFocus = {
      x: initialCamera.x / width,
      y: initialCamera.y / height,
      zoom: initialCamera.zoom,
    };

    // 11. Setup Spatial Audio Subsystem
    this.setupSpatialAudio();

    // Register scene cleanup hooks
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleDestroy, this);
  }

  public override update(time: number, delta: number): void {
    this.environmentManager?.update(time, delta);
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

    // Window curtain for ambient sway
    if (this.textures.exists('fixture_curtain')) {
      const curtainX = width * 0.28;
      const curtainY = height * 0.12;
      this.curtainImage = this.add.image(curtainX, curtainY, 'fixture_curtain');
      this.curtainImage.setOrigin(0.5, 0); // Pin top for natural sway
      this.curtainImage.setScale(scaleFactor * 1.1);
      this.layerScenery?.add(this.curtainImage);
    }

    // Clock hand pointer for Asset A1 ambient rotation
    if (this.textures.exists('fixture_clock_hand')) {
      this.clockHandImage = this.add.image(a1X, a1Y, 'fixture_clock_hand');
      this.clockHandImage.setOrigin(0.5, 0.875); // Pivot at center boss
      this.clockHandImage.setScale(scaleFactor * 1.15);
      this.layerActors?.add(this.clockHandImage);
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
   * Requests a view transition. The authoritative host supplies the next
   * projection; camera movement follows that projection's focus.
   */
  public transitionToView(targetViewId: string): void {
    this.onIntent?.({
      type: 'VIEW_TRANSITION',
      targetViewId,
    });
  }

  /**
   * Updates the scene projection from simulation state
   */
  public updateProjection(newProjection: WorldSceneProjection): void {
    this.projection = newProjection;
    this.environmentManager?.applyProjection(newProjection);

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

    // 4. Camera follows projection focus, never a view-id special case
    const cameraTarget = resolveProjectionCameraTarget(
      newProjection,
      this.scale.width,
      this.scale.height,
    );
    this.cameras.main.pan(cameraTarget.x, cameraTarget.y, 600, 'Power2');
    this.cameras.main.zoomTo(cameraTarget.zoom, 600, 'Power2');
    this.currentFocus = {
      x: cameraTarget.x / this.scale.width,
      y: cameraTarget.y / this.scale.height,
      zoom: cameraTarget.zoom,
    };

    // 5. Update audio environment & listener
    if (newProjection.listenerOrientation) {
      audioService.setListenerOrientation(newProjection.listenerOrientation);
    }
    audioService.updateEnvironment({
      rainIntensity: newProjection.weather === 'rain' ? 1.0 : 0.0,
      windIntensity: newProjection.windIntensity ?? 0,
      isInterior: newProjection.isInterior ?? true,
      timeOfDay: newProjection.timeOfDay,
    });
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
    if (this.curtainImage) {
      this.curtainImage.setPosition(width * 0.28, height * 0.12);
      this.curtainImage.setScale(Math.min(width / 1600, height / 900) * 1.1);
    }
    if (this.clockHandImage) {
      this.clockHandImage.setPosition(width * 0.68, height * 0.35);
      this.clockHandImage.setScale(Math.min(width / 1600, height / 900) * 1.15);
    }

    const cameraTarget = resolveProjectionCameraTarget(this.projection, width, height);
    this.cameras.main.centerOn(cameraTarget.x, cameraTarget.y);
    this.cameras.main.setZoom(cameraTarget.zoom);
    this.currentFocus = {
      x: cameraTarget.x / width,
      y: cameraTarget.y / height,
      zoom: cameraTarget.zoom,
    };

    this.setupHotspots(width, height);
    this.refreshRenderTextureReflection();
    this.environmentManager?.handleResize(width, height);
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

  public getEnvironmentManager(): EnvironmentManager | undefined {
    return this.environmentManager;
  }

  public getCapabilityReport(): WorldFixtureCapabilityReport {
    return {
      reactLifecycle: true,
      noDuplicateCanvas: true,
      layeredRendering: !!(this.layerBackground && this.layerScenery && this.layerActors && this.layerForeground),
      normalMapLighting: !!(this.lights && this.assetA1Image),
      movablePointLight: !!(this.movableLight ?? this.environmentManager?.getMovableLight()),
      particles: !!(this.dustMoteEmitter && this.rainEmitter),
      renderTextureFilter: !!this.puddleRenderTexture,
      hotspotInteraction: this.hotspotZones.size > 0,
      cameraTransition: true,
      hidpiResize: true,
      dayPhaseInterpolation: true,
      ambientMotion: true,
      weatherOcclusion: true,
      puddleZones: true,
      spatialAudio: true,
    };
  }

  private setupSpatialAudio(): void {
    if (this.projection.listenerOrientation) {
      audioService.setListenerOrientation(this.projection.listenerOrientation);
    }
    audioService.updateEnvironment({
      rainIntensity: this.projection.weather === 'rain' ? 1.0 : 0.0,
      windIntensity: this.projection.windIntensity ?? 0,
      isInterior: this.projection.isInterior ?? true,
      timeOfDay: this.projection.timeOfDay,
    });

    if (this.projection.spatialAudioSources) {
      for (const src of this.projection.spatialAudioSources) {
        const audioPos = mapViewCoordinatesToAudioPosition(src.x, src.y, src.z ?? 0);
        const handle = audioService.play(src.eventId, {
          loop: src.loop ?? true,
          volume: src.volume ?? 1.0,
          bus: src.bus ?? 'ambience',
          position: audioPos,
          parameters: src.parameters,
        });
        if (handle) {
          this.audioHandles.push(handle);
        }
      }
    }
  }

  private handleShutdown(): void {
    for (const handle of this.audioHandles) {
      audioService.stop(handle, 0);
    }
    this.audioHandles = [];
  }

  private handleDestroy(): void {
    this.handleShutdown();
  }

  public getAudioService(): AudioService {
    return audioService;
  }
}
