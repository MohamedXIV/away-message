import { expect, test, type Page } from '@playwright/test';
import { installOrion48FromDos } from './workerDosTestHelper';

function assertNoMainThreadSimulation(page: Page) {
  return expect.poll(() => page.evaluate(() =>
    !('__simEngine' in window) && !('__simStore' in window),
  )).toBe(true);
}

async function startNewGame(page: Page) {
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  await expect(page.getByTestId('worker-physical-hardware-bench')).toBeVisible();
}

async function installStarterOrion48(page: Page) {
  await startNewGame(page);
  const desktop = await installOrion48FromDos(page);
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion48');
  await expect(desktop).toHaveAttribute('data-os-wallpaper', 'harbor_classic');
  return desktop;
}

async function desktopGridMetrics(desktop: ReturnType<Page['getByTestId']>) {
  return desktop.getByTestId('worker-desktop-icon-grid').evaluate((grid) => {
    const buttons = Array.from(grid.querySelectorAll<HTMLElement>('[data-desktop-icon]'));
    const box = grid.getBoundingClientRect();
    return {
      columns: new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().left))).size,
      icons: buttons.length,
      scrollWidth: grid.scrollWidth,
      clientWidth: grid.clientWidth,
      scrollHeight: grid.scrollHeight,
      clientHeight: grid.clientHeight,
      outside: buttons.filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.right > box.right + 1 || rect.left < box.left - 1;
      }).length,
      appIds: buttons.map((button) => button.getAttribute('data-app-id')),
    };
  });
}

