import { expect, test } from '@playwright/test';

test('Worker-only boot route never imports Zustand engine and persists a playable session', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/worker.html');
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
  await page.goto('/worker.html');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('error');
  await expect(page.getByRole('alert')).toContainText('missing or unreadable');
  await expect(page.getByTestId('worker-hud')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
});

test('Worker Save As copies the current Pulse moment into its own slot and restores without cross-slot leaks', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.evaluate(() => {
    localStorage.setItem('away_message_pulse_state_v1:slot_1',
      JSON.stringify({ version: 1, marker: 'from-current-world' }));
  });
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_2');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_2')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pulse_current_slot'))).toBe('slot_2');
  expect(await page.evaluate(() => localStorage.getItem('away_message_pulse_state_v1:slot_2')))
    .toContain('from-current-world');

  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.evaluate(() => {
    localStorage.removeItem('away_message_pulse_state_v1:slot_2');
    localStorage.setItem('pulse_current_slot', 'slot_1');
  });
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  expect(await page.evaluate(() => localStorage.getItem('pulse_current_slot'))).toBe('slot_2');
  expect(await page.evaluate(() => localStorage.getItem('away_message_pulse_state_v1:slot_2')))
    .toContain('from-current-world');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('root runtime=worker boots without requesting or evaluating the legacy engine and cold loads a slot', async ({ page }) => {
  test.setTimeout(90_000);
  const scripts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });
  await page.goto('/?runtime=worker');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  expect(await page.locator('#root').getAttribute('data-runtime')).toBe('worker');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
  expect(scripts.some(path => /\/src\/(?:App|store\/useSimulationStore)(?:\.tsx?|\?)/.test(path)))
    .toBe(false);

  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThan(15);
  const savedMinute = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await expect(page.getByTestId('worker-continue-summary')).toContainText('Day');
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  expect(Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(savedMinute);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});

test('root runtime selector rejects invalid runtimes without loading a legacy world', async ({ page }) => {
  await page.goto('/?runtime=invalid');
  await expect(page.getByTestId('runtime-boot-error')).toContainText('Unknown simulation runtime');
  await expect(page.getByTestId('worker-first-shell')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});
