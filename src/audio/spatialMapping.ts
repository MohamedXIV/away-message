// src/audio/spatialMapping.ts

import type { AudioOrientation3D, AudioPosition3D, ListenerOrientation } from './types';

/**
 * Maps 2D/2.5D viewport coordinates to pseudo-3D audio coordinates.
 *
 * Coordinates are mapped such that:
 * - Screen horizontal: Left (0) -> -1.0, Right (1) -> +1.0
 * - Screen vertical: Top (0) -> +1.0 (elevation/ceiling), Bottom (1) -> -1.0 (elevation/floor)
 * - Depth (z): -1.0 (rear / behind listener) to +1.0 (front / deep outside)
 */
export function mapViewCoordinatesToAudioPosition(
  x: number,
  y: number,
  z = 0,
  viewBounds?: { width: number; height: number },
): AudioPosition3D {
  let nx = x;
  let ny = y;

  if (viewBounds && viewBounds.width > 0 && viewBounds.height > 0) {
    nx = x / viewBounds.width;
    ny = y / viewBounds.height;
  }

  // Clamped normalized mappings
  const posX = Math.max(-1.0, Math.min(1.0, (nx - 0.5) * 2));
  // Invert y so 0 (top of screen) is ceiling (+1.0) and 1 (bottom) is floor (-1.0)
  const posY = Math.max(-1.0, Math.min(1.0, (0.5 - ny) * 2));
  const posZ = Math.max(-1.0, Math.min(1.0, z));

  return {
    x: Number(posX.toFixed(4)),
    y: Number(posY.toFixed(4)),
    z: Number(posZ.toFixed(4)),
  };
}

/**
 * Maps listener orientation names or angles into 3D unit vectors.
 */
export function mapOrientationNameToVector(orientation: ListenerOrientation): AudioOrientation3D {
  if (typeof orientation === 'string') {
    switch (orientation.toLowerCase()) {
      case 'left':
        return {
          forward: { x: -1, y: 0, z: 0 },
          up: { x: 0, y: 1, z: 0 },
        };
      case 'right':
        return {
          forward: { x: 1, y: 0, z: 0 },
          up: { x: 0, y: 1, z: 0 },
        };
      case 'back':
      case 'rear':
        return {
          forward: { x: 0, y: 0, z: -1 },
          up: { x: 0, y: 1, z: 0 },
        };
      case 'forward':
      default:
        return {
          forward: { x: 0, y: 0, z: 1 },
          up: { x: 0, y: 1, z: 0 },
        };
    }
  }

  // Numeric angle in degrees (0 = forward, 90 = right, 180 = back, 270 = left)
  const rad = (orientation * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  return {
    forward: {
      x: Math.abs(sin) < 1e-6 ? 0 : Number(sin.toFixed(4)),
      y: 0,
      z: Math.abs(cos) < 1e-6 ? 0 : Number(cos.toFixed(4)),
    },
    up: { x: 0, y: 1, z: 0 },
  };
}
