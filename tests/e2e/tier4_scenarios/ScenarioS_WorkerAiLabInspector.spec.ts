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
  await expect(lab).toContainText('AI generation, preview, injection');

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
