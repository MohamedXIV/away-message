// src/world/phaser/environment/lightingEngine.ts

import type { DayPhaseParameters } from './dayPhases';

export type LightGlowType =
  | 'point'
  | 'window'
  | 'monitor'
  | 'lamp'
  | 'neon'
  | 'fridge'
  | 'sign'
  | 'exterior';

export interface LightFlickerDef {
  type: 'candle' | 'fluorescent' | 'neon' | 'pulse' | 'subtle';
  frequency: number; // Hz
  amplitude: number; // 0..1 max deviation fraction from base intensity
}

export interface AuthoredLightDef {
  id: string;
  kind: LightGlowType;
  x: number; // 0..1 normalized or world px
  y: number;
  radius: number;
  color: string; // #rrggbb
  baseIntensity: number;
  flicker?: LightFlickerDef;
  normalMapped?: boolean;
  movable?: boolean;
  isExterior?: boolean;
}

export interface LightningFlashState {
  startTimeMs: number;
  durationMs: number;
  peakIntensity: number;
}

export interface AuthoredLightEvaluation {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
}

function evaluateFlickerNoise(flicker: LightFlickerDef, timeMs: number): number {
  const t = (timeMs / 1000) * flicker.frequency;
  let noise = 0;

  switch (flicker.type) {
    case 'neon': {
      // Rapid intermittent micro-dips and buzz
      const buzz = Math.sin(t * 2 * Math.PI) * 0.5 + Math.sin(t * 5.7 * Math.PI) * 0.5;
      noise = buzz * flicker.amplitude;
      break;
    }
    case 'candle': {
      // Gentle low-frequency wandering
      const drift = Math.sin(t * 1.5) * 0.6 + Math.sin(t * 3.7) * 0.4;
      noise = drift * flicker.amplitude;
      break;
    }
    case 'fluorescent': {
      // Sharp erratic pulses
      const pulse = Math.sin(t * 2 * Math.PI);
      const isDip = Math.sin(t * 7.3) > 0.8;
      noise = (isDip ? -0.9 : pulse * 0.3) * flicker.amplitude;
      break;
    }
    case 'pulse': {
      // Smooth sinusoidal pulsing
      noise = Math.sin(t * 2 * Math.PI) * flicker.amplitude;
      break;
    }
    case 'subtle':
    default: {
      noise = Math.sin(t * 3.14) * 0.5 * flicker.amplitude;
      break;
    }
  }

  // Strictly clamp noise within [-amplitude, +amplitude]
  return Math.max(-flicker.amplitude, Math.min(flicker.amplitude, noise));
}

function evaluateLightningContribution(
  flash: LightningFlashState | null,
  timeMs: number
): number {
  if (!flash) return 0;
  if (timeMs < flash.startTimeMs || timeMs >= flash.startTimeMs + flash.durationMs) {
    return 0;
  }

  const elapsed = timeMs - flash.startTimeMs;
  const progress = elapsed / flash.durationMs; // 0..1

  // Double-peak profile characteristic of lightning:
  // Primary strike peak at progress ~0.12, return stroke peak at ~0.32, exponential decay
  let envelope = 0;
  if (progress < 0.12) {
    envelope = progress / 0.12;
  } else if (progress < 0.25) {
    envelope = 1.0 - (progress - 0.12) / 0.13 * 0.4; // Dips to 0.6
  } else if (progress < 0.35) {
    envelope = 0.6 + (progress - 0.25) / 0.10 * 0.3; // Return stroke spikes to 0.9
  } else {
    // Exponential decay to 0
    const decayProgress = (progress - 0.35) / 0.65;
    envelope = 0.9 * Math.exp(-decayProgress * 4.0);
  }

  return envelope * flash.peakIntensity;
}

/**
 * Evaluates an authored light definition with environmental day-phase modulation,
 * bounded flicker profiles, and transient lightning flashes.
 */
export function evaluateAuthoredLight(
  def: AuthoredLightDef,
  timeMs: number,
  dayPhase: DayPhaseParameters,
  lightning: LightningFlashState | null
): AuthoredLightEvaluation {
  let intensity = def.baseIntensity;

  // Exterior lights scale with exterior intensity
  if (def.isExterior) {
    intensity *= dayPhase.exteriorIntensity;
  } else {
    // Artificial interior lights are more prominent at night / evening
    const prominenceFactor = 0.4 + 0.6 * dayPhase.artificialLightProminence;
    intensity *= prominenceFactor;
  }

  // Apply flicker if authored
  if (def.flicker && def.flicker.amplitude > 0) {
    const noise = evaluateFlickerNoise(def.flicker, timeMs);
    intensity *= 1.0 + noise;
  }

  // Apply lightning flash to exterior lights or windows
  if (def.isExterior && lightning) {
    const lightningBoost = evaluateLightningContribution(lightning, timeMs);
    intensity += lightningBoost;
  }

  return {
    id: def.id,
    x: def.x,
    y: def.y,
    radius: def.radius,
    color: def.color,
    intensity: Math.max(0, intensity),
  };
}
