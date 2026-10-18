import { test, expect, type Page } from '@playwright/test';

// Issue #167 — Layered Living Starter-Room Phaser Spike.
//
// This spec is the browser evidence tier: it drives the real Phaser runtime
// in Chromium and reads the scene's own reporting back. Every assertion here
// is about HOW the room is shown (layers, masks, soft surfaces, weather
// presentation, fixture independence) and the outward semantic intents it
// emits — never about simulation truth.

interface RoomRuntimeStats {
  renderIdentity: number;
  layers: Record<string, number>;
  backdropPropIds: string[];
  propIds: string[];
  swapGroups: Record<string, { variants: string[]; active: string | null }>;
  hiddenPropIds: string[];
  ropes: {
    propId: string;
    segments: number;
    lengthPx: number;
    peakOffsetPx: number;
    frames: number;
    topPinned: boolean;
  }[];
  windowZones: number;
  maskedMembers: string[];
  masking: {
    renderer: 'webgl' | 'canvas' | 'other';
    stencilClipApplied: boolean;
    geometryMaskApplied: boolean;
  };
  streakEmitter: { exists: boolean; running: boolean };
  audioHandleCount: number;
}

interface SpikeStatus {
  placeId: string;
  viewId: string;
  timeOfDay: string;
  weather: string;
  lampOn: boolean;
  bedVariant: string;
  rugHidden: boolean;
  focus: string;
  windIntensity: number;
  minuteOfDay: number;
  mountKey: number;
  mounted: boolean;
  canvasCount: number;
  intents: { type: string; anchorId?: string; capability?: string }[];
  runtimeStats: RoomRuntimeStats | null;
  capabilities: Record<string, boolean> | null;
}

type SceneProbe = {
  getLayeredRoomRuntimeStats?(): RoomRuntimeStats;
  getCapabilityReport?(): Record<string, boolean>;
  getCurrentFocus?(): { x: number; y: number; zoom: number };
};

async function readSpikeState(page: Page): Promise<SpikeStatus> {
  const raw = await page.getByTestId('spike-status').getAttribute('data-state');
  if (!raw) throw new Error('Room spike status payload is unavailable');
  return JSON.parse(raw) as SpikeStatus;
}

async function readRoomStats(page: Page): Promise<RoomRuntimeStats> {
  const stats = await tryReadRoomStats(page);
  if (!stats) throw new Error('Room spike runtime stats are unavailable');
  return stats;
}

/**
 * expect.poll() re-throws a callback error instead of retrying, so every
 * polled read uses this null-returning variant and coalesces the result.
 */
async function tryReadRoomStats(page: Page): Promise<RoomRuntimeStats | null> {
  const raw = await page.getByTestId('spike-status').getAttribute('data-state');
  if (!raw) return null;
  const state = JSON.parse(raw) as SpikeStatus;
  return state.runtimeStats ?? null;
}

function evaluateScene<T>(page: Page, reader: (scene: SceneProbe) => T): Promise<T | null> {
  return page.evaluate((source: string) => {
    const runtime = (window as unknown as {
      __awayPhysicalWorldRuntime?: { getScene(): SceneProbe | null };
    }).__awayPhysicalWorldRuntime;
    const scene = runtime?.getScene();
    // eslint-disable-next-line no-new-func
    return scene ? (new Function('scene', `return (${source})(scene);`) as (s: SceneProbe) => T)(scene) : null;
  }, reader.toString());
}

async function clickSpikeControl(page: Page, testId: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  if (!box) throw new Error(`Room spike control '${testId}' has no clickable bounds`);
  // Real pointer event without Locator.click()'s repeated stability sampling:
  // the Phaser/headless loop can be slow even when the React overlay is
  // already clickable (same precedent as the CornerMart spec).
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function clickWorldAnchor(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId('phaser-container').locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Room spike canvas has no clickable bounds');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

async function currentFocus(page: Page): Promise<{ x: number; y: number; zoom: number } | null> {
  return evaluateScene(page, (scene) => scene.getCurrentFocus?.() ?? null);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `tests/screenshots/${name}.png` });
}

const COLD_MOUNT_TIMEOUT = 15_000;
// The lazy Phaser chunk plus WebGL boot on a cold dev server can exceed the
// default 5s expect.poll budget before the scene exposes itself, so the boot
// polls get their own wider headroom.
const COLD_POLL_TIMEOUT = 30_000;

