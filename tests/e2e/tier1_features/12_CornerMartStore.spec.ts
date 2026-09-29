import { test, expect, type Page } from '@playwright/test';

interface StoreFixtureState {
  placeId: string;
  viewId: string;
  availableViews: number;
  timeOfDay: string;
  weather: string;
  focusFixtureId: string | null;
  sceneProps: string[];
  stockCount: number;
  unpaidCount: number;
  ownedCount: number;
  cashier: { talk: boolean; checkout: boolean };
  cash: number;
  actorCount: number;
  innerVoiceTopic: string | null;
  focusedStock: Array<{ slotId: string; itemInstanceId: string | null }>;
}

interface PropRuntimeStats {
  propCount: number;
  propNames: string[];
  angles: Record<string, number>;
}

async function readStoreState(page: Page): Promise<StoreFixtureState> {
  const raw = await page.getByTestId('corner-mart-status').getAttribute('data-state');
  if (!raw) throw new Error('CornerMart status payload is unavailable');
  return JSON.parse(raw) as StoreFixtureState;
}

async function readPropStats(page: Page): Promise<PropRuntimeStats> {
  return page.evaluate(() => {
    const runtime = (window as typeof window & {
      __awayPhysicalWorldRuntime?: {
        getScene(): { getScenePropRuntimeStats(): PropRuntimeStats } | null;
      };
    }).__awayPhysicalWorldRuntime;
    const scene = runtime?.getScene();
    if (!scene) throw new Error('CornerMart Phaser runtime is unavailable');
    return scene.getScenePropRuntimeStats();
  });
}

async function clickFixtureControl(page: Page, testId: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  if (!box) throw new Error(`CornerMart fixture control '${testId}' has no clickable bounds`);

  // Use a real pointer event without Locator.click()'s repeated actionability
  // stability sampling. The Phaser/headless loop can be intentionally slow
  // under Playwright even when the fixed React overlay itself is clickable.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function readCharacterPerf(page: Page): Promise<{
  sampleCount: number;
  averageUpdateMs: number;
  maxUpdateMs: number;
  actualFps: number;
}> {
  return page.evaluate(() => {
    const runtime = (window as typeof window & {
      __awayPhysicalWorldRuntime?: {
        getScene(): {
          getCharacterRuntimeStats(): {
            sampleCount: number;
            averageUpdateMs: number;
            maxUpdateMs: number;
            actualFps: number;
          };
        } | null;
      };
    }).__awayPhysicalWorldRuntime;
    const scene = runtime?.getScene();
    if (!scene) throw new Error('CornerMart Phaser runtime is unavailable');
    const stats = scene.getCharacterRuntimeStats();
    return {
      sampleCount: stats.sampleCount,
      averageUpdateMs: stats.averageUpdateMs,
      maxUpdateMs: stats.maxUpdateMs,
      actualFps: stats.actualFps,
    };
  });
}

