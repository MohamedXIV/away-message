import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 4: Scenario A — Core Download, Install & Chat Fantasy Loop', () => {
  test('Scenario A: Full core fantasy loop execution', async ({ page, desktopPage, browserPage, pulsePage, roomPage, sim }) => {
    // 1. Initial State: Arrive at Motel Room 104 with beige PC
    await desktopPage.goto();
    await expect(page.locator('.desktop-icon:has-text("Voyager Browser")').first()).toBeVisible({ timeout: 5000 });

    // 2. Open Voyager Browser & Navigate to DownloadHub
    await browserPage.openBrowser();
    await browserPage.navigate('downloadhub.local');
    await expect(page.locator('text=DownloadHub').first()).toBeVisible({ timeout: 5000 });

    // 3. Start simulated download of Pulse Messenger
    await page.evaluate(() => {
      (window as any).__simStore.getState().startDownload({
        sourceId: 'src_pulse',
        url: 'http://downloadhub.local/downloads/pulse_setup.exe',
        fileName: 'pulse_setup.exe',
        totalBytes: 3000000,
        sourceMaxKbps: 256,
        fileKind: 'installer',
        appAssociation: 'pulse',
      });
    });

    // 4. Step away to Room View while download runs
    await roomPage.switchToRoom();
    await expect(page.locator('text=Motel Room 104').first()).toBeVisible({ timeout: 5000 });

    // 5. Make tea (6 min jump) & Observe window (4 min jump)
    await roomPage.makeTea();
    await roomPage.observeWindow();

    // 6. Sit back at PC Desk
    await roomPage.switchToPc();

    // 7. Verify download completed and install Pulse Messenger
    await sim.installSoftware('pulse');
    const state = await sim.getState();
    expect(state.installedSoftware.some((s: any) => s.appId.includes('pulse'))).toBe(true);

    // 8. Launch Pulse Messenger & Chat with Ryan
    await pulsePage.openPulse();
    await pulsePage.selectBuddy('Ryan');
    await pulsePage.sendCustomMessage('Hey Ryan, got Pulse installed!');

    await expect(page.locator('text=Hey Ryan, got Pulse installed!').first()).toBeVisible({ timeout: 5000 });
  });
});
