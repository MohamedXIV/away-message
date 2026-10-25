import { expect, test } from '@playwright/test';
import { installOrion48FromDos } from './workerDosTestHelper';

test('#214 fresh Orion acquires Pulse only through real internet → VFS setup → install, then uninstalls', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = await installOrion48FromDos(page);
  await expect(desktop.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'pulse', exact: true })).toHaveCount(0);
  await expect(desktop.getByRole('button', { name: 'Open FlashFetch' })).toHaveCount(0);

  await desktop.getByRole('button', { name: 'Open Voyager Browser' }).dblclick();
  const browser = page.getByTestId('worker-window-browser');
  await expect(browser.getByText('DownloadHub.local — Software Archive')).toBeVisible();
  const pulse = browser.getByRole('row').filter({ hasText: 'Pulse Messenger 5.2 Classic' });
  await pulse.getByRole('button', { name: /Download/ }).click();

  // DownloadHub must open the system's real download queue, not the optional
  // third-party FlashFetch that this player has not downloaded.
  const system = page.getByTestId('worker-window-system');
  await expect(system.getByTestId('worker-system-panel')).toContainText('pulse52_setup.exe');
  await expect(page.getByTestId('worker-window-flashfetch')).toHaveCount(0);

  // Real canonical bandwidth: the 6 MiB Pulse installer needs world minutes
  // on the starter connection, not an instant faux UI progress animation.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  }
  await expect(system.getByTestId('worker-system-panel')).toContainText('pulse52_setup.exe · complete');
  await desktop.getByRole('button', { name: 'Close Computer & Setup' }).click();
  await desktop.getByRole('button', { name: 'Close Voyager Browser' }).click();

  await desktop.getByRole('button', { name: 'Open My Computer' }).dblclick();
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await explorer.getByRole('button', { name: 'Downloads', exact: true }).click();
  await explorer.getByRole('button', { name: 'Open file: pulse52_setup.exe' }).dblclick();
  const installer = page.getByTestId('worker-installer');
  await expect(installer).toContainText('Pulse Messenger');
  for (let step=0; step<4; step++) {
    await installer.getByRole('button', { name: /Next/ }).click();
  }
  await installer.getByRole('button', { name: 'Finish' }).click();
  await expect(desktop.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(1);
  await expect(page.getByTestId('worker-window-pulse')).toBeVisible();
  // Real Worker now exposes the original retro Pulse account onboarding,
  // instead of opening a permanently signed-in engineering chat panel.
  const messenger = page.getByTestId('worker-pulse-panel');
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'sign-in');
  // Signed-out Pulse really closes, so Quick Launch must cold-start and
  // charge the same Worker hardware time as desktop and Start Menu.
  const taskbar = desktop.getByTestId('worker-desktop-taskbar');
  const quickPulse = taskbar.getByRole('group', { name: 'Quick Launch' })
    .getByRole('button', { name: 'Pulse Messenger', exact: true });
  await expect(quickPulse).toBeVisible();
  await desktop.getByRole('button', { name: 'Close Pulse Messenger' }).click();
  const beforeCold = Number(await page.getByTestId('worker-minute').textContent());
  await quickPulse.click();
  await expect(messenger).toBeVisible();
  expect(Number(await page.getByTestId('worker-minute').textContent())).toBeGreaterThan(beforeCold);
  await messenger.getByText('Get a new Pulse ID').click();
  await messenger.getByLabel('Pulse ID').fill('new_player06');
  await messenger.getByLabel('Password', { exact: true }).fill('localtest123');
  await messenger.getByLabel('Confirm password').fill('localtest123');
  await messenger.getByRole('button', { name: 'Create Pulse ID' }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'signed-in');
  await expect(messenger).toContainText('new_player06');
  await messenger.getByRole('button', { name: 'Sign out' }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'sign-in');
  await messenger.getByLabel('Pulse ID').fill('new_player06');
  await messenger.getByLabel('Password', { exact: true }).fill('localtest123');
  await messenger.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'signed-in');

  // Offline dialogue is choice-driven and Worker-authored. No free textbox
  // invites arbitrary messages to a keyword bot.
  const choices = messenger.getByTestId('worker-pulse-choices');
  await expect(choices.getByRole('button', { name: 'Hey! How have you been lately?' })).toBeVisible();
  await expect(messenger.getByRole('textbox', { name: 'Pulse message' })).toHaveCount(0);
  await choices.getByRole('button', { name: 'Hey! How have you been lately?' }).click();
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');

  // Signed-in Pulse closes to tray (still running), so quick launch
  // restores the existing session immediately without a second startup cost.
  const beforeWarm = Number(await page.getByTestId('worker-minute').textContent());
  await desktop.getByRole('button', { name: 'Close Pulse Messenger' }).click();
  await expect(messenger).toHaveCount(0);
  await quickPulse.click();
  await expect(messenger).toBeVisible();
  expect(Number(await page.getByTestId('worker-minute').textContent())).toBe(beforeWarm);

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const loaded = page.getByTestId('worker-desktop');
  await expect(loaded.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(1);
  await loaded.getByRole('button', { name: 'Open Computer & Setup' }).dblclick();
  await page.getByTestId('worker-system-panel').getByRole('button', { name: 'Uninstall Pulse Messenger' }).click();
  await expect(loaded.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'pulse', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
