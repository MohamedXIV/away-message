import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 4: Scenario F — Full 14-Day Canonical Playthrough, Resolution Modal & Telemetry Export', () => {
  test('Scenario F: Complete 14-day loop -> Resolution Certificate -> Telemetry Export -> Free Play transition', async ({ page, desktopPage, sim }) => {
    // 1. Start on Day 1
    await desktopPage.goto();
    let state = await sim.getState();
    expect(state.time.day).toBe(1);

    // 2. Perform Day 1-14 progression actions
    await sim.earnCash(300, 'Work shifts across 14 days');
    await sim.upgradeRam(1024);
    await sim.upgradeOs('Orion_6.0');
    await sim.setNarrativeFlag('maya_met_in_person', true);

    // 3. Fast-forward through Day 14 (jump to Day 15 morning)
    await sim.jumpToDay(15);
    state = await sim.getState();
    expect(state.time.day).toBeGreaterThanOrEqual(15);

    // 4. Verify Day 14 Resolution Certificate Modal appears
    await expect(page.locator('text=AWAY MESSAGE — 14-DAY EVALUATION COMPLETE').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=★ CERTIFICATE OF COMPLETION ★').first()).toBeVisible();

    // 5. Verify Diagnostic Summary Cards
    await expect(page.locator('text=Computer & Software Portfolio').first()).toBeVisible();
    await expect(page.locator('text=Financial & Living Stability').first()).toBeVisible();
    await expect(page.locator('text=Social Bonds & Companions').first()).toBeVisible();

    // 6. Test Telemetry Export button
    const exportBtn = page.locator('button:has-text("Export Telemetry (.JSON)")').first();
    await expect(exportBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');

    // 7. Transition into Free-Play Mode
    const freePlayBtn = page.locator('button:has-text("Continue in Free-Play Mode")').first();
    await expect(freePlayBtn).toBeVisible();
    await freePlayBtn.click();

    // Modal should dismiss and allow free play
    await expect(page.locator('text=AWAY MESSAGE — 14-DAY EVALUATION COMPLETE')).not.toBeVisible();
  });
});
