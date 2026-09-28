import { test, expect } from '@playwright/test';

interface CharacterRuntimeStats {
  actorCount: number;
  surfaceCount: number;
  meshCount: number;
  surfaceNames: string[];
  sampleCount: number;
  averageUpdateMs: number;
  maxUpdateMs: number;
  actualFps: number;
}

async function readCharacterStats(page: import('@playwright/test').Page): Promise<CharacterRuntimeStats> {
  return page.evaluate(() => {
    const runtime = (window as typeof window & {
      __awayPhysicalWorldRuntime?: {
        getScene(): { getCharacterRuntimeStats(): CharacterRuntimeStats } | null;
      };
    }).__awayPhysicalWorldRuntime;
    const scene = runtime?.getScene();
    if (!scene) throw new Error('Away physical-world debug runtime is unavailable');
    return scene.getCharacterRuntimeStats();
  });
}

test.describe('Issue #25 Away Puppet Phaser browser proof', () => {
  test('renders a modular three-actor group and preserves surfaces across authored view changes', async ({ page }) => {
    await page.goto('/?fixture=world');

    await expect(page.getByTestId('physical-world-host')).toBeVisible();
    await expect(page.getByTestId('phaser-container').locator('canvas')).toBeVisible();
    const badge = page.getByTestId('away-puppet-runtime-stats');
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge).toContainText('Away Puppet: 3 actors');

    await expect.poll(async () => (await readCharacterStats(page)).meshCount, {
      timeout: 10_000,
      message: 'expected Phaser Mesh2D children for the Away Puppet surfaces',
    }).toBeGreaterThan(0);

    await page.waitForTimeout(1200);
    const before = await readCharacterStats(page);

    expect(before.actorCount).toBe(3);
    expect(before.surfaceCount).toBe(3);
    expect(before.meshCount).toBeGreaterThanOrEqual(30);
    expect(before.surfaceNames).toHaveLength(3);
    expect(new Set(before.surfaceNames).size).toBe(3);
    expect(before.sampleCount).toBeGreaterThan(10);
    expect(Number.isFinite(before.averageUpdateMs)).toBe(true);
    expect(Number.isFinite(before.maxUpdateMs)).toBe(true);
    expect(before.actualFps).toBeGreaterThan(0);

    console.log('[away-puppet-performance]', JSON.stringify(before));

    await page.getByRole('button', { name: /View A2/ }).click();
    await expect.poll(async () => (await readCharacterStats(page)).surfaceNames).toEqual(before.surfaceNames);

    await page.getByRole('button', { name: /View A1/ }).click();
    await expect.poll(async () => (await readCharacterStats(page)).surfaceNames).toEqual(before.surfaceNames);

    const after = await readCharacterStats(page);
    expect(after.surfaceCount).toBe(3);
    expect(after.meshCount).toBeGreaterThanOrEqual(30);
  });
});
