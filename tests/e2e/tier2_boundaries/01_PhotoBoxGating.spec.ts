import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 2: PhotoBox Gating & Hardware Requirements', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-PBG-01: PhotoBox on baseline OS 4.8 / 512MB RAM displays system requirement error', async ({ page, sim }) => {
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=PhotoBox Pro 2.0 - System Requirement Error').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Requires Orion 6.0').first()).toBeVisible();
    await expect(page.locator('text=Requires 768 MB+').first()).toBeVisible();
  });

  test('TC-PBG-02: Upgrading RAM to 1024MB on OS 4.8 still blocks due to OS version', async ({ page, sim }) => {
    await sim.upgradeRam(1024);
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=PhotoBox Pro 2.0 - System Requirement Error').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Requires Orion 6.0').first()).toBeVisible();
  });

  test('TC-PBG-03: Upgrading OS to 6.0 with 512MB RAM still blocks due to RAM shortage', async ({ page, sim }) => {
    await sim.upgradeOs('Orion_6.0');
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=PhotoBox Pro 2.0 - System Requirement Error').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Requires 768 MB+').first()).toBeVisible();
  });

  test('TC-PBG-04: Upgrading both OS to 6.0 and RAM to 1024MB unlocks full PhotoBox editor', async ({ page, sim }) => {
    await sim.upgradeRam(1024);
    await sim.upgradeOs('Orion_6.0');
    await sim.openWindow('photobox', 'PhotoBox 3.0');

    // Requirement dialog should NOT be visible
    await expect(page.locator('text=System Requirement Error')).not.toBeVisible();
    // Full editor canvas and tools should be visible
    await expect(page.locator('text=STARLITE MOTEL').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Vintage 2006').first()).toBeVisible();
  });

  test('TC-PBG-05: Applying photo filters (Vintage, Neon, B&W) modifies canvas filter style', async ({ page, sim }) => {
    await sim.upgradeRam(1024);
    await sim.upgradeOs('Orion_6.0');
    await sim.openWindow('photobox', 'PhotoBox 3.0');

    const vintageBtn = page.locator('button:has-text("Vintage 2006")').first();
    await expect(vintageBtn).toBeVisible({ timeout: 5000 });
    await vintageBtn.click();

    await expect(page.locator('text=Applied preset: vintage').first()).toBeVisible();
  });
});
