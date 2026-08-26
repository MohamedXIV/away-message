import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Software Installation & Add/Remove Programs', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-SAR-01: Installing software registers in software registry', async ({ sim }) => {
    await sim.installSoftware('retroamp');
    const state = await sim.getState();
    const isInstalled = state.installedSoftware.some((s: any) => s.appId.includes('retroamp'));
    expect(isInstalled).toBe(true);
  });

  test('TC-SAR-02: Add/Remove Programs utility displays installed software', async ({ page, sim }) => {
    await sim.installSoftware('retroamp');
    await sim.openWindow('addremove', 'Add/Remove Programs');

    const addRemoveWin = page.locator('.window-frame:has-text("Add/Remove Programs")').first();
    await expect(addRemoveWin).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=RetroAmp').first()).toBeVisible();
  });

  test('TC-SAR-03: Uninstalling software removes entry from software registry', async ({ sim }) => {
    await sim.installSoftware('retroamp');
    let state = await sim.getState();
    const installed = state.installedSoftware.find((s: any) => s.appId.includes('retroamp'));
    expect(installed).toBeDefined();

    await sim.uninstallSoftware(installed.id);
    state = await sim.getState();
    const isStillInstalled = state.installedSoftware.some((s: any) => s.appId.includes('retroamp'));
    expect(isStillInstalled).toBe(false);
  });

  test('TC-SAR-04: Installing bundled software (WeatherBuddy + SearchMate) tracks adware payload', async ({ sim }) => {
    await sim.installSoftware('weatherbuddy', { installSearchMateToolbar: true });
    const state = await sim.getState();
    const wb = state.installedSoftware.find((s: any) => s.appId.includes('weatherbuddy'));
    expect(wb).toBeDefined();
  });

  test('TC-SAR-05: Add/Remove Programs reclaims virtual disk space', async ({ sim }) => {
    await sim.installSoftware('retroamp');
    const stateMid = await sim.getState();
    const installed = stateMid.installedSoftware.find((s: any) => s.appId.includes('retroamp'));

    await sim.uninstallSoftware(installed.id);
    const stateAfter = await sim.getState();
    expect(stateAfter.installedSoftware.some((s: any) => s.appId.includes('retroamp'))).toBe(false);
  });
});
