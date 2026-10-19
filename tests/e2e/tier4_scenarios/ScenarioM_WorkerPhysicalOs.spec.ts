import { expect, test } from '@playwright/test';

test('Worker-only desktop buys owned PC, assembles, inserts media and installs real Orion', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/worker.html');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByRole('button', { name: 'Open Computer & Setup' }).click();
  const panel = page.getByTestId('worker-system-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('worker-boot-state')).toContainText('no_computer');

  await panel.getByRole('button', { name: 'Purchase starter hardware bundle ($35)' }).click();
  await expect(panel.getByRole('button', { name: 'Assemble owned package' })).toBeEnabled();
  await panel.getByRole('button', { name: 'Assemble owned package' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('powered_off');
  await expect(panel.getByText('media_orion_48_setup (room_package)')).toBeVisible();
  await panel.getByRole('button', { name: 'Insert disc' }).click();
  await expect(panel.getByText('media_orion_48_setup (inserted)')).toBeVisible();
  await panel.getByRole('button', { name: 'Verify OS installer' }).click();
  await expect(page.getByTestId('worker-os-plan')).toContainText('Orion_4.8');
  await page.getByTestId('worker-os-plan').getByRole('button', { name: 'Commit verified OS installation' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('Orion OS: Orion_4.8');
  await panel.getByRole('button', { name: 'Power on' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('desktop');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByRole('button', { name: 'Open Computer & Setup' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('desktop');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker-owned installer refuses absent owned media and rejects real-world download addresses', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByRole('button', { name: 'Open Computer & Setup' }).click();
  const panel = page.getByTestId('worker-system-panel');
  await panel.getByRole('button', { name: 'Verify OS installer' }).click();
  await expect(page.getByTestId('worker-system-notice')).toContainText('Set up');
  await expect(page.getByTestId('worker-os-plan')).toHaveCount(0);
  await panel.getByRole('textbox', { name: 'In-game download URL' }).fill('https://example.com/file.zip');
  await panel.getByRole('button', { name: 'Download' }).click();
  await expect(page.getByTestId('worker-system-notice')).toContainText('in-game .local');
  await expect(page.getByTestId('worker-boot-state')).toContainText('not installed');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
