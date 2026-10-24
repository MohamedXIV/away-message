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

  await desktop.getByRole('button', { name: 'Open Voyager Browser' }).click();
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

  await desktop.getByRole('button', { name: 'Open My Computer' }).click();
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await explorer.getByRole('button', { name: 'Downloads', exact: true }).click();
  await explorer.getByRole('button', { name: 'Open file: pulse52_setup.exe' }).click();
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

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const loaded = page.getByTestId('worker-desktop');
  await expect(loaded.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(1);
  await loaded.getByRole('button', { name: 'Open Computer & Setup' }).click();
  await page.getByTestId('worker-system-panel').getByRole('button', { name: 'Uninstall Pulse Messenger' }).click();
  await expect(loaded.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'pulse', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
