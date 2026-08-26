import { describe, it, expect, beforeEach } from 'vitest';
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
});
