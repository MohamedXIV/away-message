import { expect, test } from '@playwright/test';

test('AI Lab diagnostics are owner-derived bounded pages without a shadow engine', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  const lab = page.getByTestId('worker-lab-inspector');
  await expect(lab.getByTestId('worker-lab-summary')).toContainText('World events:');
  await expect(lab.getByTestId('worker-lab-body')).toContainText('Energy');
  await expect(lab.getByTestId('worker-lab-actors')).toContainText('Relationship Lab');
  await expect(lab.getByTestId('worker-lab-meetings')).toContainText('Meeting Board');
  expect(await lab.getByTestId('worker-lab-actor').count()).toBeLessThanOrEqual(16);
  expect(await lab.getByTestId('worker-lab-appointment').count()).toBeLessThanOrEqual(16);
  await expect(lab.getByRole('button', { name: 'Previous actors' })).toBeDisabled();
  await expect(lab.getByRole('button', { name: 'Previous meetings' })).toBeDisabled();
  await expect(lab).toContainText('offline events, and OS release generation');

  await desktop.getByRole('button', { name: 'Minimize Away Message AI Lab' }).click();
  await expect(lab).toHaveCount(0);
  await desktop.getByRole('button', { name: 'Taskbar Away Message AI Lab' }).click();
  await expect(lab.getByTestId('worker-lab-summary')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('AI Lab diagnostic windows do not persist across a cold Worker save/load', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  await expect(page.getByTestId('worker-lab-summary')).toBeVisible();
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await expect(page.getByTestId('worker-lab-inspector')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await expect(page.getByTestId('worker-lab-inspector')).toHaveCount(0);
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  await expect(page.getByTestId('worker-lab-summary')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker AI Lab previews and injects events that survive cold save/load', async ({ page }) => {
  test.setTimeout(80_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  const lab = page.getByTestId('worker-lab-inspector');
  const summary = lab.getByTestId('worker-lab-summary');
  await expect(summary).toContainText('World events:');
  const initial = await summary.textContent();
  const pending = Number(initial?.match(/World events:\s*(\d+)\s*pending/)?.[1]);
  expect(Number.isSafeInteger(pending)).toBe(true);

  await expect(lab.getByRole('button', { name: 'Inject preview' })).toBeDisabled();
  await lab.getByRole('button', { name: 'Preview events' }).click();
  await expect(lab.getByTestId('worker-lab-preview-event')).toHaveCount(2);
  await expect(lab.getByRole('button', { name: 'Inject preview' })).toBeEnabled();
  await expect(summary).toContainText(pending + ' pending');
  await lab.getByRole('button', { name: 'Inject preview' }).click();
  await expect(lab.getByTestId('worker-lab-generation-result'))
    .toContainText('Injected 2 canonical world events');
  await expect(summary).toContainText((pending + 2) + ' pending');
  await expect(lab.getByRole('button', { name: 'Inject preview' })).toBeDisabled();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  await expect(page.getByTestId('worker-lab-summary')).toContainText((pending + 2) + ' pending');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker OS Lab previews an installable release and preserves OS/world state after cold load', async ({ page }) => {
  test.setTimeout(80_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop')
    .getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  const lab = page.getByTestId('worker-lab-inspector');
  const summary = lab.getByTestId('worker-lab-summary');
  await expect(summary).toContainText('OS pending');
  const before = await summary.textContent();
  const pending = Number(before?.match(/World events:\s*(\d+)\s*pending/)?.[1]);
  const pendingOs = Number(before?.match(/(\d+)\s*OS pending/)?.[1]);
  expect(Number.isSafeInteger(pending)).toBe(true);
  expect(Number.isSafeInteger(pendingOs)).toBe(true);

  const os = lab.getByTestId('worker-lab-os');
  await expect(os.getByRole('button', { name: 'Register OS release' })).toBeDisabled();
  await os.getByRole('button', { name: 'Preview OS release' }).click();
  const preview = os.getByTestId('worker-lab-os-preview');
  await expect(preview).toContainText('Build');
  await expect(preview).toContainText('Day 3');
  await expect(os.getByRole('button', { name: 'Register OS release' })).toBeEnabled();
  await expect(summary).toContainText(pendingOs + ' OS pending');
  await os.getByRole('button', { name: 'Register OS release' }).click();
  await expect(os.getByTestId('worker-lab-os-result')).toContainText('Registered Orion OS');
  await expect(summary).toContainText((pendingOs + 1) + ' OS pending');
  await expect(summary).toContainText((pending + 1) + ' pending');
  await expect(os.getByRole('button', { name: 'Register OS release' })).toBeDisabled();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop')
    .getByRole('button', { name: 'Open AI Lab Inspector' }).click();
  await expect(page.getByTestId('worker-lab-summary')).toContainText((pendingOs + 1) + ' OS pending');
  await expect(page.getByTestId('worker-lab-summary')).toContainText((pending + 1) + ' pending');
});
