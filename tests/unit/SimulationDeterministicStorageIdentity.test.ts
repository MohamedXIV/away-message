import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { DownloadManager } from '../../src/engine/DownloadManager';

const file = (path: string) => ({
  name: path.split('/').at(-1)!, path, parentPath: 'C:/Documents',
  kind: 'text' as const, sizeBytes: 1, content: 'body',
});
const dl = { sourceId: 'test', sourceUrl: 'http://test.local/a.exe',
  fileName: 'a.exe', totalBytes: 1000, sourceMaxKbps: 128, currentMinute: 480 };
const newDownloads = (events: EventBus, vfs: FileSystemEngine,
  state?: ConstructorParameters<typeof DownloadManager>[1]) =>
  new DownloadManager({ eventBus: events, vfs,
    getConnectionSpeedKbps: () => 256 }, state);

describe('#174 deterministic canonical FileSystem and Download identities', () => {
  it('replays identical VFS IDs without Date.now or Math.random and preserves moved file identity', () => {
    const create = () => {
      const events = new EventBus();
      const vfs = new FileSystemEngine(events);
      const a = vfs.createFile(file('C:/Documents/a.txt'), 480);
      const b = vfs.createFile(file('C:/Documents/b.txt'), 480);
      const trashed = vfs.moveToTrash(a.path, 480);
      expect(trashed.id).toBe(a.id);
      const restored = vfs.restoreFromTrash(trashed.path, 480);
      expect(restored.id).toBe(a.id);
      return [vfs.readFile('C:/Documents/Readme.txt')!.id, a.id, b.id];
    };
    const clock = vi.spyOn(Date, 'now');
    const random = vi.spyOn(Math, 'random');
    try {
      expect(create()).toEqual(create());
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); random.mockRestore(); }
  });

  it('never reuses a deleted VFS identity, including after empty trash and snapshot reload', () => {
    const events = new EventBus();
    const source = new FileSystemEngine(events);
    const first = source.createFile(file('C:/Documents/again.txt')).id;
    source.deletePermanently('C:/Documents/again.txt');
    const second = source.createFile(file('C:/Documents/again.txt')).id;
    expect(second).not.toBe(first);
    source.moveToTrash('C:/Documents/again.txt');
    source.emptyTrash();
    const snapshot = source.getState();
    const restored = new FileSystemEngine(events, snapshot);
    expect(restored.createFile(file('C:/Documents/again.txt')).id).not.toBe(second);
    expect(restored.getState().nextFileOrdinal).toBe(snapshot.nextFileOrdinal! + 1);
  });

  it('round-trips download cancellation and IDs without recycling cancelled tasks', () => {
    const events = new EventBus();
    const vfs = new FileSystemEngine(events);
    const first = newDownloads(events, vfs);
    const a = first.startDownload(dl);
    const b = first.startDownload(dl);
    expect(a.id).not.toBe(b.id);
    first.cancelDownload(a.id);
    first.cancelDownload(b.id);
    const snapshot = first.getState();
    expect(snapshot.tasks).toHaveLength(0);
    const second = newDownloads(events, vfs, {
      ...snapshot, maxConcurrentBrowser: 1, maxConcurrentFlashFetch: 4,
    });
    const c = second.startDownload(dl);
    expect(c.id).not.toBe(a.id);
    expect(c.id).not.toBe(b.id);
    const replay = newDownloads(new EventBus(), new FileSystemEngine(new EventBus()));
    expect(replay.startDownload(dl).id).toBe(a.id);
  });

  it('preserves both allocators through canonical composed SimulationKernel export and reload', () => {
    const make = () => {
      const game = new SimulationEngine();
      const path = 'C:/Documents/user-file.txt';
      const firstFile = game.vfs.createFile(file(path), 480);
      game.vfs.deletePermanently(path);
      const secondFile = game.vfs.createFile(file(path), 480);
      const firstDownload = game.downloads.startDownload(dl);
      game.downloads.cancelDownload(firstDownload.id);
      const state = game.exportSnapshot();
      expect(state.vfs.nextFileOrdinal).toBeGreaterThan(1);
      expect(state.downloadNextOrdinal).toBeGreaterThan(1);
      const restored = new SimulationEngine(state);
      const nextDownload = restored.downloads.startDownload(dl);
      const nextFile = restored.vfs.createFile(file('C:/Documents/next-file.txt'), 480);
      expect(new Set([firstFile.id, secondFile.id, nextFile.id]).size).toBe(3);
      expect(nextDownload.id).not.toBe(firstDownload.id);
      expect(restored.exportSnapshot().downloadNextOrdinal).toBe(state.downloadNextOrdinal! + 1);
      return [firstFile.id, secondFile.id, firstDownload.id, nextFile.id, nextDownload.id];
    };
    expect(make()).toEqual(make());
  });

  it('honors explicit external IDs while avoiding collisions with live IDs on restore', () => {
    const events = new EventBus();
    const vfs = new FileSystemEngine(events);
    vfs.createFile({ ...file('C:/Documents/external.txt'), id: 'file_100' });
    const state = vfs.getState();
    const restored = new FileSystemEngine(events, {
      ...state, nextFileOrdinal: undefined,
    });
    expect(restored.createFile(file('C:/Documents/new.txt')).id).toBe('file_101');
  });
});
