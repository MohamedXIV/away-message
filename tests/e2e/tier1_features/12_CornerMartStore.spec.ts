import { test, expect, type Page } from '@playwright/test';

interface StoreFixtureState {
  placeId: string;
  viewId: string;
  availableViews: number;
  timeOfDay: string;
  weather: string;
  focusFixtureId: string | null;
  sceneProps: string[];
  weatherWindowZones: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  cashierAnchorActorId: string | null;
  venueCashierAssignment: {
    actorId: string;
    roleId: string;
    stationId: string | null;
    status: string;
  } | null;
  stockCount: number;
  unpaidCount: number;
  ownedCount: number;
  cashier: { talk: boolean; checkout: boolean };
  cashierIdentity: { actorId: string; displayName: string; handle: string } | null;
  cashierPresence: {
    physical: { kind: string; placeId?: string };
    availability: { canInteractInPerson: boolean };
  } | null;
  activeSocialTarget: {
    actorId: string;
    sceneContext: string;
    personaSuffix: string;
  } | null;
  chatBusy: boolean;
  chatHistory: Array<{
    senderId: string;
    recipientId: string;
    text: string;
    tags: string[];
  }>;
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

async function clickWorldAnchor(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId('phaser-container').locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('CornerMart canvas has no clickable bounds');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

async function readCharacterPerf(page: Page): Promise<{
  actorCount: number;
  visibleSurfaceCount: number;
  meshCount: number;
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
            actorCount: number;
            visibleSurfaceCount: number;
            meshCount: number;
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
      actorCount: stats.actorCount,
      visibleSurfaceCount: stats.visibleSurfaceCount,
      meshCount: stats.meshCount,
      sampleCount: stats.sampleCount,
      averageUpdateMs: stats.averageUpdateMs,
      maxUpdateMs: stats.maxUpdateMs,
      actualFps: stats.actualFps,
    };
  });
}

