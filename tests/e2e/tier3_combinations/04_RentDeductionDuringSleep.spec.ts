import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 3: Rent Deduction & Economy Progression During Sleep', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-RDS-01: Working shifts, managing cash, and paying rent across 7 days', async ({ page, sim, roomPage }) => {
    // 1. Work shifts to earn living cash
    await sim.earnCash(200, 'Shift wages');
    let state = await sim.getState();
    expect(state.player.cash).toBeGreaterThanOrEqual(238);

    // 2. Advance to Day 7
    await sim.jumpToDay(7);
    state = await sim.getState();
    expect(state.time.day).toBe(7);

    // 3. Pay motel rent ($140)
    await page.evaluate(() => {
      (window as any).__simStore.getState().payRent();
    });

    state = await sim.getState();
    expect(state.player.rentPaid).toBe(true);

    // 4. Sleep until Day 8
    await roomPage.sleepUntilMorning();
    state = await sim.getState();
    expect(state.time.day).toBeGreaterThanOrEqual(8);
  });
});
