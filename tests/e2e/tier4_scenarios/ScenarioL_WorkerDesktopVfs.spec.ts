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
  await notepad.getByLabel('Name').fill('OwnerBoundaryNote.txt');
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

test('Worker desktop public network reads canonical CityWire and job-board projections', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Town Sites' }).click();
  const publicWeb = page.getByTestId('worker-public-sites');
  await expect(publicWeb.getByRole('heading', { name: 'The City Wire' })).toBeVisible();
  await publicWeb.getByRole('button', { name: 'Jobs.local' }).click();
  await expect(publicWeb.getByRole('heading', { name: 'Oakhaven Job Board' })).toBeVisible();
  await expect(publicWeb.getByText('Canonical available gigs, up to 32 listings')).toBeVisible();
  await desktop.getByRole('button', { name: 'Minimize Town Sites' }).click();
  await expect(publicWeb).toHaveCount(0);
  await desktop.getByRole('button', { name: 'Taskbar Town Sites' }).click();
  await expect(publicWeb).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker windows reuse authored WindowFrame dragging, sizing and maximize without a shadow engine', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Notepad' }).click();
  const frame = page.getByTestId('worker-window-notepad');
  await expect(frame).toHaveClass(/os-themed-window/);
  const before = await frame.boundingBox();
  const titlebar = await frame.locator('.os-themed-titlebar').boundingBox();
  expect(before).not.toBeNull();
  expect(titlebar).not.toBeNull();
  await page.mouse.move(titlebar!.x + 85, titlebar!.y + 12);
  await page.mouse.down();
  await page.mouse.move(titlebar!.x + 123, titlebar!.y + 32, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await frame.boundingBox())?.x ?? 0).toBeGreaterThan(before!.x + 18);
  await desktop.getByRole('button', { name: 'Maximize Notepad' }).click();
  await expect(frame).toHaveAttribute('style', /width: 100%/);
  await desktop.getByRole('button', { name: 'Restore Notepad' }).click();
  await expect(frame).not.toHaveAttribute('style', /width: 100%/);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker desktop mounts the original authored Mailbox using owner-backed letters and parcels', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Mailbox' }).click();
  const mail = page.getByTestId('worker-window-mailbox');
  await expect(mail).toBeVisible();
  await expect(mail.getByRole('button', { name: /Inbox/ })).toBeVisible();
  await expect(mail.getByText('Check-In Notice & Rent Schedule').first()).toBeVisible();
  await desktop.getByRole('button', { name: 'Minimize Mailbox' }).click();
  await expect(mail).toHaveCount(0);
  await desktop.getByRole('button', { name: 'Taskbar Mailbox' }).click();
  await expect(mail).toBeVisible();
  await desktop.getByRole('button', { name: 'Close Mailbox' }).click();
  await expect(mail).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('real Orion taskbar/Start Menu route Worker apps and exclude unported apps', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  const taskbar = page.getByTestId('worker-desktop-taskbar');
  await expect(taskbar).toHaveAttribute('data-os-taskbar', /classic|canal/);
  await taskbar.getByRole('button', { name: /Start/ }).click();
  const menu = desktop.locator('#orion-start-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-os-start-menu', /classic|canal/);
  await menu.getByRole('button', { name: /Documents/ }).click();
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await expect(explorer).toBeVisible();
  await taskbar.getByRole('button', { name: 'Taskbar My Computer' }).click();
  await expect(explorer).toHaveCount(0);
  await taskbar.getByRole('button', { name: 'Taskbar My Computer' }).click();
  await expect(explorer).toBeVisible();
  await taskbar.getByRole('button', { name: /Start/ }).click();
  await expect(menu.getByText('Settings / Control Panel')).toBeVisible();
  await expect(menu.getByText('Add/Remove Programs')).toHaveCount(0);
  await menu.getByRole('button', { name: /Settings \/ Control Panel/ }).click();
  await expect(page.getByTestId('worker-window-system')).toBeVisible();
  await taskbar.getByRole('button', { name: 'Show Desktop' }).click();
  await expect(explorer).toHaveCount(0);
  await expect(page.getByTestId('worker-window-system')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});

test('Worker tray reuses original volume and Pulse preview, with bounded live OS clock', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const tray = page.getByTestId('worker-taskbar-tray');
  await expect(tray).toBeVisible();
  await expect(tray.getByTitle('Master Volume')).toBeVisible();
  await tray.getByTitle('Master Volume').click();
  await expect(tray.getByText('Volume', { exact: true })).toBeVisible();
  await expect(tray.getByRole('checkbox', { name: 'Mute' })).toBeVisible();
  await tray.getByTitle('Master Volume').click();
  await tray.getByTitle('Pulse Messenger').click();
  await expect(tray.getByText('No unread messages. suspiciously quiet…')).toBeVisible();
  await tray.getByRole('button', { name: 'Open Pulse' }).click();
  await expect(page.getByTestId('worker-window-pulse')).toBeVisible();
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