test.describe('Issue #28 living CornerMart single-view proof', () => {
  test('keeps one hero view alive while focus, weather and shopping state change', async ({ page }) => {
    // Local Chromium/Playwright headless runs have ranged from ~45s to the
    // edge of 60s even while headed Chromium stays near 60 FPS. Keep a bounded
    // 90s test budget as scheduling margin; individual assertions remain tight.
    test.setTimeout(90_000);
    await page.goto('/?fixture=store');

    // Clean-server mounts have crossed the default 5s assertion budget
    // (~5.0s observed), so give only the cold-mount checks wider headroom.
    const coldMountTimeout = 15_000;
    await expect(page.getByTestId('physical-world-host')).toBeVisible({ timeout: coldMountTimeout });
    await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible({ timeout: coldMountTimeout });
    await expect(page.getByTestId('corner-mart-status')).toBeVisible({ timeout: coldMountTimeout });
    await expect(page.getByTestId('world-fixture-controls')).toHaveCount(0);
    const qaBar = await page.getByTestId('corner-mart-qa-bar').boundingBox();
    expect(qaBar).not.toBeNull();
    expect(qaBar!.height).toBeLessThan(120);

    await expect.poll(async () => (await readStoreState(page)).sceneProps).toContain('corner_mart_fan_prop');
    const initial = await readStoreState(page);
    expect(initial.placeId).toBe('place_b1');
    expect(initial.viewId).toBe('view_b1');
    expect(initial.availableViews).toBe(1);
    expect(initial.focusFixtureId).toBeNull();
    expect(initial.cashier).toEqual({ talk: true, checkout: false });
    expect(initial.actorCount).toBe(1);
    expect(initial.innerVoiceTopic).toBe('physical_shop_arrival');
    expect(initial.cashierAnchorActorId).toBe('corner_mart_cashier');
    expect(initial.venueCashierAssignment).toMatchObject({
      actorId: 'corner_mart_cashier',
      roleId: 'fixture_cashier_role',
      stationId: 'fixture_shop_staff_station',
      status: 'active',
    });
    expect(initial.cashierIdentity).toEqual({
      actorId: 'corner_mart_cashier',
      displayName: 'Casey',
      handle: 'casey_counter',
    });
    expect(initial.cashierPresence?.availability.canInteractInPerson).toBe(true);
    expect(initial.cashierPresence?.physical).toEqual({
      kind: 'at_place',
      placeId: 'place_b1',
    });
    expect(initial.weatherWindowZones).toHaveLength(1);
    expect(initial.weatherWindowZones[0]).toMatchObject({
      id: 'corner_mart_window_prop',
      width: 0.055,
      height: 0.333,
    });

    await expect.poll(async () => (await readCharacterPerf(page)).actorCount, {
      timeout: 10_000,
      message: 'expected engine-backed cashier renderer to mount',
    }).toBe(1);
    await expect.poll(async () => (await readCharacterPerf(page)).visibleSurfaceCount, {
      timeout: 10_000,
      message: 'expected the mounted cashier puppet surface to become visible',
    }).toBe(1);

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

    // Hit the actual authored cashier hotspot in the Phaser canvas. This proves
    // anchor -> actorId -> world intent -> social target rather than bypassing
    // the world interaction path through a QA-only button.
    await clickWorldAnchor(page, 0.72, 0.67);
    await expect.poll(async () => (await readStoreState(page)).activeSocialTarget?.actorId)
      .toBe('corner_mart_cashier');
    const talkState = await readStoreState(page);
    expect(talkState.activeSocialTarget?.sceneContext).toContain('In-person meeting at CornerMart');
    expect(talkState.activeSocialTarget?.sceneContext).toContain('front counter');
    expect(talkState.activeSocialTarget?.sceneContext).not.toContain('stock');
    expect(talkState.activeSocialTarget?.personaSuffix).toContain('physically present');
    await expect(page.getByTestId('corner-mart-physical-chat')).toBeVisible();

    await page.getByTestId('corner-mart-chat-input').fill('long night?');
    await clickFixtureControl(page, 'corner-mart-chat-send');
    await expect.poll(async () => (await readStoreState(page)).chatHistory.length, {
      timeout: 15_000,
      message: 'expected player line and cashier reply in canonical SocialEngine history',
    }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await readStoreState(page)).chatBusy).toBe(false);

    const chatted = await readStoreState(page);
    const recentChat = chatted.chatHistory.slice(-2);
    expect(recentChat[0]).toMatchObject({
      senderId: 'player',
      recipientId: 'corner_mart_cashier',
      text: 'long night?',
    });
    expect(recentChat[0]?.tags).toContain('physical-chat');
    expect(recentChat[1]?.senderId).toBe('corner_mart_cashier');
    expect(recentChat[1]?.recipientId).toBe('player');
    expect(recentChat[1]?.text.trim().length).toBeGreaterThan(0);
    expect(recentChat[1]?.tags).toContain('physical-chat');
    await expect(page.getByTestId('corner-mart-chat-history')).toContainText('long night?');

    const cashBefore = chatted.cash;
    const focusBeforeTake = chatted;
    expect(focusBeforeTake.focusedStock.every((slot) => slot.itemInstanceId !== null)).toBe(true);

    await clickFixtureControl(page, 'corner-mart-take-item');
    await expect.poll(async () => (await readStoreState(page)).unpaidCount).toBe(1);
    const afterTake = await readStoreState(page);
    expect(afterTake.cashier.checkout).toBe(true);
    expect(afterTake.focusedStock.some((slot) => slot.itemInstanceId === null)).toBe(true);

    await expect(page.getByTestId('corner-mart-checkout')).toBeEnabled();
    await clickFixtureControl(page, 'corner-mart-checkout');
    await expect.poll(async () => (await readStoreState(page)).unpaidCount).toBe(0);
    const paid = await readStoreState(page);
    expect(paid.ownedCount).toBe(1);
    expect(paid.cash).toBeLessThan(cashBefore);
    expect(paid.viewId).toBe('view_b1');

    const characterPerf = await readCharacterPerf(page);
    console.log('[corner-mart-browser]', JSON.stringify({
      state: paid,
      chatHistory: paid.chatHistory,
      props: propAfter,
      characterPerf,
      perfNote:
        'average/max update ms measure character-renderer update cost; actualFps is Phaser game.loop.actualFps for this local Chromium/Playwright headless run and may reflect headless scheduling rather than renderer cost',
    }));
  });
});
