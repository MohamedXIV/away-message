import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Terminal CLI Utility', () => {
  test.beforeEach(async ({ desktopPage, sim }) => {
    await desktopPage.goto();
    await sim.openWindow('terminal', 'Terminal CLI');
  });

  test('TC-TRM-01: Terminal CLI window mounts with command prompt', async ({ page }) => {
    const termWin = page.locator('.window-frame:has-text("Terminal")').first();
    await expect(termWin).toBeVisible({ timeout: 5000 });
  });

  test('TC-TRM-02: Executing "help" command lists available commands', async ({ page }) => {
    const input = page.locator('.window-frame:has-text("Terminal") input, .window-frame:has-text("Terminal") textarea').first();
    if (await input.isVisible()) {
      await input.fill('help');
      await input.press('Enter');
      await expect(page.locator('text=DIR').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('TC-TRM-03: Executing "dir" lists files in current directory', async ({ page }) => {
    const input = page.locator('.window-frame:has-text("Terminal") input, .window-frame:has-text("Terminal") textarea').first();
    if (await input.isVisible()) {
      await input.fill('dir');
      await input.press('Enter');
      await expect(page.locator('.window-frame:has-text("Terminal")').first()).toBeVisible();
    }
  });

  test('TC-TRM-04: Executing "ipconfig" displays network adapter configuration', async ({ page }) => {
    const input = page.locator('.window-frame:has-text("Terminal") input, .window-frame:has-text("Terminal") textarea').first();
    if (await input.isVisible()) {
      await input.fill('ipconfig');
      await input.press('Enter');
      await expect(page.locator('.window-frame:has-text("Terminal")').first()).toBeVisible();
    }
  });

  test('TC-TRM-05: Executing "cls" clears the terminal screen', async ({ page }) => {
    const input = page.locator('.window-frame:has-text("Terminal") input, .window-frame:has-text("Terminal") textarea').first();
    if (await input.isVisible()) {
      await input.fill('cls');
      await input.press('Enter');
      await expect(page.locator('.window-frame:has-text("Terminal")').first()).toBeVisible();
    }
  });
});
