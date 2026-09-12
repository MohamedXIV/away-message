// src/world/phaser/technicalFixture.ts

import type * as Phaser from 'phaser';
import { createWorldSceneProjection } from './presentationAdapter';
import type { WorldSceneProjection } from './types';

/**
 * Creates an in-memory HTMLCanvasElement with authored drawing operations.
 */
export function createProceduralCanvas(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, width, height);
  return canvas;
}

/**
 * Procedural background for technical fixture (Layer 0 - Background)
 */
export function createFixtureBackgroundCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(1600, 900, (ctx, w, h) => {
    // Wall gradient (2005 cozy teal/cream)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    wallGrad.addColorStop(0, '#2d3844');
    wallGrad.addColorStop(1, '#4a5b6e');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h * 0.7);

    // Wallpaper horizontal molding band
    ctx.fillStyle = '#1e2630';
    ctx.fillRect(0, h * 0.68, w, h * 0.02);

    // Floor (hardwood boards)
    const floorGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    floorGrad.addColorStop(0, '#543b27');
    floorGrad.addColorStop(1, '#2c1e13');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    // Floor board planks
    ctx.strokeStyle = '#3d2919';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.7);
      ctx.lineTo(x - 80, h);
      ctx.stroke();
    }

    // Window on the left (showing outdoor sky & rainy street silhouette)
    const winX = 120;
    const winY = 100;
    const winW = 340;
    const winH = 460;

    // Window frame
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(winX - 12, winY - 12, winW + 24, winH + 24);

    // Outdoor glass
    const glassGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
    glassGrad.addColorStop(0, '#5a7088');
    glassGrad.addColorStop(1, '#2a3442');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // Window sill / mullions
    ctx.fillStyle = '#2d333b';
    ctx.fillRect(winX + winW / 2 - 4, winY, 8, winH);
    ctx.fillRect(winX, winY + winH / 2 - 4, winW, 8);
  });
}

/**
 * Procedural scenery/desk canvas (Layer 1 - Midground Scenery)
 */
export function createFixtureDeskCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(900, 400, (ctx, w, h) => {
    // Desk surface
    const deskGrad = ctx.createLinearGradient(0, 0, 0, h);
    deskGrad.addColorStop(0, '#8c6544');
    deskGrad.addColorStop(1, '#4a331f');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, 50, w, h - 50);

    // Desk bevel highlight
    ctx.fillStyle = '#b58861';
    ctx.fillRect(0, 50, w, 8);

    // Desk legs
    ctx.fillStyle = '#261b11';
    ctx.fillRect(40, 180, 40, h - 180);
    ctx.fillRect(w - 80, 180, 40, h - 180);

    // CRT Monitor base & shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(w * 0.45, 140, 160, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Desk lamp fixture on right
    ctx.fillStyle = '#222831';
    ctx.beginPath();
    ctx.arc(w * 0.8, 120, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#daa520';
    ctx.fillRect(w * 0.79, 40, 8, 80);
  });
}

/**
 * Procedural diffuse texture for #51 generated asset 'asset_a1' (Wall Medallion / Clock)
 */
export function createFixtureAssetA1Canvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(256, 256, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = 110;

    // Outer drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(cx + 6, cy + 8, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer bronze ring
    const ringGrad = ctx.createRadialGradient(cx - 20, cy - 20, 20, cx, cy, r);
    ringGrad.addColorStop(0, '#d4af37');
    ringGrad.addColorStop(0.7, '#8c6b1b');
    ringGrad.addColorStop(1, '#473507');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner dial face
    ctx.fillStyle = '#1c222b';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 24, 0, Math.PI * 2);
    ctx.fill();

    // Radial hour ticks
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const x1 = cx + Math.cos(angle) * (r - 42);
      const y1 = cy + Math.sin(angle) * (r - 42);
      const x2 = cx + Math.cos(angle) * (r - 28);
      const y2 = cy + Math.sin(angle) * (r - 28);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Center boss & hands
    ctx.fillStyle = '#ffdf78';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffdf78';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 55); // Hour hand pointing up
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 45, cy + 20); // Minute hand
    ctx.stroke();
  });
}

/**
 * Procedural tangent-space normal map for #51 generated asset 'asset_a1_n'
 * Encodes surface normal vectors (nx, ny, nz) into RGB:
 *   R = (nx + 1) * 127.5
 *   G = (ny + 1) * 127.5
 *   B = (nz + 1) * 127.5
 * Flat surface: (0, 0, 1) -> RGB(128, 128, 255)
 */
