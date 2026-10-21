import { expect, test } from '@playwright/test';

test('Worker-hosted authored Phaser room keeps gameplay commands on the single Worker', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/worker.html');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  const initial = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'room', exact: true }).click();
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  await expect(page.getByTestId('physical-world-host')).toBeVisible();
  await expect(page.locator('#root canvas').first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Shower' }).click();
  await expect(page.getByTestId('worker-room-notice')).toContainText('Took a shower');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(initial + 12);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});

test('Pulse BuddyItem and paged conversation use player-known Worker reads, including a current v6 slot', async ({ page }) => {
  test.setTimeout(90_000);
  // Prepare a CURRENT-FORMAT game slot using the normal game's QA fixture,
  // then navigate away: the old main-thread engine ceases to exist before
  // Worker boot. The new page NEVER imports that engine or its store.
  await page.goto('/');
  // Root now dynamically imports the selected runtime. A real legacy save
  // fixture may only read its engine after that asynchronous boot completes.
  await page.waitForFunction(() => !!(window as any).__simEngine &&
    !!(window as any).__slots, undefined, { timeout: 15_000 });
  const prepared = await page.evaluate(async () => {
    const w = window as any;
    const engine = w.__simEngine;
    const buddy = engine.social.getBuddies()[0];
    if (!buddy) throw new Error('No authored contact fixture');
    engine.social.learnHandle(buddy.id, buddy.handle);
    engine.social.sendMessage(buddy.id, buddy.id, 'player', 'FROM_CURRENT_V6_SLOT', engine.clock.getTotalMinutes());
    await w.__slots.saveSlot(engine, 'slot_2');
    return { name: buddy.displayName };
  });
  await page.goto('/worker.html');
  await expect(page.getByTestId('worker-first-shell')).toBeVisible();
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_2');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'pulse', exact: true }).click();
  const panel = page.getByTestId('worker-pulse-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(prepared.name, { exact: true })).toBeVisible();
  await expect(page.getByTestId('worker-pulse-messages')).toContainText('FROM_CURRENT_V6_SLOT');
  await panel.getByRole('textbox', { name: 'Pulse message' }).fill('FROM_WORKER_UI');
  await panel.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('worker-pulse-messages')).toContainText('FROM_WORKER_UI');
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window)))
    .toBe(true);
});
