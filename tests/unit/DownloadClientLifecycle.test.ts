import { describe, expect, it } from 'vitest';
import { DownloadManager } from '../../src/engine/DownloadManager';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import type { InstalledSoftwareRecord } from '../../src/engine/types';

const flashFetchInstall: InstalledSoftwareRecord = {
  id: 'inst_sw_flashfetch_31',
  appId: 'app.flashfetch',
  name: 'FlashFetch Download Accelerator',
  version: '3.1',
  installedBytes: 12_582_912,
  installPath: 'C:/Program Files/FlashFetch',
  installedAtMinute: 0,
  isPortable: false,
  isAdware: false,
  shortcuts: [],
};

describe('download client lifecycle isolation', () => {
  it('keeps completed files and unrelated active transfers when FlashFetch is uninstalled', () => {
    const eventBus = new EventBus();
    const vfs = new FileSystemEngine(eventBus);
    const downloads = new DownloadManager({
      eventBus,
      vfs,
      getConnectionSpeedKbps: () => 256,
    });
    const software = new SoftwareRegistry(
      eventBus,
      vfs,
      {
        getOsVersion: () => 'Orion_6.0',
        getRamMb: () => 1024,
        getCpuTier: () => 2,
      },
      [flashFetchInstall],
    );

    const completed = downloads.startDownload({
      sourceId: 'completed_asset',
      sourceUrl: 'http://downloadhub.local/completed.zip',
      fileName: 'completed.zip',
      totalBytes: 196_608,
      sourceMaxKbps: 512,
      clientProfile: {
        clientId: 'flashfetch',
        maxConcurrent: 4,
        supportsResume: true,
      },
    });
    downloads.advanceTime(1, 1);
    expect(downloads.getTask(completed.id)?.status).toBe('complete');
    expect(vfs.readFile('C:/Downloads/completed.zip')).toBeDefined();

    const unrelated = downloads.startDownload({
      sourceId: 'future_client_asset',
      sourceUrl: 'http://downloadhub.local/future.zip',
      fileName: 'future.zip',
      totalBytes: 20_000_000,
      sourceMaxKbps: 512,
      clientProfile: {
        clientId: 'future-client',
        maxConcurrent: 2,
        supportsResume: true,
      },
    });
    downloads.advanceTime(1, 2);
    const beforeUninstall = downloads.getTask(unrelated.id)!;
    expect(beforeUninstall.status).toBe('downloading');
    expect(beforeUninstall.downloadedBytes).toBeGreaterThan(0);

    expect(software.uninstallSoftware(flashFetchInstall.id)).toBe(true);
    expect(software.isInstalled('app.flashfetch')).toBe(false);
    expect(vfs.readFile('C:/Downloads/completed.zip')).toBeDefined();

    const afterUninstall = downloads.getTask(unrelated.id)!;
    expect(afterUninstall.status).toBe('downloading');
    expect(afterUninstall.downloadedBytes).toBe(beforeUninstall.downloadedBytes);

    downloads.advanceTime(1, 3);
    expect(downloads.getTask(unrelated.id)!.downloadedBytes).toBeGreaterThan(
      afterUninstall.downloadedBytes,
    );
  });
});
