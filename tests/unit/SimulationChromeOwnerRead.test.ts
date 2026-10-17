import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { DownloadTask } from '../../src/engine/types';

describe('#172 scalar source reads for OS chrome', () => {
  it('projects network, installed Pulse and active counts without cloning domain roots', () => {
    const game = new SimulationEngine();
    const expected = {
      network: game.hardware.getState(),
      installed: game.software.getInstalledSoftware().some(pkg => String(pkg.appId).includes('pulse')),
      active: game.downloads.getState().tasks.filter(task => task.status === 'downloading').length,
    };
    const whole = vi.spyOn(game, 'getState');
    const hardware = vi.spyOn(game.hardware, 'getState');
    const downloads = vi.spyOn(game.downloads, 'getState');
    const software = vi.spyOn(game.software, 'getInstalledSoftware');
    const read = game.getChromeRead();
    expect(read.connectionType).toBe(expected.network.connectionType);
    expect(read.connectionSpeedKbps).toBe(expected.network.connectionSpeedKbps);
    expect(read.pulseInstalled).toBe(expected.installed);
    expect(read.activeDownloadCount).toBe(expected.active);
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(whole).not.toHaveBeenCalled();
    expect(hardware).not.toHaveBeenCalled();
    expect(downloads).not.toHaveBeenCalled();
    expect(software).not.toHaveBeenCalled();
  });

  it('does not copy hundreds of archived download records to read a single tray count', () => {
    const game = new SimulationEngine();
    const base: DownloadTask = {
      id: 'archive-0',
      sourceId: 'archive-source',
      sourceUrl: 'http://downloadhub.local/archive.bin',
      fileName: 'archive.bin',
      targetDirectory: 'C:/Downloads',
      totalBytes: 1000,
      downloadedBytes: 1000,
      sourceMaxKbps: 64,
      allocatedKbps: 0,
      status: 'complete',
      resumable: true,
      manager: 'browser',
      startedAtMinute: 10,
      completedAtMinute: 15,
      fileKind: 'archive',
    };
    game.downloads.restoreState({
      tasks: Array.from({ length: 400 }, (_, id) => ({ ...base, id: `archive-${id}` })),
      maxConcurrentBrowser: 2,
      maxConcurrentFlashFetch: 4,
    });
    const expected = game.downloads.getState().tasks.filter(task => task.status === 'downloading').length;
    const all = vi.spyOn(game.downloads, 'getState');
    const full = vi.spyOn(game, 'getState');
    for (let i = 0; i < 5; i++) {
      const view = game.getChromeRead();
      expect(view.activeDownloadCount).toBe(expected);
      expect(JSON.parse(JSON.stringify(view))).toEqual(view);
      const apps = game.getAppRead();
      expect(apps.downloads).toHaveLength(256);
      expect(apps.downloads[0]?.id).toBe('archive-144');
      expect(apps.downloads[255]?.id).toBe('archive-399');
      expect(JSON.parse(JSON.stringify(apps))).toEqual(apps);
    }
    const smallWindow = game.downloads.getRecentTasks(2);
    expect(smallWindow.map(task => task.id)).toEqual(['archive-398', 'archive-399']);
    expect(game.downloads.getRecentTasks(0)).toEqual([]);
    smallWindow[0]!.fileName = 'mutated';
    expect(game.downloads.getRecentTasks(2)[0]!.fileName).toBe('archive.bin');
    expect(all).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
    expect(game.downloads.getActiveDownloadCount()).toBe(expected);
  });

  it('preserves assembled-computer hotkey eligibility without building hardware state', () => {
    const game = new SimulationEngine();
    const state = game.hardware.getState();
    const full = vi.spyOn(game.hardware, 'getState');
    const assembled = game.hardware.hasAssembledComputer();
    expect(assembled).toBe(state.hasComputer);
    expect(full).not.toHaveBeenCalled();
  });
});
