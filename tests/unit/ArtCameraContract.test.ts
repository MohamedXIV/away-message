// Issue #159: source-level guard against drift between authored room geometry
// and the art compositor's 1600x900 openings, runnable without Python/ImageGen.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rect = { x: number; y: number; w: number; h: number };
type Store = {
  anchors: Record<string, { x: number; y: number }>;
  sceneProps: Record<string, { anchorId: string; width: number; height: number }>;
};
type Manifest = {
  frame: { width: number; height: number };
  openings: { window: Rect; door: Rect };
};

const root = join(__dirname, '../..');
const store = JSON.parse(readFileSync(join(root, 'content/store.json'), 'utf8')) as Store;
const manifest = JSON.parse(readFileSync(join(root, 'tools/art/treatments.json'), 'utf8')) as Manifest;

function authoredRect(propId: string): Rect {
  const prop = store.sceneProps[propId];
  if (!prop) throw new Error(`Unknown scene prop ${propId}`);
  const anchor = store.anchors[prop.anchorId];
  if (!anchor) throw new Error(`Unknown anchor ${prop.anchorId} for ${propId}`);
  const w = prop.width * manifest.frame.width;
  const h = prop.height * manifest.frame.height;
  return { x: anchor.x * manifest.frame.width - w / 2, y: anchor.y * manifest.frame.height - h / 2, w, h };
}

function maxRectDelta(a: Rect, b: Rect): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
}

describe('Issue #159 authored camera / compositor geometry contract', () => {
  it('uses the authored 1600x900 reference frame', () => {
    expect(manifest.frame).toEqual({ width: 1600, height: 900 });
  });

  it('matches the window opening to the runtime glass/window-zone geometry', () => {
    // Authored dimensions round to subpixel units (0.418 * 900 = 376.2).
    expect(maxRectDelta(authoredRect('spike_prop_glass'), manifest.openings.window)).toBeLessThanOrEqual(0.5);
  });

  it('keeps the preexisting door-panel/opening mismatch explicitly bounded', () => {
    const panel = authoredRect('spike_prop_door');
    const hole = manifest.openings.door;
    // The #167 reference has the door panel ~9.5 px below the wall cutout.
    // This is a known visual-acceptance gap, NOT evidence of exact alignment;
    // fail if geometry drifts further until the production-art pass resolves it.
    expect(Math.abs(panel.x - hole.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(panel.y - hole.y)).toBeLessThanOrEqual(11);
    expect(Math.abs(panel.w - hole.w)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(panel.h - hole.h)).toBeLessThanOrEqual(0.5);
  });

  it('would catch an authored window move without a matching new opening', () => {
    const rect = authoredRect('spike_prop_glass');
    expect(maxRectDelta({ ...rect, x: rect.x + 5 }, manifest.openings.window)).toBeGreaterThan(0.5);
  });
});
