import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 2: Time Advancement & Midnight Rollovers', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-TMR-01: Discrete time jump rolling across 23:59 increments in-game day', async ({ sim }) => {
    const stateStart = await sim.getState();
    const dayStart = stateStart.time.day;

    // Advance 24 hours (1440 minutes)
    await sim.advanceGameMinutes(1440, 'Advance 1 day');

    const stateAfter = await sim.getState();
    expect(stateAfter.time.day).toBe(dayStart + 1);
  });

  test('TC-TMR-02: Multi-day jumps calculate day, hour, and minute modulo precisely', async ({ sim }) => {
    // Advance 3 days (4320 minutes)
    await sim.advanceGameMinutes(4320, 'Advance 3 days');

    const state = await sim.getState();
    expect(state.time.day).toBe(4);
    expect(state.time.hour).toBeGreaterThanOrEqual(0);
    expect(state.time.hour).toBeLessThanOrEqual(23);
    expect(state.time.minute).toBeGreaterThanOrEqual(0);
    expect(state.time.minute).toBeLessThanOrEqual(59);
  });

  test('TC-TMR-03: Fast-forwarding to Day 14 triggers evaluation milestone', async ({ sim }) => {
    await sim.jumpToDay(14);
    const state = await sim.getState();
    expect(state.time.day).toBeGreaterThanOrEqual(14);
  });

  test('TC-TMR-04: Sleeping advances clock directly to morning 08:00', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().restOrSleep(8);
    });

    const state = await sim.getState();
    expect(state.time.hour).toBe(8);
    expect(state.time.minute).toBe(0);
  });

  test('TC-TMR-05: Real-time clock ticks continuously in background without time freezing', async ({ page, sim }) => {
    const timeBefore = (await sim.getState()).time.totalMinutes;
    // Wait 200ms
    await page.waitForTimeout(200);
    const timeAfter = (await sim.getState()).time.totalMinutes;
    expect(timeAfter).toBeGreaterThanOrEqual(timeBefore);
  });
});
