// src/world/phaser/WorldScene.ts

import Phaser from 'phaser';
import type {
  WorldSceneProjection,
  WorldInteractionIntent,
  WorldCameraFocus,
  WorldFixtureCapabilityReport,
} from './types';
import { ensureFixtureTextures, createTechnicalFixtureProjection } from './technicalFixture';
import { resolveProjectionVisual } from './projectionVisual';
import {
  buildProjectionAssetLoadPlan,
  queueProjectionAssetLoads,
  formatProjectionAssetLoadError,
  textureHasLinkedNormalMap,
  queueMissingProjectionAssetsForUpdate,
  type ProjectionAssetLoadErrorFile,
  type RefreshableProjectionLoadScene,
} from './projectionAssets';
import { EnvironmentManager } from './environment/EnvironmentManager';
import { audioService, type AudioService } from '../../audio/AudioService';
import { mapViewCoordinatesToAudioPosition } from '../../audio/spatialMapping';
import type { SpatialAudioSourceDef } from '../../audio/types';

export interface WorldSceneInitData {
  projection: WorldSceneProjection;
  onIntent?: (intent: WorldInteractionIntent) => void;
}

export interface WorldSceneVisualPlan {
  textureKey: string;
  normalMapTextureKey: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
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

export function resolveWorldSceneVisualPlan(
  projection: WorldSceneProjection,
  width: number,
  height: number,
): WorldSceneVisualPlan | null {
  const visual = resolveProjectionVisual(projection);
  if (!visual.usesAuthoredAsset || !visual.assetId) {
    return null;
  }

  return {
    textureKey: visual.assetId,
    normalMapTextureKey: visual.normalMapAssetId,
    x: width / 2,
    y: height / 2,
    width,
    height,
  };
}

export class WorldScene extends Phaser.Scene {
  public static readonly SCENE_KEY = 'WorldScene';

  public projection: WorldSceneProjection = createTechnicalFixtureProjection();
  private onIntent?: (intent: WorldInteractionIntent) => void;
  private environmentManager?: EnvironmentManager;
  private audioHandles: Map<string, { handle: string; eventId: string }> = new Map();

  // Visual Display Layers
  private layerBackground?: Phaser.GameObjects.Container;
  private layerScenery?: Phaser.GameObjects.Container;
  private layerActors?: Phaser.GameObjects.Container;
  private layerForeground?: Phaser.GameObjects.Container;

  // Projection-owned view image
  private bgImage?: Phaser.GameObjects.Image;
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

  /**
   * Queues the projection-selected production diffuse images and their
   * linked normal maps (active view plus authored siblings) with relative
   * Vite/itch-compatible URLs. Invalid references are reported by the load
   * plan and queued nowhere; the projection stays assetless for those
   * slots instead of borrowing another visual.
   *
   * The loaderror listener is registered BEFORE queueing so initial preload
   * failures are reported loudly with the Phaser file key/URL. It is
   * removed again on shutdown (see handleShutdown).
   */
  public preload(): void {
    try {
      this.load.off('loaderror', this.handleAssetLoadError, this);
    } catch {
      // Headless/test loaders may not implement off(); registration below still applies.
    }
    this.load.on('loaderror', this.handleAssetLoadError, this);
    queueProjectionAssetLoads(this, buildProjectionAssetLoadPlan(this.projection));
  }

