import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function populateDocuments(game: SimulationEngine, count: number): void {
  for (let i = 0; i < count; i++) {
    game.vfs.createFile({
      name: `paging-${i}.txt`,
      path: `C:/Documents/paging-${i}.txt`,
      parentPath: 'C:/Documents',
      kind: 'text',
      sizeBytes: 20,
      content: 'PRIVATE_FILE_BODY',
      metadata: { textContent: 'PRIVATE_FILE_BODY' },
    });
  }
}

describe('#172 bounded FileExplorer directory pages', () => {
  it('pages 140 files in canonical directory order with no hidden file bodies or broad snapshot', () => {
    const game = new SimulationEngine();
    populateDocuments(game, 140);
    const full = vi.spyOn(game, 'getState');
    const vfs = vi.spyOn(game.vfs, 'getState');
    const unbounded = vi.spyOn(game.vfs, 'listDirectory');
    const pages = [game.getDirectoryRead('C:/Documents', 0, 64),
      game.getDirectoryRead('C:/Documents', 64, 64),
      game.getDirectoryRead('C:/Documents', 128, 64)];
    expect(pages.map(p => p.files.length)).toEqual([64, 64, 12]);
    expect(pages.map(p => p.hasMore)).toEqual([true, true, false]);
    expect(pages.map(p => p.offset)).toEqual([0, 64, 128]);
    const paths = pages.flatMap(p => p.files.map(f => f.path));
    expect(new Set(paths).size).toBe(140);
    expect(paths[0]).toBe('C:/Documents/paging-0.txt');
    expect(paths[64]).toBe('C:/Documents/paging-64.txt');
    expect(paths[139]).toBe('C:/Documents/paging-139.txt');
    for (const page of pages) {
      expect(JSON.parse(JSON.stringify(page))).toEqual(page);
      expect(JSON.stringify(page)).not.toContain('PRIVATE_FILE_BODY');
    }
    expect(game.getFileRead(paths[0]!).file?.content).toBe('PRIVATE_FILE_BODY');
    expect(full).not.toHaveBeenCalled();
    expect(vfs).not.toHaveBeenCalled();
    expect(unbounded).not.toHaveBeenCalled();
  });

  it('bounds both projection and owner allocations even for untrusted page parameters', () => {
    const game = new SimulationEngine();
    populateDocuments(game, 140);
    const metadata = vi.spyOn(game.vfs, 'listDirectoryMetadata');
    const oversized = game.getDirectoryRead('C:/Documents', -100, 999999);
    expect(oversized.files).toHaveLength(64);
    expect(oversized.offset).toBe(0);
    expect(oversized.hasMore).toBe(true);
    expect(metadata).toHaveBeenLastCalledWith('C:/Documents', 65, 0);
    expect(game.getDirectoryRead('C:/Documents', 128, 1).files).toHaveLength(1);
    expect(metadata).toHaveBeenLastCalledWith('C:/Documents', 2, 128);
    const empty = game.getDirectoryRead('C:/Documents', 9999, 64);
    expect(empty.files).toEqual([]);
    expect(empty.hasMore).toBe(false);
    const invalid = game.getDirectoryRead('C:/Documents', NaN, Infinity);
    expect(invalid.offset).toBe(0);
    expect(invalid.files).toHaveLength(64);
    expect(game.vfs.listDirectoryMetadata('C:/Documents', 0)).toEqual([]);
  });

  it('re-reads the same offset after mutation without exposing stale page contents', () => {
    const game = new SimulationEngine();
    populateDocuments(game, 65);
    const before = game.getDirectoryRead('C:/Documents', 64, 64);
    expect(before.files.map(f => f.name)).toEqual(['paging-64.txt']);
    const broad = vi.spyOn(game, 'getState');
    const result = game.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Documents/paging-0.txt' });
    expect(result.success).toBe(true);
    const after = game.getDirectoryRead('C:/Documents', 64, 64);
    expect(after.files).toEqual([]);
    expect(after.hasMore).toBe(false);
    expect(after.revision).toBeGreaterThan(before.revision);
    const first = game.getDirectoryRead('C:/Documents', 0, 64);
    expect(first.files[0]?.name).toBe('paging-1.txt');
    expect(first.files[63]?.name).toBe('paging-64.txt');
    expect(broad).not.toHaveBeenCalled();
  });
});
