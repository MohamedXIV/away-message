import { expect, test } from '@playwright/test';

/**
 * Real mouse-driven Worker / physical OS / DownloadHub / VFS / Installer /
 * RetroAmp journey. No injected engine and no mock download or audio.
 */
test('installed RetroAmp plays genuine PCM WAV created in Worker-owned Music folder', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();

  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Computer & Setup' }).click();
  const setup = page.getByTestId('worker-system-panel');
  await setup.getByRole('button', { name: 'Purchase starter hardware bundle ($35)' }).click();
  await expect(setup.getByRole('button', { name: 'Assemble owned package' })).toBeEnabled();
  await setup.getByRole('button', { name: 'Assemble owned package' }).click();
  await setup.getByRole('button', { name: 'Insert disc' }).click();
  await setup.getByRole('button', { name: 'Verify OS installer' }).click();
  await page.getByTestId('worker-os-plan')
    .getByRole('button', { name: 'Commit verified OS installation' }).click();
  await setup.getByRole('button', { name: 'Power on' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('desktop');
  await desktop.getByRole('button', { name: 'Close Computer & Setup' }).click();

  await desktop.getByRole('button', { name: 'Open Voyager Browser' }).click();
  const voyager = page.getByTestId('worker-window-browser');
  await expect(voyager.getByText('DownloadHub.local — Software Archive')).toBeVisible();
  const retroRow = voyager.locator('tr').filter({ hasText: 'RetroAmp Audio Player 2.95' });
  await expect(retroRow).toBeVisible();
  await retroRow.getByRole('button', { name: /Download/ }).click();
  await expect(page.getByTestId('worker-window-flashfetch')).toBeVisible();

  // The game's canonical transfer proceeds on world minutes, not fake UI progress.
  for (let i = 0; i < 8; i++) {
    if (await retroRow.getByText('✓ Downloaded').count()) break;
    await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  }
  await expect(retroRow.getByText('✓ Downloaded')).toBeVisible();
  await desktop.getByRole('button', { name: 'Minimize FlashFetch' }).click();
  await desktop.getByRole('button', { name: 'Minimize Voyager Browser' }).click();

  await desktop.getByRole('button', { name: 'Open My Computer' }).click();
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await explorer.getByRole('button', { name: 'Downloads', exact: true }).click();
  await explorer.getByRole('button', { name: 'Open file: retroamp_setup.exe' }).click();

  const installer = page.getByTestId('worker-window-installer');
  await expect(installer).toBeVisible();
  const taskbar = page.getByTestId('worker-desktop-taskbar');
  for (let i = 0; i < 4; i++) {
    const next = installer.getByRole('button', { name: /Next/ });
    await expect(next).toBeEnabled();
    // Regressions must fail fast with a geometric explanation, not hang
    // for minutes while a taskbar steals the installer footer's clicks.
    const buttonRect = await next.boundingBox();
    const barRect = await taskbar.boundingBox();
    expect(buttonRect, 'Installer Next button must be laid out').not.toBeNull();
    expect(barRect, 'Taskbar must exist').not.toBeNull();
    expect(buttonRect!.y + buttonRect!.height, 'Installer controls must be above taskbar').toBeLessThanOrEqual(barRect!.y);
    await next.click({ timeout: 6000 });
  }
  await expect(installer.getByText('Completing Setup')).toBeVisible();
  await installer.getByRole('button', { name: 'Finish' }).click();

  const retro = page.getByTestId('worker-retroamp');
  await expect(retro).toBeVisible();
  await expect(retro.getByText('PLAYLIST (0 TRACKS)')).toBeVisible();
  await retro.getByRole('button', { name: '+ ADD WAV' }).click();
  await expect(retro.getByText(/Motel Night Loop/)).toBeVisible();
  await retro.getByRole('button', { name: 'Play' }).click();
  const wav = retro.getByTestId('retroamp-real-audio');
  await expect(wav).toHaveAttribute('src', /^data:audio\/wav;base64,/);
  await expect.poll(() => wav.evaluate((element: HTMLAudioElement) => element.duration))
    .toBeGreaterThan(7);
  await expect.poll(() => wav.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0);
  // The canonical world advances independently. A revision refresh must not
  // remount the HTMLMediaElement and restart the sound.
  await wav.evaluate(element => { element.dataset.workerPlaybackMarker = 'retained'; });
  await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  await expect(wav).toHaveAttribute('data-worker-playback-marker', 'retained');

  await retro.getByRole('button', { name: 'Pause' }).click();
  await retro.getByRole('button', { name: 'CLEAR' }).click();
  await expect(retro.getByText('PLAYLIST (0 TRACKS)')).toBeVisible();
  await retro.getByRole('button', { name: '+ ADD WAV' }).click();
  await expect(retro.getByText(/Motel Night Loop/)).toBeVisible();

  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});
