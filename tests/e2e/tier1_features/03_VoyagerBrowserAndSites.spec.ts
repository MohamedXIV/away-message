import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Voyager Browser & Fake Internet Sites', () => {
  test.beforeEach(async ({ desktopPage, browserPage }) => {
    await desktopPage.goto();
    await browserPage.openBrowser();
  });

  test('TC-VBS-01: Default homepage loads FindIt web search', async ({ page }) => {
    await expect(page.locator('text=FindIt').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=The Premier Directory & Crawler').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-VBS-02: Navigating to downloadhub.local renders software directory', async ({ page, browserPage }) => {
    await browserPage.navigate('downloadhub.local');
    await expect(page.locator('text=DownloadHub').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Pulse Messenger').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=RetroAmp Audio Player').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-VBS-03: Navigating to techmart.local renders computer parts catalog', async ({ page, browserPage }) => {
    await browserPage.navigate('techmart.local');
    await expect(page.locator('text=TechMart').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=512MB High-Density RAM Module').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-VBS-04: Navigating to nightboard.local renders community message board', async ({ page, browserPage }) => {
    await browserPage.navigate('nightboard.local');
    await expect(page.locator('text=NightBoard').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Infrastructure & Audio Forensics').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-VBS-05: Free-text search on FindIt queries indexed content', async ({ page, browserPage }) => {
    await browserPage.navigate('findit.local');
    const searchInput = page.locator('input[placeholder*="Search the web"]').first();
    await searchInput.fill('messenger');
    await searchInput.press('Enter');

    await expect(page.locator('text=Results 1 -').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Pulse Messenger').first()).toBeVisible({ timeout: 5000 });
  });
});
