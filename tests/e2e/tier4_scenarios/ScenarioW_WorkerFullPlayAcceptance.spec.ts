import { expect, test, type Page } from '@playwright/test';

function assertNoMainThreadSimulation(page: Page) {
  return expect.poll(() => page.evaluate(() =>
    !('__simEngine' in window) && !('__simStore' in window),
  )).toBe(true);
}

/**
 * #175 P3.44: release-level gameplay journey, not another isolated window
 * smoke. Both stories use mouse/keyboard on plain '/', with one authoritative
 * real Worker throughout each document. Explicit DEV-only seeding is allowed
 * ONLY for the second story's deterministic *preexisting café guest*, and is
 * destroyed by navigation before any gameplay operation.
 */
test('fresh root New Game: room needs → town outing → real PC installation → VFS → cold saved continuity', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await assertNoMainThreadSimulation(page);
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible();

  // Canonical room activity progresses the world; it is not a cosmetic toast.
  const startedMinute = Number(await page.getByTestId('worker-minute').textContent());
  await page.getByRole('button', { name: 'Shower' }).click();
  await expect(page.getByTestId('worker-room-notice')).toContainText('Took a shower');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThan(startedMinute);

  // Real map route and paid authored outing, not a synthetic browser travel flag.
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await expect(page.getByTestId('worker-city-travel')).toBeVisible();
  await page.getByRole('button', { name: 'Choose Suds & Spin' }).click();
  await page.getByRole('button', { name: 'Travel to Suds & Spin' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toHaveText('Suds & Spin');
  const beforeOuting = Number(await page.getByTestId('worker-minute').textContent());
  const beforeCash = await page.getByTestId('worker-hud').getByTitle('Cash on hand').textContent();
  await page.getByRole('button', { name: 'Go: Laundromat Run' }).click();
  await expect(page.getByTestId('worker-city-place-receipt')).toContainText('Laundromat');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThan(beforeOuting);
  await expect(page.getByTestId('worker-hud').getByTitle('Cash on hand'))
    .not.toHaveText(beforeCash ?? '');
  await page.getByRole('button', { name: 'Return home' }).click();
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();

  // Owned machine / authored installation / OS state lives in the one Worker.
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toBeVisible();
  await desktop.getByRole('button', { name: 'Open Computer & Setup' }).click();
  const setup = page.getByTestId('worker-system-panel');
  await setup.getByRole('button', { name: 'Purchase starter hardware bundle ($35)' }).click();
  await setup.getByRole('button', { name: 'Assemble owned package' }).click();
  await setup.getByRole('button', { name: 'Insert disc' }).click();
  await setup.getByRole('button', { name: 'Verify OS installer' }).click();
  await page.getByTestId('worker-os-plan')
    .getByRole('button', { name: 'Commit verified OS installation' }).click();
  await setup.getByRole('button', { name: 'Power on' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('desktop');
  await desktop.getByRole('button', { name: 'Close Computer & Setup' }).click();

  await desktop.getByRole('button', { name: 'Open Notepad' }).click();
  const note = page.getByTestId('worker-window-notepad');
  await note.getByLabel('Name').fill('FirstDayJourney.txt');
  await note.getByRole('textbox', { name: 'Notepad document' })
    .fill('Shower, launder my clothes, and get Orion running.');
  await note.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(note.getByText('Saved C:/Documents/FirstDayJourney.txt')).toBeVisible();
  const savedMinute = Number(await page.getByTestId('worker-minute').textContent());

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await assertNoMainThreadSimulation(page);
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').textContent()))
    .toBeGreaterThanOrEqual(savedMinute);
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();

  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await page.getByRole('button', { name: 'Open Computer & Setup' }).click();
  await expect(page.getByTestId('worker-boot-state')).toContainText('desktop');
  await desktop.getByRole('button', { name: 'Close Computer & Setup' }).click();
  await desktop.getByRole('button', { name: 'Open My Computer' }).click();
  await page.getByTestId('worker-window-fileexplorer')
    .getByRole('button', { name: 'Open file: FirstDayJourney.txt' }).click();
  await expect(page.getByRole('textbox', { name: 'Notepad document' }))
    .toHaveValue('Shower, launder my clothes, and get Orion running.');
  await assertNoMainThreadSimulation(page);
});

test('authored social continuation: café Ink → real Pulse message → room → desktop → cold recovery', async ({ page }) => {
  test.setTimeout(180_000);
  // Only deterministic precondition setup: the player has previously met a
  // genuinely present local contact in an EXISTING current-format world.
  // The Classic fixture is never imported or mounted while Worker plays.
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__simStore && (window as any).__slots),
  )).toBe(true);
  await page.evaluate(async () => {
    const engine = (window as any).__simStore.getState().engine;
    const arrival = engine.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'walk' });
    if (!arrival.success) throw new Error('Could not prepare canonical café location');
    const maya = engine.social.getBuddy('maya');
    if (!maya) throw new Error('Missing authored local contact');
    engine.social.learnHandle(maya.id, maya.handle);
    engine.relocateActorSpatially(maya.id, { x: 20, y: 60, z: 0 });
    if (engine.getCafeGuestRead('place_a1').guest?.actorId !== maya.id) {
      throw new Error('Café character not physically co-located');
    }
    await (window as any).__slots.saveSlot(engine, 'slot_2');
  });

  await page.goto('/'); // Plain production root, not /worker.html or a preview.
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await assertNoMainThreadSimulation(page);
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_2');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toContainText('Starlight Café');
  await expect(page.getByTestId('worker-cafe-presence')).toContainText('is here at the café');
  await page.getByRole('button', { name: /Talk with / }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('Hey! You made it!');

  // Mid-choice Ink persistence is part of the same player-driven play loop.
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_2')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('Hey! You made it!');
  // Continue last save is an implicit Load; its selected write target must
  // track the recovered World slot, not reset to the shell's initial slot_1.
  await expect(page.getByRole('combobox', { name: 'Save slot' })).toHaveValue('slot_2');
  await page.getByRole('button', { name: "Ask how they've been" }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('week comes out sideways');
  await page.getByRole('button', { name: 'Finish conversation' }).click();
  await expect(page.getByTestId('worker-cafe-dialogue')).toHaveCount(0);

  // The contact is real Social-known state; messages route through Worker
  // dispatch/archived conversation rather than a test-injected transcript.
  await page.getByRole('button', { name: 'pulse', exact: true }).click();
  const pulse = page.getByTestId('worker-pulse-panel');
  await expect(pulse).toBeVisible();
  await expect(pulse).toContainText('Maya');
  await pulse.getByRole('textbox', { name: 'Pulse message' })
    .fill('Enjoyed catching up at the café!');
  await pulse.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('worker-pulse-messages'))
    .toContainText('Enjoyed catching up at the café!');

  await page.getByRole('button', { name: 'room', exact: true }).click();
  await page.getByRole('button', { name: 'Return home' }).click();
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await desktop.getByRole('button', { name: 'Open Notepad' }).click();
  const note = page.getByTestId('worker-window-notepad');
  await note.getByLabel('Name').fill('CafeConversation.txt');
  await note.getByRole('textbox', { name: 'Notepad document' })
    .fill('I spoke with Maya, then sent a Pulse message.');
  await note.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(note.getByText('Saved C:/Documents/CafeConversation.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_2')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect(page.getByRole('combobox', { name: 'Save slot' })).toHaveValue('slot_2');
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  await page.getByRole('button', { name: 'pulse', exact: true }).click();
  await expect(page.getByTestId('worker-pulse-messages'))
    .toContainText('Enjoyed catching up at the café!');
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await desktop.getByRole('button', { name: 'Open My Computer' }).click();
  await page.getByTestId('worker-window-fileexplorer')
    .getByRole('button', { name: 'Open file: CafeConversation.txt' }).click();
  await expect(page.getByRole('textbox', { name: 'Notepad document' }))
    .toHaveValue('I spoke with Maya, then sent a Pulse message.');
  await assertNoMainThreadSimulation(page);
});