export function createFixtureAssetA1NormalMapCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(256, 256, (ctx, w, h) => {
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    const cx = w / 2;
    const cy = h / 2;
    const outerR = 110;
    const innerR = outerR - 24;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let nx = 0;
        let ny = 0;
        let nz = 1;

        if (dist <= outerR && dist >= innerR) {
          // Outer beveled ring: slopes upward toward center of ring band
          const bandCenter = (outerR + innerR) / 2;
          const bandHalfWidth = (outerR - innerR) / 2;
          const slope = (bandCenter - dist) / bandHalfWidth; // -1 at outer, +1 at inner
          const radX = dist > 0 ? dx / dist : 0;
          const radY = dist > 0 ? dy / dist : 0;

          nx = radX * slope * 0.8;
          ny = radY * slope * 0.8;
          const lenSq = nx * nx + ny * ny;
          nz = Math.sqrt(Math.max(0.1, 1 - lenSq));
        } else if (dist < innerR && dist > 20) {
          // Subtle dish depression on the face
          const dishNorm = (dist / innerR) * 0.25;
          nx = (dx / dist) * dishNorm;
          ny = (dy / dist) * dishNorm;
          nz = Math.sqrt(Math.max(0.1, 1 - (nx * nx + ny * ny)));
        } else if (dist <= 20) {
          // Center dome
          const domeX = dx / 20;
          const domeY = dy / 20;
          const domeLenSq = domeX * domeX + domeY * domeY;
          if (domeLenSq <= 1) {
            nx = domeX * 0.8;
            ny = domeY * 0.8;
            nz = Math.sqrt(1 - (nx * nx + ny * ny));
          }
        }

        // Normalize vector
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;

        // Convert [-1, 1] to [0, 255]
        data[idx] = Math.round((nx + 1) * 127.5);
        data[idx + 1] = Math.round((ny + 1) * 127.5);
        data[idx + 2] = Math.round((nz + 1) * 127.5);
        data[idx + 3] = dist <= outerR + 2 ? 255 : 0; // Alpha
      }
    }

    ctx.putImageData(imgData, 0, 0);
  });
}

/**
 * Procedural particle textures (dust motes & rain streaks)
 */
