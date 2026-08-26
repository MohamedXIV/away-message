import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('File Explorer & Trash Operations', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('moves a file to C:/Trash preserving original path metadata', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'photo.jpg',
        path: 'C:/Pictures/photo.jpg',
        parentPath: 'C:/Pictures',
        kind: 'image',
        sizeBytes: 50000,
      },
    });

    expect(engine.vfs.readFile('C:/Pictures/photo.jpg')).toBeDefined();

    engine.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Pictures/photo.jpg' });

    expect(engine.vfs.readFile('C:/Pictures/photo.jpg')).toBeUndefined();
    const trashed = engine.vfs.readFile('C:/Trash/photo.jpg');
    expect(trashed).toBeDefined();
    expect(trashed?.metadata?.originalTrashPath).toBe('C:/Pictures/photo.jpg');
  });

  it('restores a file from trash back to its original directory', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'notes.txt',
        path: 'C:/Documents/notes.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 1024,
      },
    });

    engine.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Documents/notes.txt' });
    expect(engine.vfs.readFile('C:/Documents/notes.txt')).toBeUndefined();

    engine.dispatchAction({ type: 'VFS_RESTORE_TRASH', trashPath: 'C:/Trash/notes.txt' });
    expect(engine.vfs.readFile('C:/Documents/notes.txt')).toBeDefined();
    expect(engine.vfs.readFile('C:/Trash/notes.txt')).toBeUndefined();
  });

  it('empties trash and reclaims occupied disk bytes', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'junk.bin',
        path: 'C:/Downloads/junk.bin',
        parentPath: 'C:/Downloads',
        kind: 'executable',
        sizeBytes: 10_000_000,
      },
    });

    engine.dispatchAction({ type: 'VFS_MOVE_TRASH', path: 'C:/Downloads/junk.bin' });
    const freeBefore = engine.vfs.getFreeDiskBytes();

    const emptyRes = engine.dispatchAction({ type: 'VFS_EMPTY_TRASH' });
    expect(emptyRes.success).toBe(true);
    expect(engine.vfs.readFile('C:/Trash/junk.bin')).toBeUndefined();
    expect(engine.vfs.getFreeDiskBytes()).toBe(freeBefore + 10_000_000);
  });

  it('permanently deletes a file directly', () => {
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'temp.log',
        path: 'C:/Documents/temp.log',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 500,
      },
    });

    expect(engine.vfs.readFile('C:/Documents/temp.log')).toBeDefined();
    engine.dispatchAction({ type: 'VFS_DELETE_FILE', path: 'C:/Documents/temp.log' });
    expect(engine.vfs.readFile('C:/Documents/temp.log')).toBeUndefined();
  });
});
