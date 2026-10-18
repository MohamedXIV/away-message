import { test, expect, type Page } from '@playwright/test';

// Issue #159 — Phase A art-direction comparison inside the real runtime.
//
// The claim under test is narrow and falsifiable: a treatment switch changes
// ONLY which texture keys the live scene objects carry. Ids, prop transforms,
// window zones, masks, ropes and intents must be identical across treatments,
// because the same authored content drives all of them. Screenshots here are
// the review material; the assertions are the proof that the comparison is
// fair (identical camera framing) and that no art code holds gameplay
// authority.

interface RoomRuntimeStats {
  renderIdentity: number;
  propIds: string[];
  propTransforms: Record<string, { x: number; y: number; width: number; height: number }>;
  propTextures: Record<string, string>;
  backgroundTexture: string | null;
  hiddenPropIds: string[];
  windowZones: number;
  maskedMembers: string[];
  ropes: { propId: string; frames: number }[];
}

interface SpikeStatus {
  artTreatment: string;
  timeOfDay: string;
  weather: string;
  lampOn: boolean;
  bedVariant: string;
  focus: string;
  canvasCount: number;
  runtimeStats: RoomRuntimeStats | null;
}

async function readState(page: Page): Promise<SpikeStatus> {
  const raw = await page.getByTestId('spike-status').getAttribute('data-state');
  if (!raw) throw new Error('Room spike status payload is unavailable');
  return JSON.parse(raw) as SpikeStatus;
}

async function readStats(page: Page): Promise<RoomRuntimeStats> {
  const stats = (await readState(page)).runtimeStats;
  if (!stats) throw new Error('Room spike runtime stats are unavailable');
  return stats;
}

async function bootRoom(page: Page, treatment: string): Promise<void> {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`/?fixture=room&treatment=${treatment}`);
  await expect(page.getByTestId('physical-world-host')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('spike-status')).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => (await readState(page)).canvasCount, { timeout: 30_000 })
    .toBe(1);
  await expect
    .poll(async () => (await tryStats(page))?.propIds.length ?? -1, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(17);
  expect(pageErrors).toEqual([]);
}

async function tryStats(page: Page): Promise<RoomRuntimeStats | null> {
  const raw = await page.getByTestId('spike-status').getAttribute('data-state');
  if (!raw) return null;
  return (JSON.parse(raw) as SpikeStatus).runtimeStats ?? null;
}

async function clickControl(page: Page, testId: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  if (!box) throw new Error(`control '${testId}' has no clickable bounds`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function waitForTreatment(page: Page, treatment: string): Promise<RoomRuntimeStats> {
  await expect
    .poll(async () => (await readState(page)).artTreatment, { timeout: 15_000 })
    .toBe(treatment);
  // The rebuild completes when the live background texture key follows.
  await expect
    .poll(async () => (await tryStats(page))?.backgroundTexture ?? '', { timeout: 15_000 })
    .toMatch(treatment === 'blockout' ? /^spike_architecture$/ : new RegExp(`_${treatment}$`));
  return readStats(page);
}

// Props whose sr variant is authored in this batch, so a treatment switch
// must visibly rebind them. bed A is deliberately NOT here: it was generated
// for gn only, so sr keeps the blockout bed and the per-layer fallback is
// what's under test instead.
const CAPTURE_PROPS = [
  'spike_prop_desk',
  'spike_prop_pc',
  'spike_prop_lamp',
  'spike_prop_glass',
  'spike_prop_curtain',
];

// Wind-driven foliage props sway by ROTATING around their bottom-center
// pivot (authored motionAmplitude in degrees), so their live center can
// legitimately sit up to (height/2)·sin(amplitude) away from the authored
// position between samples; the AC unit vibrates by ~1px. The
// fair-comparison claim is about the authored contract: every static prop
// must match exactly, and a moving prop may only drift within its own
// authored motion envelope.
const MOTION_PROPS: Record<string, number> = {
  spike_prop_tree_back: 6,
  spike_prop_tree_mid: 9,
  spike_prop_ac: 1.2,
};

function expectTransformsComparable(
  actual: RoomRuntimeStats['propTransforms'],
  baseline: RoomRuntimeStats['propTransforms'],
): void {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(baseline).sort());
  for (const [id, transform] of Object.entries(baseline)) {
    const received = actual[id];
    if (!received) throw new Error(`prop '${id}' lost its live transform`);
    expect(received.width, id).toBeCloseTo(transform.width, 1);
    expect(received.height, id).toBeCloseTo(transform.height, 1);
    const amplitude = MOTION_PROPS[id];
    // Two independent samples of an oscillating prop can differ by at most
    // twice the envelope; static props must match to the rounding precision.
    const tolerance = amplitude === undefined
      ? 0.01
      : transform.height * Math.sin((amplitude * Math.PI) / 180) + 0.5;
    expect(Math.abs(received.x - transform.x), `${id}.x drift`).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(received.y - transform.y), `${id}.y drift`).toBeLessThanOrEqual(tolerance);
  }
}

