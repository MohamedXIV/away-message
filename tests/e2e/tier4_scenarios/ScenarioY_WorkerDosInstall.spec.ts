import { expect, test } from '@playwright/test';

test('#219 real unseeded DOS boot requires an owned CD and delivers clean Orion without Pulse', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const bench = page.getByTestId('worker-physical-hardware-bench');
  await expect(bench).toBeVisible();
  await expect(page.getByTestId('worker-desktop')).toHaveCount(0);
  await expect(page.getByTestId('worker-dos-boot')).toHaveCount(0);

  await bench.getByRole('button', { name: 'Purchase starter hardware bundle ($35)' }).click();
  await bench.getByRole('button', { name: 'Assemble owned package' }).click();
  await expect(bench).toContainText('powered off');
  await bench.getByRole('button', { name: 'Power on' }).click();
  const dos = page.getByTestId('worker-dos-boot');
  await expect(dos).toBeVisible();
  await expect(page.getByTestId('worker-desktop')).toHaveCount(0);
  const input = dos.getByRole('textbox', { name: 'DOS command' });

  // This is a real owner rejection, not a decorative disabled button.
  await input.fill('SETUP');
  await input.press('Enter');
  await expect(dos.getByTestId('worker-dos-transcript'))
    .toContainText('Insert owned bootable OS media first');
  await expect(page.getByTestId('worker-orion-installer')).toHaveCount(0);

  await input.fill('MEDIA');
  await input.press('Enter');
  await expect(dos.getByTestId('worker-dos-transcript')).toContainText('1.');
  await input.fill('INSERT 1');
  await input.press('Enter');
  await expect(dos.getByTestId('worker-dos-media')).not.toContainText('NO DISC');
  await input.fill('DIR D:');
  await input.press('Enter');
  await expect(dos.getByTestId('worker-dos-transcript')).toContainText('SETUP.EXE');

  const minuteBefore = Number(await page.getByTestId('worker-minute').textContent());
  await input.fill('D:\\SETUP.EXE');
  await input.press('Enter');
  const installer = page.getByTestId('worker-orion-installer');
  await expect(installer).toHaveAttribute('data-installer-edition', 'orion48');
  await expect(installer).toContainText('Orion 4.8 Text-Mode Setup');
  for (let step=0;step<3;step++) await installer.getByRole('button', { name: 'Next' }).click();
  await installer.getByRole('button', { name: 'Begin installation' }).click();
  const progress = page.getByTestId('worker-os-install-progress');
  await expect(progress).toHaveAttribute('aria-label', 'OS installation progress');
  await installer.getByRole('button', { name: 'Advance installation' }).click();
  // Worker publishes the revision asynchronously after the command resolves.
  // Observe canonical progress, not the stale React frame at click return.
  await expect.poll(async () => Number(
    await progress.getByRole('progressbar').getAttribute('aria-valuenow'),
  )).toBeGreaterThan(0);
  const minutesSpent = await progress.getByRole('progressbar').getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const resumed = page.getByTestId('worker-orion-installer');
  await expect(resumed.getByRole('progressbar')).toHaveAttribute('aria-valuenow', minutesSpent!);
  for (let step = 0; step < 3; step++) {
    await resumed.getByRole('button', { name: 'Advance installation' }).click();
  }

  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion48');
  await expect(page.getByTestId('worker-dos-boot')).toHaveCount(0);
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThan(minuteBefore);
  await expect(desktop.locator('[data-desktop-icon="sys_pulse"]')).toHaveCount(0);
  await expect(desktop.locator('[data-desktop-icon="sys_flashfetch"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'pulse', exact: true })).toHaveCount(0);
  await expect(desktop.getByRole('button', { name: 'Pulse Messenger' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await expect(page.getByTestId('worker-desktop')).toHaveAttribute('data-os-theme', 'orion48');
  await expect(page.getByTestId('worker-dos-boot')).toHaveCount(0);
  await expect(page.getByTestId('worker-desktop').locator('[data-desktop-icon="sys_pulse"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
