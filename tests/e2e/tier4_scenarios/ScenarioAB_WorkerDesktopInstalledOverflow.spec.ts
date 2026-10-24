import { expect, test } from '@playwright/test';

/**
 * #212: stress the actual / Worker OS shell after importing a deliberately
 * overpopulated DEV save. Software/VFS shortcuts are persisted with matching
 * owner records; this is a layout stress fixture, NOT a claim that players
 * acquired twenty fictional programs in the ordinary economy.
 */
test('owned installed shortcuts remain discoverable and keyboard-navigable beyond the icon-grid viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 620, height: 460 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__simStore && (window as any).__simEngine))).toBe(true);
  const skip = page.getByRole('button', { name: 'skip to desktop' });
  if (await skip.isVisible({ timeout: 5_000 }).catch(() => false)) await skip.click();

  await page.evaluate(async () => {
    const store = (window as any).__simStore.getState();
    const engine = store.engine;
    engine.hardware.loadState({
      computer: { ...engine.hardware.getComputerState(), assembled: true, poweredOn: true },
      display: engine.hardware.getDisplayState(),
    });
    engine.core.os.loadState({ currentOsId: 'Orion_6.0' });
    const actualPackages = engine.software.getCatalog().map((definition: any) => ({
      id: 'inst_' + definition.id,
      appId: definition.appId,
      name: definition.name,
      version: definition.version,
      installedBytes: definition.installedBytes,
      installPath: 'C:/Program Files/' + definition.name,
      installedAtMinute: engine.clock.getTotalMinutes(),
      isPortable: false,
      isAdware: Boolean(definition.isAdware),
      shortcuts: ['C:/Desktop/' + definition.name + '.lnk'],
    }));
    // Explicitly unavailable historical utilities test visible disabled
    // shortcut navigation; they must never acquire executable capabilities.
    const unavailable = Array.from({ length: 20 }, (_, index) => ({
      id: 'inst_fixture_' + index,
      appId: 'app.unported_fixture_' + index,
      name: 'Archive Utility ' + String(index + 1).padStart(2, '0'),
      version: '1.0',
      installedBytes: 0,
      installPath: 'C:/Program Files/ArchiveUtility' + index,
      installedAtMinute: engine.clock.getTotalMinutes(),
      isPortable: false,
      isAdware: false,
      shortcuts: ['C:/Desktop/Archive Utility ' + String(index + 1).padStart(2, '0') + '.lnk'],
    }));
    for (const program of [...actualPackages, ...unavailable]) {
      engine.vfs.createFile({
        name: program.name + '.lnk',
        path: program.shortcuts[0],
        parentPath: 'C:/Desktop',
        kind: 'shortcut',
        sizeBytes: 1024,
        appAssociation: program.appId,
      }, engine.clock.getTotalMinutes());
    }
    engine.software.loadState([...actualPackages, ...unavailable]);
    engine.invalidateStateCache?.();
    store.syncStateFromEngine();
    await (window as any).__slots.saveSlot(engine, 'slot_3');
  });

  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_3');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion60');
  const grid = desktop.getByTestId('worker-desktop-icon-grid');
  await expect(grid.locator('[data-desktop-icon]')).toHaveCount(38);
  await expect(grid.locator('[data-desktop-icon][disabled]')).toHaveCount(20);
  const pager = desktop.getByTestId('desktop-icon-pages');
  await expect(pager).toBeVisible();
  await expect(grid.evaluate(el => el.scrollWidth - el.clientWidth)).resolves.toBeGreaterThan(0);
  await pager.getByRole('button', { name: 'Next desktop icons' }).click();
  await expect.poll(() => grid.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await expect(pager.getByRole('button', { name: 'Previous desktop icons' })).toBeEnabled();
  // The last item in the synthetic owner list is disabled; End must focus
  // the last genuinely launchable shortcut instead.
  await grid.locator('[data-desktop-icon]:not(:disabled)').first().focus();
  await page.keyboard.press('End');
  await expect(grid.locator('[data-desktop-icon]:not(:disabled)').last()).toBeFocused();
  await expect(grid.locator('[data-desktop-icon]:disabled').last()).not.toBeFocused();
  await expect.poll(() => page.evaluate(() =>
    !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
