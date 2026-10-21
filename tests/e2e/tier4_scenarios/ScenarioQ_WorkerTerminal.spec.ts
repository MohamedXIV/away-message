import { expect, test } from '@playwright/test';

test('Worker Command Prompt reads and writes real VFS data shared with Explorer and cold saves', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Command Prompt' }).click();
  const terminal = page.getByTestId('worker-terminal');
  const output = terminal.getByTestId('worker-terminal-output');
  const command = terminal.getByRole('textbox', { name: 'Command line' });
  const run = async (value: string) => {
    await command.fill(value);
    await command.press('Enter');
    await expect(command).toBeEnabled();
  };
  await run('HELP');
  await expect(output).toContainText('Worker-backed');
  await run('CD C:/Documents');
  await expect(terminal.getByText('C:/Documents>')).toBeVisible();
  await run('DIR');
  await expect(output).toContainText('Readme.txt');
  await run('TYPE Readme.txt');
  await expect(output).toContainText('Welcome to Orion OS 4.8');
  await run('SAVE WorkerCommandNote.txt Same owner same file');
  await expect(output).toContainText('Saved C:/Documents/WorkerCommandNote.txt');
  await run('TYPE WorkerCommandNote.txt');
  await expect(output).toContainText('Same owner same file');
  await run('PING localhost');
  await expect(output).toContainText('Unsupported command: ping');
  // Like a real OS, an active window occludes desktop icons. Minimize it
  // using the visible titlebar instead of force-clicking through the window.
  await desktop.getByRole('button', { name: 'Minimize Command Prompt' }).click();
  await expect(terminal).toHaveCount(0);
  await desktop.getByRole('button', { name: 'Open My Computer' }).click({ timeout: 6_000 });
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await expect(explorer.getByRole('button', { name: 'Open file: WorkerCommandNote.txt' })).toBeVisible();
  await explorer.getByRole('button', { name: 'Open file: WorkerCommandNote.txt' }).click();
  await expect(page.getByRole('textbox', { name: 'Notepad document' })).toHaveValue('Same owner same file');

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open Command Prompt' }).click({ timeout: 6_000 });
  const recovered = page.getByTestId('worker-terminal');
  await recovered.getByRole('textbox', { name: 'Command line' }).fill('TYPE C:/Documents/WorkerCommandNote.txt');
  await recovered.getByRole('textbox', { name: 'Command line' }).press('Enter');
  await expect(recovered.getByTestId('worker-terminal-output')).toContainText('Same owner same file');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker terminal rejects parent-directory escape and cannot fabricate network output', async ({ page }) => {
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByTestId('worker-desktop').getByRole('button', { name: 'Open Command Prompt' }).click();
  const terminal = page.getByTestId('worker-terminal');
  const prompt = terminal.getByRole('textbox', { name: 'Command line' });
  for (const cmd of ['CD ../../', 'SAVE C:/Windows/Injected.txt no', 'DEL C:/Documents/../../Readme.txt']) {
    await prompt.fill(cmd); await prompt.press('Enter');
    await expect(prompt).toBeEnabled();
  }
  await expect(terminal.getByTestId('worker-terminal-output')).toContainText('Invalid path');
  await expect(terminal.getByTestId('worker-terminal-output')).toContainText('SAVE requires');
  await expect(terminal.getByTestId('worker-terminal-output')).toContainText('DEL only supports');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
