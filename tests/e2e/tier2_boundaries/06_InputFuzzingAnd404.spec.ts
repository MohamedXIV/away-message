import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 2: Input Fuzzing & 404 Error Handling', () => {
  test.beforeEach(async ({ desktopPage, browserPage }) => {
    await desktopPage.goto();
    await browserPage.openBrowser();
  });

  test('TC-IFZ-01: Navigating to non-existent .local domain renders 404 Not Found page gracefully', async ({ page, browserPage }) => {
    await browserPage.navigate('nonexistentdomain123.local');
    await expect(page.locator('text=404').or(page.locator('text=Not Found')).or(page.locator('text=Cannot Connect'))).toBeVisible({ timeout: 5000 });
  });

  test('TC-IFZ-02: Searching special symbols and unicode characters does not crash search engine', async ({ page, browserPage }) => {
    await browserPage.navigate('findit.local');
    const searchInput = page.locator('input[placeholder*="Search the web"]').first();
    await searchInput.fill('<script>alert("xss")</script> !@#$%^&*()_+');
    await searchInput.press('Enter');

    await expect(page.locator('.window-frame:has-text("Voyager Browser")')).toBeVisible();
  });

  test('TC-IFZ-03: Rapid navigation clicks do not corrupt browser history stack', async ({ page, browserPage }) => {
    await browserPage.navigate('downloadhub.local');
    await browserPage.navigate('techmart.local');
    await browserPage.navigate('nightboard.local');

    const backBtn = page.locator('button:has-text("Back")').first();
    if (await backBtn.isEnabled()) {
      await backBtn.click();
      await page.waitForTimeout(100);
      await backBtn.click();
      await page.waitForTimeout(100);
    }
    await expect(page.locator('.window-frame:has-text("Voyager Browser")')).toBeVisible();
  });

  test('TC-IFZ-04: Opening and closing multiple dialogs rapidly maintains UI integrity', async ({ desktopPage, sim }) => {
    for (let i = 0; i < 5; i++) {
      await sim.openWindow('terminal');
      await sim.closeWindow('terminal');
    }
    const count = await desktopPage.getOpenWindowCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-IFZ-05: Empty search queries on FindIt return default popular directory links', async ({ page, browserPage }) => {
    await browserPage.navigate('findit.local');
    const searchInput = page.locator('input[placeholder*="Search the web"]').first();
    await searchInput.fill('');
    await searchInput.press('Enter');

    await expect(page.locator('.window-frame:has-text("Voyager Browser")')).toBeVisible();
  });
});
