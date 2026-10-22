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
  await expect(page.getByTestId('worker-city-place-location')).toContainText('Starlight Café');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect(page.getByTestId('worker-city-place-location')).toContainText('Starlight Café');
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
  await expect(page.getByTestId('worker-city-place-location')).toContainText('Motel Lobby');
  await expect(page.getByTestId('worker-city-arrival')).toContainText('on foot');
});


test('Worker-owned laundromat visit commits canonical money and time and persists location', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/worker.html');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Suds & Spin' }).click();
  await page.getByRole('button', { name: 'Travel to Suds & Spin' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toHaveText('Suds & Spin');

  const beforeCash = await page.getByTestId('worker-hud').getByTitle('Cash on hand').textContent();
  const beforeMinute = Number(await page.getByTestId('worker-minute').textContent());
  await page.getByRole('button', { name: 'Go: Laundromat Run' }).click();
  await expect(page.getByTestId('worker-city-place-receipt')).toContainText('Laundromat');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThan(beforeMinute);
  await expect(page.getByTestId('worker-hud').getByTitle('Cash on hand')).not.toHaveText(beforeCash || '');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toHaveText('Suds & Spin');
  expect(await page.evaluate(() => Boolean((window as any).__simEngine || (window as any).__simStore))).toBe(false);
});

test('Worker cafe uses authored Phaser place and canonical presence, outing and cold save', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?runtime=worker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Starlight Café' }).click();
  await page.getByRole('button', { name: 'Travel to Starlight Café' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toHaveText('Starlight Café');
  await expect(page.getByTestId('worker-cafe-scene')).toBeVisible();
  await expect(page.getByTestId('worker-cafe-presence')).toContainText(
    /No one you know is here right now|is here at the café/,
  );
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
  const before = Number(await page.getByTestId('worker-minute').textContent());
  await page.getByRole('button', { name: 'Go: Travel to Starlight Café' }).click();
  await expect(page.getByTestId('worker-city-place-receipt')).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-cafe-scene')).toBeVisible();
  await expect(page.getByTestId('worker-cafe-presence')).toContainText(
    /No one you know is here right now|is here at the café/,
  );
});

test('Worker café runs compiled Ink choices with a genuinely co-located known guest', async ({ page }) => {
  test.setTimeout(110_000);
  // Legacy is a test-only canonical slot seeder, not a concurrent runtime or fake NPC.
  await page.goto('/?runtime=legacy');
  await expect.poll(async () => page.evaluate(() => Boolean((window as any).__simStore))).toBe(true);
  await page.evaluate(async () => {
    const engine = (window as any).__simStore.getState().engine;
    const travel = engine.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'walk' });
    if (!travel.success) throw Error('Cannot reach café: ' + travel.error);
    engine.relocateActorSpatially('maya', { x: 20, y: 60, z: 0 });
    if (engine.getCafeGuestRead('place_a1').guest?.actorId !== 'maya') {
      throw Error('Test actor is not physically present in the café');
    }
    await (window as any).__slots.saveSlot(engine, 'slot_1');
  });
  await page.goto('/?runtime=worker');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toHaveText('Starlight Café');
  await expect(page.getByTestId('worker-cafe-presence')).toContainText('is here at the café');
  await page.getByRole('button', { name: /Talk with / }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('Hey! You made it!');
  await page.getByRole('button', { name: "Ask how they've been" }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('week comes out sideways');
  await page.getByRole('button', { name: 'Finish conversation' }).click();
  await expect(page.getByTestId('worker-cafe-dialogue')).toHaveCount(0);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});
