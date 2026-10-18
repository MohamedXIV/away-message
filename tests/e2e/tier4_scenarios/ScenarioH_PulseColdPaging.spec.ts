import { test, expect } from '../fixtures/testFixture';

test('production cold boot pages the real React Pulse history and preserves full Save Log (#173)', async ({
  page, desktopPage,
}) => {
  test.setTimeout(90_000);
  await desktopPage.goto();
  const fixture = await page.evaluate(async () => {
    // @ts-expect-error served by Vite only in browser
    const { mountPulseColdPagingBrowserHarness } = await import(/* @vite-ignore */ '/src/tools/PulsePagingBrowserHarness.tsx');
    return mountPulseColdPagingBrowserHarness();
  });
  expect(fixture.total).toBe(200);
  const host = page.locator('#pulse-cold-browser-harness');

  await expect(host.getByText('COLD_BROWSER_199')).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText('COLD_BROWSER_150')).toBeVisible();
  await expect(host.getByText('151–200 of 200 messages')).toBeVisible();
  await host.getByRole('button', { name: 'Older' }).click();
  await expect(host.getByText('COLD_BROWSER_100')).toBeVisible();
  await expect(host.getByText('COLD_BROWSER_099')).toHaveCount(0);
  await host.getByRole('button', { name: 'Older' }).click();
  await expect(host.getByText('COLD_BROWSER_050')).toBeVisible();
  await host.getByRole('button', { name: 'Older' }).click();
  await expect(host.getByText('COLD_BROWSER_000')).toBeVisible();
  await expect(host.getByText('1–50 of 200 messages')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Older' })).toBeDisabled();

  await host.getByRole('button', { name: 'Newer' }).click();
  await host.getByRole('button', { name: 'Newer' }).click();
  await host.getByRole('button', { name: 'Newer' }).click();
  await expect(host.getByText('COLD_BROWSER_199')).toBeVisible();
  await host.getByRole('button', { name: 'Save log' }).click();

  await expect.poll(async () => page.evaluate(actorId => {
    const engine = (window as any).__simStore.getState().engine;
    const buddy = engine.social.getBuddy(actorId);
    const saved = engine.vfs.listDirectory('C:/Documents').find((item: any) =>
      item.name.startsWith(`Pulse_${buddy.handle}_Day`) && item.name.endsWith('.txt'));
    return saved?.content?.match(/COLD_BROWSER_/g)?.length ?? 0;
  }, fixture.actorId), { timeout: 15_000 }).toBe(200);

  const afterSave = await page.evaluate(async ({ actorId, slotId }) => {
    // @ts-expect-error browser-only source import
    const { saveSlot, loadSlotEngine } = await import(/* @vite-ignore */ '/src/persistence/slots.ts');
    const original = (window as any).__simStore.getState().engine;
    const privatePage = await original.getConversationReadAsync('not-a-learned-contact', 150, 50);
    await saveSlot(original, slotId);
    const restored = await loadSlotEngine(slotId);
    if (!restored) throw new Error('Failed to reload cold browser fixture');
    const older = await restored.getConversationReadAsync(actorId, 150, 50);
    return {
      cold: restored.social.hasColdConversations(),
      total: older.total,
      first: older.messages[0]?.text,
      last: older.messages.at(-1)?.text,
      privateCount: privatePage.messages.length,
    };
  }, fixture);
  expect(afterSave).toEqual({
    cold: true, total: 200, first: 'COLD_BROWSER_000', last: 'COLD_BROWSER_049', privateCount: 0,
  });
});
