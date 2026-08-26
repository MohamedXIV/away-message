import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 3: Download & Room Activity Continuous Simulation', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-DRC-01: Background download continues while player makes tea and observes window in room', async ({ page, sim, roomPage }) => {
    // 1. Start download on PC
    await page.evaluate(() => {
      (window as any).__simStore.getState().startDownload({
        sourceId: 'src_zipmate',
        url: 'http://zipmate.local/downloads/zipmate_setup.exe',
        fileName: 'zipmate_setup.exe',
        totalBytes: 2000000,
        sourceMaxKbps: 256,
        fileKind: 'installer',
        appAssociation: 'zipmate',
      });
    });

    let state = await sim.getState();
    const task = state.downloads.find((d: any) => d.fileName === 'zipmate_setup.exe');
    expect(task).toBeDefined();
    expect(task.status).toBe('downloading');

    // 2. Step away to Room view
    await roomPage.switchToRoom();
    await expect(page.locator('text=Motel Room 104').first()).toBeVisible({ timeout: 5000 });

    // 3. Make tea (6 min time jump)
    await roomPage.makeTea();

    // 4. Observe window (4 min time jump)
    await roomPage.observeWindow();

    // 5. Sit back at PC Desk
    await roomPage.switchToPc();
    await expect(page.locator('.desktop-icon:has-text("My Computer")').first()).toBeVisible({ timeout: 5000 });

    // 6. Verify download finished during room activities
    state = await sim.getState();
    const taskAfter = state.downloads.find((d: any) => d.fileName === 'zipmate_setup.exe');
    expect(taskAfter.status).toBe('complete');

    // 7. Verify file exists in C:/Downloads/
    const file = state.vfs.files['C:/Downloads/zipmate_setup.exe'];
    expect(file).toBeDefined();
  });
});
