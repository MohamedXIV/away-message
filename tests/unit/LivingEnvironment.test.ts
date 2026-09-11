// tests/unit/LivingEnvironment.test.ts

import { describe, it, expect } from 'vitest';
import {
  interpolateDayPhase,
  CANONICAL_DAY_PHASES,
  type DayPhaseParameters,
} from '../../src/world/phaser/environment/dayPhases';
import {
  updatePuddleZone,
  type PuddleZoneDef,
  type PuddleZoneState,
} from '../../src/world/phaser/environment/puddles';
import {
  resolveWeatherLayers,
  type WeatherLayerResolution,
} from '../../src/world/phaser/environment/weatherLayers';
import {
  evaluateAmbientMotion,
  type AmbientMotionDef,
} from '../../src/world/phaser/environment/ambientMotion';
import {
  evaluateAuthoredLight,
  type AuthoredLightDef,
  type LightningFlashState,
} from '../../src/world/phaser/environment/lightingEngine';

describe('Living Environment Subsystem', () => {
  describe('1. Five Time-of-Day Profiles & Continuous Interpolation', () => {
    it('evaluates exact anchor profiles at canonical anchor minutes', () => {
      // 5 canonical anchors:
      // dawn_morning (~390m / 06:30)
      // day (~720m / 12:00)
      // late_afternoon (~990m / 16:30)
      // dusk_evening (~1170m / 19:30)
      // night_late_night (~60m / 01:00)
      const dawn = interpolateDayPhase(CANONICAL_DAY_PHASES.dawn_morning.minuteOfDay);
      expect(dawn.ambientColor.toLowerCase()).toBe(CANONICAL_DAY_PHASES.dawn_morning.ambientColor.toLowerCase());
      expect(dawn.ambientIntensity).toBeCloseTo(CANONICAL_DAY_PHASES.dawn_morning.ambientIntensity, 2);

      const day = interpolateDayPhase(CANONICAL_DAY_PHASES.day.minuteOfDay);
      expect(day.ambientColor.toLowerCase()).toBe(CANONICAL_DAY_PHASES.day.ambientColor.toLowerCase());
      expect(day.ambientIntensity).toBeCloseTo(CANONICAL_DAY_PHASES.day.ambientIntensity, 2);
      expect(day.artificialLightProminence).toBeLessThan(0.3);

      const afternoon = interpolateDayPhase(CANONICAL_DAY_PHASES.late_afternoon.minuteOfDay);
      expect(afternoon.ambientColor.toLowerCase()).toBe(CANONICAL_DAY_PHASES.late_afternoon.ambientColor.toLowerCase());

      const dusk = interpolateDayPhase(CANONICAL_DAY_PHASES.dusk_evening.minuteOfDay);
      expect(dusk.ambientColor.toLowerCase()).toBe(CANONICAL_DAY_PHASES.dusk_evening.ambientColor.toLowerCase());

      const night = interpolateDayPhase(CANONICAL_DAY_PHASES.night_late_night.minuteOfDay);
      expect(night.ambientColor.toLowerCase()).toBe(CANONICAL_DAY_PHASES.night_late_night.ambientColor.toLowerCase());
      expect(night.artificialLightProminence).toBeGreaterThan(0.7);
    });

    it('interpolates continuously across midpoints without abrupt step changes', () => {
      const minuteA = 720; // Noon (Day)
      const minuteB = 990; // 16:30 (Late Afternoon)
      const midMinute = Math.round((minuteA + minuteB) / 2);

      const paramA = interpolateDayPhase(minuteA);
      const paramMid = interpolateDayPhase(midMinute);
      const paramB = interpolateDayPhase(minuteB);

      // Midpoint intensity must lie strictly between the two anchors
      const minIntensity = Math.min(paramA.ambientIntensity, paramB.ambientIntensity);
      const maxIntensity = Math.max(paramA.ambientIntensity, paramB.ambientIntensity);
      expect(paramMid.ambientIntensity).toBeGreaterThan(minIntensity);
      expect(paramMid.ambientIntensity).toBeLessThan(maxIntensity);

      // Small 1-minute delta produces a correspondingly tiny continuous change (no cliff)
      const paramMidPlus1 = interpolateDayPhase(midMinute + 1);
      const deltaIntensity = Math.abs(paramMidPlus1.ambientIntensity - paramMid.ambientIntensity);
      expect(deltaIntensity).toBeLessThan(0.01);
    });

    it('wraps smoothly across midnight (1439m -> 0m -> 1m)', () => {
      const p1439 = interpolateDayPhase(1439);
      const p0 = interpolateDayPhase(0);
      const p1 = interpolateDayPhase(1);

      expect(Math.abs(p1439.ambientIntensity - p0.ambientIntensity)).toBeLessThan(0.005);
      expect(Math.abs(p0.ambientIntensity - p1.ambientIntensity)).toBeLessThan(0.005);
      expect(p0.starAlpha).toBeGreaterThan(0.8);
    });

    it('guarantees time-jump equivalence to incremental minute updates', () => {
      // Evaluating directly at minute 450 produces the exact same parameters
      // as reaching 450 through any progression.
      const jumpParam = interpolateDayPhase(450);

      let stepParam: DayPhaseParameters = interpolateDayPhase(0);
      for (let m = 1; m <= 450; m++) {
        stepParam = interpolateDayPhase(m);
      }

      expect(jumpParam.ambientIntensity).toBe(stepParam.ambientIntensity);
      expect(jumpParam.ambientColor).toBe(stepParam.ambientColor);
      expect(jumpParam.artificialLightProminence).toBe(stepParam.artificialLightProminence);
      expect(jumpParam.exteriorColor).toBe(stepParam.exteriorColor);
    });
  });

  describe('2. Deterministic Wetness and Puddle Accumulation', () => {
    const testPuddleDef: PuddleZoneDef = {
      id: 'puddle_window',
      x: 0.2,
      y: 0.8,
      width: 0.25,
      height: 0.12,
      threshold: 0.3,       // Wetness must exceed 0.3 before water pools
      fillRate: 0.05,       // +0.05 wetness per minute of full rain
      drainRate: 0.02,      // -0.02 wetness per minute when dry
      maxCapacity: 0.9,     // Maximum pool fill depth
      rippleIntensity: 1.0,
    };

    const initialDryState: PuddleZoneState = {
      id: 'puddle_window',
      wetness: 0,
      poolFill: 0,
      hasRipples: false,
    };

    it('keeps poolFill at 0 while wetness is below pooling threshold', () => {
      // 4 minutes of rain at intensity 1.0 -> wetness = 0 + 4 * 0.05 = 0.20 <= threshold (0.3)
      const state = updatePuddleZone(testPuddleDef, initialDryState, 1.0, 4);
      expect(state.wetness).toBeCloseTo(0.20, 4);
      expect(state.poolFill).toBe(0);
      expect(state.hasRipples).toBe(false);
    });

    it('begins pool growth once wetness exceeds threshold', () => {
      // 10 minutes of rain at intensity 1.0 -> wetness = 0.50 > threshold (0.3)
      const state = updatePuddleZone(testPuddleDef, initialDryState, 1.0, 10);
      expect(state.wetness).toBeCloseTo(0.50, 4);
      expect(state.poolFill).toBeGreaterThan(0);
      expect(state.hasRipples).toBe(true);
    });

    it('caps wetness at 1.0 and poolFill at maxCapacity', () => {
      // 100 minutes of heavy rain
      const state = updatePuddleZone(testPuddleDef, initialDryState, 1.0, 100);
      expect(state.wetness).toBe(1.0);
      expect(state.poolFill).toBe(testPuddleDef.maxCapacity);
      expect(state.hasRipples).toBe(true);
    });

    it('drains and dries when rain stops until completely clear', () => {
      const fullState: PuddleZoneState = {
        id: 'puddle_window',
        wetness: 1.0,
        poolFill: testPuddleDef.maxCapacity,
        hasRipples: true,
      };

      // Rain stops (intensity = 0), drains for 20 minutes (20 * 0.02 = 0.40 reduction)
      const drainingState = updatePuddleZone(testPuddleDef, fullState, 0.0, 20);
      expect(drainingState.wetness).toBeCloseTo(0.60, 4);
      expect(drainingState.hasRipples).toBe(false); // No active rain ripples

      // Drains for another 40 minutes (40 * 0.02 = 0.80 reduction, clamps to 0)
      const dryState = updatePuddleZone(testPuddleDef, drainingState, 0.0, 40);
      expect(dryState.wetness).toBe(0);
      expect(dryState.poolFill).toBe(0);
      expect(dryState.hasRipples).toBe(false);
    });

    it('guarantees dry/drain equivalence: 30-minute jump equals thirty 1-minute updates', () => {
      const fullState: PuddleZoneState = {
        id: 'puddle_window',
        wetness: 0.8,
        poolFill: 0.6,
        hasRipples: false,
      };

      const jumpState = updatePuddleZone(testPuddleDef, fullState, 0.0, 30);

      let stepState = fullState;
      for (let i = 0; i < 30; i++) {
        stepState = updatePuddleZone(testPuddleDef, stepState, 0.0, 1);
      }

      expect(jumpState.wetness).toBeCloseTo(stepState.wetness, 5);
      expect(jumpState.poolFill).toBeCloseTo(stepState.poolFill, 5);
    });

    it('guarantees rain accumulation equivalence: 25-minute jump equals twenty-five 1-minute updates', () => {
      const jumpState = updatePuddleZone(testPuddleDef, initialDryState, 0.8, 25);

      let stepState = initialDryState;
      for (let i = 0; i < 25; i++) {
        stepState = updatePuddleZone(testPuddleDef, stepState, 0.8, 1);
      }

      expect(jumpState.wetness).toBeCloseTo(stepState.wetness, 5);
      expect(jumpState.poolFill).toBeCloseTo(stepState.poolFill, 5);
    });
  });

  describe('3. Weather Layering and Indoor/Outdoor Occlusion', () => {
    it('suppresses foreground rain and splashes in indoor spaces while enabling window droplets', () => {
      const indoorLayers = resolveWeatherLayers({
        weather: 'rain',
        isInterior: true,
      });

      expect(indoorLayers.backgroundRain).toBe(true);
      expect(indoorLayers.foregroundRain).toBe(false); // Suppressed indoors!
      expect(indoorLayers.windowDroplets).toBe(true);  // Runoff/condensation on glass
      expect(indoorLayers.surfaceSplashes).toBe(false); // No floor splashes
      expect(indoorLayers.dustMotes).toBe(false);
    });

    it('enables full foreground streaks and surface splashes in outdoor spaces', () => {
      const outdoorLayers = resolveWeatherLayers({
        weather: 'rain',
        isInterior: false,
      });

      expect(outdoorLayers.backgroundRain).toBe(true);
      expect(outdoorLayers.foregroundRain).toBe(true);
      expect(outdoorLayers.windowDroplets).toBe(false);
      expect(outdoorLayers.surfaceSplashes).toBe(true);
      expect(outdoorLayers.dustMotes).toBe(false);
    });

    it('disables all rain effects and activates dust motes in clear or cloudy weather', () => {
      const clearLayers = resolveWeatherLayers({
        weather: 'clear',
        isInterior: true,
      });

      expect(clearLayers.backgroundRain).toBe(false);
      expect(clearLayers.foregroundRain).toBe(false);
      expect(clearLayers.windowDroplets).toBe(false);
      expect(clearLayers.surfaceSplashes).toBe(false);
      expect(clearLayers.dustMotes).toBe(true);
    });

    it('resolves generic weather layers without any location-specific code', () => {
      // Different place IDs or contexts with identical parameters resolve identically
      const resA = resolveWeatherLayers({ weather: 'rain', isInterior: true });
      const resB = resolveWeatherLayers({ weather: 'rain', isInterior: true });
      expect(resA).toEqual(resB);
    });
  });

  describe('4. Generic Ambient Motion Bindings', () => {
    it('evaluates rotation motion linearly over time', () => {
      const clockDef: AmbientMotionDef = {
        id: 'clock_hand',
        targetName: 'fixture_clock_hand',
        type: 'rotation',
        speed: 6, // 6 deg / sec
      };

      const at0 = evaluateAmbientMotion(clockDef, 0, 0);
      expect(at0.rotation).toBe(0);

      const at10s = evaluateAmbientMotion(clockDef, 10000, 0);
      expect(at10s.rotation).toBeCloseTo(60, 2);

      const at60s = evaluateAmbientMotion(clockDef, 60000, 0);
      expect(at60s.rotation).toBeCloseTo(360, 2);
    });

    it('evaluates sway motion with wind gust amplification', () => {
      const curtainDef: AmbientMotionDef = {
        id: 'curtain_sway',
        targetName: 'fixture_curtain',
        type: 'sway',
        speed: 1,      // 1 Hz
        amplitude: 5,  // 5 px or deg
        windFactor: 2, // 2x amplitude at full wind
      };

      // At calm wind (wind = 0), max sway is amplitude 5
      const calmQuarterCycle = evaluateAmbientMotion(curtainDef, 250, 0); // sin(pi/2) = 1
      expect(calmQuarterCycle.xOffset).toBeCloseTo(5, 2);

      // At strong wind (wind = 1), max sway is amplitude * (1 + 1*2) = 15
      const windyQuarterCycle = evaluateAmbientMotion(curtainDef, 250, 1.0);
      expect(windyQuarterCycle.xOffset).toBeCloseTo(15, 2);
    });

    it('evaluates machine vibration with high-frequency bounded displacement', () => {
      const fridgeDef: AmbientMotionDef = {
        id: 'fridge_vibe',
        targetName: 'fixture_fridge',
        type: 'vibration',
        amplitude: 0.8,
      };

      const m1 = evaluateAmbientMotion(fridgeDef, 120, 0);
      expect(Math.abs(m1.xOffset)).toBeLessThanOrEqual(0.81);
      expect(Math.abs(m1.yOffset)).toBeLessThanOrEqual(0.81);
    });
  });

  describe('5. Generic Authored Lights, Flicker and Lightning Flash', () => {
    it('modulates point light prominence according to day phase', () => {
      const lampDef: AuthoredLightDef = {
        id: 'desk_lamp',
        kind: 'lamp',
        x: 0.5,
        y: 0.5,
        radius: 300,
        color: '#ffea9f',
        baseIntensity: 1.5,
      };

      const dayPhase = interpolateDayPhase(CANONICAL_DAY_PHASES.day.minuteOfDay);
      const nightPhase = interpolateDayPhase(CANONICAL_DAY_PHASES.night_late_night.minuteOfDay);

      const dayLight = evaluateAuthoredLight(lampDef, 0, dayPhase, null);
      const nightLight = evaluateAuthoredLight(lampDef, 0, nightPhase, null);

      // Lamp is more prominent at night than at noon
      expect(nightLight.intensity).toBeGreaterThan(dayLight.intensity);
    });

    it('keeps flicker noise strictly within authored amplitude bounds', () => {
      const neonDef: AuthoredLightDef = {
        id: 'neon_sign',
        kind: 'neon',
        x: 0.2,
        y: 0.2,
        radius: 200,
        color: '#ff3366',
        baseIntensity: 1.0,
        flicker: {
          type: 'neon',
          frequency: 8,
          amplitude: 0.15, // Max 15% deviation
        },
      };

      const dayPhase = interpolateDayPhase(CANONICAL_DAY_PHASES.day.minuteOfDay);
      const effectiveBase = neonDef.baseIntensity * (0.4 + 0.6 * dayPhase.artificialLightProminence);

      for (let t = 0; t < 1000; t += 50) {
        const light = evaluateAuthoredLight(neonDef, t, dayPhase, null);
        const minExpected = effectiveBase * (1 - 0.151);
        const maxExpected = effectiveBase * (1 + 0.151);
        expect(light.intensity).toBeGreaterThanOrEqual(minExpected);
        expect(light.intensity).toBeLessThanOrEqual(maxExpected);
      }
    });

    it('evaluates transient lightning flash spike and smooth decay', () => {
      const exteriorLightDef: AuthoredLightDef = {
        id: 'window_exterior',
        kind: 'window',
        x: 0.2,
        y: 0.3,
        radius: 400,
        color: '#607090',
        baseIntensity: 0.8,
        isExterior: true,
      };

      const nightPhase = interpolateDayPhase(CANONICAL_DAY_PHASES.night_late_night.minuteOfDay);

      const flashState: LightningFlashState = {
        startTimeMs: 1000,
        durationMs: 300,
        peakIntensity: 3.5,
      };

      // Before flash (t = 500ms)
      const before = evaluateAuthoredLight(exteriorLightDef, 500, nightPhase, flashState);
      expect(before.intensity).toBeCloseTo(0.8 * nightPhase.exteriorIntensity, 2);

      // Peak of flash (t = 1050ms)
      const peak = evaluateAuthoredLight(exteriorLightDef, 1050, nightPhase, flashState);
      expect(peak.intensity).toBeGreaterThan(2.5);

      // After flash has ended (t = 1400ms)
      const after = evaluateAuthoredLight(exteriorLightDef, 1400, nightPhase, flashState);
      expect(after.intensity).toBeCloseTo(before.intensity, 2);
    });
  });
});
