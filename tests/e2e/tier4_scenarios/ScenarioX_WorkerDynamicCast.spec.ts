import { expect, test, type Page } from '@playwright/test';
import { installOrion48FromDos } from './workerDosTestHelper';

function noShadowEngine(page: Page) {
  return expect.poll(() => page.evaluate(() =>
    !('__simEngine' in window) && !('__simStore' in window),
  )).toBe(true);
}

async function inspectActualCast(page: Page): Promise<string[]> {
  // An in-person café encounter can be the actual cold-saved location.
  // Return to the owned home PC before inspecting its installed OS; do not
  // invent a remotely accessible desktop while the player is out in town.
  await page.getByRole('button', { name: 'room', exact: true }).click();
  if (await page.getByTestId('worker-city-place').isVisible()) {
    await page.getByRole('button', { name: 'Return home' }).click();
    await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  }
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  const bench = page.getByTestId('worker-physical-hardware-bench');
  await expect(desktop.or(bench)).toBeVisible();
  // A genuinely new player owns no Orion OS; use an actual purchased PC,
  // physical disc, DOS setup and saved-time installation before opening Lab.
  if (await bench.isVisible()) await installOrion48FromDos(page);
  await expect(desktop).toBeVisible();
  await desktop.getByRole('button', { name: 'Open AI Lab Inspector' }).dblclick();
  const lab = page.getByTestId('worker-lab-inspector');
  await expect(lab.getByTestId('worker-lab-actor')).toHaveCount(8);
  const roster = await lab.getByTestId('worker-lab-actor').allTextContents();
  expect(roster.join(' ')).not.toMatch(/\b(?:Maya|Mr\. Henderson|Ryan|Nora)\b/);
  await noShadowEngine(page);
  return roster.map(value => value.split(' · ')[0]!.trim());
}

/** No Classic, seeded guest or direct engine access: a genuine first-day player. */
test('#213 plain-root New Game makes a varied, player-known cast with a real café encounter and cold restore', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();

  const first = await inspectActualCast(page);
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Starlight Café' }).click();
  await page.getByRole('button', { name: 'Travel to Starlight Café' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toContainText('Starlight Café');
  const guest = page.getByTestId('worker-cafe-presence');
  await expect(guest).toContainText('is here at the café');
  await page.getByRole('button', { name: /Talk with / }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('Hey! You made it!');
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('Hey! You made it!');
  expect(await inspectActualCast(page)).toEqual(first);
  await noShadowEngine(page);

  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await expect(page.getByTestId('worker-physical-room')).toBeVisible();
  const second = await inspectActualCast(page);
  expect(second).not.toEqual(first);

  // The SECOND independent world must also support a real player-operated
  // café/social path, not merely produce a different diagnostic roster.
  await page.getByRole('button', { name: 'city', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Starlight Café' }).click();
  await page.getByRole('button', { name: 'Travel to Starlight Café' }).click();
  await expect(page.getByTestId('worker-city-place-location')).toContainText('Starlight Café');
  await expect(page.getByTestId('worker-cafe-presence')).toContainText('is here at the café');
  await page.getByRole('button', { name: /Talk with / }).click();
  await expect(page.getByTestId('worker-cafe-dialogue-text')).toContainText('Hey! You made it!');
  await noShadowEngine(page);
});
