import { expect, test } from '@playwright/test';

test('Worker-only boot route never imports Zustand engine and persists a playable session', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?runtime=worker');
  const shell = page.getByTestId('worker-first-shell');
  await expect(shell).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);

  await shell.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  const initial = Number(await page.getByTestId('worker-minute').innerText());
  await shell.getByRole('button', { name: 'Pause clock' }).click();
  await expect(shell.getByRole('button', { name: 'Resume clock' })).toBeVisible();
  await shell.getByRole('button', { name: 'Advance 15 minutes' }).click();
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(initial + 15);
  const advanced = Number(await page.getByTestId('worker-minute').innerText());
  await shell.getByRole('button', { name: 'Save game' }).click();
  await expect(shell.getByText('Saved to slot_1')).toBeVisible();

  await shell.getByRole('button', { name: 'Return to menu' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await shell.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(advanced);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  await expect(page.getByTestId('worker-world')).toContainText('Canonical world projection');
});

test('Worker-only entry rejects unreadable slots and never starts an anonymous fallback world', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?runtime=worker');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('error');
  await expect(page.getByRole('alert')).toContainText('missing or unreadable');
  await expect(page.getByTestId('worker-hud')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
});
