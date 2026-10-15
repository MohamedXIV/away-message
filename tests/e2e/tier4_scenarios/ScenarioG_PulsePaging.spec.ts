import { test, expect } from '../fixtures/testFixture';

test('real React Pulse chat pages older/newer messages and Save Log exports complete history (#172)', async ({
  page, desktopPage,
}) => {
  test.setTimeout(60_000);
  await desktopPage.goto();
  const seed = await page.evaluate(async () => {
    const { mountPulsePagingBrowserHarness } = await import(
      /* @vite-ignore */ '/src/tools/PulsePagingBrowserHarness.tsx'
    );
    return mountPulsePagingBrowserHarness();
  });
  expect(seed.total).toBe(125);
  const host = page.locator('#pulse-paging-harness');
  await expect(host.getByText('PAGING_BROWSER_124')).toBeVisible({ timeout: 10_000 });
  await expect(host.getByText('PAGING_BROWSER_075')).toBeVisible();
  await expect(host.getByText('PAGING_BROWSER_074')).toHaveCount(0);
  await expect(host.getByText('76–125 of 125 messages')).toBeVisible();

  await host.getByRole('button', { name: 'Older' }).click();
  await expect(host.getByText('PAGING_BROWSER_074')).toBeVisible();
  await expect(host.getByText('PAGING_BROWSER_025')).toBeVisible();
  await expect(host.getByText('PAGING_BROWSER_124')).toHaveCount(0);
  await expect(host.getByText('26–75 of 125 messages')).toBeVisible();

  await host.getByRole('button', { name: 'Older' }).click();
  await expect(host.getByText('PAGING_BROWSER_000')).toBeVisible();
  await expect(host.getByText('PAGING_BROWSER_024')).toBeVisible();
  await expect(host.getByText('PAGING_BROWSER_025')).toHaveCount(0);
  await expect(host.getByText('1–25 of 125 messages')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Older' })).toBeDisabled();

  await host.getByRole('button', { name: 'Newer' }).click();
  await host.getByRole('button', { name: 'Newer' }).click();
  await expect(host.getByText('PAGING_BROWSER_124')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Newer' })).toBeDisabled();

  await host.getByRole('button', { name: 'Save log' }).click();
  const saved = await page.evaluate((actorId) => {
    const engine = (window as any).__simStore.getState().engine;
    const buddy = engine.social.getBuddy(actorId);
    const files = engine.vfs.listDirectory('C:/Documents');
    const file = files.find((item: any) =>
      item.name.startsWith(`Pulse_${buddy.handle}_Day`) && item.name.endsWith('.txt')
    );
    return { body: file?.content ?? '', total: engine.getConversationRead(actorId, 0, 50).total };
  }, seed.actorId);
  expect(saved.total).toBe(125);
  expect(saved.body).toContain('PAGING_BROWSER_000');
  expect(saved.body).toContain('PAGING_BROWSER_124');
  expect(saved.body.match(/PAGING_BROWSER_/g)).toHaveLength(125);
});
