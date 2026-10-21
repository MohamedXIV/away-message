// src/world/phaser/WorldScene.ts

import Phaser from 'phaser';
import type { GeneratedAssetDef } from '../../engine/worldContent.generated';
import type {
  WorldSceneProjection,
  WorldInteractionIntent,
  WorldCameraFocus,
  WorldFixtureCapabilityReport,
  WorldScenePropProjection,
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
import {
  computeSoftSurfacePoints,
  type SoftSurfaceParams,
} from './layeredRoom/softSurfaceMotion';
import {
  applyRoomDisplayOverrides,
  computeRoomStructureSignature,
  planRoomPropPlacements,
} from './layeredRoom/roomPropPlan';
import type { SoftSurfaceMotionDef } from './environment/ambientMotion';
import { audioService, type AudioService } from '../../audio/AudioService';
import { mapViewCoordinatesToAudioPosition } from '../../audio/spatialMapping';
import { projectEnvironmentAudio } from '../../audio/environmentMapping';
import type { SpatialAudioSourceDef } from '../../audio/types';
import { createTechnicalAwayPuppetCharacterGroup } from './TechnicalAwayPuppetRig';
import {
  destroyWorldSceneCharacterMounts,
  disposeRemovedWorldSceneCharacters,
  syncWorldSceneCharacterMounts,
  updateWorldSceneCharacterMounts,
  type WorldSceneCharacterMount,
} from './WorldSceneCharacters';

export interface WorldSceneInitData {
  projection: WorldSceneProjection;
  onIntent?: (intent: WorldInteractionIntent) => void;
  visualMode?: 'production' | 'technical-fixture';
  characters?: readonly WorldSceneCharacterMount[];
}

export function resolveSceneBackgroundTexture(
  projection: WorldSceneProjection,
  visualMode: 'production' | 'technical-fixture',
  assets?: readonly GeneratedAssetDef[],
): string | null {
  return visualMode === 'technical-fixture'
    ? 'fixture_bg'
    : resolveProjectionVisual(projection, assets).assetId;
}

export interface WorldSceneVisualPlan {
  textureKey: string;
  normalMapTextureKey: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Scene-root depths of the window clip band (issue #167). The inverted
 * clip stencil draws at WINDOW_CLIP_TOP - 0.5, masked members spread across
 * (WINDOW_CLIP_TOP, WINDOW_CLIP_CLEAR), and the clearing stencil at
 * WINDOW_CLIP_CLEAR — between the layer foreground container (40) and the
 * EnvironmentManager weather band (45+), so unclipped weather always draws
 * above the clipped window group.
 */
const WINDOW_CLIP_TOP = 41;
const WINDOW_CLIP_CLEAR = 44;

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
  assets?: readonly GeneratedAssetDef[],
): WorldSceneVisualPlan | null {
  const visual = resolveProjectionVisual(projection, assets);
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
  private visualMode: 'production' | 'technical-fixture' = 'production';
  private environmentManager?: EnvironmentManager;
  private audioHandles: Map<string, { handle: string; eventId: string }> = new Map();
  private characterMounts: readonly WorldSceneCharacterMount[] = [];

  // Visual Display Layers
  private layerBackground?: Phaser.GameObjects.Container;
  private layerScenery?: Phaser.GameObjects.Container;
  private layerActors?: Phaser.GameObjects.Container;
  private layerForeground?: Phaser.GameObjects.Container;
  /** Exterior/backdrop props rendered behind the view architecture image. */
  private layerRoomBackdrop?: Phaser.GameObjects.Container;

  // Projection-owned view image
  private bgImage?: Phaser.GameObjects.Image;
  private deskImage?: Phaser.GameObjects.Image;
  private assetA1Image?: Phaser.GameObjects.Image;
  private curtainImage?: Phaser.GameObjects.Image;
  private clockHandImage?: Phaser.GameObjects.Image;
  private projectionPropImages = new Map<string, Phaser.GameObjects.Image>();
  private puddleRenderTexture?: Phaser.GameObjects.RenderTexture;

  // --- Layered living room (issue #167) — presentation runtime state ---
  // Soft-surface (Phaser Rope) handles keyed by authored prop id. Ropes are
  // vertex-deformed by EnvironmentManager; nothing here is a physics cloth.
  private roomRopes = new Map<string, Phaser.GameObjects.Rope>();
  private roomRopesById = new Map<string, Phaser.GameObjects.Rope>();
  // Scene-root members of the window-mask group (masked/soft props plus the
  // window-bounded streak emitter). They share one window clip; the clip is
  // applied per member because every renderer path handles group masking
  // differently.
  private windowGroupMembers: Phaser.GameObjects.GameObject[] = [];
  // WebGL path: an inverted addLayer stencil over the authored window rects
  // blocks drawing everywhere outside the windows, and a `clear` stencil
  // removes the clip again just before the weather band, so only group
  // members render between the two.
  private windowClipStencil?: Phaser.GameObjects.Stencil;
  private windowClipClearStencil?: Phaser.GameObjects.Stencil;
  private windowStencilClipApplied = false;
  // Canvas path: GeometryMask is canvas-renderer-only, so each member gets
  // the same generated rectangle mask.
  private windowClipGraphics?: Phaser.GameObjects.Graphics;
  private windowGeometryMask?: Phaser.Display.Masks.GeometryMask;
  private windowMaskGeometryApplied = false;
  private windowStreakEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Params captured at rope creation so EnvironmentManager can be (re)fed
  // after create()/updateProjection() ordering quirks.
  private pendingSoftSurfaceParams = new Map<string, SoftSurfaceParams>();
  // Bumped only when the room's GameObject graph is (re)built. A fixture
  // swap/hide or lamp toggle never bumps it — the independence evidence.
  private roomRenderIdentity = 0;
  private readonly roomDisplayOverrides: {
    fixtureVariants: Record<string, string | null>;
    hiddenPropIds: string[];
  } = { fixtureVariants: {}, hiddenPropIds: [] };
  private lastRoomStructureSignature = '';
  private roomMaskWarningShown = false;

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
    if (data?.visualMode) {
      this.visualMode = data.visualMode;
    }
    // Missing `characters` means "preserve Scene-owned/default mounts".
    // An explicit [] remains meaningful and clears the roster.
    if (data && Object.prototype.hasOwnProperty.call(data, 'characters')) {
      this.characterMounts = data.characters ?? [];
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
    if (this.visualMode === 'production') {
      queueProjectionAssetLoads(this, buildProjectionAssetLoadPlan(this.projection));
    }
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

    this.layerRoomBackdrop = this.add.container(0, 0).setDepth(8);
    this.layerBackground = this.add.container(0, 0).setDepth(10);
    this.layerScenery = this.add.container(0, 0).setDepth(20);
    this.layerActors = this.add.container(0, 0).setDepth(30);
    this.layerForeground = this.add.container(0, 0).setDepth(40);

    if (this.visualMode === 'technical-fixture' && this.characterMounts.length === 0) {
      this.characterMounts = createTechnicalAwayPuppetCharacterGroup();
    }

    this.setupLighting();
    this.setupSprites(width, height);
    this.setupParticles(width, height);
    this.setupRenderTexturePath(width, height);

    this.environmentManager = new EnvironmentManager(
      this,
      this.projection,
      this.visualMode === 'technical-fixture',
    );
    this.environmentManager.init();
    this.registerFixtureMotionTargets();
    this.registerRoomSoftSurfaces();

    this.setupHotspots(width, height);
    this.syncCharacterMounts(width, height);
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

  /** Reprojects live actors without restarting the scene or changing simulation identity. */
  public setCharacterMounts(next: readonly WorldSceneCharacterMount[]): void {
    disposeRemovedWorldSceneCharacters(this.characterMounts, next);
    this.characterMounts = next;
    if (this.layerActors) this.syncCharacterMounts(this.scale.width, this.scale.height);
  }

  private characterUpdateSamples = 0;
  private characterUpdateTotalMs = 0;
  private characterUpdateMaxMs = 0;

  public override update(time: number, delta: number): void {
    this.environmentManager?.update(time, delta);
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    updateWorldSceneCharacterMounts(this.characterMounts, delta);
    if (started > 0 && typeof performance !== 'undefined') {
      const elapsed = performance.now() - started;
      this.characterUpdateSamples += 1;
      this.characterUpdateTotalMs += elapsed;
      this.characterUpdateMaxMs = Math.max(this.characterUpdateMaxMs, elapsed);
    }
  }

  /** Debug-only evidence surface for #25 browser/performance verification. */
  public getCharacterRuntimeStats(): {
    actorCount: number;
    surfaceCount: number;
    visibleSurfaceCount: number;
    meshCount: number;
    surfaceNames: string[];
    sampleCount: number;
    averageUpdateMs: number;
    maxUpdateMs: number;
    actualFps: number;
  } {
    const surfaces = (this.layerActors?.list ?? []).filter(
      (object): object is Phaser.GameObjects.Container =>
        object instanceof Phaser.GameObjects.Container
        && typeof object.name === 'string'
        && object.name.startsWith('away-puppet-surface-'),
    );
    const meshCount = surfaces.reduce((total, object) => {
      const children = object.list ?? [];
      return total + children.filter(
        (child) => typeof child.name === 'string' && child.name.startsWith('away-puppet-mesh-'),
      ).length;
    }, 0);

    return {
      actorCount: this.characterMounts.length,
      surfaceCount: surfaces.length,
      visibleSurfaceCount: surfaces.filter((surface) => surface.visible).length,
      meshCount,
      surfaceNames: surfaces.map((surface) => surface.name),
      sampleCount: this.characterUpdateSamples,
      averageUpdateMs: this.characterUpdateSamples > 0
        ? this.characterUpdateTotalMs / this.characterUpdateSamples
        : 0,
      maxUpdateMs: this.characterUpdateMaxMs,
      actualFps: this.game.loop.actualFps,
    };
  }

  public getScenePropRuntimeStats(): {
    propCount: number;
    propNames: string[];
    angles: Record<string, number>;
  } {
    return {
      propCount: this.projectionPropImages.size,
      propNames: [...this.projectionPropImages.keys()],
      angles: Object.fromEntries(
        [...this.projectionPropImages.entries()].map(([id, image]) => [id, image.angle]),
      ),
    };
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
    // Room-graph teardown is unconditional so the early-return paths leave
    // no orphaned window clip stencils, ropes, or streak emitters behind.
    this.destroyLayeredRoomObjects();
    this.bgImage?.destroy();
    this.bgImage = undefined;
    this.deskImage?.destroy();
    this.assetA1Image?.destroy();
    this.curtainImage?.destroy();
    this.clockHandImage?.destroy();
    for (const propImage of this.projectionPropImages.values()) propImage.destroy();
    this.projectionPropImages.clear();
    this.deskImage = this.assetA1Image = this.curtainImage = this.clockHandImage = undefined;

    if (resolveSceneBackgroundTexture(this.projection, this.visualMode) === 'fixture_bg') {
      this.setupFixtureSprites(width, height);
      return;
    }

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

    this.setupProjectionProps(width, height);
  }

  private setupProjectionProps(width: number, height: number): void {
    this.destroyLayeredRoomObjects();
    this.lastRoomStructureSignature = this.roomStructureSignature();
    const props = this.roomDisplayProps();
    if (props.length === 0) return;

    const zones = this.projection.weatherWindowZones ?? [];
    const placements = planRoomPropPlacements(props, zones);

    // Masked members + the window streak emitter draw at scene root inside
    // the window clip band (40..46); everyone else routes by authored depth.
    const maskedPlacements = placements.filter(
      (placement) => placement.windowZoneIds.length > 0 || placement.unmasked,
    );
    const bandOrdered = maskedPlacements
      .slice()
      .sort((a, b) => (a.prop.depth - b.prop.depth) || a.prop.id.localeCompare(b.prop.id));

    for (const placement of placements) {
      const { prop } = placement;
      if (!this.textures.exists(prop.assetId)) {
        console.error(
          `[projection-assets] Scene prop asset '${prop.assetId}' is not loaded; omitting prop '${prop.id}'.`,
        );
        continue;
      }

      if (placement.unmasked) {
        // A masked prop with no authored window zone cannot be clipped;
        // rendering it over the room would paint exterior pixels onto the
        // interior. It is reported and left hidden instead.
        if (!this.roomMaskWarningShown) {
          this.roomMaskWarningShown = true;
          console.error(
            '[layered-room] Props declare maskZone but the view authors no weather-window zones; masked props stay hidden rather than painting over the room.',
          );
        }
        continue;
      }

      const inWindowGroup = placement.windowZoneIds.length > 0;
      const object = this.createRoomPropObject(prop, width, height);
      if (!object) continue;

      this.applyRoomPropBlend(object, prop);
      object.setVisible(!prop.hidden);

      // Every room prop is tracked by id (visibility/resize/stats); window
      // members additionally join the clipped band. Ownership for destroy
      // stays with the image map / rope map, never the member list.
      if (object instanceof Phaser.GameObjects.Image) this.projectionPropImages.set(prop.id, object);
      else this.roomRopesById.set(prop.id, object);

      if (inWindowGroup) {
        const rank = bandOrdered.findIndex((candidate) => candidate.prop.id === prop.id);
        object.setDepth(WINDOW_CLIP_TOP + ((rank + 1) / (bandOrdered.length + 2)));
        this.windowGroupMembers.push(object);
      } else {
        const layer = placement.slot === 'backdrop'
          ? this.layerRoomBackdrop
          : placement.slot === 'foreground'
            ? this.layerForeground
            : placement.slot === 'actors'
              ? this.layerActors
              : this.layerScenery;
        object.setDepth(prop.depth);
        layer?.add(object);
      }
    }

    if (this.windowGroupMembers.length > 0) {
      const streak = this.createWindowStreakEmitter(width, height, bandOrdered.length);
      if (streak) this.windowGroupMembers.push(streak);
      this.applyWindowClip(width, height);
    }
    this.roomRenderIdentity += 1;
  }

  /** Creates the image or Rope GameObject for one authored prop. */
  private createRoomPropObject(
    prop: WorldScenePropProjection,
    width: number,
    height: number,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rope | null {
    if (prop.softSurface) {
      const def = (this.projection.softSurfaces ?? []).find((candidate) => candidate.targetName === prop.id);
      if (!def) return null;
      const params = this.softSurfaceParams(prop, def, height);
      const rope = this.add.rope(
        prop.x * width,
        prop.y * height,
        prop.assetId,
        undefined,
        computeSoftSurfacePoints(params, 0, 0),
        false,
      );
      rope.setName(`world-soft-${prop.id}`);
      this.roomRopes.set(def.id, rope);
      this.pendingSoftSurfaceParams.set(def.id, params);
      return rope;
    }

    const image = this.add.image(prop.x * width, prop.y * height, prop.assetId);
    image.setName(`world-prop-${prop.id}`);
    image.setDisplaySize(prop.width * width, prop.height * height);
    return image;
  }

  private softSurfaceParams(
    prop: WorldScenePropProjection,
    def: SoftSurfaceMotionDef,
    sceneHeight: number,
  ): SoftSurfaceParams {
    return {
      segments: Math.max(2, def.segments ?? 14) + 1,
      lengthPx: Math.max(1, prop.height * sceneHeight),
      amplitude: def.amplitude ?? 0.05,
      speed: def.speed ?? 1,
      windAmplitude: (def.amplitude ?? 0.05) * (def.windFactor ?? 0.5),
      phaseOffset: def.phaseOffset,
    };
  }

  private applyRoomPropBlend(
    object: Phaser.GameObjects.Image | Phaser.GameObjects.Rope,
    prop: WorldScenePropProjection,
  ): void {
    if (!prop.blendMode || prop.blendMode === 'normal') return;
    const mode = prop.blendMode === 'add'
      ? Phaser.BlendModes.ADD
      : Phaser.BlendModes.SCREEN;
    (object as unknown as { setBlendMode(mode: number): unknown }).setBlendMode(mode);
  }

  /**
   * WebGL: one inverted addLayer stencil (blocking everything outside the
   * authored window rects) at WINDOW_CLIP_TOP and a `clear` stencil at
   * WINDOW_CLIP_CLEAR. Members between them render clipped; weather layers
   * above WINDOW_CLIP_CLEAR are unclipped. Canvas: GeometryMask per member
   * (the mask type is canvas-renderer-only, so no stencil is faked).
   */
  private applyWindowClip(width: number, height: number): void {
    const zones = (this.projection.weatherWindowZones ?? []).map((zone) => ({
      x: zone.x * width,
      y: zone.y * height,
      width: Math.max(1, zone.width * width),
      height: Math.max(1, zone.height * height),
    }));
    if (zones.length === 0) return;

    const isWebGL = this.renderer?.type === Phaser.WEBGL;
    if (isWebGL) {
      // Phaser 4's intended WebGL masking primitive: an inverted addLayer
      // Stencil blocks drawing everywhere its geometry does NOT cover, and
      // a `clear` Stencil removes the clip again further down the display
      // list. Stencil children render into the stencil buffer only — the
      // render step masks off color writes — so they must be fully opaque
      // fragments (a transparent fill would discard and clip nothing).
      const blockers: Phaser.GameObjects.Graphics[] = [];
      for (const zone of zones) {
        const blocker = this.make.graphics({}, false);
        blocker.fillStyle(0xffffff, 1);
        blocker.fillRect(zone.x, zone.y, zone.width, zone.height);
        blockers.push(blocker);
      }
      this.windowClipStencil = this.add.stencil(0, 0, blockers, {
        stencilLayerMode: 'addLayer',
        stencilInvert: true,
        stencilCompositeCheck: false,
      });
      this.windowClipStencil.setDepth(WINDOW_CLIP_TOP - 0.5);
      this.windowClipStencil.setName('room-window-clip-stencil');
      this.windowClipClearStencil = this.add.stencil(0, 0, [], {
        stencilLayerMode: 'clear',
        stencilClearValue: 0,
      });
      this.windowClipClearStencil.setDepth(WINDOW_CLIP_CLEAR);
      this.windowClipClearStencil.setName('room-window-clear-stencil');
      this.windowStencilClipApplied = true;
      return;
    }

    if (this.renderer?.type !== Phaser.CANVAS) {
      // No mask path exists for this renderer; report honestly.
      console.error(
        '[layered-room] Unsupported renderer type; window masking is NOT applied and is reported as unavailable.',
      );
      return;
    }

    const graphics = this.make.graphics({}, false);
    for (const zone of zones) graphics.fillRect(zone.x, zone.y, zone.width, zone.height);
    this.windowClipGraphics = graphics;
    this.windowGeometryMask = new Phaser.Display.Masks.GeometryMask(this, graphics);
    for (const member of this.windowGroupMembers) {
      (member as unknown as { setMask(mask: Phaser.Display.Masks.GeometryMask): unknown })
        .setMask(this.windowGeometryMask);
    }
    this.windowMaskGeometryApplied = true;
  }

  /** Resize path: window rects moved, so the clip machinery is rebuilt. */
  private rebuildWindowClip(width: number, height: number): void {
    this.windowClipStencil?.destroy();
    this.windowClipStencil = undefined;
    this.windowClipClearStencil?.destroy();
    this.windowClipClearStencil = undefined;
    this.windowClipGraphics?.destroy();
    this.windowClipGraphics = undefined;
    // Geometry masks live outside the display list; the regenerated one
    // replaces it on next applyWindowClip, so drop member masks first.
    for (const member of this.windowGroupMembers) {
      try {
        (member as unknown as { clearMask?(destroy?: boolean): unknown }).clearMask?.(false);
      } catch {
        // Renderer component edge cases; re-applied immediately after.
      }
    }
    this.windowGeometryMask = undefined;
    this.windowStencilClipApplied = false;
    this.windowMaskGeometryApplied = false;
    this.applyWindowClip(width, height);
  }

  /** Window-bounded foreground streaks: interior rain that never leaves the glass. */
  private createWindowStreakEmitter(
    width: number,
    height: number,
    memberCount: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter | null {
    const zones = this.projection.weatherWindowZones ?? [];
    if (zones.length === 0 || !this.textures.exists('fixture_rain')) return null;

    // Streaks draw as the last member of the clipped band (between the
    // clip stencil and its clear), so they never escape the window rects.
    const depth = WINDOW_CLIP_TOP + ((memberCount + 1) / (memberCount + 2)) * 0.9;

    const emitter = this.add.particles(0, 0, 'fixture_rain', {
      // Positions are owned by the emit zones below (see EM precedent).
      x: 0,
      y: 0,
      speedX: { min: -60, max: -30 },
      speedY: { min: 320, max: 460 },
      lifespan: 620,
      alpha: { start: 0.55, end: 0.08 },
      frequency: 40,
      quantity: 1,
    });
    emitter.setName('room-window-streaks');
    emitter.setDepth(depth);
    this.setWindowStreakZones(width, height);
    this.windowStreakEmitter = emitter;
    this.syncWindowStreakRunning();
    return emitter;
  }

  private setWindowStreakZones(width: number, height: number): void {
    const emitter = this.windowStreakEmitter;
    if (!emitter) return;
    emitter.clearEmitZones();
    for (const zone of this.projection.weatherWindowZones ?? []) {
      const rect = {
        x: zone.x * width,
        y: zone.y * height,
        width: Math.max(1, zone.width * width),
        height: Math.max(1, zone.height * height),
      };
      emitter.addEmitZone({
        type: 'random',
        source: {
          getRandomPoint(point: Phaser.Types.Math.Vector2Like) {
            point.x = rect.x + Math.random() * rect.width;
            point.y = rect.y + Math.random() * rect.height;
          },
        },
      });
    }
  }

  /** Interior rain stays outside the glass: streaks run only with a window. */
  private syncWindowStreakRunning(): void {
    const emitter = this.windowStreakEmitter;
    if (!emitter) return;
    const rain = this.projection.weather === 'rain';
    const intensity = this.projection.roomPresentation?.rainIntensity ?? (rain ? 1 : 0);
    const hasZones = (this.projection.weatherWindowZones?.length ?? 0) > 0;
    if (rain && intensity > 0 && hasZones) emitter.start();
    else emitter.stop();
  }

  /** Props with the current runtime display overrides layered on top. */
  private roomDisplayProps(): WorldScenePropProjection[] {
    const base = this.projection.sceneProps ?? [];
    if (base.length === 0) return [];
    return applyRoomDisplayOverrides(
      base,
      this.roomDisplayOverrides.fixtureVariants,
      this.roomDisplayOverrides.hiddenPropIds,
    );
  }

  /**
   * Identity of the authored prop graph INCLUDING geometry. Display
   * overrides and toggles never change it; any prop x/y/size/depth,
   * window-zone rect, or soft-surface def change does, so same-signature
   * updates can never leave stale image/rope/clip/streak geometry behind
   * (PR #198 review item 1).
   */
  private roomStructureSignature(projection: WorldSceneProjection = this.projection): string {
    return computeRoomStructureSignature({
      viewId: projection.viewId,
      props: projection.sceneProps ?? [],
      windowZones: projection.weatherWindowZones ?? [],
      softSurfaces: projection.softSurfaces ?? [],
    });
  }

  /**
   * Targeted visual refresh when the authored graph is unchanged. Because
   * the structure signature includes prop geometry, mask membership, zone
   * rects and soft-surface defs, a matching signature proves only
   * visibility/toggle state differs: fixture swap/hide resolves to
   * per-object visibility and the streak emitter follows weather. No room
   * image, light, or prop object is destroyed and recreated, and no
   * geometry can silently go stale.
   */
  private applyRoomSpriteVisuals(): void {
    const props = this.roomDisplayProps();
    for (const prop of props) {
      const image = this.projectionPropImages.get(prop.id);
      if (image) image.setVisible(!prop.hidden);
      const rope = this.roomRopesById.get(prop.id);
      if (rope) rope.setVisible(!prop.hidden);
    }
    this.syncWindowStreakRunning();
  }

  /**
   * QA/runtime entry point for independent fixture changes. This never
   * touches the engine: it only flips visibility on existing GameObjects
   * (and the window-band state) for the current projection.
   */
  public setRoomDisplayOverrides(overrides: {
    fixtureVariants?: Readonly<Record<string, string | null>>;
    hiddenPropIds?: readonly string[];
  }): void {
    if (overrides.fixtureVariants) {
      this.roomDisplayOverrides.fixtureVariants = { ...overrides.fixtureVariants };
    }
    if (overrides.hiddenPropIds) {
      this.roomDisplayOverrides.hiddenPropIds = [...overrides.hiddenPropIds];
    }
    this.applyRoomSpriteVisuals();
  }

  public getRoomDisplayOverridesState(): {
    fixtureVariants: Record<string, string | null>;
    hiddenPropIds: string[];
  } {
    return {
      fixtureVariants: { ...this.roomDisplayOverrides.fixtureVariants },
      hiddenPropIds: [...this.roomDisplayOverrides.hiddenPropIds],
    };
  }

  private registerRoomSoftSurfaces(): void {
    const environmentManager = this.environmentManager;
    if (!environmentManager) return;
    for (const [defId, rope] of this.roomRopes) {
      const params = this.pendingSoftSurfaceParams.get(defId);
      if (!params) continue;
      const def = (this.projection.softSurfaces ?? []).find((candidate) => candidate.id === defId);
      if (!def) continue;
      environmentManager.registerSoftSurface({
        defId,
        targetName: def.targetName,
        rope: rope as unknown as Parameters<typeof environmentManager.registerSoftSurface>[0]['rope'],
        params,
      });
    }
  }

  private destroyLayeredRoomObjects(): void {
    this.environmentManager?.clearSoftSurfaces();
    this.pendingSoftSurfaceParams.clear();

    // Ownership: prop images belong to the projectionPropImages purge (in
    // setupSprites/handleShutdown), ropes belong to this path, the streak
    // emitter and clip machinery are exclusive to it. Members still alive
    // release their mask first; destroyed ones are skipped.
    for (const rope of this.roomRopesById.values()) rope.destroy();
    this.roomRopesById.clear();
    this.roomRopes.clear();

    for (const member of this.windowGroupMembers) {
      if ((member as unknown as { active?: boolean }).active !== true) continue;
      try {
        (member as unknown as { clearMask?(destroy?: boolean): unknown }).clearMask?.(false);
      } catch {
        // Mask component differences across renderer builds.
      }
    }
    this.windowGroupMembers = [];

    this.windowStreakEmitter?.destroy();
    this.windowStreakEmitter = undefined;
    this.windowClipStencil?.destroy();
    this.windowClipStencil = undefined;
    this.windowClipClearStencil?.destroy();
    this.windowClipClearStencil = undefined;
    this.windowClipGraphics?.destroy();
    this.windowClipGraphics = undefined;
    this.windowGeometryMask = undefined;
    this.windowStencilClipApplied = false;
    this.windowMaskGeometryApplied = false;
    this.roomMaskWarningShown = false;
  }

  /** Presentation-only runtime evidence for browser QA (issue #167). */
  public getLayeredRoomRuntimeStats(): {
    renderIdentity: number;
    layers: Record<string, number>;
    backdropPropIds: string[];
    propIds: string[];
    swapGroups: Record<string, { variants: string[]; active: string | null }>;
    hiddenPropIds: string[];
    propTransforms: Record<string, { x: number; y: number; width: number; height: number }>;
    ropes: {
      propId: string;
      segments: number;
      lengthPx: number;
      peakOffsetPx: number;
      frames: number;
      topPinned: boolean;
    }[];
    windowZones: number;
    maskedMembers: string[];
    masking: {
      renderer: 'webgl' | 'canvas' | 'other';
      stencilClipApplied: boolean;
      geometryMaskApplied: boolean;
    };
    streakEmitter: { exists: boolean; running: boolean };
    audioHandleCount: number;
  } {
    const layers: Record<string, number> = {
      backdrop: this.layerRoomBackdrop?.length ?? 0,
      background: this.layerBackground?.length ?? 0,
      scenery: this.layerScenery?.length ?? 0,
      actors: this.layerActors?.length ?? 0,
      foreground: this.layerForeground?.length ?? 0,
    };

    const softStats = this.environmentManager?.getSoftSurfaceStats();
    const ropes = (this.projection.softSurfaces ?? []).flatMap((def) => {
      const rope = this.roomRopes.get(def.id);
      if (!rope) return [];
      const stats = softStats?.surfaces.find((surface) => surface.defId === def.id);
      return [{
        propId: def.targetName,
        segments: rope.points.length,
        lengthPx: Math.round((stats?.lengthPx ?? 0) * 100) / 100,
        peakOffsetPx: stats?.peakOffsetPx ?? 0,
        frames: stats?.frames ?? 0,
        // The pinned header must never have moved off x = 0.
        topPinned: Math.abs(rope.points[0]?.x ?? 0) < 1e-6,
      }];
    });

    const swapGroups: Record<string, { variants: string[]; active: string | null }> = {};
    const displayProps = this.roomDisplayProps();
    const hiddenById = new Map(displayProps.map((prop) => [prop.id, prop.hidden === true]));
    for (const prop of this.projection.sceneProps ?? []) {
      if (!prop.swapGroup) continue;
      const entry = swapGroups[prop.swapGroup] ?? { variants: [], active: null };
      const variant = prop.variant ?? prop.id;
      if (!entry.variants.includes(variant)) entry.variants.push(variant);
      if (!hiddenById.get(prop.id)) entry.active = variant;
      swapGroups[prop.swapGroup] = entry;
    }

    const rendererType = this.renderer?.type === Phaser.WEBGL
      ? 'webgl'
      : this.renderer?.type === Phaser.CANVAS ? 'canvas' : 'other';

    return {
      renderIdentity: this.roomRenderIdentity,
      layers,
      backdropPropIds: [...this.projection.roomPresentation?.backdropPropIds ?? []]
        .filter((id) => this.projectionPropImages.has(id) || this.roomRopesById.has(id)),
      propIds: [
        ...this.projectionPropImages.keys(),
        ...this.roomRopesById.keys(),
      ].sort(),
      swapGroups,
      hiddenPropIds: this.roomDisplayProps()
        .filter((prop) => prop.hidden && (this.projectionPropImages.has(prop.id) || this.roomRopesById.has(prop.id)))
        .map((prop) => prop.id),
      // Live GameObject transforms, so a browser test can prove geometry
      // updates actually reached the rendered objects (PR #198 item 1).
      propTransforms: Object.fromEntries(
        [...this.projectionPropImages.entries()].map(([id, image]) => [
          id,
          {
            x: Math.round(image.x * 100) / 100,
            y: Math.round(image.y * 100) / 100,
            width: Math.round(image.displayWidth * 100) / 100,
            height: Math.round(image.displayHeight * 100) / 100,
          },
        ]),
      ),
      ropes,
      windowZones: this.projection.weatherWindowZones?.length ?? 0,
      maskedMembers: this.windowGroupMembers
        .map((member) => (member as unknown as { name?: string }).name ?? '')
        .filter(Boolean),
      masking: {
        renderer: rendererType,
        stencilClipApplied: this.windowStencilClipApplied,
        geometryMaskApplied: this.windowMaskGeometryApplied,
      },
      streakEmitter: {
        exists: !!this.windowStreakEmitter,
        // `active` stays true while stopped (alive particles keep updating);
        // `emitting` is the honest "is rain currently falling" signal.
        running: !!this.windowStreakEmitter?.emitting,
      },
      audioHandleCount: this.audioHandles.size,
    };
  }

  private setupFixtureSprites(width: number, height: number): void {
    this.bgImage = this.add.image(width / 2, height / 2, 'fixture_bg');
    this.bgImage.setDisplaySize(width, height);
    this.layerBackground?.add(this.bgImage);

    const scaleFactor = Math.min(width / 1600, height / 900);
    this.deskImage = this.add.image(width * 0.58, height * 0.72, 'fixture_desk');
    this.deskImage.setScale(scaleFactor * 1.1);
    this.layerScenery?.add(this.deskImage);

    const a1X = width * 0.68;
    const a1Y = height * 0.35;
    this.assetA1Image = this.add.image(a1X, a1Y, 'asset_a1');
    this.assetA1Image.setScale(scaleFactor * 1.15);
    this.layerActors?.add(this.assetA1Image);
    const litAsset = this.assetA1Image as unknown as {
      setLighting?: (enable: boolean) => void;
      setSelfShadow?: (enable: boolean, penumbra?: number, diffuseFlatThreshold?: number) => void;
    };
    litAsset.setLighting?.(true);
    litAsset.setSelfShadow?.(true, 0.45, 0.25);

    if (this.textures.exists('fixture_curtain')) {
      this.curtainImage = this.add.image(width * 0.28, height * 0.12, 'fixture_curtain');
      this.curtainImage.setOrigin(0.5, 0);
      this.curtainImage.setScale(scaleFactor * 1.1);
      this.layerScenery?.add(this.curtainImage);
    }
    if (this.textures.exists('fixture_clock_hand')) {
      this.clockHandImage = this.add.image(a1X, a1Y, 'fixture_clock_hand');
      this.clockHandImage.setOrigin(0.5, 0.875);
      this.clockHandImage.setScale(scaleFactor * 1.15);
      this.layerActors?.add(this.clockHandImage);
    }
  }

  private registerFixtureMotionTargets(): void {
    if (!this.environmentManager) return;
    if (this.visualMode === 'technical-fixture') {
      if (this.curtainImage) this.environmentManager.registerMotionTarget('fixture_curtain', this.curtainImage);
      if (this.clockHandImage) this.environmentManager.registerMotionTarget('fixture_clock_hand', this.clockHandImage);
      if (this.deskImage) this.environmentManager.registerMotionTarget('fixture_desk', this.deskImage);
      if (this.assetA1Image) this.environmentManager.registerMotionTarget('asset_a1', this.assetA1Image);
    }
    for (const [propId, image] of this.projectionPropImages) {
      this.environmentManager.registerMotionTarget(propId, image);
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
    this.puddleRenderTexture.draw(this.deskImage ?? this.bgImage, 40, 20);
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
          ...(anchor.actorId ? { actorId: anchor.actorId } : {}),
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
    const nextSignature = this.roomStructureSignature(newProjection);
    const roomGraphUnchanged = nextSignature === this.lastRoomStructureSignature
      && (newProjection.sceneProps?.length ?? 0) > 0;
    this.projection = newProjection;
    this.environmentManager?.applyProjection(newProjection);

    this.applyAmbientLighting();
    if (this.visualMode === 'production') {
      try {
        queueMissingProjectionAssetsForUpdate(
          this as unknown as RefreshableProjectionLoadScene,
          newProjection,
          this.handleDynamicProjectionAssetsComplete,
        );
      } catch {
        // Loader bookkeeping must never break a view update.
      }
    }
    if (roomGraphUnchanged) {
      // Same authored prop graph (weather/lamp/focus/time updates): resolve
      // visibility in place. The room image, prop objects, ropes, lights and
      // window clip all keep their exact runtime identity — this is the
      // fixture/lighting independence path. Motion bases are NOT re-captured
      // (the objects are mid-animation); EM handles stay registered.
      this.applyRoomSpriteVisuals();
      this.registerRoomSoftSurfaces();
    } else {
      this.setupSprites(this.scale.width, this.scale.height);
      this.registerFixtureMotionTargets();
      this.registerRoomSoftSurfaces();
    }

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
    this.syncCharacterMounts(this.scale.width, this.scale.height);

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
    if (this.visualMode === 'technical-fixture') {
      const scaleFactor = Math.min(width / 1600, height / 900);
      this.deskImage?.setPosition(width * 0.58, height * 0.72).setScale(scaleFactor * 1.1);
      this.assetA1Image?.setPosition(width * 0.68, height * 0.35).setScale(scaleFactor * 1.15);
      this.curtainImage?.setPosition(width * 0.28, height * 0.12).setScale(scaleFactor * 1.1);
      this.clockHandImage?.setPosition(width * 0.68, height * 0.35).setScale(scaleFactor * 1.15);
    }
    for (const prop of this.projection.sceneProps ?? []) {
      const image = this.projectionPropImages.get(prop.id);
      if (image) {
        image.setPosition(prop.x * width, prop.y * height);
        image.setDisplaySize(prop.width * width, prop.height * height);
      }
      const rope = this.roomRopesById.get(prop.id);
      if (rope) {
        // Rope length follows the scene height; the def is re-resolved so a
        // later projection cannot leave a stale strip geometry behind.
        const def = (this.projection.softSurfaces ?? []).find((candidate) => candidate.targetName === prop.id);
        if (def) {
          const params = this.softSurfaceParams(prop, def, height);
          this.pendingSoftSurfaceParams.set(def.id, params);
          rope.setPosition(prop.x * width, prop.y * height);
          rope.setPoints(computeSoftSurfacePoints(params, this.time?.now ?? 0, 0));
          this.environmentManager?.registerSoftSurface({
            defId: def.id,
            targetName: def.targetName,
            rope: rope as unknown as Parameters<EnvironmentManager['registerSoftSurface']>[0]['rope'],
            params,
          });
        }
      }
    }

    if (this.windowGroupMembers.length > 0) {
      this.rebuildWindowClip(width, height);
      this.setWindowStreakZones(width, height);
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
    this.syncCharacterMounts(width, height);
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
    // Layered-room capabilities report what the RUNNING scene actually has,
    // never what a projection merely authored (Delivery-First honesty rule).
    const hasRoomProps = (this.projection.sceneProps?.length ?? 0) > 0
      && this.projectionPropImages.size + this.roomRopesById.size > 0;
    const backdropRendered = [...(this.projection.roomPresentation?.backdropPropIds ?? [])]
      .some((id) => this.projectionPropImages.has(id) || this.roomRopesById.has(id));
    const softLive = [...this.roomRopes.values()].some((rope) => rope.active);
    const swapGroupsLive = Object.keys(this.projection.roomPresentation?.swapGroups ?? {}).length > 0
      && hasRoomProps;
    const maskPathApplied = this.windowStencilClipApplied || this.windowMaskGeometryApplied;
    return {
      reactLifecycle: true,
      noDuplicateCanvas: true,
      layeredRendering: !!(this.layerBackground && this.layerScenery && this.layerActors && this.layerForeground),
      // True only when a scenery image is showing AND its diffuse texture
      // actually carries a linked normal map. A named-but-failed normal map
      // (missing key or no dataSource) never reports success.
      normalMapLighting: this.visualMode === 'technical-fixture'
        ? !!(this.lights && this.assetA1Image && textureHasLinkedNormalMap(this.textures, 'asset_a1'))
        : !!(this.lights && this.bgImage && visualPlan?.normalMapTextureKey
          && textureHasLinkedNormalMap(this.textures, visualPlan.textureKey)),
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
      // #167 layered room: props render, backdrop sits under the room image,
      // and the projection-driven graph is live.
      layeredRoom: hasRoomProps && backdropRendered,
      // Rope-backed soft surface present and driven (not a static image).
      softSurfaceMotion: softLive,
      // Only true when the clip path is actually applied on the active
      // renderer: WebGL stencil clip or Canvas geometry mask. A window
      // group without any applied clip never claims masking.
      windowStencilMask: this.windowGroupMembers.length > 0 && maskPathApplied,
      // Swap groups exist and overrides resolve without a room rebuild.
      fixtureIndependence: swapGroupsLive,
    };
  }

  private updateSpatialAudioEnvironment(): void {
    if (this.projection.listenerOrientation) {
      audioService.setListenerOrientation(this.projection.listenerOrientation);
    }
    const canonicalAudio = this.projection.environment
      ? projectEnvironmentAudio(this.projection.environment)
      : null;
    audioService.updateEnvironment({
      rainIntensity: canonicalAudio?.precipitation
        ?? (this.projection.weather === 'rain' ? 1.0 : 0.0),
      windIntensity: canonicalAudio?.wind ?? this.projection.windIntensity ?? 0,
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
    // Ropes, window clip stencils/masks and the streak emitter are owned by
    // the layered-room path; plain images by the map purge below.
    this.destroyLayeredRoomObjects();
    this.lastRoomStructureSignature = '';
    for (const propImage of this.projectionPropImages.values()) propImage.destroy();
    this.projectionPropImages.clear();
    destroyWorldSceneCharacterMounts(this.characterMounts);
    this.characterMounts = [];
  }

  private syncCharacterMounts(width: number, height: number): void {
    if (this.layerActors) {
      for (const mount of this.characterMounts) mount.attach?.(this, this.layerActors);
    }
    syncWorldSceneCharacterMounts(this.projection, width, height, this.characterMounts);
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
      this.registerFixtureMotionTargets();
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