  public create(): void {
    // Technical fixture textures still provide the current procedural particle
    // probes; scenery selection itself is projection-owned below.
    ensureFixtureTextures(this);
    // preload() already registered this listener before the boot queue ran.
    // Re-assert it here (off-then-on) so scenes created without preload
    // (tests, direct boots) still report failures loudly without doubling.
    try {
      this.load.off('loaderror', this.handleAssetLoadError, this);
    } catch {
      // Ignore headless/test loader differences.
    }
    this.load.on('loaderror', this.handleAssetLoadError, this);

    const width = this.scale.width;
    const height = this.scale.height;

    this.layerBackground = this.add.container(0, 0).setDepth(10);
    this.layerScenery = this.add.container(0, 0).setDepth(20);
    this.layerActors = this.add.container(0, 0).setDepth(30);
    this.layerForeground = this.add.container(0, 0).setDepth(40);

    this.setupLighting();
    this.setupSprites(width, height);
    this.setupParticles(width, height);
    this.setupRenderTexturePath(width, height);

    this.environmentManager = new EnvironmentManager(this, this.projection);
    this.environmentManager.init();

    this.setupHotspots(width, height);
    this.setupPointerTracking();

    const initialCamera = resolveProjectionCameraTarget(this.projection, width, height);
    this.cameras.main.setZoom(initialCamera.zoom);
    this.cameras.main.centerOn(initialCamera.x, initialCamera.y);
    this.currentFocus = {
      x: initialCamera.x / width,
      y: initialCamera.y / height,
      zoom: initialCamera.zoom,
    };

    this.setupSpatialAudio();

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

    const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * ambientIntensity));
    const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * ambientIntensity));
    const b = Math.min(255, Math.round((hex & 0xff) * ambientIntensity));

    this.lights.setAmbientColor((r << 16) | (g << 8) | b);
  }

  /**
   * Renders only the asset selected by the current projection. Assetless views
   * intentionally remain without a scenery image instead of borrowing the
   * technical fixture background, desk, clock, curtain, or asset identities.
   * A projection that names an asset which failed to load is reported loudly
   * and likewise left assetless — never silently substituted.
   */
  private setupSprites(width: number, height: number): void {
    this.bgImage?.destroy();
    this.bgImage = undefined;

    const plan = resolveWorldSceneVisualPlan(this.projection, width, height);
    if (!plan) {
      return;
    }
    if (!this.textures.exists(plan.textureKey)) {
      console.error(
        `[projection-assets] Production asset '${plan.textureKey}' is not loaded; leaving the projection assetless rather than substituting another visual.`,
      );
      return;
    }

    this.bgImage = this.add.image(plan.x, plan.y, plan.textureKey);
    this.bgImage.setDisplaySize(plan.width, plan.height);
    this.layerBackground?.add(this.bgImage);

    // Normal-map lighting only when the diffuse texture actually carries a
    // linked normal map in texture state (Phaser 4 dataSource). A projection
    // that names a normal map which failed to load (missing key or no linked
    // data source) renders unlit — it is never reported as lit.
    // The valid array-linked form (load.image(key, [diffuse, normal])) still
    // lights, as does the procedural fixture path (setDataSource).
    if (plan.normalMapTextureKey && textureHasLinkedNormalMap(this.textures, plan.textureKey)) {
      const litImage = this.bgImage as unknown as {
        setLighting?: (enable: boolean) => void;
        setSelfShadow?: (enable: boolean, penumbra?: number, diffuseFlatThreshold?: number) => void;
      };
      litImage.setLighting?.(true);
      litImage.setSelfShadow?.(true, 0.45, 0.25);
    }
  }

  /**
   * Sets up particles for dust motes and rainy weather
   */
  private setupParticles(width: number, height: number): void {
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
      if (!this.projection.particles.rain || this.projection.isInterior) {
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

    this.refreshRenderTextureReflection();
  }

  public refreshRenderTextureReflection(): void {
    if (!this.puddleRenderTexture || !this.bgImage) return;
    this.puddleRenderTexture.clear();
    this.puddleRenderTexture.fill(0x334a60, 0.5);
    this.puddleRenderTexture.draw(this.bgImage, 40, 20);
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
    this.hotspotZones.forEach(({ zone, highlight }) => {
      zone.destroy();
      highlight.destroy();
    });
    this.hotspotZones.clear();

    this.projection.anchors.forEach((anchor) => {
      const hx = anchor.x * width;
      const hy = anchor.y * height;
      const size = 64;

      const highlight = this.add.circle(hx, hy, size / 2, 0xffe680, 0);
      highlight.setStrokeStyle(2, 0xffdf78, 0);
      highlight.setDepth(35);

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
   * Updates the scene projection from simulation state.
   *
   * Boot loading is preload()-owned (active view plus authored siblings).
   * A later projection may name a production asset that was never part of
   * the boot set; in that case the missing assets are queued generically
   * and the sprite refreshes once Phaser's loader completes. Repeated view
   * updates coalesce into one pending refresh and never force-restart an
   * in-flight load. Failures stay loud and assetless via the loaderror path.
   */
  public updateProjection(newProjection: WorldSceneProjection): void {
    this.projection = newProjection;
    this.environmentManager?.applyProjection(newProjection);

    this.applyAmbientLighting();
    try {
      queueMissingProjectionAssetsForUpdate(
        this as unknown as RefreshableProjectionLoadScene,
        newProjection,
        this.handleDynamicProjectionAssetsComplete,
      );
    } catch {
      // Loader bookkeeping must never break a view update.
    }
    this.setupSprites(this.scale.width, this.scale.height);

    if (this.dustMoteEmitter) {
      if (newProjection.particles.dustMotes) {
        this.dustMoteEmitter.start();
      } else {
        this.dustMoteEmitter.stop();
      }
    }
    if (this.rainEmitter) {
      if (newProjection.particles.rain && !newProjection.isInterior) {
        this.rainEmitter.start();
      } else {
        this.rainEmitter.stop();
      }
    }

    this.setupHotspots(this.scale.width, this.scale.height);

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

    this.updateSpatialAudioEnvironment();
    this.syncSpatialAudioSources();
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
    const visualPlan = resolveWorldSceneVisualPlan(
      this.projection,
      this.scale?.width ?? 0,
      this.scale?.height ?? 0,
    );
    return {
      reactLifecycle: true,
      noDuplicateCanvas: true,
      layeredRendering: !!(this.layerBackground && this.layerScenery && this.layerActors && this.layerForeground),
      // True only when a scenery image is showing AND its diffuse texture
      // actually carries a linked normal map. A named-but-failed normal map
      // (missing key or no dataSource) never reports success.
      normalMapLighting: !!(
        this.lights &&
        this.bgImage &&
        visualPlan?.normalMapTextureKey &&
        textureHasLinkedNormalMap(this.textures, visualPlan.textureKey)
      ),
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

  private updateSpatialAudioEnvironment(): void {
    if (this.projection.listenerOrientation) {
      audioService.setListenerOrientation(this.projection.listenerOrientation);
    }
    audioService.updateEnvironment({
      rainIntensity: this.projection.weather === 'rain' ? 1.0 : 0.0,
      windIntensity: this.projection.windIntensity ?? 0,
      isInterior: this.projection.isInterior ?? true,
      timeOfDay: this.projection.timeOfDay,
    });
  }

  /**
   * Keeps projection-owned sources stable across view/weather updates. A
   * source ID is the lifecycle identity; changing its event or removing it
   * stops the old handle before a replacement is created.
   */
  private syncSpatialAudioSources(): void {
    const sourceDefs = this.projection.spatialAudioSources ?? [];
    const sourceById = new Map(sourceDefs.map((source) => [source.id, source]));

    for (const [sourceId, active] of this.audioHandles) {
      const next = sourceById.get(sourceId);
      if (
        !next
        || next.eventId !== active.eventId
        || !audioService.isInstanceActive(active.handle)
      ) {
        if (audioService.isInstanceActive(active.handle)) {
          audioService.stop(active.handle, 0.15);
        }
        this.audioHandles.delete(sourceId);
      }
    }

    for (const src of sourceDefs) {
      const audioPos = mapViewCoordinatesToAudioPosition(src.x, src.y, src.z ?? 0);
      const active = this.audioHandles.get(src.id);

      if (active && active.eventId === src.eventId) {
        audioService.setSourcePosition(active.handle, audioPos);
        for (const [name, value] of Object.entries(src.parameters ?? {})) {
          audioService.setParameter(name, value, active.handle);
        }
        continue;
      }

      if (active) {
        audioService.stop(active.handle, 0.15);
        this.audioHandles.delete(src.id);
      }

      const handle = this.playSpatialAudioSource(src, audioPos);
      if (handle) {
        this.audioHandles.set(src.id, { handle, eventId: src.eventId });
      }
    }
  }

  private playSpatialAudioSource(
    src: SpatialAudioSourceDef,
    audioPos: ReturnType<typeof mapViewCoordinatesToAudioPosition>,
  ): string {
    return audioService.play(src.eventId, {
      loop: src.loop ?? true,
      volume: src.volume ?? 1.0,
      bus: src.bus ?? 'ambience',
      position: audioPos,
      parameters: src.parameters,
    });
  }

  private setupSpatialAudio(): void {
    this.updateSpatialAudioEnvironment();
    this.syncSpatialAudioSources();
  }

  private handleShutdown(): void {
    try {
      this.load.off('loaderror', this.handleAssetLoadError, this);
    } catch {
      // Headless/test loaders may not implement off().
    }
    // Dynamic refresh is registered without a context (see
    // queueMissingProjectionAssetsForUpdate); remove both forms so a pending
    // refresh never fires after shutdown. Phaser's own loader shutdown also
    // clears all listeners, this is belt-and-braces for restarts.
    try {
      this.load.off('complete', this.handleDynamicProjectionAssetsComplete);
    } catch {
      // No pending dynamic refresh in most shutdowns; ignore listener edge cases.
    }
    try {
      this.load.off('complete', this.handleDynamicProjectionAssetsComplete, this);
    } catch {
      // Ignore listener edge cases.
    }
    for (const { handle } of this.audioHandles.values()) {
      audioService.stop(handle, 0);
    }
    this.audioHandles.clear();
  }

  private handleDestroy(): void {
    this.handleShutdown();
  }

  /**
   * One-shot refresh after a post-boot dynamic asset load completes. Renders
   * the current projection (which may have advanced past the projection that
   * triggered the load — setupSprites always uses the latest), so a later
   * projection is never left stale behind a completed download.
   */
  private handleDynamicProjectionAssetsComplete = (): void => {
    try {
      if (!this.textures) return;
      this.setupSprites(this.scale.width, this.scale.height);
      this.refreshRenderTextureReflection();
    } catch {
      // Refresh is best-effort; the next view update re-renders anyway.
    }
  };

  /**
   * Reports a failed production asset download loudly, including the Phaser
   * file key and resolved URL when provided. The render path stays
   * assetless for that projection (see setupSprites) — it never substitutes
   * another visual.
   */
  private handleAssetLoadError(file: ProjectionAssetLoadErrorFile): void {
    console.error(formatProjectionAssetLoadError(file));
  }

  public getAudioService(): AudioService {
    return audioService;
  }
}
