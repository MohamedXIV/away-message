// src/world/phaser/environment/ambientMotion.ts

export type AmbientMotionType =
  | 'rotation'
  | 'sway'
  | 'vibration'
  | 'light_sweep'
  | 'drift';

export interface AmbientMotionDef {
  id: string;
  targetName: string; // Identifier for target GameObject / anchor / light
  type: AmbientMotionType;
  speed?: number; // deg/sec for rotation, Hz for sway/vibration
  amplitude?: number; // px displacement or degrees of sway
  windFactor?: number; // Multiplier for wind intensity amplification (0..N)
  phaseOffset?: number; // Initial phase in radians or degrees
  periodSeconds?: number; // Period for cyclic events like light sweeps
}

export interface AmbientMotionResult {
  xOffset: number;
  yOffset: number;
  rotation: number; // degrees
  scaleOffset: number;
  alphaOffset: number;
}

/**
 * Evaluates a generic authored ambient motion binding at timeMs with given wind intensity.
 * Deterministic and pure function without side effects or engine dependency.
 */
export function evaluateAmbientMotion(
  def: AmbientMotionDef,
  timeMs: number,
  windIntensity = 0
): AmbientMotionResult {
  const tSec = Math.max(0, timeMs) / 1000;
  const wind = Math.max(0, Math.min(1, windIntensity));

  switch (def.type) {
    case 'rotation': {
      const speed = def.speed ?? 30; // 30 deg / sec default
      const phase = def.phaseOffset ?? 0;
      const angle = speed * tSec + phase;
      return {
        xOffset: 0,
        yOffset: 0,
        rotation: angle,
        scaleOffset: 0,
        alphaOffset: 0,
      };
    }

    case 'sway': {
      const freq = def.speed ?? 1.0; // 1 Hz default
      const baseAmp = def.amplitude ?? 4.0;
      const factor = def.windFactor ?? 1.0;
      const effectiveAmp = baseAmp * (1.0 + wind * factor);
      const phase = def.phaseOffset ?? 0;
      const angle = 2 * Math.PI * freq * tSec + phase;
      const swayValue = Math.sin(angle) * effectiveAmp;

      return {
        xOffset: swayValue,
        yOffset: 0,
        rotation: swayValue * 0.5,
        scaleOffset: 0,
        alphaOffset: 0,
      };
    }

    case 'vibration': {
      const freq = def.speed ?? 28; // High frequency machine vibration
      const amp = def.amplitude ?? 1.0;
      const x = Math.sin(2 * Math.PI * freq * tSec) * amp;
      const y = Math.cos(2 * Math.PI * (freq * 1.3) * tSec) * (amp * 0.7);

      return {
        xOffset: x,
        yOffset: y,
        rotation: 0,
        scaleOffset: 0,
        alphaOffset: 0,
      };
    }

    case 'light_sweep': {
      const period = def.periodSeconds ?? 8.0;
      const progress = (tSec % period) / period;
      // Linear sweep from -1 to +1 across window width
      const x = (progress * 2 - 1) * (def.amplitude ?? 100);
      const alpha = progress < 0.1 ? progress / 0.1 : progress > 0.9 ? (1 - progress) / 0.1 : 1.0;

      return {
        xOffset: x,
        yOffset: 0,
        rotation: 0,
        scaleOffset: 0,
        alphaOffset: alpha,
      };
    }

    case 'drift':
    default: {
      const speed = def.speed ?? 0.5;
      const amp = def.amplitude ?? 2.0;
      const driftX = Math.sin(2 * Math.PI * speed * tSec) * amp;
      const driftY = -Math.cos(2 * Math.PI * speed * tSec) * (amp * 0.5);

      return {
        xOffset: driftX,
        yOffset: driftY,
        rotation: 0,
        scaleOffset: 0,
        alphaOffset: 0,
      };
    }
  }
}
