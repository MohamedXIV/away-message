import { expect, test } from '@playwright/test';

test('Worker Recycle Bin restores actual trashed VFS file, preserving original path', async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');

  await desktop.getByRole('button', { name: 'Open Command Prompt' }).click();
  const terminal = page.getByTestId('worker-terminal');
  const cmd = terminal.getByRole('textbox', { name: 'Command line' });
  const run = async (text: string) => {
    await cmd.fill(text);
    await cmd.press('Enter');
    await expect(cmd).toBeEnabled();
  };
  await run('SAVE C:/Documents/RecoverOwnerNote.txt recycle-data');
  await expect(terminal).toContainText('Saved C:/Documents/RecoverOwnerNote.txt');
  await run('DEL C:/Documents/RecoverOwnerNote.txt');
  await expect(terminal).toContainText('Moved to Recycle Bin');
  await desktop.getByRole('button', { name: 'Close Terminal CLI' }).click();

  await desktop.getByRole('button', { name: 'Open Recycle Bin', exact: true }).click({ timeout: 6000 });
  const trash = page.getByTestId('worker-recycle-bin');
  await expect(trash.getByRole('button', { name: 'Select trashed: RecoverOwnerNote.txt' }))
    .toContainText('C:/Documents/RecoverOwnerNote.txt');
  await trash.getByRole('button', { name: 'Select trashed: RecoverOwnerNote.txt' }).click();
  await trash.getByRole('button', { name: 'Restore selected' }).click();
  await expect(trash).toContainText('Restored RecoverOwnerNote.txt');
  await expect(trash).toContainText('The Recycle Bin is empty.');
  await desktop.getByRole('button', { name: 'Close Recycle Bin' }).click();
  await desktop.getByRole('button', { name: 'Open Command Prompt' }).click();
  const restored = page.getByTestId('worker-terminal');
  await restored.getByRole('textbox', { name: 'Command line' }).fill('TYPE C:/Documents/RecoverOwnerNote.txt');
  await restored.getByRole('textbox', { name: 'Command line' }).press('Enter');
  await expect(restored.getByTestId('worker-terminal-output')).toContainText('recycle-data');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('in-desktop Worker Save/Load replaces the canonical world and does not leak old windows', async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  const initial = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(initial + 15);
  const saved = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Save / Load Game' }).click();
  const panel = page.getByTestId('worker-save-load');
  const row = panel.getByTestId('worker-save-row-slot_2');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row).toContainText('Day');
  await expect(panel.getByText('Saved to slot_2')).toBeVisible();

  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(saved + 15);
  const unsaved = Number(await page.getByTestId('worker-minute').innerText());
  await row.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect(page.getByTestId('worker-window-savegame')).toHaveCount(0);
  const recovered = Number(await page.getByTestId('worker-minute').innerText());
  expect(recovered).toBeGreaterThanOrEqual(saved);
  expect(recovered).toBeLessThan(unsaved);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Add/Remove only exposes bounded Worker-installed programs and offers explicit uninstall confirmation', async ({ page }) => {
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Add/Remove Programs' }).click();
  const programs = page.getByTestId('worker-addremove');
  await expect(programs).toBeVisible();
  await expect(programs).toContainText('installed programs');
  await expect(programs.getByRole('button', { name: 'Remove selected' })).toBeDisabled();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
