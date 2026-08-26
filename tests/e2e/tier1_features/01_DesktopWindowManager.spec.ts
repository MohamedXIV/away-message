import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Desktop & Window Manager', () => {
  test.beforeEach(async ({ page, desktopPage }) => {
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    page.on('console', (msg) => console.log('CONSOLE:', msg.text()));
    await desktopPage.goto();
  });

  test('TC-DWM-01: Desktop loads with icons and taskbar in initial Orion 4.8 theme', async ({ page }) => {
    const rootDiv = page.locator('div[data-theme="orion48"]').first();
    await expect(rootDiv).toBeVisible();

    // Verify default desktop system icons exist
    await expect(page.locator('.desktop-icon:has-text("My Computer")').first()).toBeVisible();
    await expect(page.locator('.desktop-icon:has-text("Voyager Browser")').first()).toBeVisible();
    await expect(page.locator('.desktop-icon:has-text("Pulse Messenger")').first()).toBeVisible();
    await expect(page.locator('.desktop-icon:has-text("Terminal CLI")').first()).toBeVisible();
    await expect(page.locator('.desktop-icon:has-text("Control Panel")').first()).toBeVisible();
    await expect(page.locator('.desktop-icon:has-text("Recycle Bin")').first()).toBeVisible();
  });

  test('TC-DWM-02: Double-clicking desktop icon opens application window', async ({ page, desktopPage }) => {
    await desktopPage.doubleClickDesktopIcon('Voyager Browser');
    const browserWin = page.locator('.window-frame:has-text("Voyager Browser")').first();
    await expect(browserWin).toBeVisible();
  });

  test('TC-DWM-03: Window controls: minimize, maximize, restore, and close', async ({ page, desktopPage, sim }) => {
    await sim.openWindow('terminal', 'Terminal CLI');
    const termWin = page.locator('.window-frame:has-text("Terminal CLI")').first();
    await expect(termWin).toBeVisible();

    // Minimize
    await desktopPage.minimizeWindow('terminal');
    // Window frame is hidden or minimized
    const openWinsAfterMin = await page.evaluate(() => {
      const wins = (window as any).__windowStore.getState().windows;
      return wins['terminal']?.isMinimized;
    });
    expect(openWinsAfterMin).toBe(true);

    // Restore
    await desktopPage.restoreWindow('terminal');
    const isMinAfterRestore = await page.evaluate(() => {
      const wins = (window as any).__windowStore.getState().windows;
      return wins['terminal']?.isMinimized;
    });
    expect(isMinAfterRestore).toBe(false);

    // Maximize
    await desktopPage.maximizeWindow('terminal');
    const isMax = await page.evaluate(() => {
      const wins = (window as any).__windowStore.getState().windows;
      return wins['terminal']?.isMaximized;
    });
    expect(isMax).toBe(true);

    // Close
    await desktopPage.closeWindow('terminal');
    const isOpen = await page.evaluate(() => {
      const wins = (window as any).__windowStore.getState().windows;
      return wins['terminal']?.isOpen;
    });
    expect(isOpen).toBe(false);
  });

  test('TC-DWM-04: Multiple windows stack with proper z-index elevation on focus', async ({ page, sim }) => {
    await sim.openWindow('browser', 'Voyager Browser');
    await sim.openWindow('pulse', 'Pulse Messenger');
    await sim.openWindow('terminal', 'Terminal CLI');

    const zIndices = await page.evaluate(() => {
      const wins = (window as any).__windowStore.getState().windows;
      return {
        browser: wins['browser']?.zIndex,
        pulse: wins['pulse']?.zIndex,
        terminal: wins['terminal']?.zIndex,
      };
    });

    expect(zIndices.terminal).toBeGreaterThan(zIndices.pulse);
    expect(zIndices.pulse).toBeGreaterThan(zIndices.browser);

    // Focus browser
    await page.evaluate(() => {
      (window as any).__windowStore.getState().focusWindow('browser');
    });

    const newBrowserZ = await page.evaluate(() => {
      return (window as any).__windowStore.getState().windows['browser']?.zIndex;
    });
    expect(newBrowserZ).toBeGreaterThan(zIndices.terminal);
  });

  test('TC-DWM-05: Start menu opens and launches applications', async ({ page, desktopPage }) => {
    await desktopPage.openStartMenu();
    const startMenu = page.locator('#orion-start-menu');
    await expect(startMenu).toBeVisible();

    await desktopPage.clickStartMenuItem('Control Panel');
    const cpWin = page.locator('.window-frame:has-text("Control Panel")').first();
    await expect(cpWin).toBeVisible();
  });
});
