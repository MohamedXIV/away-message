import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';

describe('FileSystemEngine (VFS Hierarchy, CRUD, Trash & 40GB Quota)', () => {
  let eventBus: EventBus;
  let vfs: FileSystemEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    vfs = new FileSystemEngine(eventBus);
  });

  it('initializes canonical folder hierarchy and default readme file', () => {
    const canonicalDirs = FileSystemEngine.CANONICAL_DIRECTORIES;
    for (const dir of canonicalDirs) {
      const record = vfs.readFile(dir);
      expect(record).toBeDefined();
      expect(record?.kind).toBe('directory');
    }

    const readme = vfs.readFile('C:/Documents/Readme.txt');
    expect(readme).toBeDefined();
    expect(readme?.kind).toBe('text');
    expect(readme?.content).toContain('Welcome to Orion OS');
  });

  it('creates files, enforces parent directory checks, and updates free space', () => {
    const initialFree = vfs.getFreeDiskBytes();

    const created = vfs.createFile({
      name: 'TestFile.txt',
      path: 'C:/Documents/TestFile.txt',
      parentPath: 'C:/Documents',
      kind: 'text',
      sizeBytes: 1_000_000, // ~1MB
      content: 'Hello World',
    });

    expect(created.name).toBe('TestFile.txt');
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 1_000_000);

    // Fails on non-existent parent directory
    expect(() => {
      vfs.createFile({
        name: 'Bad.txt',
        path: 'C:/NonExistent/Bad.txt',
        parentPath: 'C:/NonExistent',
        kind: 'text',
        sizeBytes: 100,
      });
    }).toThrow('Parent directory does not exist');
  });

  it('lists directory contents accurately', () => {
    vfs.createFile({
      name: 'Doc1.txt',
      path: 'C:/Documents/Doc1.txt',
      parentPath: 'C:/Documents',
      kind: 'text',
      sizeBytes: 500,
    });
    vfs.createFile({
      name: 'Doc2.txt',
      path: 'C:/Documents/Doc2.txt',
      parentPath: 'C:/Documents',
      kind: 'text',
      sizeBytes: 500,
    });

    const docs = vfs.listDirectory('C:/Documents');
    // Readme.txt + Doc1.txt + Doc2.txt = 3 files
    expect(docs.length).toBe(3);
    expect(docs.map((d) => d.name)).toContain('Doc1.txt');
    expect(docs.map((d) => d.name)).toContain('Doc2.txt');
  });

  it('manages trash lifecycle: moveToTrash, restoreFromTrash, emptyTrash', () => {
    vfs.createFile({
      name: 'ToDelete.txt',
      path: 'C:/Desktop/ToDelete.txt',
      parentPath: 'C:/Desktop',
      kind: 'text',
      sizeBytes: 5000,
    });

    // Move to Trash
    const trashed = vfs.moveToTrash('C:/Desktop/ToDelete.txt');
    expect(trashed.path).toBe('C:/Trash/ToDelete.txt');
    expect(vfs.readFile('C:/Desktop/ToDelete.txt')).toBeUndefined();
    expect(vfs.readFile('C:/Trash/ToDelete.txt')).toBeDefined();

    // Restore from Trash
    const restored = vfs.restoreFromTrash('C:/Trash/ToDelete.txt');
    expect(restored.path).toBe('C:/Desktop/ToDelete.txt');
    expect(vfs.readFile('C:/Desktop/ToDelete.txt')).toBeDefined();

    // Trash and Empty Trash
    vfs.moveToTrash('C:/Desktop/ToDelete.txt');
    const reclaimed = vfs.emptyTrash();
    expect(reclaimed).toBe(5000);
    expect(vfs.readFile('C:/Trash/ToDelete.txt')).toBeUndefined();
  });

  it('updates file content and metadata cleanly', () => {
    const file = vfs.createFile({
      name: 'Notes.txt',
      path: 'C:/Documents/Notes.txt',
      parentPath: 'C:/Documents',
      kind: 'text',
      sizeBytes: 100,
      content: 'Initial notes',
    });
    expect(file).toBeDefined();

    const updated = vfs.updateFile('C:/Documents/Notes.txt', {
      content: 'Updated notes with more details',
      sizeBytes: 250,
    });

    expect(updated.content).toBe('Updated notes with more details');
    expect(updated.sizeBytes).toBe(250);
  });

  it('keeps disk capacity O(1) for a large VFS and accounts for updates, deletion and trash', () => {
    const initialFree = vfs.getFreeDiskBytes();
    for (let i = 0; i < 200; i++) {
      vfs.createFile({
        name: `item-${i}.txt`, path: `C:/Documents/item-${i}.txt`,
        parentPath: 'C:/Documents', kind: 'text', sizeBytes: 100,
      });
    }
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 20_000);
    vfs.updateFile('C:/Documents/item-0.txt', { sizeBytes: 500 });
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 20_400);
    vfs.moveToTrash('C:/Documents/item-0.txt');
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 20_400);
    vfs.restoreFromTrash('C:/Trash/item-0.txt');
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 20_400);
    expect(vfs.deletePermanently('C:/Documents/item-0.txt')).toBe(true);
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 19_900);
    vfs.moveToTrash('C:/Documents/item-1.txt');
    vfs.moveToTrash('C:/Documents/item-2.txt');
    expect(vfs.emptyTrash()).toBe(200);
    expect(vfs.emptyTrash()).toBe(0);
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 19_700);

    // A scalar disk-capacity read must not enumerate the source file map.
    const files = (vfs as unknown as { files: Map<string, unknown> }).files;
    const scan = vi.spyOn(files, 'values').mockImplementation(() => {
      throw new Error('Unexpected full VFS scan');
    });
    try {
      expect(vfs.getOccupiedDiskBytes()).toBe(vfs.getDiskCapacity().totalDiskBytes - vfs.getFreeDiskBytes());
      expect(scan).not.toHaveBeenCalled();
    } finally {
      scan.mockRestore();
    }
  });

  it('accounts for legacy trash-name and restore-path overwrites without double-counting', () => {
    const initial = vfs.getFreeDiskBytes();
    const file = (folder: string, sizeBytes: number) => vfs.createFile({
      name: 'overlap.txt', path: `${folder}/overlap.txt`,
      parentPath: folder, kind: 'text', sizeBytes,
    });
    file('C:/Documents', 10);
    file('C:/Desktop', 20);
    vfs.moveToTrash('C:/Documents/overlap.txt');
    expect(vfs.getFreeDiskBytes()).toBe(initial - 30);
    // The existing VFS behavior intentionally overwrites a trash path with
    // the same file name. The replaced 10-byte file must stop occupying space.
    vfs.moveToTrash('C:/Desktop/overlap.txt');
    expect(vfs.getFreeDiskBytes()).toBe(initial - 20);
    file('C:/Desktop', 30);
    expect(vfs.getFreeDiskBytes()).toBe(initial - 50);
    vfs.restoreFromTrash('C:/Trash/overlap.txt');
    expect(vfs.getFreeDiskBytes()).toBe(initial - 20);
    expect(vfs.readFile('C:/Desktop/overlap.txt')?.sizeBytes).toBe(20);
  });

  it('rebuilds owner usage from loaded state rather than retaining prior totals', () => {
    const initialFree = vfs.getFreeDiskBytes();
    vfs.createFile({
      name: 'saved.txt', path: 'C:/Documents/saved.txt',
      parentPath: 'C:/Documents', kind: 'text', sizeBytes: 1234,
    });
    const saved = vfs.getState();
    vfs.createFile({
      name: 'unsaved.txt', path: 'C:/Documents/unsaved.txt',
      parentPath: 'C:/Documents', kind: 'text', sizeBytes: 900,
    });
    vfs.restoreState(saved);
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 1234);
    expect(vfs.readFile('C:/Documents/unsaved.txt')).toBeUndefined();
    vfs.restoreState(saved);
    expect(vfs.getFreeDiskBytes()).toBe(initialFree - 1234);
    expect(() => vfs.createFile({
      name: 'too-big.txt', path: 'C:/Documents/too-big.txt',
      parentPath: 'C:/Documents', kind: 'text',
      sizeBytes: vfs.getFreeDiskBytes() + 1,
    })).toThrow('Disk Full');
  });
});
