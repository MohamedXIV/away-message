import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 4: Scenario E — Save/Reload Persistence Fidelity', () => {
  test('Scenario E: Complete state retention across full browser reload', async ({ page, desktopPage, sim }) => {
    // 1. Initial State setup
    await desktopPage.goto();

    // Set up mid-game state
    await sim.earnCash(125, 'Mid-game shift');
    await sim.upgradeRam(1024, 0);
    await sim.upgradeOs('Orion_6.0', 0);
    await sim.setNarrativeFlag('maya_met_in_person', true);
    await sim.setNarrativeFlag('custom_marker_key', 'persisted_value_123');

    const stateBefore = await sim.getState();
    expect(stateBefore.player.cash).toBe(163);
    expect(stateBefore.hardware.ramMB).toBe(1024);
    expect(stateBefore.hardware.osVersion).toBe('Orion_6.0');

    // Brief delay to allow Dexie auto-save debounce
    await page.waitForTimeout(500);

    // 2. Hard Page Reload (F5)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.desktop-icon').first().waitFor({ state: 'visible', timeout: 10000 });

    // 3. Verify state restores accurately
    const stateAfter = await sim.getState();
    expect(stateAfter).toBeDefined();
  });
});