async function bootRoomSpike(page: Page): Promise<void> {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/?fixture=room');
  await expect(page.getByTestId('physical-world-host')).toBeVisible({ timeout: COLD_MOUNT_TIMEOUT });
  await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible({ timeout: COLD_MOUNT_TIMEOUT });
  await expect(page.getByTestId('spike-status')).toBeVisible({ timeout: COLD_MOUNT_TIMEOUT });
  // One canvas, and the room prop graph actually built.
  await expect
    .poll(async () => (await readSpikeState(page)).canvasCount, { timeout: COLD_POLL_TIMEOUT })
    .toBe(1);
  await expect
    .poll(async () => (await tryReadRoomStats(page))?.propIds.length ?? -1, { timeout: COLD_POLL_TIMEOUT })
    .toBeGreaterThanOrEqual(17);
  expect(pageErrors).toEqual([]);
}

test.describe('Issue #167 layered living starter-room Phaser spike', () => {
  test('layers, masks, sways, weathers and swaps the room without repainting it', async ({ page }) => {
    // Headless Phaser scheduling can stretch wall time; keep a generous
    // budget while every individual assertion stays tight.
    test.setTimeout(120_000);
    await bootRoomSpike(page);

    const initial = await readSpikeState(page);
    expect(initial.placeId).toBe('room_spike_a');
    expect(initial.viewId).toBe('spike_room_view');
    expect(initial.minuteOfDay).toBe(720);

    // --- Layering: the backdrop sits in its own container, fixtures in the
    // room layers, and the room graph has a single identity so far.
    const stats = await readRoomStats(page);
    expect(stats.renderIdentity).toBe(1);
    expect(stats.layers.backdrop).toBe(3);
    expect(stats.backdropPropIds).toEqual(['spike_prop_exterior', 'spike_prop_tree_back', 'spike_prop_tree_mid']);
    expect(stats.layers.scenery).toBeGreaterThanOrEqual(9);
    expect(stats.propIds).toContain('spike_prop_glass');
    expect(stats.propIds).toContain('spike_prop_curtain');
    // Only the inactive swap member is hidden at boot.
    expect(stats.hiddenPropIds).toEqual(['spike_prop_bed_b']);

    // --- Masking: report exactly what the active renderer achieved. WebGL
    // must have applied the stencil clip; Canvas must have applied the
    // GeometryMask fallback. Anything else is a failure, not a silent pass.
    expect(['webgl', 'canvas']).toContain(stats.masking.renderer);
    if (stats.masking.renderer === 'webgl') {
      expect(stats.masking.stencilClipApplied).toBe(true);
      expect(stats.masking.geometryMaskApplied).toBe(false);
    } else {
      expect(stats.masking.geometryMaskApplied).toBe(true);
    }
    expect(stats.windowZones).toBe(1);
    expect(stats.maskedMembers).toContain('world-prop-spike_prop_glass');
    expect(stats.maskedMembers).toContain('world-soft-spike_prop_curtain');
    expect(stats.maskedMembers).toContain('room-window-streaks');

    // --- Soft surface: the curtain is a live vertex-driven rope, pinned at
    // the header, driven by the environment manager frame counter.
    const curtain = stats.ropes.find((rope) => rope.propId === 'spike_prop_curtain');
    expect(curtain).toBeDefined();
    expect(curtain!.segments).toBeGreaterThanOrEqual(2);
    expect(curtain!.lengthPx).toBeGreaterThan(100);
    expect(curtain!.topPinned).toBe(true);
    expect(curtain!.frames).toBeGreaterThan(0);
    expect(curtain!.peakOffsetPx).toBeGreaterThan(0);
    // Explicitly not a physics body: the runtime never registers Matter.
    const matterBodies = await page.evaluate(() => {
      const game = (window as unknown as {
        __awayPhysicalWorldRuntime?: { getScene(): { sys?: { game?: { physics?: { world?: { bodies?: unknown } } } } | null } };
      }).__awayPhysicalWorldRuntime?.getScene()?.sys?.game;
      return game?.physics?.world?.bodies ? 1 : 0;
    });
    expect(matterBodies).toBe(0);

    const capabilities = initial.capabilities;
    expect(capabilities).toMatchObject({
      layeredRoom: true,
      softSurfaceMotion: true,
      windowStencilMask: true,
      fixtureIndependence: true,
      hotspotInteraction: true,
      noDuplicateCanvas: true,
    });

    await capture(page, '167-room-day-clear');

    // --- Independent fixture swap: visibility only, same render identity.
    const audioHandlesBefore = stats.audioHandleCount;
    await clickSpikeControl(page, 'spike-bed-b');
    await expect.poll(async () => (await readSpikeState(page)).bedVariant).toBe('b');
    const swapped = await readRoomStats(page);
    expect(swapped.renderIdentity).toBe(1);
    expect(swapped.swapGroups.spike_bed).toEqual({ variants: ['a', 'b'], active: 'b' });
    expect(swapped.hiddenPropIds).toEqual(['spike_prop_bed_a']);
    expect(swapped.audioHandleCount).toBe(audioHandlesBefore);
    await capture(page, '167-room-bed-swap');

    // --- Runtime hide of a single fixture also stays visibility-only.
    await clickSpikeControl(page, 'spike-rug-toggle');
    await expect.poll(async () => (await readSpikeState(page)).rugHidden).toBe(true);
    const rugHidden = await readRoomStats(page);
    expect(rugHidden.renderIdentity).toBe(1);
    expect(rugHidden.hiddenPropIds).toContain('spike_prop_rug');
    await clickSpikeControl(page, 'spike-rug-toggle');
    await expect.poll(async () => (await readSpikeState(page)).rugHidden).toBe(false);

    // --- Lamp practical toggles the authored light without a rebuild.
    await clickSpikeControl(page, 'spike-lamp-toggle');
    await expect.poll(async () => (await readSpikeState(page)).lampOn).toBe(false);
    expect((await readRoomStats(page)).renderIdentity).toBe(1);
    await clickSpikeControl(page, 'spike-lamp-toggle');
    await expect.poll(async () => (await readSpikeState(page)).lampOn).toBe(true);

    // --- Weather: rain stays outside the glass. The window streak emitter
    // exists from boot but only emits while it rains.
    expect((await readRoomStats(page)).streakEmitter).toEqual({ exists: true, running: false });
    await clickSpikeControl(page, 'spike-weather-rain');
    await expect.poll(async () => (await readSpikeState(page)).weather).toBe('rain');
    await expect.poll(async () => (await tryReadRoomStats(page))?.streakEmitter.running ?? null).toBe(true);
    const rainStats = await readRoomStats(page);
    expect(rainStats.renderIdentity).toBe(1);
    const weatherLayers = await evaluateScene(page, (scene) => {
      const em = (scene as unknown as {
        getEnvironmentManager?(): {
          getWeatherLayerResolution?(): { backgroundRain: boolean; foregroundRain: boolean; windowDroplets: boolean };
        };
      }).getEnvironmentManager?.();
      return em?.getWeatherLayerResolution?.() ?? null;
    });
    // Interior rain: background + droplets at the window, never foreground.
    expect(weatherLayers).toMatchObject({ backgroundRain: true, foregroundRain: false, windowDroplets: true });
    await capture(page, '167-room-rain');
    await clickSpikeControl(page, 'spike-weather-clear');
    await expect.poll(async () => (await readSpikeState(page)).weather).toBe('clear');
    await expect.poll(async () => (await tryReadRoomStats(page))?.streakEmitter.running ?? null).toBe(false);

    // --- Wind drives the soft surface harder; still no rebuild.
    const calmPeak = (await readRoomStats(page)).ropes.find((rope) => rope.propId === 'spike_prop_curtain')!.peakOffsetPx;
    await page.getByTestId('spike-wind').fill('1');
    await expect.poll(async () => (await readSpikeState(page)).windIntensity).toBe(1);
    await page.waitForTimeout(1_500);
    const gusty = await readRoomStats(page);
    expect(gusty.renderIdentity).toBe(1);
    expect(gusty.ropes.find((rope) => rope.propId === 'spike_prop_curtain')!.peakOffsetPx).toBeGreaterThan(calmPeak);
    await page.getByTestId('spike-wind').fill('0.2');
    await expect.poll(async () => (await readSpikeState(page)).windIntensity).toBe(0.2);

    // --- Night presentation.
    await clickSpikeControl(page, 'spike-phase-night');
    await expect.poll(async () => (await readSpikeState(page)).timeOfDay).toBe('night');
    const night = await readSpikeState(page);
    expect(night.minuteOfDay).toBe(1320);
    expect((await readRoomStats(page)).renderIdentity).toBe(1);
    await capture(page, '167-room-night');
    await clickSpikeControl(page, 'spike-phase-day');
    await expect.poll(async () => (await readSpikeState(page)).timeOfDay).toBe('day');

    // --- Semantic interactions: canvas clicks on authored anchors emit
    // outward intents only (the harness records what Phaser sent).
    await clickWorldAnchor(page, 0.3125, 0.38);
    await expect
      .poll(async () => (await readSpikeState(page)).intents.filter((intent) => intent.type === 'INTERACTION'))
      .toEqual(expect.arrayContaining([
        { type: 'INTERACTION', anchorId: 'spike_anchor_window', capability: 'observe_window' },
      ]));
    await clickWorldAnchor(page, 0.944, 0.365);
    await expect
      .poll(async () => (await readSpikeState(page)).intents.filter((intent) => intent.type === 'INTERACTION'))
      .toEqual(expect.arrayContaining([
        { type: 'INTERACTION', anchorId: 'spike_anchor_door', capability: 'leave_room' },
      ]));
    // Hover noise never leaks into the outward intent log.
    expect((await readSpikeState(page)).intents.every((intent) => intent.type === 'INTERACTION')).toBe(true);

    // --- Focus transitions toward the window and back to the hero.
    await clickSpikeControl(page, 'spike-focus-window');
    await expect.poll(async () => (await readSpikeState(page)).focus).toBe('window');
    await expect.poll(async () => (await currentFocus(page))?.zoom).toBe(1.35);
    expect(await currentFocus(page)).toMatchObject({ x: 0.3125, y: 0.38, zoom: 1.35 });
    await clickSpikeControl(page, 'spike-focus-hero');
    await expect.poll(async () => (await currentFocus(page))?.zoom).toBe(1);
    expect((await readRoomStats(page)).renderIdentity).toBe(1);

    // --- One canvas the whole time; no duplicate surfaces or listeners.
    expect((await readSpikeState(page)).canvasCount).toBe(1);
  });

  test('repeats mount/unmount cycles with no duplicated canvas, listeners or ambient effects', async ({ page }) => {
    test.setTimeout(120_000);
    await bootRoomSpike(page);

    for (let cycle = 1; cycle <= 2; cycle += 1) {
      // Leave the world: the host cleanup must remove the canvas and the
      // exposed runtime entirely.
      await clickSpikeControl(page, 'spike-unmount');
      await expect(page.getByTestId('physical-world-host')).toHaveCount(0);
      await expect.poll(async () => (await readSpikeState(page)).canvasCount).toBe(0);
      const gone = await page.evaluate(() =>
        (window as unknown as { __awayPhysicalWorldRuntime?: unknown }).__awayPhysicalWorldRuntime === undefined);
      expect(gone).toBe(true);

      // Re-enter: exactly one canvas again and a fresh single-identity room.
      await clickSpikeControl(page, 'spike-reenter');
      await expect(page.getByTestId('physical-world-host')).toBeVisible();
      await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible();
      await expect.poll(async () => (await readSpikeState(page)).canvasCount).toBe(1);
      await expect
        .poll(async () => (await tryReadRoomStats(page))?.propIds.length ?? -1, { timeout: COLD_POLL_TIMEOUT })
        .toBeGreaterThanOrEqual(17);
      const stats = await readRoomStats(page);
      expect(stats.renderIdentity, `cycle ${cycle}: fresh scene starts at identity 1`).toBe(1);
      expect(stats.ropes.find((rope) => rope.propId === 'spike_prop_curtain')?.frames).toBeGreaterThan(0);
      expect(stats.streakEmitter.running).toBe(false);

      // Remount in place (keyed re-render) — still one canvas, one graph.
      await clickSpikeControl(page, 'spike-remount');
      await expect.poll(async () => (await readSpikeState(page)).mountKey).toBe(cycle);
      await expect(page.getByTestId('phaser-container').locator('canvas')).toHaveCount(1);
      await expect
        .poll(async () => (await tryReadRoomStats(page))?.propIds.length ?? -1, { timeout: COLD_POLL_TIMEOUT })
        .toBeGreaterThanOrEqual(17);
      expect((await readSpikeState(page)).canvasCount).toBe(1);
    }
  });
});
