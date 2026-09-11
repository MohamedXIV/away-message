// src/world/phaser/environment/EnvironmentManager.ts

import Phaser from 'phaser';
import type { WorldSceneProjection } from '../types';
import { interpolateDayPhase, type DayPhaseParameters } from './dayPhases';
import { updatePuddleZones, type PuddleZoneDef, type PuddleZoneState } from './puddles';
import { resolveWeatherLayers, type WeatherLayerResolution } from './weatherLayers';
import { evaluateAmbientMotion, type AmbientMotionDef } from './ambientMotion';
import {
  evaluateAuthoredLight,
  type AuthoredLightDef,
  type LightningFlashState,
} from './lightingEngine';

export class EnvironmentManager {
  private scene: Phaser.Scene;
  private projection: WorldSceneProjection;

  // Day Phase
  private currentMinuteOfDay = 720;
  private currentDayPhaseParams: DayPhaseParameters = interpolateDayPhase(720);

  // Lights
  private dynamicLights: Map<string, Phaser.GameObjects.Light> = new Map();
  private movableLight?: Phaser.GameObjects.Light;
  private activeLightning: LightningFlashState | null = null;
  private lastLightningTriggerTime = 0;

  // Particle Emitters
  private dustMoteEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private backgroundRainEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private foregroundRainEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private windowDropletsEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // Ambient Motion Targets & Base Transforms
  private motionTargets: Map<string, Phaser.GameObjects.GameObject> = new Map();
  private baseTransforms: Map<
    string,
    { x: number; y: number; angle: number; scaleX: number; scaleY: number; alpha: number }
  > = new Map();

  // Puddles
  private puddleStates: Map<string, PuddleZoneState> = new Map();
  private puddleRenderTexture?: Phaser.GameObjects.RenderTexture;
  private puddleRippleGraphics?: Phaser.GameObjects.Graphics;
  private rippleTime = 0;

  constructor(scene: Phaser.Scene, projection: WorldSceneProjection) {
    this.scene = scene;
    this.projection = projection;
    this.currentMinuteOfDay = projection.minuteOfDay ?? 720;
    this.currentDayPhaseParams = interpolateDayPhase(this.currentMinuteOfDay);
  }

  public init(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // 1. Setup Lighting
    this.setupLighting();

    // 2. Setup Weather Layer Emitters
    this.setupWeatherEmitters(width, height);

    // 3. Setup Puddle Zones
    this.setupPuddleZones(width, height);

    // 4. Initial state sync
    this.applyWeatherResolution();
  }

  /**
   * Registers a visual object target for data-driven ambient motion.
   */
  public registerMotionTarget(targetName: string, target: Phaser.GameObjects.GameObject): void {
    this.motionTargets.set(targetName, target);

    const objAny = target as unknown as {
      x?: number;
      y?: number;
      angle?: number;
      scaleX?: number;
      scaleY?: number;
      alpha?: number;
    };

    this.baseTransforms.set(targetName, {
      x: objAny.x ?? 0,
      y: objAny.y ?? 0,
      angle: objAny.angle ?? 0,
      scaleX: objAny.scaleX ?? 1,
      scaleY: objAny.scaleY ?? 1,
      alpha: objAny.alpha ?? 1,
    });
  }

  /**
   * Frame-by-frame living update hook called from WorldScene.update()
   */
  public update(timeMs: number, deltaMs: number): void {
    const deltaMinutes = deltaMs / 60000;

    // 1. Continuous Day Phase interpolation
    if (this.projection.minuteOfDay !== undefined) {
      this.currentMinuteOfDay = this.projection.minuteOfDay;
    }
    this.currentDayPhaseParams = interpolateDayPhase(this.currentMinuteOfDay);

    // 2. Modulate ambient lighting
    this.applyAmbientLighting();

    // 3. Modulate dynamic point lights & lightning
    this.updateLights(timeMs);

    // 4. Ambient motion bindings
    this.updateAmbientMotions(timeMs);

    // 5. Puddle simulation
    this.updatePuddles(timeMs, deltaMinutes);
  }

  public applyProjection(newProjection: WorldSceneProjection): void {
    this.projection = newProjection;
    if (newProjection.minuteOfDay !== undefined) {
      this.currentMinuteOfDay = newProjection.minuteOfDay;
    }
    this.currentDayPhaseParams = interpolateDayPhase(this.currentMinuteOfDay);

    this.applyAmbientLighting();
    this.applyWeatherResolution();
    this.refreshPuddleDefs();
  }

