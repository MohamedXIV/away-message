import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Dial-up & Connection Simulation', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-DUC-01: System Tray shows initial DSL connection status', async ({ page }) => {
    // Verify system tray network monitor has initial DSL 256k speed
    await expect(page.locator('div[title*="256 kbps"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-DUC-02: Upgrading connection type updates simulation state and speed', async ({ page, sim }) => {
    await sim.upgradeConnection('dsl_1m', 0);
    const state = await sim.getState();
    expect(state.hardware.connectionType).toBe('dsl_1m');
    expect(state.hardware.connectionSpeedKbps).toBe(1024);

    // Verify UI reflects 1M DSL in tray tooltip
    await expect(page.locator('div[title*="1024 kbps"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-DUC-03: Switching to dial-up connection updates speed to 56k', async ({ page, sim }) => {
    await sim.upgradeConnection('dialup_56k', 0);
    const state = await sim.getState();
    expect(state.hardware.connectionType).toBe('dialup_56k');
    expect(state.hardware.connectionSpeedKbps).toBe(56);

    await expect(page.locator('div[title*="56 kbps"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-DUC-04: Dial-up modal can be opened from Start Menu', async ({ page, desktopPage }) => {
    await desktopPage.openStartMenu();
    const dialupItem = page.locator('button:has-text("Dial-up Connection")').first();
    await expect(dialupItem).toBeVisible({ timeout: 5000 });
    await dialupItem.click();
    await expect(page.locator('text=Connect OrionNet Dial-Up').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-DUC-05: Hardware state tracks bandwidth allocation accurately', async ({ sim }) => {
    const state = await sim.getState();
    expect(state.hardware.connectionSpeedKbps).toBeGreaterThan(0);
  });
});
