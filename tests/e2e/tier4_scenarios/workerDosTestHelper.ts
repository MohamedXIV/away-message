import { expect, type Page } from '@playwright/test';

/** Ordinary in-game player journey, never Classic/dev injected state. */
export async function installOrion48FromDos(page: Page) {
  const bench = page.getByTestId('worker-physical-hardware-bench');
  await expect(bench).toBeVisible();
  await bench.getByRole('button', { name: 'Purchase starter hardware bundle ($35)' }).click();
  await bench.getByRole('button', { name: 'Assemble owned package' }).click();
  await bench.getByRole('button', { name: 'Power on' }).click();

  const dos = page.getByTestId('worker-dos-boot');
  await expect(dos).toBeVisible();
  await expect(page.getByTestId('worker-desktop')).toHaveCount(0);
  const prompt = page.getByRole('textbox', { name: 'DOS command' });
  await prompt.fill('MEDIA');
  await prompt.press('Enter');
  await expect(dos.getByTestId('worker-dos-transcript')).toContainText('1.');

  await prompt.fill('INSERT 1');
  await prompt.press('Enter');
  await expect(dos.getByTestId('worker-dos-media')).not.toContainText('NO DISC');
  await prompt.fill('SETUP');
  await prompt.press('Enter');

  const setup = page.getByTestId('worker-orion-installer');
  await expect(setup).toBeVisible();
  await expect(setup).toHaveAttribute('data-installer-edition', 'orion48');
  for (let step = 0; step < 3; step++) {
    await setup.getByRole('button', { name: 'Next' }).click();
  }
  await expect(setup).toContainText('Estimated installation:');
  await setup.getByRole('button', { name: 'Install from disc' }).click();
  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toBeVisible();
  await expect(page.getByTestId('worker-dos-boot')).toHaveCount(0);
  return desktop;
}