export function createFixtureMoteCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(16, 16, (ctx, w, h) => {
    const rad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
    rad.addColorStop(0, 'rgba(255, 250, 220, 0.9)');
    rad.addColorStop(0.5, 'rgba(255, 230, 180, 0.4)');
    rad.addColorStop(1, 'rgba(255, 230, 180, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  });
}

export function createFixtureRainCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(4, 24, (ctx, _w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(180, 210, 240, 0.1)');
    grad.addColorStop(0.7, 'rgba(210, 235, 255, 0.7)');
    grad.addColorStop(1, 'rgba(240, 250, 255, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(1, 0, 2, h);
  });
}

/**
 * Procedural curtain canvas for ambient sway motion
 */
export function createFixtureCurtainCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(80, 420, (ctx, w, h) => {
    // Folded warm burgundy fabric with vertical pleats
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#581c25');
    grad.addColorStop(0.3, '#7a2d39');
    grad.addColorStop(0.7, '#42141c');
    grad.addColorStop(1, '#66222c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Vertical pleat shadow lines
    ctx.strokeStyle = 'rgba(20, 6, 8, 0.5)';
    ctx.lineWidth = 2;
    for (let x = 15; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  });
}

/**
 * Procedural clock hand canvas for ambient rotation motion
 */
export function createFixtureClockHandCanvas(): HTMLCanvasElement | null {
  return createProceduralCanvas(16, 80, (ctx) => {
    ctx.fillStyle = '#ffdf78';
    ctx.beginPath();
    ctx.arc(8, 70, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffea9f';
    ctx.beginPath();
    ctx.moveTo(6, 70);
    ctx.lineTo(8, 10);
    ctx.lineTo(10, 70);
    ctx.closePath();
    ctx.fill();
  });
}

/**
 * Registers all fixture procedural textures into a Phaser Scene if not already loaded.
 */
export function ensureFixtureTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (!textures) return;

  // 1. Background
  if (!textures.exists('fixture_bg')) {
    const bgCanvas = createFixtureBackgroundCanvas();
    if (bgCanvas) textures.addCanvas('fixture_bg', bgCanvas);
  }

  // 2. Desk
  if (!textures.exists('fixture_desk')) {
    const deskCanvas = createFixtureDeskCanvas();
    if (deskCanvas) textures.addCanvas('fixture_desk', deskCanvas);
  }

  // 3. Asset A1 (Diffuse) & Asset A1_N (Normal Map)
  if (!textures.exists('asset_a1')) {
    const diffuseCanvas = createFixtureAssetA1Canvas();
    if (diffuseCanvas) {
      const tex = textures.addCanvas('asset_a1', diffuseCanvas);
      // Generate and associate normal map
      const normalCanvas = createFixtureAssetA1NormalMapCanvas();
      if (normalCanvas) {
        textures.addCanvas('asset_a1_n', normalCanvas);
        const texAny = tex as unknown as { setDataSource?: (src: unknown) => void };
        if (typeof texAny?.setDataSource === 'function') {
          texAny.setDataSource(normalCanvas);
        }
      }
    }
  }

  // 4. Particles
  if (!textures.exists('fixture_mote')) {
    const moteCanvas = createFixtureMoteCanvas();
    if (moteCanvas) textures.addCanvas('fixture_mote', moteCanvas);
  }

  if (!textures.exists('fixture_rain')) {
    const rainCanvas = createFixtureRainCanvas();
    if (rainCanvas) textures.addCanvas('fixture_rain', rainCanvas);
  }

  // 5. Ambient Motion Textures
  if (!textures.exists('fixture_curtain')) {
    const curtainCanvas = createFixtureCurtainCanvas();
    if (curtainCanvas) textures.addCanvas('fixture_curtain', curtainCanvas);
  }

  if (!textures.exists('fixture_clock_hand')) {
    const handCanvas = createFixtureClockHandCanvas();
    if (handCanvas) textures.addCanvas('fixture_clock_hand', handCanvas);
  }
}

import type { CreateProjectionOptions } from './presentationAdapter';

/**
 * Default projection for the Technical Fixture showcasing living environment capabilities
 */
export function createTechnicalFixtureProjection(
  overrides: Partial<CreateProjectionOptions> = {}
): WorldSceneProjection {
  return createWorldSceneProjection({
    placeId: 'place_a1',
    viewId: 'view_a1',
    timeOfDay: 'evening',
    minuteOfDay: 1170, // 19:30 Dusk/Evening
    weather: 'clear',
    windIntensity: 0.35,
    isInterior: true,
    customLights: [
      {
        id: 'desk_lamp',
        x: 0.65,
        y: 0.55,
        radius: 380,
        color: '#ffe090',
        intensity: 1.8,
        movable: true,
      },
      {
        id: 'window_ambient',
        x: 0.22,
        y: 0.35,
        radius: 420,
        color: '#7ea4c9',
        intensity: 0.9,
        movable: false,
      },
    ],
    authoredLights: [
      {
        id: 'desk_lamp',
        kind: 'lamp',
        x: 0.65,
        y: 0.55,
        radius: 380,
        color: '#ffe090',
        baseIntensity: 1.8,
        flicker: {
          type: 'subtle',
          frequency: 3,
          amplitude: 0.05,
        },
        movable: true,
      },
      {
        id: 'window_exterior',
        kind: 'window',
        x: 0.22,
        y: 0.35,
        radius: 420,
        color: '#7ea4c9',
        baseIntensity: 0.9,
        isExterior: true,
      },
      {
        id: 'neon_sign',
        kind: 'neon',
        x: 0.82,
        y: 0.15,
        radius: 180,
        color: '#38bdf8',
        baseIntensity: 0.8,
        flicker: {
          type: 'neon',
          frequency: 7,
          amplitude: 0.12,
        },
      },
    ],
    ambientMotions: [
      {
        id: 'motion_clock',
        targetName: 'fixture_clock_hand',
        type: 'rotation',
        speed: 12, // 12 deg / sec
      },
      {
        id: 'motion_curtain',
        targetName: 'fixture_curtain',
        type: 'sway',
        speed: 0.8,
        amplitude: 5,
        windFactor: 2.5,
      },
      {
        id: 'motion_desk',
        targetName: 'fixture_desk',
        type: 'vibration',
        speed: 24,
        amplitude: 0.3,
      },
    ],
    puddleZones: [
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
    ],
    spatialAudioSources: [
      {
        id: 'fixture_clock_tick',
        eventId: 'device.clock_tick',
        x: 0.68,
        y: 0.35,
        z: 0.1,
        loop: true,
        volume: 0.35,
        bus: 'ambience',
        attachedTargetName: 'fixture_clock_hand',
      },
      {
        id: 'fixture_lamp_buzz',
        eventId: 'device.lamp_buzz',
        x: 0.65,
        y: 0.55,
        z: 0.2,
        loop: true,
        volume: 0.25,
        bus: 'ambience',
        attachedTargetName: 'desk_lamp',
      },
      {
        id: 'fixture_window_weather',
        eventId: 'ambience.weather.rain',
        x: 0.22,
        y: 0.35,
        z: 0.8,
        loop: true,
        volume: 0.5,
        bus: 'ambience',
        attachedTargetName: 'window_exterior',
      },
    ],
    listenerOrientation: 'forward',
    ...overrides,
  });
}