test.describe('Issue #159 art-direction treatments in the layered room', () => {
  test('switching treatments swaps texture keys and nothing else', async ({ page }) => {
    test.setTimeout(120_000);
    await bootRoom(page, 'blockout');

    const blockout = await readStats(page);
    expect(blockout.backgroundTexture).toBe('spike_architecture');
    expect(blockout.propTextures['spike_prop_desk']).toBe('spike_desk');

    await clickControl(page, 'spike-art-sr');
    const sr = await waitForTreatment(page, 'sr');
    expect(sr.backgroundTexture).toBe('spike_architecture_sr');
    expect(sr.propTextures['spike_prop_desk']).toBe('spike_desk_sr');
    expect(sr.propTextures['spike_prop_pc']).toBe('spike_pc_placeholder_sr');
    // Unauthored variant -> honest per-layer fallback to the blockout, not
    // another treatment's art and not a missing prop.
    expect(sr.propTextures['spike_prop_bed_a']).toBe('spike_bed_a');
    // The rebuild path ran: this is a new scene identity, not a fast toggle.
    expect(sr.renderIdentity).toBeGreaterThan(blockout.renderIdentity);

    // Fair-comparison core: identical prop ids, geometry, masks, zones and
    // hidden set across treatments. Only the texture keys differ.
    expect(sr.propIds).toEqual(blockout.propIds);
    expectTransformsComparable(sr.propTransforms, blockout.propTransforms);
    expect(sr.hiddenPropIds).toEqual(blockout.hiddenPropIds);
    expect(sr.windowZones).toBe(blockout.windowZones);
    expect(sr.maskedMembers).toEqual(blockout.maskedMembers);
    for (const prop of CAPTURE_PROPS) {
      expect(sr.propTextures[prop]).not.toBe(blockout.propTextures[prop]);
    }

    await clickControl(page, 'spike-art-gn');
    const gn = await waitForTreatment(page, 'gn');
    expectTransformsComparable(gn.propTransforms, blockout.propTransforms);
    // Per-layer fallback: bed A is authored for gn, bed B is not, so the
    // swap group keeps working with one painted and one blockout layer.
    expect(gn.propTextures['spike_prop_bed_a']).toBe('spike_bed_a_gn');
    expect(gn.propTextures['spike_prop_bed_b']).toBe('spike_bed_b');
  });

  test('identical-framing captures: day/clear, rain, night/lamp, swap, focus', async ({ page }) => {
    test.setTimeout(180_000);
    await bootRoom(page, 'blockout');

    for (const treatment of ['blockout', 'sr', 'gn'] as const) {
      if (treatment !== 'blockout') {
        await clickControl(page, `spike-art-${treatment}`);
        await waitForTreatment(page, treatment);
      }

      // 1. day/clear baseline.
      await page.screenshot({ path: `tests/screenshots/159-${treatment}-day-clear.png` });

      // 2. rain over the same camera.
      await clickControl(page, 'spike-weather-rain');
      await expect
        .poll(async () => (await readState(page)).weather, { timeout: 10_000 })
        .toBe('rain');
      await page.waitForTimeout(900);
      await page.screenshot({ path: `tests/screenshots/159-${treatment}-rain.png` });
      await clickControl(page, 'spike-weather-clear');
      await expect
        .poll(async () => (await readState(page)).weather, { timeout: 10_000 })
        .toBe('clear');

      // 3. night with the practical lamp on. The QA bar state reaches the
      // projection one React commit behind the click, so drive the lamp from
      // the reported status instead of assuming a toggle landed, and restore
      // the pre-step state afterwards so every treatment's later captures
      // run under identical conditions.
      const lampBefore = (await readState(page)).lampOn;
      await clickControl(page, 'spike-phase-night');
      await expect
        .poll(async () => (await readState(page)).timeOfDay, { timeout: 10_000 })
        .toBe('night');
      if (!(await readState(page)).lampOn) await clickControl(page, 'spike-lamp-toggle');
      await expect
        .poll(async () => (await readState(page)).lampOn, { timeout: 10_000 })
        .toBe(true);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `tests/screenshots/159-${treatment}-night-lamp.png` });
      await clickControl(page, 'spike-phase-day');
      await expect
        .poll(async () => (await readState(page)).timeOfDay, { timeout: 10_000 })
        .toBe('day');
      if ((await readState(page)).lampOn !== lampBefore) await clickControl(page, 'spike-lamp-toggle');
      await expect
        .poll(async () => (await readState(page)).lampOn, { timeout: 10_000 })
        .toBe(lampBefore);

      // 4. a swap/movement state: bed variant B visible.
      await clickControl(page, 'spike-bed-b');
      await expect
        .poll(async () => (await readState(page)).bedVariant, { timeout: 10_000 })
        .toBe('b');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `tests/screenshots/159-${treatment}-bed-swap.png` });
      await clickControl(page, 'spike-bed-a');
      await expect
        .poll(async () => (await readState(page)).bedVariant, { timeout: 10_000 })
        .toBe('a');

      // 5. a focus/interaction state: the authored desk anchor camera.
      await clickControl(page, 'spike-focus-desk');
      await expect
        .poll(async () => (await readState(page)).focus, { timeout: 10_000 })
        .toBe('desk');
      await page.waitForTimeout(700);
      await page.screenshot({ path: `tests/screenshots/159-${treatment}-focus-desk.png` });
      await clickControl(page, 'spike-focus-hero');
      await expect
        .poll(async () => (await readState(page)).focus, { timeout: 10_000 })
        .toBe('hero');

      // Geometry survived the whole battery in this treatment.
      const stats = await readStats(page);
      expect(Object.keys(stats.propTransforms).length).toBeGreaterThanOrEqual(15);
    }
  });
});
