import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 3: Adware Toolbar Infection & SafeSweep Cleanup Lifecycle', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-ATB-01: Full adware lifecycle: Infection -> Toolbar Injected -> SafeSweep Remediation -> Clean Browser', async ({ page, sim, browserPage }) => {
    // 1. Install WeatherBuddy with bundled SearchMate toolbar
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });

    // 2. Open Voyager Browser -> Verify SearchMate toolbar is present
    await browserPage.openBrowser();
    await expect(page.locator('text=SearchMate:').first()).toBeVisible({ timeout: 5000 });

    // 3. Launch SafeSweep Anti-Spyware
    await sim.openWindow('safesweep', 'SafeSweep Anti-Adware');
    const quickScanBtn = page.locator('button:has-text("Quick Scan")').first();
    await expect(quickScanBtn).toBeVisible({ timeout: 5000 });
    await quickScanBtn.click();

    // 4. Wait for threat detection
    await expect(page.locator('text=Adware.Win32.SearchMateToolbar').first()).toBeVisible({ timeout: 6000 });

    // 5. Remove threat
    const cleanBtn = page.locator('button:has-text("Remove & Quarantine Selected")').first();
    await expect(cleanBtn).toBeVisible();
    await cleanBtn.click();
    await expect(page.locator('text=Cleaned').first()).toBeVisible({ timeout: 5000 });

    // 6. Return to Browser -> Verify toolbar is cleaned
    await browserPage.openBrowser();
    await expect(page.locator('text=SearchMate:').first()).not.toBeVisible();
  });
});
