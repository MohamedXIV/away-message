import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 2: Rent Failure & Economy Boundaries', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-RFE-01: Insufficient funds on rent day does not crash the simulation', async ({ sim }) => {
    // Spend down player cash to $0
    const currentCash = (await sim.getState()).player.cash;
    await sim.spendCash(currentCash, 'Exhaust funds');
    expect((await sim.getState()).player.cash).toBe(0);

    // Fast-forward to rent due day (Day 7)
    await sim.jumpToDay(7);

    const state = await sim.getState();
    expect(state.time.day).toBe(7);
    expect(state.player.cash).toBe(0);
  });

  test('TC-RFE-02: Working shifts recovers bankrupt cash balance to positive', async ({ page, sim }) => {
    const currentCash = (await sim.getState()).player.cash;
    await sim.spendCash(currentCash, 'Exhaust funds');

    // Work a shift
    await page.evaluate(() => {
      (window as any).__simStore.getState().workShift(240, 62);
    });

    const state = await sim.getState();
    expect(state.player.cash).toBe(62);
  });

  test('TC-RFE-03: Multiple work shifts accumulate lifetime earned money telemetry', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().workShift(240, 62);
      (window as any).__simStore.getState().workShift(240, 62);
    });

    const state = await sim.getState();
    expect(state.telemetry.stats.workShiftsCompleted).toBeGreaterThanOrEqual(2);
    expect(state.telemetry.stats.totalMoneyEarned).toBeGreaterThanOrEqual(124);
  });

  test('TC-RFE-04: Excess spending is clamped and does not generate NaN', async ({ sim }) => {
    await sim.spendCash(500, 'Overspend attempt');
    const state = await sim.getState();
    expect(isNaN(state.player.cash)).toBe(false);
  });

  test('TC-RFE-05: Paying rent when funds are sufficient marks rent paid', async ({ page, sim }) => {
    await sim.earnCash(200, 'Work wage');
    await page.evaluate(() => {
      (window as any).__simStore.getState().payRent();
    });
    const state = await sim.getState();
    expect(state.player.rentPaid).toBe(true);
  });
});
