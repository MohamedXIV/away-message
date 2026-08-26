import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 4: Scenario B — Software Literacy & Adware Remediation', () => {
  test('Scenario B: Install bundled adware, observe browser infection, and sanitize with SafeSweep', async ({ page, desktopPage, browserPage, sim }) => {
    // 1. Initial State: Clean desktop & browser
    await desktopPage.goto();
    await browserPage.openBrowser();
    await expect(page.locator('text=SearchMate:')).not.toBeVisible();

    // 2. Install WeatherBuddy with SearchMate bundled option checked
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });

    // 3. Open Voyager Browser -> Notice injected SearchMate toolbar
    await browserPage.openBrowser();
    await expect(page.locator('text=SearchMate:').first()).toBeVisible({ timeout: 5000 });

    // 4. Launch SafeSweep Anti-Spyware utility
    await sim.openWindow('safesweep', 'SafeSweep Anti-Adware');
    const scanBtn = page.locator('button:has-text("Quick Scan")').first();
    await expect(scanBtn).toBeVisible({ timeout: 5000 });
    await scanBtn.click();

    // 5. Detect Adware threat
    await expect(page.locator('text=Adware.Win32.SearchMateToolbar').first()).toBeVisible({ timeout: 6000 });

    // 6. Clean threat
    const cleanBtn = page.locator('button:has-text("Remove & Quarantine Selected")').first();
    await cleanBtn.click();
    await expect(page.locator('text=Cleaned').first()).toBeVisible({ timeout: 5000 });

    // 7. Verify browser toolbar is removed
    await browserPage.openBrowser();
    await expect(page.locator('text=SearchMate:')).not.toBeVisible();
  });
});
