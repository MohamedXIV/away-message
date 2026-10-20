import { expect, test } from '@playwright/test';

/**
 * Browser-native fault injection captures ONLY the real Dedicated Worker
 * handle; no production debug hooks, no local SimulationKernel, no mocks of
 * the canonical simulation or storage. Worker error follows real Host listeners.
 */
test('fatal Worker crash removes live world; explicit saved-slot recovery boots a new Worker', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    const probes: Worker[] = [];
    (window as typeof window & { __testWorkerProbes: Worker[] }).__testWorkerProbes = probes;
    window.Worker = class extends OriginalWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        probes.push(this);
      }
    };
  });
  await page.goto('/worker.html');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  const beforeSave = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();

  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  // The command's RPC ack may precede the next bounded HUD publication.
  // Await published canonical truth instead of sampling React too early.
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(beforeSave + 15);
  const unsaved = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open My Computer' }).click();
  await expect(page.getByTestId('worker-window-fileexplorer')).toBeVisible();

  await page.evaluate(() => {
    const worker = (window as typeof window & { __testWorkerProbes: Worker[] }).__testWorkerProbes.at(-1);
    if (!worker) throw new Error('Browser did not start an actual Worker');
    worker.dispatchEvent(new ErrorEvent('error', { message: 'simulated native Worker crash' }));
  });
  await expect(page.getByTestId('worker-phase')).toHaveText('error');
  await expect(page.getByRole('alert')).toContainText('crashed');
  await expect(page.getByTestId('worker-recovery-controls')).toContainText('Unsaved progress cannot be restored');
  await expect(page.getByTestId('worker-hud')).toHaveCount(0);
  await expect(page.getByTestId('worker-window-fileexplorer')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
  await page.getByRole('button', { name: 'Recover saved slot' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  const recovered = Number(await page.getByTestId('worker-minute').innerText());
  expect(recovered).toBeGreaterThanOrEqual(beforeSave);
  expect(recovered).toBeLessThan(unsaved);
  expect(await page.evaluate(() =>
    (window as typeof window & { __testWorkerProbes: Worker[] }).__testWorkerProbes.length
  )).toBe(2);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker page reload cold-restores an explicit saved slot, not a shadow live world', async ({ page }) => {
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  const saved = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await expect(page.getByTestId('worker-hud')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  expect(Number(await page.getByTestId('worker-minute').innerText())).toBeGreaterThanOrEqual(saved);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