test('ordinary / New Game installs Orion 4.8 and delivers a coherent, responsive, keyboard-usable desktop', async ({ page }) => {
  test.setTimeout(180_000);
  const desktop = await installStarterOrion48(page);
  expect(await page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);

  // In-world identity replaces the previous Worker diagnostic label.
  await expect(desktop.getByTestId('worker-desktop-uninstalled')).toHaveCount(0);
  await expect(desktop.getByTestId('worker-desktop-os-badge')).toContainText('Orion OS 4.8');
  await expect(desktop).not.toContainText('Worker-backed desktop');

  const metrics = await desktopGridMetrics(desktop);
  // Clean Orion has no preinstalled Pulse or FlashFetch: 11 core icons.
  expect(metrics.icons).toBe(11);
  expect(metrics.appIds).not.toContain('pulse');
  expect(metrics.appIds).not.toContain('flashfetch');
  expect(metrics.columns).toBeGreaterThanOrEqual(3);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(new Set(metrics.appIds).size).toBe(metrics.appIds.length);

  const taskbar = page.getByTestId('worker-desktop-taskbar');
  const startButton = taskbar.getByRole('button', { name: /Start/ });
  const menu = desktop.locator('#orion-start-menu');
  await startButton.click();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-os-start-menu', 'classic');
  await expect(menu.getByRole('button', { name: /Programs/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await startButton.click();
  await menu.getByRole('button', { name: /Documents/ }).click();
  await expect(page.getByTestId('worker-window-fileexplorer')).toBeVisible();
  await desktop.getByRole('button', { name: 'Close My Computer' }).click();

  // Pointer focus and roving arrow navigation share one authored icon surface.
  await desktop.locator('[data-desktop-icon="sys_computer"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(desktop.locator('[data-desktop-icon="sys_browser"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(desktop.locator('[data-desktop-icon="sys_mailbox"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('worker-window-mailbox')).toBeVisible();
  await expect(page.getByTestId('worker-window-mailbox').locator('.os-themed-titlebar'))
    .toHaveAttribute('data-inactive', 'false');
  await page.keyboard.press('Alt+F4');
  await expect(page.getByTestId('worker-window-mailbox')).toHaveCount(0);

  const notepadIcon = desktop.getByRole('button', { name: 'Open Notepad' });
  await notepadIcon.click();
  await expect(notepadIcon).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('worker-window-notepad')).toHaveCount(0);
  await notepadIcon.dblclick();
  const note = page.getByTestId('worker-window-notepad');
  await expect(note).toBeVisible();
  const before = await note.boundingBox();
  const titlebar = await note.locator('.os-themed-titlebar').boundingBox();
  expect(before).not.toBeNull();
  expect(titlebar).not.toBeNull();
  await page.mouse.move(titlebar!.x + 85, titlebar!.y + 12);
  await page.mouse.down();
  await page.mouse.move(titlebar!.x + 123, titlebar!.y + 32, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await note.boundingBox())?.x ?? 0).toBeGreaterThan(before!.x + 18);
  await desktop.getByRole('button', { name: 'Maximize Notepad' }).click();
  await expect(note).toHaveAttribute('style', /width: 100%/);
  await desktop.getByRole('button', { name: 'Restore Notepad' }).click();
  await expect(note).not.toHaveAttribute('style', /width: 100%/);

  const beforeResize = await note.boundingBox();
  const resizeHandle = await note.locator('div.cursor-nwse-resize').last().boundingBox();
  expect(beforeResize).not.toBeNull();
  expect(resizeHandle).not.toBeNull();
  await page.mouse.move(resizeHandle!.x + resizeHandle!.width / 2, resizeHandle!.y + resizeHandle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeHandle!.x + 60, resizeHandle!.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await note.boundingBox())?.width ?? 0)
    .toBeGreaterThan(beforeResize!.width + 30);

  await desktop.getByRole('button', { name: 'Minimize Notepad' }).click();
  await expect(note).toHaveCount(0);
  await expect(taskbar).toContainText('Notepad');
  await desktop.getByRole('button', { name: 'Taskbar Notepad' }).click();
  await expect(note).toBeVisible();

  await note.getByLabel('Name').fill('DesktopUxNote.txt');
  await note.getByRole('textbox', { name: 'Notepad document' }).fill('A believable Orion desktop.');
  await note.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(note.getByText('Saved C:/Documents/DesktopUxNote.txt')).toBeVisible();
  const savedMinute = Number(await page.getByTestId('worker-minute').innerText());
  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('worker-phase')).toHaveText('menu');
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await expect.poll(async () => Number(await page.getByTestId('worker-minute').innerText()))
    .toBeGreaterThanOrEqual(savedMinute);
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const recoveredDesktop = page.getByTestId('worker-desktop');
  await expect(recoveredDesktop).toHaveAttribute('data-os-theme', 'orion48');
  await recoveredDesktop.getByRole('button', { name: 'Open My Computer' }).dblclick();
  const documentIcon = page.getByTestId('worker-window-fileexplorer')
    .getByRole('button', { name: 'Open file: DesktopUxNote.txt' });
  await documentIcon.click();
  await expect(documentIcon).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Notepad document' })).toHaveCount(0);
  await documentIcon.dblclick();
  await expect(page.getByRole('textbox', { name: 'Notepad document' }))
    .toHaveValue('A believable Orion desktop.');
  await assertNoMainThreadSimulation(page);
});

test('the Orion desktop stays usable in a small viewport and honours reduced motion', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 820, height: 620 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const desktop = await installStarterOrion48(page);
  const desktopBox = await desktop.boundingBox();
  expect(desktopBox).not.toBeNull();

  const metrics = await desktopGridMetrics(desktop);
  // Clean Orion has no preinstalled Pulse or FlashFetch: 11 core icons.
  expect(metrics.icons).toBe(11);
  expect(metrics.appIds).not.toContain('pulse');
  expect(metrics.appIds).not.toContain('flashfetch');
  expect(metrics.columns).toBeGreaterThanOrEqual(3);
  expect(metrics.outside).toBe(0);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);

  await desktop.getByRole('button', { name: 'Open Notepad' }).dblclick();
  const note = page.getByTestId('worker-window-notepad');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('data-os-window-animation', 'snap');
  expect(await note.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  const frameBox = await note.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox!.x).toBeGreaterThanOrEqual(desktopBox!.x - 1);
  expect(frameBox!.x + frameBox!.width).toBeLessThanOrEqual(desktopBox!.x + desktopBox!.width + 1);
  expect(frameBox!.y + frameBox!.height).toBeLessThanOrEqual(desktopBox!.y + desktopBox!.height - 28 + 1);

  // Drag deliberately beyond the right edge; the entire titlebar and its
  // Close button must remain reachable inside the contained OS surface.
  const bar = note.locator('.os-themed-titlebar');
  const barBox = await bar.boundingBox();
  expect(barBox).not.toBeNull();
  await page.mouse.move(barBox!.x + 70, barBox!.y + 12);
  await page.mouse.down();
  await page.mouse.move(desktopBox!.x + desktopBox!.width + 300, barBox!.y + 12, { steps: 8 });
  await page.mouse.up();
  const moved = await note.boundingBox();
  expect(moved).not.toBeNull();
  expect(moved!.x).toBeGreaterThanOrEqual(desktopBox!.x - 1);
  expect(moved!.x + moved!.width).toBeLessThanOrEqual(desktopBox!.x + desktopBox!.width + 1);
  await expect(note.getByRole('button', { name: 'Close Notepad' })).toBeVisible();
  await desktop.getByRole('button', { name: 'Close Notepad' }).click();

  const taskbar = page.getByTestId('worker-desktop-taskbar');
  await taskbar.getByRole('button', { name: /Start/ }).click();
  const menu = desktop.locator('#orion-start-menu');
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(desktopBox!.x - 1);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(desktopBox!.x + desktopBox!.width + 1);
  expect(menuBox!.y).toBeGreaterThanOrEqual(desktopBox!.y - 1);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(desktopBox!.y + desktopBox!.height - 28 + 2);
  await menu.getByRole('button', { name: /Programs/ }).click();
  await expect(menu.getByRole('button', { name: /Voyager Browser/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await assertNoMainThreadSimulation(page);
});

test('Orion 6.0 keeps a distinct authored desktop through the central OS contract', async ({ page }) => {
  test.setTimeout(120_000);

  // Deterministic cold-save precondition only: the DEV Classic fixture sets a
  // canonical current-format OS generation, then navigation destroys it. The
  // desktop below is rendered and operated entirely by the ordinary Worker.
  await page.goto('/?runtime=legacy');
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__simStore && (window as any).__simEngine),
  )).toBe(true);
  const skip = page.getByRole('button', { name: 'skip to desktop' });
  if (await skip.isVisible({ timeout: 5_000 }).catch(() => false)) await skip.click();
  await page.evaluate(async () => {
    const store = (window as any).__simStore.getState();
    const engine = store.engine;
    // Presentation-only DEV fixture: explicitly mark the machine assembled
    // and powered as well as installed. A bare OS id on a non-existent PC
    // must never unlock Orion after #219's real boot gate.
    engine.hardware.loadState({
      computer: { ...engine.hardware.getComputerState(), assembled: true, poweredOn: true },
      display: engine.hardware.getDisplayState(),
    });
    engine.core.os.loadState({ currentOsId: 'Orion_6.0' });
    engine.invalidateStateCache?.();
    store.syncStateFromEngine();
    await (window as any).__slots.saveSlot(engine, 'slot_3');
  });

  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('combobox', { name: 'Save slot' }).selectOption('slot_3');
  await page.getByRole('button', { name: 'Load game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = page.getByTestId('worker-desktop');
  await expect(desktop).toHaveAttribute('data-os-theme', 'orion60');
  await expect(desktop).toHaveAttribute('data-os-wallpaper', 'canal_bliss');
  await expect(page.getByTestId('worker-desktop-taskbar')).toHaveAttribute('data-os-taskbar', 'canal');
  await expect(desktop.getByTestId('worker-desktop-os-badge')).toContainText('Orion OS 6.0');
  await assertNoMainThreadSimulation(page);

  const taskbar = page.getByTestId('worker-desktop-taskbar');
  await taskbar.getByRole('button', { name: /Start/ }).click();
  const menu = desktop.locator('#orion-start-menu');
  await expect(menu).toHaveAttribute('data-os-start-menu', 'canal');
  await expect(menu).toContainText('Player');
  await expect(menu).toContainText('Orion 6.0');
  await expect(menu.getByRole('button', { name: /Turn Off Computer/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  await desktop.getByRole('button', { name: 'Open Notepad' }).dblclick();
  const note = page.getByTestId('worker-window-notepad');
  await expect(note).toHaveAttribute('data-os-theme', 'orion60');
  await expect(note).toHaveAttribute('data-os-window-chrome', 'soft-classic');
  await desktop.getByRole('button', { name: 'Close Notepad' }).click();
  await assertNoMainThreadSimulation(page);
});
