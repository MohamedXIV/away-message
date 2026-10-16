import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 canonical desktop no-op publication', () => {
  it('does not publish missing download transitions, missing deletions, or repeated empty trash', () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const vfsState = vi.spyOn(game.vfs, 'getState');
    const received: Array<{ revision: number; domains: readonly string[] }> = [];
    const unsub = game.subscribeChanges(change => received.push({ revision: change.revision, domains: change.changedDomains }));
    received.length = 0;
    const start = game.getRevision();

    for (const type of ['DOWNLOAD_PAUSE', 'DOWNLOAD_RESUME', 'DOWNLOAD_CANCEL'] as const) {
      expect(game.dispatchAction({ type, taskId: 'missing_download' }).success).toBe(false);
    }
    expect(game.dispatchAction({ type: 'VFS_DELETE_FILE', path: 'C:/Documents/missing.txt' }).success).toBe(false);
    expect(game.dispatchAction({ type: 'VFS_EMPTY_TRASH' })).toEqual({ success: true, data: { bytesReclaimed: 0 } });
    expect(game.dispatchAction({ type: 'VFS_EMPTY_TRASH' })).toEqual({ success: true, data: { bytesReclaimed: 0 } });

    expect(game.getRevision()).toBe(start);
    expect(received).toEqual([]);
    expect(broad).not.toHaveBeenCalled();
    expect(vfsState).not.toHaveBeenCalled();
    unsub();
  });

  it('publishes actual VFS create/trash/empty once, even when deleting a zero-byte file', () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const observed: Array<{ revision: number; domains: readonly string[] }> = [];
    const unsub = game.subscribeChanges(change => observed.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    observed.length = 0;
    const initial = game.getRevision();
    const path = 'C:/Documents/empty-revision-probe.txt';
    const create = game.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'empty-revision-probe.txt', path, parentPath: 'C:/Documents',
        kind: 'text', sizeBytes: 0,
      },
    });
    expect(create.success).toBe(true);
    expect(game.getRevision()).toBe(initial + 1);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.domains).toEqual(expect.arrayContaining(['vfs', 'unknown']));

    const move = game.dispatchAction({ type: 'VFS_MOVE_TRASH', path });
    expect(move.success).toBe(true);
    expect(game.getRevision()).toBe(initial + 2);
    expect(observed).toHaveLength(2);
    expect(game.vfs.readFile('C:/Trash/empty-revision-probe.txt')?.sizeBytes).toBe(0);

    const empty = game.dispatchAction({ type: 'VFS_EMPTY_TRASH' });
    expect(empty).toEqual({ success: true, data: { bytesReclaimed: 0 } });
    expect(game.vfs.readFile('C:/Trash/empty-revision-probe.txt')).toBeUndefined();
    expect(game.getRevision()).toBe(initial + 3);
    expect(observed).toHaveLength(3);
    expect(observed.every(change => change.domains.includes('vfs'))).toBe(true);

    const repeat = game.dispatchAction({ type: 'VFS_EMPTY_TRASH' });
    expect(repeat).toEqual({ success: true, data: { bytesReclaimed: 0 } });
    expect(game.getRevision()).toBe(initial + 3);
    expect(observed).toHaveLength(3);
    expect(broad).not.toHaveBeenCalled();
    unsub();
  });

  it('source owner does not emit trash mutation for an empty directory', () => {
    const game = new SimulationEngine();
    const source = vi.fn();
    const off = game.events.on('vfs:trash_emptied', source);
    expect(game.vfs.emptyTrash()).toBe(0);
    expect(source).not.toHaveBeenCalled();
    off();
  });
});
