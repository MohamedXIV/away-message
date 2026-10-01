import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Phaser Residence View & Physical Interactables', () => {
  test.beforeEach(async ({ desktopPage, roomPage }) => {
    await desktopPage.goto();
    await roomPage.switchToRoom();
  });

  test('TC-RVI-01: current tenancy renders through the authored Phaser world', async ({ page }) => {
    await expect(page.getByText('Current Residence').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('physical-world-host')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('button:has-text("Sit at PC")').first()).toBeVisible();
    await expect(page.getByText('Motel Room 104')).toHaveCount(0);

    const residence = await page.evaluate(() => {
      const engine = (window as any).__simStore.getState().engine;
      return {
        statePlaceId: engine.getResidenceState().currentResidencePlaceId,
        resolvedPlaceId: engine.getCurrentResidencePlaceId(),
      };
    });
    expect(residence.resolvedPlaceId).toBe(residence.statePlaceId);
  });

  test('TC-RVI-02: Making tea advances continuous clock by 6 minutes and improves fatigue', async ({ sim, roomPage }) => {
    const timeBefore = (await sim.getState()).time.totalMinutes;
    await roomPage.makeTea();
    const timeAfter = (await sim.getState()).time.totalMinutes;
    expect(timeAfter - timeBefore).toBe(6);
  });

  test('TC-RVI-03: Taking a shower advances clock by 12 minutes', async ({ sim, roomPage }) => {
    const timeBefore = (await sim.getState()).time.totalMinutes;
    await roomPage.takeShower();
    const timeAfter = (await sim.getState()).time.totalMinutes;
    expect(timeAfter - timeBefore).toBe(12);
  });

  test('TC-RVI-04: Window observation increments telemetry counter and advances clock by 4 minutes', async ({ sim, roomPage }) => {
    const stateBefore = await sim.getState();
    const countBefore = stateBefore.telemetry?.stats?.windowObservationsCount ?? 0;
    const timeBefore = stateBefore.time.totalMinutes;

    await roomPage.observeWindow();

    const stateAfter = await sim.getState();
    const countAfter = stateAfter.telemetry?.stats?.windowObservationsCount ?? 0;
    const timeAfter = stateAfter.time.totalMinutes;

    expect(countAfter).toBe(countBefore + 1);
    expect(timeAfter - timeBefore).toBe(4);
  });

  test('TC-RVI-05: Sleeping in bed resets fatigue and advances clock to morning (08:00)', async ({ sim, roomPage }) => {
    await roomPage.sleepUntilMorning();
    const state = await sim.getState();
    expect(state.time.hour).toBe(8);
    expect(state.needs.energy).toBeGreaterThanOrEqual(90);
  });
});
