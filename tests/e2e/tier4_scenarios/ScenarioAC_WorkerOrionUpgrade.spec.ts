import { expect, test } from '@playwright/test';
import { installOrion48FromDos } from './workerDosTestHelper';

/**
 * Full player-operated 4.8 → 5.0 retail upgrade. The DEV state supplies only
 * elapsed day-six time and an earned budget; it does not inject a computer,
 * RAM, CD, installed OS or shortcuts. All owner purchases/physical assembly,
 * powered-off RAM insertion, original setup and upgrade happen in the real
 * Dedicated Worker via the ordinary visible game controls.
 */
test('Orion retail upgrade: buy 128MB RAM and 5.0 CD, power off to install, copy and cold-resume into Aperture', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__simStore && (window as any).__simEngine))).toBe(true);
  const skip = page.getByRole('button', { name: 'skip to desktop' });
  if (await skip.isVisible({ timeout: 5_000 }).catch(() => false)) await skip.click();

  await page.evaluate(async () => {
    const store = (window as any).__simStore.getState();
    const engine = store.engine;
    engine.clock.setTotalMinutes(engine.clock.getTotalMinutes() + 5 * 1440);
    engine.economy.loadState({ ...engine.getState().player, cash: 200, location: 'home' });
    engine.invalidateStateCache?.();
    const snapshot = engine.exportSnapshot();
    if (snapshot.computer.assembled || snapshot.os.currentOsId ||
      snapshot.inventory.items.some((item: { catalogItemId: string }) =>
        item.catalogItemId.startsWith('media_orion'))) {
      throw new Error('Upgrade fixture must not pre-grant any owned PC or disc');
    }
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

  // Nothing preinstalled: spend $35, build the original machine, physically
  // insert its 4.8 CD and finish four clock-backed DOS copy stages.
  let desktop = await installOrion48FromDos(page);
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion48');
  await desktop.getByRole('button', { name: 'Open Computer & Setup' }).dblclick();
  let system = page.getByTestId('worker-system-panel');
  const shop = system.getByTestId('worker-os-upgrade-store');
  await expect(shop).toBeVisible();
  await shop.getByRole('button', { name: 'Buy 128MB RAM ($32)' }).click();
  await shop.getByRole('button', { name: 'Buy Orion 5.0 setup CD ($29)' }).click();
  await expect(system.getByTestId('worker-owned-cd-media_orion_50_setup')).toBeVisible();

  // Hardware cannot be magically hot-swapped into a running PC. The owner's
  // real powered-off workbench is the only player-operated installation UI.
  await system.getByRole('button', { name: 'Power off' }).click();
  const bench = page.getByTestId('worker-physical-hardware-bench');
  await expect(bench).toBeVisible();
  const memory = bench.getByTestId('worker-ram-install-bench');
  await expect(memory).toContainText('1 / 2');
  await memory.getByRole('button', { name: 'Install owned RAM: ram_sdram_128' }).click();
  await expect(memory).toContainText('2 / 2');
  await bench.getByRole('button', { name: 'Power on' }).click();
  desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion48');
  await desktop.getByRole('button', { name: 'Open Computer & Setup' }).dblclick();
  system = page.getByTestId('worker-system-panel');
  await expect(system).toContainText('RAM: 192 MB');

  // The 4.8 CD is actually inserted from the first install. Eject it and
  // insert the purchased separate Orion 5.0 physical retail disc.
  await system.getByRole('button', { name: 'Eject disc' }).click();
  await system.getByTestId('worker-owned-cd-media_orion_50_setup')
    .getByRole('button', { name: 'Insert disc' }).click();
  await system.getByRole('button', { name: 'Verify OS installer' }).click();
  const plan = system.getByTestId('worker-os-plan');
  await expect(plan).toContainText('Orion 5.0');
  await expect(plan).toContainText('Upgrade');
  await plan.getByRole('button', { name: 'Begin installation' }).click();
  const progress = system.getByTestId('worker-system-os-install-progress');
  await expect(progress).toHaveAttribute('data-installer-edition', 'orion50');
  await progress.getByRole('button', { name: 'Advance installation' }).click();
  await expect.poll(async () => Number(
    await progress.getByRole('progressbar', { name: 'Orion installation progress' }).getAttribute('value')
  )).toBeGreaterThan(0);
  const spent = await progress.getByRole('progressbar').getAttribute('value');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion48');

  // Independent cold-save checkpoint of unfinished paid upgrade, not a
  // second forced grant through a legacy engine.
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_1');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_1');
  await page.getByRole('button', { name: 'Load game' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion48');
  await desktop.getByRole('button', { name: 'Open Computer & Setup' }).dblclick();
  system = page.getByTestId('worker-system-panel');
  const resumed = system.getByTestId('worker-system-os-install-progress');
  await expect(resumed.getByRole('progressbar')).toHaveAttribute('value', spent!);
  for (let step = 0; step < 3; step++) {
    await resumed.getByRole('button', { name: 'Advance installation' }).click();
  }
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion50');
  await expect(desktop.getByTestId('worker-desktop-os-badge')).toContainText('Orion OS 5.0');
  await expect(page.getByTestId('worker-dos-boot')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
