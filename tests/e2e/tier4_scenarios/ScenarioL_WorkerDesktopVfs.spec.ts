import { expect, test } from '@playwright/test';

test('Worker-owned desktop reuses window store; Explorer and Notepad persist real VFS files', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/worker.html');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);

  await desktop.getByRole('button', { name: 'Open Notepad' }).click();
  const notepad = page.getByTestId('worker-window-notepad');
  await expect(notepad).toBeVisible();
  await notepad.getByLabel('worker-document-name').fill('OwnerBoundaryNote.txt');
  await notepad.getByRole('textbox', { name: 'Notepad document' })
    .fill('Written into the one canonical Worker world');
  await notepad.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(notepad.getByText('Saved C:/Documents/OwnerBoundaryNote.txt')).toBeVisible();

  await desktop.getByRole('button', { name: 'Minimize Notepad' }).click();
  await expect(notepad).toHaveCount(0);
  await expect(page.getByTestId('worker-desktop-taskbar')).toContainText('Notepad');
  await desktop.getByRole('button', { name: 'Taskbar Notepad' }).click();
  await expect(notepad).toBeVisible();
  await desktop.getByRole('button', { name: 'Close Notepad' }).click();
  await expect(notepad).toHaveCount(0);
  await desktop.getByRole('button', { name: 'Open My Computer' }).click();
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole('button', { name: 'Open file: OwnerBoundaryNote.txt' })).toBeVisible();
  await explorer.getByRole('button', { name: 'Open file: OwnerBoundaryNote.txt' }).click();
  await expect(page.getByTestId('worker-window-notepad')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Notepad document' }))
    .toHaveValue('Written into the one canonical Worker world');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker desktop Pulse window can minimize, restore and query same authorized conversations', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Pulse Messenger' }).click();
  await expect(page.getByTestId('worker-window-pulse')).toBeVisible();
  await expect(page.getByTestId('worker-pulse-panel')).toBeVisible();
  await desktop.getByRole('button', { name: 'Minimize Pulse Messenger' }).click();
  await expect(page.getByTestId('worker-window-pulse')).toHaveCount(0);
  await desktop.getByRole('button', { name: 'Taskbar Pulse Messenger' }).click();
  await expect(page.getByTestId('worker-window-pulse')).toBeVisible();
  await desktop.getByRole('button', { name: 'Close Pulse Messenger' }).click();
  await expect(page.getByTestId('worker-window-pulse')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
