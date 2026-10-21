// tests/unit/LayeredRoomSoftSurfaceMotion.test.ts
//
// Issue #167 — soft-surface sway math. Pure module: no Phaser, no engine.

import { describe, expect, it } from 'vitest';
import {
  computeSoftSurfacePoints,
  softSurfaceAmplitudeEnvelope,
  softSurfacePeakOffset,
  type SoftSurfaceParams,
} from '../../src/world/phaser/layeredRoom/softSurfaceMotion';

const params: SoftSurfaceParams = {
  segments: 15,
  lengthPx: 380,
  amplitude: 0.05,
  speed: 1.4,
  windAmplitude: 0.025,
  phaseOffset: 0,
};

describe('soft surface motion (Phaser Rope driving data, never Matter cloth)', () => {
  it('is deterministic for identical inputs', () => {
    const a = computeSoftSurfacePoints(params, 1234, 0.3);
    const b = computeSoftSurfacePoints(params, 1234, 0.3);
    expect(a).toEqual(b);
  });

  it('pins the header at zero offset for every time and wind value', () => {
    for (const time of [0, 37, 981, 12_345]) {
      for (const wind of [0, 0.35, 1]) {
        const points = computeSoftSurfacePoints(params, time, wind);
        expect(Math.abs(points[0]!.x)).toBe(0);
      }
    }
    expect(softSurfaceAmplitudeEnvelope(0, 100)).toBe(0);
  });

  it('grows amplitude toward the free edge (quadratic envelope)', () => {
    expect(softSurfaceAmplitudeEnvelope(0.5, 100)).toBeCloseTo(25);
    expect(softSurfaceAmplitudeEnvelope(1, 100)).toBeCloseTo(100);
    const points = computeSoftSurfacePoints({ ...params, speed: 0 }, 0, 0);
    // Wave travels down the strip: depth spacing is exact pixel steps.
    expect(points).toHaveLength(params.segments + 1);
    points.forEach((point, index) => {
      expect(point.y).toBeCloseTo((index / params.segments) * params.lengthPx, 6);
    });
  });

  it('scales the free-edge offset with amplitude and boosts it with wind', () => {
    const calm = computeSoftSurfacePoints(params, 67, 0);
    const gusty = computeSoftSurfacePoints(params, 67, 1);
    const calmPeak = softSurfacePeakOffset(calm);
    const gustyPeak = softSurfacePeakOffset(gusty);
    expect(calmPeak).toBeGreaterThan(0);
    expect(gustyPeak).toBeGreaterThanOrEqual(calmPeak);
    // Every offset stays inside the envelope limit (base + wind amplitude),
    // and the free edge carries meaningful motion rather than a static strip.
    expect(calmPeak).toBeLessThanOrEqual(params.amplitude * params.lengthPx + 1e-9);
    expect(gustyPeak).toBeLessThanOrEqual((params.amplitude + params.windAmplitude!) * params.lengthPx + 1e-9);
    expect(Math.abs(calm[calm.length - 1]!.x)).toBeGreaterThan(0.5);
    expect(Math.abs(gusty[gusty.length - 1]!.x)).toBeGreaterThan(Math.abs(calm[calm.length - 1]!.x));
  });

  it('oscillates over time rather than displacing monotonically', () => {
    const signs = new Set<string>();
    for (let t = 0; t < 1000; t += 41) {
      const points = computeSoftSurfacePoints(params, t, 0.2);
      const bottom = points[points.length - 1]!.x;
      if (bottom > 0.5) signs.add('+');
      if (bottom < -0.5) signs.add('-');
    }
    expect([...signs].sort()).toEqual(['+', '-']);
  });

  it('clamps degenerate inputs instead of producing NaN geometry', () => {
    const points = computeSoftSurfacePoints(
      { segments: 0, lengthPx: 0, amplitude: 5, speed: -2 },
      -100,
      5,
    );
    expect(points.length).toBeGreaterThan(1);
    expect(Math.abs(points[0]!.x)).toBe(0);
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(softSurfacePeakOffset(points)).toBeLessThanOrEqual(2 + 1e-9);
    }
  });
});