test.describe('Issue #28 living CornerMart single-view proof', () => {
  test('keeps one hero view alive while focus, weather and shopping state change', async ({ page }) => {
    await page.goto('/?fixture=store');

    await expect(page.getByTestId('physical-world-host')).toBeVisible();
    await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible();
    await expect(page.getByTestId('corner-mart-status')).toBeVisible();

    await expect.poll(async () => (await readStoreState(page)).sceneProps).toContain('corner_mart_fan_prop');
    const initial = await readStoreState(page);
    expect(initial.placeId).toBe('place_b1');
    expect(initial.viewId).toBe('view_b1');
    expect(initial.availableViews).toBe(1);
    expect(initial.focusFixtureId).toBeNull();
    expect(initial.cashier).toEqual({ talk: true, checkout: false });
    expect(initial.actorCount).toBe(1);
    expect(initial.innerVoiceTopic).toBe('physical_shop_arrival');

    await expect(page.getByTestId('away-puppet-runtime-stats')).toContainText('Away Puppet: 1 actors', {
      timeout: 10_000,
    });

    const capabilities = await page.evaluate(() => {
      const runtime = (window as typeof window & {
        __awayPhysicalWorldRuntime?: {
          getScene(): { getCapabilityReport(): { normalMapLighting: boolean; ambientMotion: boolean; spatialAudio: boolean } } | null;
        };
      }).__awayPhysicalWorldRuntime;
      return runtime?.getScene()?.getCapabilityReport() ?? null;
    });
    expect(capabilities).toMatchObject({
      normalMapLighting: true,
      ambientMotion: true,
      spatialAudio: true,
    });

    await expect.poll(async () => (await readPropStats(page)).propCount, {
      timeout: 10_000,
      message: 'expected authored fan/window props to render through WorldScene',
    }).toBeGreaterThanOrEqual(2);
    const propBefore = await readPropStats(page);
    await page.waitForTimeout(500);
    const propAfter = await readPropStats(page);
    expect(propAfter.propNames).toContain('corner_mart_fan_prop');
    expect(propAfter.angles['corner_mart_fan_prop']).not.toBe(propBefore.angles['corner_mart_fan_prop']);

    await clickFixtureControl(page, 'corner-mart-phase-night');
    await clickFixtureControl(page, 'corner-mart-weather-rain');
    await clickFixtureControl(page, 'corner-mart-focus-fridge');

    await expect.poll(async () => (await readStoreState(page)).timeOfDay).toBe('night');
    await expect.poll(async () => (await readStoreState(page)).weather).toBe('rain');
    await expect.poll(async () => (await readStoreState(page)).focusFixtureId).toBe('corner_mart_fridge');

    const weatherLayers = await page.evaluate(() => {
      const runtime = (window as typeof window & {
        __awayPhysicalWorldRuntime?: {
          getScene(): {
            getEnvironmentManager(): {
              getWeatherLayerResolution(): {
                backgroundRain: boolean;
                foregroundRain: boolean;
                windowDroplets: boolean;
              } | null;
            } | undefined;
          } | null;
        };
      }).__awayPhysicalWorldRuntime;
      return runtime?.getScene()?.getEnvironmentManager()?.getWeatherLayerResolution() ?? null;
    });
    expect(weatherLayers).toMatchObject({
      backgroundRain: true,
      foregroundRain: false,
      windowDroplets: true,
    });

    const focus = await page.evaluate(() => {
      const runtime = (window as typeof window & {
        __awayPhysicalWorldRuntime?: {
          getScene(): { getCurrentFocus(): { x: number; y: number; zoom: number } } | null;
        };
      }).__awayPhysicalWorldRuntime;
      return runtime?.getScene()?.getCurrentFocus() ?? null;
    });
    expect(focus?.zoom).toBe(1.75);

    const cashBefore = (await readStoreState(page)).cash;
    const focusBeforeTake = await readStoreState(page);
    expect(focusBeforeTake.focusedStock.every((slot) => slot.itemInstanceId !== null)).toBe(true);

    await clickFixtureControl(page, 'corner-mart-take-item');
    await expect.poll(async () => (await readStoreState(page)).unpaidCount).toBe(1);
    const afterTake = await readStoreState(page);
    expect(afterTake.cashier.checkout).toBe(true);
    expect(afterTake.focusedStock.some((slot) => slot.itemInstanceId === null)).toBe(true);

    await clickFixtureControl(page, 'corner-mart-cashier');
    await expect.poll(async () => (await readStoreState(page)).unpaidCount).toBe(0);
    const paid = await readStoreState(page);
    expect(paid.ownedCount).toBe(1);
    expect(paid.cash).toBeLessThan(cashBefore);
    expect(paid.viewId).toBe('view_b1');

    const characterPerf = await readCharacterPerf(page);
    console.log('[corner-mart-browser]', JSON.stringify({
      state: paid,
      props: propAfter,
      characterPerf,
      perfNote:
        'average/max update ms measure character-renderer update cost; actualFps is Phaser game-loop scheduling in this browser environment',
    }));
  });
});
