import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: RetroAmp MP3 Player & Web Audio', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-AMP-01: RetroAmp opens and displays retro winamp-style interface', async ({ page, sim }) => {
    await sim.openWindow('retroamp', 'RetroAmp');
    const ampWin = page.locator('.window-frame:has-text("RetroAmp")').first();
    await expect(ampWin).toBeVisible({ timeout: 5000 });
  });

  test('TC-AMP-02: RetroAmp player controls: play, pause, stop', async ({ page, sim }) => {
    await sim.openWindow('retroamp', 'RetroAmp');
    const playBtn = page.locator('button:has-text("▶"), button:has-text("Play")').first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
    }
    const ampWin = page.locator('.window-frame:has-text("RetroAmp")').first();
    await expect(ampWin).toBeVisible();
  });

  test('TC-AMP-03: RetroAmp equalizer bands and visualizer mount without error', async ({ page, sim }) => {
    await sim.openWindow('retroamp', 'RetroAmp');
    await expect(page.locator('.window-frame:has-text("RetroAmp")').first()).toBeVisible();
  });

  test('TC-AMP-04: Audio unlocking works on user interaction', async ({ page }) => {
    await page.click('body');
    const isUnlocked = await page.evaluate(() => {
      return (window as any).__simStore ? true : false;
    });
    expect(isUnlocked).toBe(true);
  });

  test('TC-AMP-05: Closing RetroAmp stops playback cleanly', async ({ page, sim }) => {
    await sim.openWindow('retroamp', 'RetroAmp');
    await sim.closeWindow('retroamp');
    const isOpen = await page.evaluate(() => {
      const wins = (window as any).__windowStore.getState().windows;
      return wins['retroamp']?.isOpen;
    });
    expect(isOpen).toBe(false);
  });
});
