import { test, expect } from '@playwright/test';

test('Worker city travel and saved location', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'room', exact: true }).click();
  await page.getByRole('button', { name: 'Leave room / City map' }).click();
  await expect(page.getByTestId('worker-city-location')).toContainText('Room 104');
  await page.getByRole('button', { name: 'Choose Starlight Café' }).click();
  await page.getByRole('button', { name: 'Travel to Starlight Café' }).click();
  await expect(page.getByTestId('worker-city-location')).toContainText('Starlight Café');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await expect(page.getByTestId('worker-city-location')).toContainText('Starlight Café');
  await page.getByRole('button', { name: 'Return home' }).click();
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
});

test('Travel mode previews a walk when no bus route exists', async ({ page }) => {
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Motel Lobby' }).click();
  await page.getByRole('combobox', { name: 'Travel mode' }).selectOption('bus');
  await expect(page.getByTestId('worker-city-quote')).toContainText('no full bus route');
  await page.getByRole('button', { name: 'Travel to Motel Lobby' }).click();
  await expect(page.getByTestId('worker-city-location')).toContainText('Motel Lobby');
  await expect(page.getByTestId('worker-city-receipt')).toContainText('on foot');
});
