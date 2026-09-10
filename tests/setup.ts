import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '../src/persistence/db';

// Lightweight 2D canvas context mock for tests running under jsdom
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
  const dummyContext = {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: (_x: number, _y: number, w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4 || 16) }),
    putImageData: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    resetTransform: () => {},
  };

  if (!(window as any).CanvasRenderingContext2D) {
    (window as any).CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
  }

  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') return dummyContext as unknown as CanvasRenderingContext2D;
    return null;
  } as any;
}

beforeEach(async () => {
  // Clear fake-indexeddb tables before every unit/integration test for complete test isolation
  try {
    if (db) {
      await db.saves?.clear();
      await db.vfs_files?.clear();
      await db.downloads?.clear();
      await db.installed_software?.clear();
      await db.messages?.clear();
      await db.relationships?.clear();
      await db.narrative_state?.clear();
      await db.telemetry_logs?.clear();
      await db.ai_cache?.clear();
    }
  } catch {
    // Graceful fallback if tables are not initialized
  }
});
