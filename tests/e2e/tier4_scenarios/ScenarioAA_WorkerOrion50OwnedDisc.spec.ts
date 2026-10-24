import { expect, test } from '@playwright/test';

/**
 * #219: A bounded DEV save *only* supplies earned cash and the day-six
 * release window. The physical Family Refurb bundle itself is purchased via
 * the production store owner. After navigation the ordinary / Dedicated
 * Worker (not the DEV engine) performs assembly, disc insert, DOS setup,
 * in-world copying, save/reload and 5.0 boot.
 *
 * Distinct from a full six-day economy/endurance playtest; no fake media or
 * direct OS entitlement is injected.
 */
test('Orion 5.0: owned Family Refurb CD boots actual second-edition DOS installer on the ordinary Worker', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__simStore && (window as any).__simEngine))).toBe(true);
  const skip = page.getByRole('button', { name: 'skip to desktop' });
  if (await skip.isVisible({ timeout: 5_000 }).catch(() => false)) await skip.click();

  await page.evaluate(async () => {
    const store = (window as any).__simStore.getState();
    const engine = store.engine;
    // Save prerequisite only: no Orion OS, installed-program license or
    // disc is injected. The actual $85 bundle is bought from its store.
    engine.clock.setTotalMinutes(engine.clock.getTotalMinutes() + 5 * 1440);
    engine.economy.loadState({ ...engine.getState().player, cash: 200, location: 'home' });
    engine.invalidateStateCache?.();
    const receipt = engine.purchaseStoreItem('silicon_spares', 'bundle_family');
    if (!receipt.success) throw new Error('Cannot purchase genuine Family Refurb: ' + receipt.error);
    const saved = engine.exportSnapshot();
    if (saved.os.currentOsId !== null ||
      !saved.inventory.items.some((item: { catalogItemId: string }) => item.catalogItemId === 'media_orion_50_setup')) {
      throw new Error('The day-six setup must own a genuine 5.0 disc but no OS');
    }
    store.syncStateFromEngine();
    await (window as any).__slots.saveSlot(engine, 'slot_3');
  });

  // Full navigation destroys DEV state; from here the browser exercises the
  // *real* canonical Worker through in-world buttons/keyboard exclusively.
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_3');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const bench = page.getByTestId('worker-physical-hardware-bench');
  await expect(bench.getByRole('button', { name: 'Assemble owned package' })).toBeVisible();
  await expect(page.getByTestId('worker-desktop')).toHaveCount(0);
  await bench.getByRole('button', { name: 'Assemble owned package' }).click();
  await bench.getByRole('button', { name: 'Power on' }).click();

  const dos = page.getByTestId('worker-dos-boot');
  const input = dos.getByRole('textbox', { name: 'DOS command' });
  await expect(dos).toBeVisible();
  await expect(dos).toContainText('DOS 1.0');
  await input.fill('MEDIA');
  await input.press('Enter');
  await expect(dos.getByTestId('worker-dos-transcript')).toContainText('media_orion_50_setup');
  await expect(dos.getByTestId('worker-dos-transcript')).not.toContainText('media_orion_48_setup');
  await input.fill('INSERT 1');
  await input.press('Enter');
  await expect(dos.getByTestId('worker-dos-media')).toContainText('media_orion_50_setup');
  await input.fill('SETUP');
  await input.press('Enter');
  const setup = page.getByTestId('worker-orion-installer');
  await expect(setup).toHaveAttribute('data-installer-edition', 'orion50');
  await expect(setup).toContainText('Orion 5.0 Setup');
  await expect(setup).toContainText('Aperture');

  for (let stage = 0; stage < 3; stage++) await setup.getByRole('button', { name: 'Next' }).click();
  const before = Number(await page.getByTestId('worker-minute').textContent());
  await setup.getByRole('button', { name: 'Begin installation' }).click();
  const progress = page.getByTestId('worker-os-install-progress');
  await expect(progress).toBeVisible();
  await setup.getByRole('button', { name: 'Advance installation' }).click();
  await expect.poll(async () => Number(
    await progress.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  const elapsed = await progress.getByRole('progressbar').getAttribute('aria-valuenow');
  await expect(page.getByTestId('worker-desktop')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_1');
  await page.getByRole('button', { name: 'Load game' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const restored = page.getByTestId('worker-orion-installer');
  await expect(restored).toHaveAttribute('data-installer-edition', 'orion50');
  await expect(restored.getByRole('progressbar')).toHaveAttribute('aria-valuenow', elapsed!);
  for (let stage = 0; stage < 3; stage++) {
    await restored.getByRole('button', { name: 'Advance installation' }).click();
  }
  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion50');
  await expect(desktop).toHaveAttribute('data-os-wallpaper', 'aperture_sand');
  await expect(desktop.getByTestId('worker-desktop-os-badge')).toContainText('Orion OS 5.0');
  await expect(page.getByTestId('worker-dos-boot')).toHaveCount(0);
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThan(before);
  await expect(desktop.locator('[data-app-id="pulse"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
