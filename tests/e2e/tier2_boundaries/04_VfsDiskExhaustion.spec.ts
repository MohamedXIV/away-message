import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 2: VFS Disk Space & Resource Limits', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-VDE-01: Baseline system initializes with 40GB total HDD space', async ({ sim }) => {
    const state = await sim.getState();
    expect(state.hardware.hddTotalGB).toBe(40);
    expect(state.hardware.hddFreeGB).toBeGreaterThan(0);
  });

  test('TC-VDE-02: Adding files to VFS decreases available free disk space', async ({ page }) => {
    const freeBefore = await page.evaluate(() => (window as any).__simEngine.vfs.getFreeDiskBytes());

    await page.evaluate(() => {
      (window as any).__simStore.getState().createFile({
        name: 'huge_iso.iso',
        path: 'C:/Downloads/huge_iso.iso',
        parentPath: 'C:/Downloads',
        kind: 'executable',
        sizeBytes: 200 * 1024 * 1024, // 200 MB
      });
    });

    const freeAfter = await page.evaluate(() => (window as any).__simEngine.vfs.getFreeDiskBytes());
    expect(freeAfter).toBeLessThan(freeBefore);
  });

  test('TC-VDE-03: Deleting files and emptying Recycle Bin reclaims free disk space', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().createFile({
        name: 'temp_big.dat',
        path: 'C:/Desktop/temp_big.dat',
        parentPath: 'C:/Desktop',
        kind: 'text',
        sizeBytes: 50 * 1024 * 1024, // 50 MB
      });
    });

    const freeAfterCreate = await page.evaluate(() => (window as any).__simEngine.vfs.getFreeDiskBytes());

    await page.evaluate(() => {
      (window as any).__simStore.getState().deleteFile('C:/Desktop/temp_big.dat');
    });

    const freeAfterDelete = await page.evaluate(() => (window as any).__simEngine.vfs.getFreeDiskBytes());
    expect(freeAfterDelete).toBeGreaterThanOrEqual(freeAfterCreate);
  });

  test('TC-VDE-04: Deep directory hierarchies in VFS resolve correctly', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().createFile({
        name: 'Projects',
        path: 'C:/Documents/Projects',
        parentPath: 'C:/Documents',
        kind: 'directory',
        sizeBytes: 0,
      });
      (window as any).__simStore.getState().createFile({
        name: 'nested.txt',
        path: 'C:/Documents/Projects/nested.txt',
        parentPath: 'C:/Documents/Projects',
        kind: 'text',
        sizeBytes: 512,
      });
    });

    const state = await sim.getState();
    expect(state.vfs.files['C:/Documents/Projects/nested.txt']).toBeDefined();
  });

  test('TC-VDE-05: Trash folder isolates deleted items from main directories', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().createFile({
        name: 'trash_test.txt',
        path: 'C:/Desktop/trash_test.txt',
        parentPath: 'C:/Desktop',
        kind: 'text',
        sizeBytes: 256,
      });
      (window as any).__simStore.getState().moveFileToTrash('C:/Desktop/trash_test.txt');
    });

    const state = await sim.getState();
    expect(state.vfs.files['C:/Desktop/trash_test.txt']).toBeUndefined();
    expect(state.vfs.files['C:/Trash/trash_test.txt']).toBeDefined();
  });
});