  public handleResize(width: number, height: number): void {
    if (this.puddleRenderTexture) {
      const puddleW = Math.round(width * 0.24);
      const puddleH = Math.round(height * 0.14);
      this.puddleRenderTexture.setPosition(width * 0.22, height * 0.82);
      this.puddleRenderTexture.setSize(puddleW, puddleH);
    }
  }

  public triggerLightning(durationMs = 300, peakIntensity = 3.5): void {
    this.activeLightning = {
      startTimeMs: this.scene.time.now,
      durationMs,
      peakIntensity,
    };
  }

  public getDayPhaseParams(): DayPhaseParameters {
    return this.currentDayPhaseParams;
  }

  public getPuddleStates(): Map<string, PuddleZoneState> {
    return this.puddleStates;
  }

  public getPuddleState(id: string): PuddleZoneState | undefined {
    return this.puddleStates.get(id);
  }

  public getMovableLight(): Phaser.GameObjects.Light | undefined {
    return this.movableLight;
  }

  public hasActiveRipples(): boolean {
    for (const s of this.puddleStates.values()) {
      if (s.hasRipples) return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Internal Lighting Subsystem
  // --------------------------------------------------------------------------

  private setupLighting(): void {
    if (!this.scene.lights) return;
    this.scene.lights.enable();
    this.applyAmbientLighting();

    // Setup point lights from projection
    this.projection.lighting.pointLights.forEach((lightDef) => {
      const colorNum = parseInt(lightDef.color.replace('#', ''), 16) || 0xffffff;
      const lx = lightDef.x <= 1 ? lightDef.x * this.scene.scale.width : lightDef.x;
      const ly = lightDef.y <= 1 ? lightDef.y * this.scene.scale.height : lightDef.y;

      const light = this.scene.lights.addLight(lx, ly, lightDef.radius, colorNum, lightDef.intensity);
      this.dynamicLights.set(lightDef.id, light);

      if (lightDef.movable && !this.movableLight) {
        this.movableLight = light;
      }
    });

    // Setup additional authored lights if present
    if (this.projection.authoredLights) {
      this.projection.authoredLights.forEach((aLight) => {
        if (this.dynamicLights.has(aLight.id)) return;
        const colorNum = parseInt(aLight.color.replace('#', ''), 16) || 0xffffff;
        const lx = aLight.x <= 1 ? aLight.x * this.scene.scale.width : aLight.x;
        const ly = aLight.y <= 1 ? aLight.y * this.scene.scale.height : aLight.y;

        const light = this.scene.lights.addLight(lx, ly, aLight.radius, colorNum, aLight.baseIntensity);
        this.dynamicLights.set(aLight.id, light);

        if (aLight.movable && !this.movableLight) {
          this.movableLight = light;
        }
      });
    }
  }

  private applyAmbientLighting(): void {
    if (!this.scene.lights) return;
    const { ambientColor, ambientIntensity } = this.currentDayPhaseParams;
    const hex = parseInt(ambientColor.replace('#', ''), 16) || 0xffffff;

    let r = ((hex >> 16) & 0xff) * ambientIntensity;
    let g = ((hex >> 8) & 0xff) * ambientIntensity;
    let b = (hex & 0xff) * ambientIntensity;

    // Boost ambient flash if lightning is active
    if (this.activeLightning) {
      const now = this.scene.time?.now ?? 0;
      const elapsed = now - this.activeLightning.startTimeMs;
      if (elapsed >= 0 && elapsed < this.activeLightning.durationMs) {
        const lightningProgress = elapsed / this.activeLightning.durationMs;
        const flashVal = (1.0 - lightningProgress) * 0.45;
        r = Math.min(255, r + flashVal * 255);
        g = Math.min(255, g + flashVal * 255);
        b = Math.min(255, b + flashVal * 255);
      } else if (elapsed >= this.activeLightning.durationMs) {
        this.activeLightning = null;
      }
    }

    const finalR = Math.min(255, Math.max(0, Math.round(r)));
    const finalG = Math.min(255, Math.max(0, Math.round(g)));
    const finalB = Math.min(255, Math.max(0, Math.round(b)));

    this.scene.lights.setAmbientColor((finalR << 16) | (finalG << 8) | finalB);
  }

  private updateLights(timeMs: number): void {
    if (!this.scene.lights || !this.projection.authoredLights) return;

    this.projection.authoredLights.forEach((def) => {
      const light = this.dynamicLights.get(def.id);
      if (!light) return;

      const evalResult = evaluateAuthoredLight(
        def,
        timeMs,
        this.currentDayPhaseParams,
        this.activeLightning
      );

      light.intensity = evalResult.intensity;
      const hex = parseInt(evalResult.color.replace('#', ''), 16);
      if (!isNaN(hex)) {
        light.setColor(hex);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Weather Layers & Occlusion
  // --------------------------------------------------------------------------

  private setupWeatherEmitters(width: number, height: number): void {
    if (!this.scene.textures) return;

    // Dust Motes
    if (this.scene.textures.exists('fixture_mote')) {
      this.dustMoteEmitter = this.scene.add.particles(0, 0, 'fixture_mote', {
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
    }

    // Background Rain (Visible behind scenery / through window)
    if (this.scene.textures.exists('fixture_rain')) {
      this.backgroundRainEmitter = this.scene.add.particles(0, 0, 'fixture_rain', {
        x: { min: 80, max: Math.min(width, 500) },
        y: -30,
        speedX: { min: -100, max: -70 },
        speedY: { min: 400, max: 600 },
        lifespan: 1100,
        alpha: { start: 0.5, end: 0.15 },
        frequency: 35,
        quantity: 2,
      });
      this.backgroundRainEmitter.setDepth(15); // Behind midground scenery
    }

    // Foreground Rain (Outdoor only)
    if (this.scene.textures.exists('fixture_rain')) {
      this.foregroundRainEmitter = this.scene.add.particles(0, 0, 'fixture_rain', {
        x: { min: 0, max: width + 200 },
        y: -30,
        speedX: { min: -120, max: -80 },
        speedY: { min: 450, max: 650 },
        lifespan: 1200,
        alpha: { start: 0.7, end: 0.2 },
        frequency: 25,
        quantity: 2,
      });
      this.foregroundRainEmitter.setDepth(46);
    }

    // Window droplets / runoff (Indoor only, on glass)
    if (this.scene.textures.exists('fixture_mote')) {
      this.windowDropletsEmitter = this.scene.add.particles(0, 0, 'fixture_mote', {
        x: { min: 140, max: 440 }, // Window bounds
        y: { min: 120, max: 540 },
        speedX: 0,
        speedY: { min: 20, max: 65 },
        scale: { start: 0.35, end: 0.2 },
        alpha: { start: 0.7, end: 0.1 },
        lifespan: 2500,
        frequency: 180,
      });
      this.windowDropletsEmitter.setDepth(18);
    }

    // Surface Splashes (Outdoor only)
    if (this.scene.textures.exists('fixture_mote')) {
      this.splashEmitter = this.scene.add.particles(0, 0, 'fixture_mote', {
        x: { min: 0, max: width },
        y: height * 0.85,
        speedX: { min: -30, max: 30 },
        speedY: { min: -40, max: -10 },
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 300,
        frequency: 80,
      });
      this.splashEmitter.setDepth(47);
    }
  }

  private applyWeatherResolution(): void {
    const isInterior = this.projection.isInterior ?? true;
    const resolution: WeatherLayerResolution = resolveWeatherLayers({
      weather: this.projection.weather,
      isInterior,
    });

    if (this.dustMoteEmitter) {
      if (resolution.dustMotes) this.dustMoteEmitter.start();
      else this.dustMoteEmitter.stop();
    }

    if (this.backgroundRainEmitter) {
      if (resolution.backgroundRain) this.backgroundRainEmitter.start();
      else this.backgroundRainEmitter.stop();
    }

    if (this.foregroundRainEmitter) {
      if (resolution.foregroundRain) this.foregroundRainEmitter.start();
      else this.foregroundRainEmitter.stop();
    }

    if (this.windowDropletsEmitter) {
      if (resolution.windowDroplets) this.windowDropletsEmitter.start();
      else this.windowDropletsEmitter.stop();
    }

    if (this.splashEmitter) {
      if (resolution.surfaceSplashes) this.splashEmitter.start();
      else this.splashEmitter.stop();
    }
  }

  // --------------------------------------------------------------------------
  // Ambient Motion
  // --------------------------------------------------------------------------

  private updateAmbientMotions(timeMs: number): void {
    if (!this.projection.ambientMotions) return;
    const wind = this.projection.windIntensity ?? 0;

    for (const motionDef of this.projection.ambientMotions) {
      const target = this.motionTargets.get(motionDef.targetName);
      const base = this.baseTransforms.get(motionDef.targetName);
      if (!target || !base) continue;

      const motion = evaluateAmbientMotion(motionDef, timeMs, wind);
      const objAny = target as unknown as {
        x: number;
        y: number;
        angle: number;
        scaleX: number;
        scaleY: number;
        alpha: number;
      };

      if (motionDef.type === 'rotation') {
        objAny.angle = base.angle + motion.rotation;
      } else if (motionDef.type === 'sway') {
        objAny.x = base.x + motion.xOffset;
        objAny.angle = base.angle + motion.rotation;
      } else if (motionDef.type === 'vibration') {
        objAny.x = base.x + motion.xOffset;
        objAny.y = base.y + motion.yOffset;
      } else if (motionDef.type === 'light_sweep') {
        objAny.x = base.x + motion.xOffset;
        objAny.alpha = base.alpha * motion.alphaOffset;
      } else {
        objAny.x = base.x + motion.xOffset;
        objAny.y = base.y + motion.yOffset;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Puddles & Wetness
  // --------------------------------------------------------------------------

  private setupPuddleZones(width: number, height: number): void {
    this.refreshPuddleDefs();

    // Setup Render-Texture for reflection wash
    const puddleW = Math.round(width * 0.24);
    const puddleH = Math.round(height * 0.14);
    const puddleX = width * 0.22;
    const puddleY = height * 0.82;

    this.puddleRenderTexture = this.scene.add.renderTexture(puddleX, puddleY, puddleW, puddleH);
    this.puddleRenderTexture.setDepth(22);
    this.puddleRenderTexture.setAlpha(0.65);

    // Ripple vector overlay graphics
    this.puddleRippleGraphics = this.scene.add.graphics();
    this.puddleRippleGraphics.setDepth(23);
  }

  private refreshPuddleDefs(): void {
    const zones = this.projection.puddleZones ?? [
      {
        id: 'puddle_default',
        x: 0.22,
        y: 0.82,
        width: 0.24,
        height: 0.14,
        threshold: 0.25,
        fillRate: 0.06,
        drainRate: 0.02,
        maxCapacity: 1.0,
        rippleIntensity: 1.0,
      },
    ];

    for (const z of zones) {
      if (!this.puddleStates.has(z.id)) {
        this.puddleStates.set(z.id, {
          id: z.id,
          wetness: 0,
          poolFill: 0,
          hasRipples: false,
        });
      }
    }
  }

  private updatePuddles(timeMs: number, deltaMinutes: number): void {
    const rainIntensity = this.projection.weather === 'rain' ? 1.0 : 0;
    const zones = this.projection.puddleZones ?? [
      {
        id: 'puddle_default',
        x: 0.22,
        y: 0.82,
        width: 0.24,
        height: 0.14,
        threshold: 0.25,
        fillRate: 0.06,
        drainRate: 0.02,
        maxCapacity: 1.0,
        rippleIntensity: 1.0,
      },
    ];

    this.puddleStates = updatePuddleZones(zones, this.puddleStates, rainIntensity, deltaMinutes);

    // Render reflection wash and ripples
    const defaultState = this.puddleStates.get('puddle_default');
    const poolFill = defaultState?.poolFill ?? 0;
    const wetness = defaultState?.wetness ?? 0;

    if (this.puddleRenderTexture) {
      this.puddleRenderTexture.clear();
      if (wetness > 0.05) {
        const sheenAlpha = Math.min(0.85, 0.2 + poolFill * 0.65);
        this.puddleRenderTexture.setAlpha(sheenAlpha);
        // Cool blue-grey wash reflecting evening/sky
        this.puddleRenderTexture.fill(0x384a60, 0.6);
      } else {
        this.puddleRenderTexture.setAlpha(0);
      }
    }

    if (this.puddleRippleGraphics) {
      this.puddleRippleGraphics.clear();
      if (defaultState?.hasRipples && poolFill > 0) {
        this.rippleTime += deltaMinutes * 60; // elapsed seconds
        const w = this.scene.scale.width;
        const h = this.scene.scale.height;
        const px = w * 0.22;
        const py = h * 0.82;

        this.puddleRippleGraphics.lineStyle(1.5, 0xd0e8ff, 0.45);
        // Draw 2 concentric expanding ripple rings
        for (let i = 0; i < 2; i++) {
          const r = ((this.rippleTime * 25 + i * 20) % 50) + 5;
          const alpha = 1.0 - r / 55;
          this.puddleRippleGraphics.lineStyle(1.5, 0xd0e8ff, Math.max(0, alpha * 0.6));
          this.puddleRippleGraphics.strokeEllipse(px, py, r * 2, r * 0.7);
        }
      }
    }
  }

  public destroy(): void {
    this.dustMoteEmitter?.destroy();
    this.backgroundRainEmitter?.destroy();
    this.foregroundRainEmitter?.destroy();
    this.windowDropletsEmitter?.destroy();
    this.splashEmitter?.destroy();
    this.puddleRenderTexture?.destroy();
    this.puddleRippleGraphics?.destroy();
    this.dynamicLights.clear();
    this.motionTargets.clear();
    this.baseTransforms.clear();
  }
}
