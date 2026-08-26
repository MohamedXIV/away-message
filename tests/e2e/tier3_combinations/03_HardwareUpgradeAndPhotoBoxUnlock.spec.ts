import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 3: Hardware Upgrade & PhotoBox 3.0 Unlock', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-HUP-01: Full upgrade pipeline unlocks PhotoBox 3.0 from incompatible state', async ({ page, sim }) => {
    // 1. Initial attempt: PhotoBox fails gating
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=PhotoBox Pro 2.0 - System Requirement Error').first()).toBeVisible({ timeout: 5000 });
    await sim.closeWindow('photobox');

    // 2. Earn money working shifts
    await sim.earnCash(150, 'Food cart shifts');

    // 3. Purchase RAM upgrade (1024 MB)
    await sim.upgradeRam(1024, 45);

    // 4. Purchase and install Orion OS 6.0
    await sim.upgradeOs('Orion_6.0', 60);

    // 5. Verify OS theme switched to Orion 6.0
    await expect(page.locator('div[data-theme="orion60"]').first()).toBeVisible({ timeout: 5000 });

    // 6. Launch PhotoBox -> Now passes requirement check!
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=System Requirement Error')).not.toBeVisible();
    await expect(page.locator('text=STARLITE MOTEL').first()).toBeVisible({ timeout: 5000 });
  });
});
