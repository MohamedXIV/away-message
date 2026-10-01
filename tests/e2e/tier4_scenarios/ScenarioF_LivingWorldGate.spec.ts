import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 4: Scenario F — Living-world integration gate (#29)', () => {
  test('current tenancy, canonical player context, and Phaser presentation stay composed', async ({
    page,
    desktopPage,
    roomPage,
  }) => {
    test.setTimeout(60_000);

    await desktopPage.goto();
    await roomPage.switchToRoom();

    await expect(page.getByText('Current Residence').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('physical-world-host')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Motel Room 104')).toHaveCount(0);

    const initial = await page.evaluate(() => {
      const store = (window as any).__simStore.getState();
      const engine = store.engine;
      const residence = engine.getResidenceState();
      const environment = engine.gameContext.environment.current();
      const needs = engine.gameContext.player.needs();
      const mood = engine.gameContext.player.mood();

      return {
        activeView: store.activeView,
        residencePlaceId: residence.currentResidencePlaceId,
        resolvedHomePlaceId: engine.getCurrentResidencePlaceId(),
        environment: {
          atMinute: environment.atMinute,
          condition: environment.weather.condition,
          precipitation: environment.weather.precipitation,
          wind: environment.weather.wind,
          visibility: environment.weather.visibility,
          sourceEventIds: [...environment.sourceEventIds],
        },
        needs: {
          energy: needs.energy,
          hunger: needs.hunger,
          socialBattery: needs.socialBattery,
        },
        mood: {
          band: mood.band,
          value: mood.value,
        },
      };
    });

    expect(initial.activeView).toBe('room');
    expect(initial.residencePlaceId).toBe(initial.resolvedHomePlaceId);
    expect(initial.residencePlaceId).toBeTruthy();
    expect(initial.environment.atMinute).toBeGreaterThanOrEqual(0);
    expect(initial.environment.precipitation).toBeGreaterThanOrEqual(0);
    expect(initial.environment.precipitation).toBeLessThanOrEqual(1);
    expect(initial.environment.wind).toBeGreaterThanOrEqual(0);
    expect(initial.environment.wind).toBeLessThanOrEqual(1);
    expect(initial.environment.visibility).toBeGreaterThanOrEqual(0);
    expect(initial.environment.visibility).toBeLessThanOrEqual(1);
    expect(initial.needs.energy).toBeGreaterThanOrEqual(0);
    expect(initial.needs.energy).toBeLessThanOrEqual(100);
    expect(initial.mood.band).toMatch(/^(miserable|low|neutral|good|great)$/);

    const clockBefore = initial.environment.atMinute;
    await page.evaluate(() => {
      (window as any).__simStore.getState().advanceTime(7, 'living-world browser gate');
    });

    await expect.poll(async () => page.evaluate(() => {
      const engine = (window as any).__simStore.getState().engine;
      return engine.gameContext.environment.current().atMinute;
    })).toBeGreaterThan(clockBefore);

    const after = await page.evaluate(() => {
      const store = (window as any).__simStore.getState();
      const engine = store.engine;
      return {
        residencePlaceId: engine.getResidenceState().currentResidencePlaceId,
        resolvedHomePlaceId: engine.getCurrentResidencePlaceId(),
        needs: engine.gameContext.player.needs(),
        mood: engine.gameContext.player.mood(),
      };
    });

    expect(after.residencePlaceId).toBe(initial.residencePlaceId);
    expect(after.resolvedHomePlaceId).toBe(initial.resolvedHomePlaceId);
    expect(after.needs.energy).toBeLessThanOrEqual(initial.needs.energy);
    expect(after.mood.value).toBeGreaterThanOrEqual(0);
    expect(after.mood.value).toBeLessThanOrEqual(100);

    // The physical renderer remains mounted after semantic simulation updates.
    await expect(page.getByTestId('physical-world-host')).toBeVisible();
    await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible();
  });
});
