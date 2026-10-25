import { expect, test } from '@playwright/test';

test('ordinary / launches only the canonical Worker and supports a real cold-save play loop', async ({ page }) => {
  test.setTimeout(100_000);
  const scripts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });

  // No query parameter and no worker.html preview document.
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  expect(scripts.some(path => /\/src\/(?:App|store\/useSimulationStore)(?:\.tsx?|\?)/.test(path)))
    .toBe(false);

  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pause clock' }).click();
  const before = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(before + 15);

  await page.getByRole('button', { name: 'city', exact: true }).click();
  await expect(page.getByTestId('worker-city-travel')).toBeVisible();
  await page.getByRole('button', { name: 'pulse', exact: true }).click();
  await expect(page.getByTestId('worker-pulse-panel')).toBeVisible();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await expect(page.getByTestId('worker-desktop')).toBeVisible();
  const savedMinute = Number(await page.getByTestId('worker-minute').innerText());

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await expect(page.getByTestId('worker-hud')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(savedMinute);
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('DEV-only Classic fixture never owns the ordinary root or survives a full-page switch', async ({ page }) => {
  await page.goto('/?runtime=legacy');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'legacy');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__simStore))).toBe(true);

  // No same-document fallback: navigation tears down the old engine first.
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);

  await page.goto('/?runtime=nonexistent');
  await expect(page.getByTestId('runtime-boot-error')).toContainText('Unknown simulation runtime');
  await expect(page.getByTestId('worker-first-shell')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
