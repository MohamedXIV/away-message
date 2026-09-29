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

    await expect.poll(async () => (await readPropStats(page)).propCount, {
      timeout: 10_000,
      message: 'expected authored fan/window props to render through WorldScene',
    }).toBeGreaterThanOrEqual(2);
    const propBefore = await readPropStats(page);
    await page.waitForTimeout(500);
    const propAfter = await readPropStats(page);
    expect(propAfter.propNames).toContain('corner_mart_fan_prop');
    expect(propAfter.angles['corner_mart_fan_prop']).not.toBe(propBefore.angles['corner_mart_fan_prop']);

    await page.getByTestId('corner-mart-phase-night').click();
    await page.getByTestId('corner-mart-weather-rain').click();
    await page.getByTestId('corner-mart-focus-fridge').click();

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
    await page.getByTestId('corner-mart-take-item').click();
    await expect.poll(async () => (await readStoreState(page)).unpaidCount).toBe(1);
    expect((await readStoreState(page)).cashier.checkout).toBe(true);

    await page.getByTestId('corner-mart-cashier').click();
    await expect.poll(async () => (await readStoreState(page)).unpaidCount).toBe(0);
    const paid = await readStoreState(page);
    expect(paid.ownedCount).toBe(1);
    expect(paid.cash).toBeLessThan(cashBefore);
    expect(paid.viewId).toBe('view_b1');

    console.log('[corner-mart-browser]', JSON.stringify({
      state: paid,
      props: propAfter,
    }));
  });
});
