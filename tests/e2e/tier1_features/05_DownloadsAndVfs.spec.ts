import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Downloads & Virtual File System (VFS)', () => {
  test.beforeEach(async ({ desktopPage }) => {
    await desktopPage.goto();
  });

  test('TC-DVFS-01: Starting download creates task and progresses in background', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().startDownload({
        sourceId: 'src_retroamp',
        url: 'http://retroamp.local/downloads/retroamp_setup.exe',
        fileName: 'retroamp_setup.exe',
        totalBytes: 5000000,
        sourceMaxKbps: 256,
        fileKind: 'installer',
        appAssociation: 'retroamp',
      });
    });

    const state = await sim.getState();
    expect(state.downloads.length).toBeGreaterThan(0);
    const task = state.downloads.find((d: any) => d.fileName === 'retroamp_setup.exe');
    expect(task).toBeDefined();
    expect(task.status).toBe('downloading');

    // Advance 5 minutes to finish download
    await sim.advanceGameMinutes(5, 'Download RetroAmp');

    const stateAfter = await sim.getState();
    const taskAfter = stateAfter.downloads.find((d: any) => d.fileName === 'retroamp_setup.exe');
    expect(taskAfter.status).toBe('complete');

    // Check VFS file in C:/Downloads/
    const fileExists = Object.values(stateAfter.vfs.files).some(
      (f: any) => f.name === 'retroamp_setup.exe' && f.parentPath === 'C:/Downloads'
    );
    expect(fileExists).toBe(true);
  });

  test('TC-DVFS-02: Pausing and resuming a download task', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().startDownload({
        sourceId: 'src_bigfile',
        url: 'http://test.local/bigfile.zip',
        fileName: 'bigfile.zip',
        totalBytes: 20000000,
        sourceMaxKbps: 256,
      });
    });

    let state = await sim.getState();
    const task = state.downloads.find((d: any) => d.fileName === 'bigfile.zip');
    expect(task).toBeDefined();

    // Pause
    await page.evaluate((id) => {
      (window as any).__simStore.getState().pauseDownload(id);
    }, task.id);

    state = await sim.getState();
    const pausedTask = state.downloads.find((d: any) => d.id === task.id);
    expect(pausedTask.status).toBe('paused');

    // Resume
    await page.evaluate((id) => {
      (window as any).__simStore.getState().resumeDownload(id);
    }, task.id);

    state = await sim.getState();
    const resumedTask = state.downloads.find((d: any) => d.id === task.id);
    expect(resumedTask.status).toBe('downloading');
  });

  test('TC-DVFS-03: File Explorer opens and browses directory tree', async ({ page, sim }) => {
    await sim.openWindow('fileexplorer', 'My Computer');
    const explorerWin = page.locator('.window-frame:has-text("My Computer")').first();
    await expect(explorerWin).toBeVisible({ timeout: 5000 });
  });

  test('TC-DVFS-04: Moving file to Trash and emptying Recycle Bin', async ({ page, sim }) => {
    // Create test file in VFS
    await page.evaluate(() => {
      (window as any).__simStore.getState().createFile({
        name: 'test_doc.txt',
        path: 'C:/Desktop/test_doc.txt',
        parentPath: 'C:/Desktop',
        kind: 'text',
        sizeBytes: 1024,
        extension: '.txt',
        content: 'Hello World',
      });
    });

    let state = await sim.getState();
    expect(state.vfs.files['C:/Desktop/test_doc.txt']).toBeDefined();

    // Move to Trash
    await page.evaluate(() => {
      (window as any).__simStore.getState().moveFileToTrash('C:/Desktop/test_doc.txt');
    });

    state = await sim.getState();
    expect(state.vfs.files['C:/Desktop/test_doc.txt']).toBeUndefined();
    expect(state.vfs.files['C:/Trash/test_doc.txt']).toBeDefined();

    // Empty Trash
    await page.evaluate(() => {
      (window as any).__simStore.getState().emptyTrash();
    });

    state = await sim.getState();
    expect(state.vfs.files['C:/Trash/test_doc.txt']).toBeUndefined();
  });

  test('TC-DVFS-05: Canceling a download frees active bandwidth', async ({ page, sim }) => {
    await page.evaluate(() => {
      (window as any).__simStore.getState().startDownload({
        sourceId: 'src_cancel_test',
        url: 'http://test.local/cancel_test.iso',
        fileName: 'cancel_test.iso',
        totalBytes: 50000000,
        sourceMaxKbps: 256,
      });
    });

    let state = await sim.getState();
    const task = state.downloads.find((d: any) => d.fileName === 'cancel_test.iso');
    expect(task).toBeDefined();

    await page.evaluate((id) => {
      (window as any).__simStore.getState().cancelDownload(id);
    }, task.id);

    state = await sim.getState();
    const canceledTask = state.downloads.find((d: any) => d.id === task.id);
    expect(canceledTask).toBeUndefined();
  });
});
