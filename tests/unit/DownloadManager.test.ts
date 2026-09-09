import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { DownloadManager } from '../../src/engine/DownloadManager';

describe('DownloadManager (Bandwidth Allocation, Progress & Time Jumps)', () => {
  let eventBus: EventBus;
  let vfs: FileSystemEngine;
  let downloadManager: DownloadManager;
  let connectionSpeedKbps: number;

  beforeEach(() => {
    eventBus = new EventBus();
    vfs = new FileSystemEngine(eventBus);
    connectionSpeedKbps = 256; // 256 kbps = 32 KB/s
    downloadManager = new DownloadManager({
      eventBus,
      vfs,
      getConnectionSpeedKbps: () => connectionSpeedKbps,
    });
  });

  it('starts a download and allocates available bandwidth', () => {
    // 8 MB file (8,388,608 bytes)
    const task = downloadManager.startDownload({
      sourceId: 'downloadhub_pulse',
      sourceUrl: 'http://downloadhub.local/PulseSetup.exe',
      fileName: 'PulseSetup.exe',
      totalBytes: 8_388_608,
      sourceMaxKbps: 512,
      fileKind: 'executable',
    });

    expect(task.id).toBeDefined();
    expect(task.fileName).toBe('PulseSetup.exe');
    expect(task.status).toBe('downloading');

    const active = downloadManager.getActiveDownloads();
    expect(active.length).toBe(1);
    expect(active[0]?.allocatedKbps).toBe(256); // Bottlenecked by client 256k
  });

  it('rejects new transfers when there is no usable connection bandwidth', () => {
    connectionSpeedKbps = 0;

    expect(() =>
      downloadManager.startDownload({
        sourceId: 'offline_tool',
        sourceUrl: 'http://downloadhub.local/offline-tool.zip',
        fileName: 'offline-tool.zip',
        totalBytes: 1_000_000,
        sourceMaxKbps: 256,
      }),
    ).toThrow(/network|connection|offline/i);

    expect(downloadManager.getState().tasks).toHaveLength(0);
  });

  it('advances download progress over continuous time and completes file in VFS', () => {
    let completedEventEmitted = false;
    eventBus.on('download:completed', ({ task, filePath }) => {
      completedEventEmitted = true;
      expect(task.fileName).toBe('SmallTool.exe');
      expect(filePath).toBe('C:/Downloads/SmallTool.exe');
    });

    // 192 KB file = 196,608 bytes
    // At 256 kbps (32 KB/s), takes 196,608 / 32,768 = 6.0 seconds = 0.1 minutes
    const task = downloadManager.startDownload({
      sourceId: 'tool_small',
      sourceUrl: 'http://downloadhub.local/SmallTool.exe',
      fileName: 'SmallTool.exe',
      totalBytes: 196_608,
      sourceMaxKbps: 512,
      fileKind: 'executable',
    });

    // Advance 1 game minute (60 seconds)
    downloadManager.advanceTime(1, 1);

    const finishedTask = downloadManager.getTask(task.id);
    expect(finishedTask?.status).toBe('complete');
    expect(finishedTask?.downloadedBytes).toBe(196_608);
    expect(completedEventEmitted).toBe(true);

    // Verify file created in VFS
    const vfsFile = vfs.readFile('C:/Downloads/SmallTool.exe');
    expect(vfsFile).toBeDefined();
    expect(vfsFile?.sizeBytes).toBe(196_608);
  });

  it('fair-shares bandwidth across multiple concurrent downloads (FlashFetch mode)', () => {
    // 2 downloads in FlashFetch mode
    const task1 = downloadManager.startDownload({
      sourceId: 'dl_1',
      sourceUrl: 'http://downloadhub.local/file1.zip',
      fileName: 'file1.zip',
      totalBytes: 10_000_000,
      sourceMaxKbps: 512,
      manager: 'flashfetch',
    });

    const task2 = downloadManager.startDownload({
      sourceId: 'dl_2',
      sourceUrl: 'http://downloadhub.local/file2.zip',
      fileName: 'file2.zip',
      totalBytes: 10_000_000,
      sourceMaxKbps: 512,
      manager: 'flashfetch',
    });

    const active = downloadManager.getActiveDownloads();
    expect(active.length).toBe(2);

    // Total 256 kbps split equally -> 128 kbps each
    const t1 = downloadManager.getTask(task1.id);
    const t2 = downloadManager.getTask(task2.id);
    expect(t1?.allocatedKbps).toBe(128);
    expect(t2?.allocatedKbps).toBe(128);
  });

  it('accepts an explicit future client profile without an engine special-case branch', () => {
    const first = downloadManager.startDownload({
      sourceId: 'future_1',
      sourceUrl: 'http://downloadhub.local/future-1.zip',
      fileName: 'future-1.zip',
      totalBytes: 10_000_000,
      sourceMaxKbps: 512,
      clientProfile: {
        clientId: 'future-client',
        maxConcurrent: 2,
        supportsResume: true,
      },
    });

    const second = downloadManager.startDownload({
      sourceId: 'future_2',
      sourceUrl: 'http://downloadhub.local/future-2.zip',
      fileName: 'future-2.zip',
      totalBytes: 10_000_000,
      sourceMaxKbps: 512,
      clientProfile: {
        clientId: 'future-client',
        maxConcurrent: 2,
        supportsResume: true,
      },
    });

    expect(first.status).toBe('downloading');
    expect(second.status).toBe('downloading');
    expect(downloadManager.getActiveDownloads()).toHaveLength(2);
  });

  it('pauses, resumes, and cancels downloads correctly', () => {
    const task = downloadManager.startDownload({
      sourceId: 'dl_pause',
      sourceUrl: 'http://downloadhub.local/big.iso',
      fileName: 'big.iso',
      totalBytes: 50_000_000,
      sourceMaxKbps: 512,
      resumable: true,
    });

    // Advance 1 min (transfers 32 KB/s * 60s = 1.92 MB)
    downloadManager.advanceTime(1, 1);
    const midTask = downloadManager.getTask(task.id);
    expect(midTask?.downloadedBytes).toBeGreaterThan(1_000_000);
    const downloadedBeforePause = midTask!.downloadedBytes;

    // Pause
    downloadManager.pauseDownload(task.id);
    expect(downloadManager.getTask(task.id)?.status).toBe('paused');

    // Advance while paused -> no byte change
    downloadManager.advanceTime(1, 2);
    expect(downloadManager.getTask(task.id)?.downloadedBytes).toBe(downloadedBeforePause);

    // Resume
    downloadManager.resumeDownload(task.id);
    expect(downloadManager.getTask(task.id)?.status).toBe('downloading');

    // Cancel
    downloadManager.cancelDownload(task.id);
    expect(downloadManager.getTask(task.id)).toBeUndefined();
  });
});
