// src/world/phaser/layeredRoom/softSurfaceMotion.ts
//
// Pure soft-surface sway math for the #167 layered starter-room spike.
// A hanging soft surface (curtain strip) is pinned at the top; a wave
// travels down the strip and its amplitude grows toward the free bottom
// edge. This is presentation math only — it mutates nothing and owns no
// simulation state. Phaser's Rope GameObject consumes the produced point
// array (points[i] = {x: offset, y: depth*i}) after each update.

export interface SoftSurfaceParams {
  /** Number of rope segments down the strip (>= 1). */
  segments: number;
  /** Strip length in scene pixels. */
  lengthPx: number;
  /** Base sway amplitude at the free edge, as a fraction of length (0..1). */
  amplitude: number;
  /** Oscillation frequency in Hz. */
  speed: number;
  /** Extra wind-driven amplitude at the free edge as a fraction of length. */
  windAmplitude?: number;
  /** Traveling-wave wavelength measured along the strip length. */
  wavelengthFactor?: number;
  /** Static phase offset so neighboring strips do not move in lockstep. */
  phaseOffset?: number;
}

export interface SoftSurfacePoint {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Envelope of the sway amplitude at normalized depth t (0 pinned top → 1
 * free bottom). Exported separately so tests and QA stats can assert the
 * pinning property (t = 0 always returns 0) without building a rope.
 */
export function softSurfaceAmplitudeEnvelope(t: number, maxAmplitudePx: number): number {
  const depth = clamp(t, 0, 1);
  return depth * depth * maxAmplitudePx;
}

/**
 * Produces the deformed rope points for one frame. Deterministic for a
 * given (timeMs, wind, params): same inputs, same output array.
 */
export function computeSoftSurfacePoints(
  params: SoftSurfaceParams,
  timeMs: number,
  windIntensity = 0,
): SoftSurfacePoint[] {
  const segments = Math.max(1, Math.floor(params.segments));
  const lengthPx = Math.max(1, params.lengthPx);
  const baseAmp = clamp(params.amplitude, 0, 1) * lengthPx;
  const windAmp = clamp(params.windAmplitude ?? 0.5 * params.amplitude, 0, 1) * lengthPx;
  const wind = clamp(windIntensity, 0, 1);
  const maxAmplitudePx = baseAmp + wind * windAmp;
  const frequency = Math.max(0, params.speed);
  const wavelength = Math.max(0.25, params.wavelengthFactor ?? 0.75);
  const phase = params.phaseOffset ?? 0;
  const timeSec = Math.max(0, timeMs) / 1000;

  const points: SoftSurfacePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wave = Math.sin(2 * Math.PI * (frequency * timeSec - t / wavelength) + phase);
    points.push({
      x: wave * softSurfaceAmplitudeEnvelope(t, maxAmplitudePx),
      y: t * lengthPx,
    });
  }
  return points;
}

/** Maximum absolute x-offset observed across the strip's current points. */
export function softSurfacePeakOffset(points: readonly SoftSurfacePoint[]): number {
  let peak = 0;
  for (const point of points) peak = Math.max(peak, Math.abs(point.x));
  return peak;
}
