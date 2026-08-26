import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 4: Scenario C — Hardware Progression & OS 6.0 Upgrade', () => {
  test('Scenario C: Progression loop unlocking PhotoBox 3.0 via RAM & OS upgrade', async ({ page, desktopPage, sim }) => {
    // 1. Initial State: Orion 4.8, 512 MB RAM
    await desktopPage.goto();
    await expect(page.locator('div[data-theme="orion48"]').first()).toBeVisible();

    // 2. Attempt PhotoBox on baseline OS 4.8 -> Fails requirements
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=PhotoBox Pro 2.0 - System Requirement Error').first()).toBeVisible({ timeout: 5000 });
    await sim.closeWindow('photobox');

    // 3. Earn cash from work shifts
    await sim.earnCash(120, 'Food cart shifts');

    // 4. Upgrade RAM to 1024 MB
    await sim.upgradeRam(1024, 45);

    // 5. Upgrade OS to Orion 6.0
    await sim.upgradeOs('Orion_6.0', 60);

    // 6. Verify OS generation transition to Orion 6.0
    await expect(page.locator('div[data-theme="orion60"]').first()).toBeVisible({ timeout: 5000 });

    // 7. Launch PhotoBox 3.0 -> Successfully unlocked and operational!
    await sim.openWindow('photobox', 'PhotoBox 3.0');
    await expect(page.locator('text=System Requirement Error')).not.toBeVisible();
    await expect(page.locator('text=STARLITE MOTEL').first()).toBeVisible({ timeout: 5000 });
  });
});
