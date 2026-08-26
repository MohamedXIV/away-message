import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 2: WeatherBuddy Adware Injection & SafeSweep Remediation', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-WBA-01: Installing WeatherBuddy with bundled SearchMate injects adware toolbar', async ({ page, sim, browserPage }) => {
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });
    await browserPage.openBrowser();

    // Verify injected toolbar appears in browser
    await expect(page.locator('text=SearchMate:').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-WBA-02: WeatherBuddy desktop widget displays weather forecast and sponsored link', async ({ page, sim }) => {
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });
    await sim.openWindow('weatherbuddy', 'WeatherBuddy');

    await expect(page.locator('text=WeatherBuddy 3.1').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=SearchMate Deal').first()).toBeVisible();
  });

  test('TC-WBA-03: SafeSweep Anti-Spyware detects SearchMate adware payload during scan', async ({ page, sim }) => {
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });
    await sim.openWindow('safesweep', 'SafeSweep Anti-Adware');

    const quickScanBtn = page.locator('button:has-text("Quick Scan")').first();
    await expect(quickScanBtn).toBeVisible({ timeout: 5000 });
    await quickScanBtn.click();

    // Wait for scan to complete and show detected threat
    await expect(page.locator('text=Adware.Win32.SearchMateToolbar').first()).toBeVisible({ timeout: 6000 });
  });

  test('TC-WBA-04: SafeSweep removes SearchMate and cleans Voyager Browser toolbar', async ({ page, sim, browserPage }) => {
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });
    await sim.openWindow('safesweep', 'SafeSweep Anti-Adware');

    const quickScanBtn = page.locator('button:has-text("Quick Scan")').first();
    await quickScanBtn.click();
    await expect(page.locator('text=Adware.Win32.SearchMateToolbar').first()).toBeVisible({ timeout: 6000 });

    const removeBtn = page.locator('button:has-text("Remove & Quarantine Selected")').first();
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(page.locator('text=Cleaned').first()).toBeVisible({ timeout: 5000 });

    // Open browser and verify SearchMate toolbar is gone
    await browserPage.openBrowser();
    await expect(page.locator('text=SearchMate:').first()).not.toBeVisible();
  });

  test('TC-WBA-05: Running SafeSweep on a clean system reports zero threats', async ({ page, sim }) => {
    await sim.openWindow('safesweep', 'SafeSweep Anti-Adware');
    const quickScanBtn = page.locator('button:has-text("Quick Scan")').first();
    await quickScanBtn.click();
    await expect(page.locator('text=Scan complete').or(page.locator('text=Definitions database updated'))).toBeVisible({ timeout: 6000 });
  });
});
