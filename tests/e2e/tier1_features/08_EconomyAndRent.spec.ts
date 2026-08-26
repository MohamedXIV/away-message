import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Economy & Rent System', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-ECO-01: Player starts with initial cash balance ($38.00)', async ({ sim }) => {
    const state = await sim.getState();
    expect(state.player.cash).toBe(38);
  });

  test('TC-ECO-02: Working food cart shift grants cash wage and depletes energy', async ({ page, sim }) => {
    const stateBefore = await sim.getState();
    const cashBefore = stateBefore.player.cash;
    const energyBefore = stateBefore.player.energy;

    await page.evaluate(() => {
      (window as any).__simStore.getState().workShift(240, 62);
    });

    const stateAfter = await sim.getState();
    expect(stateAfter.player.cash).toBe(cashBefore + 62);
    expect(stateAfter.player.energy).toBeLessThan(energyBefore);
    expect(stateAfter.telemetry.stats.workShiftsCompleted).toBe(1);
    expect(stateAfter.telemetry.stats.totalMoneyEarned).toBe(62);
  });

  test('TC-ECO-03: Paying motel rent deducts rent amount and marks rent paid', async ({ page, sim }) => {
    // Give enough cash
    await sim.earnCash(200, 'Shift wages');
    const cashBefore = (await sim.getState()).player.cash;

    const rentAmount = (await sim.getState()).player.rentAmount;
    await page.evaluate(() => {
      (window as any).__simStore.getState().payRent();
    });

    const stateAfter = await sim.getState();
    expect(stateAfter.player.cash).toBe(cashBefore - rentAmount);
    expect(stateAfter.player.rentPaid).toBe(true);
  });

  test('TC-ECO-04: Purchasing hardware or software deducts exact cash amount', async ({ sim }) => {
    await sim.earnCash(100, 'Bonus');
    const cashBefore = (await sim.getState()).player.cash;

    await sim.spendCash(45, 'High-Density 512MB RAM Module');
    const cashAfter = (await sim.getState()).player.cash;
    expect(cashAfter).toBe(cashBefore - 45);
  });

  test('TC-ECO-05: HUD displays updated cash balance in real time', async ({ page, sim, roomPage }) => {
    await sim.earnCash(150, 'Shift wage');
    await roomPage.switchToRoom();
    await expect(page.locator('text=$188.00').first()).toBeVisible({ timeout: 5000 });
  });
});
