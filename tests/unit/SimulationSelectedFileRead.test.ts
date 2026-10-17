import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 explicit selected-file transport boundary', () => {
  it('returns exactly the requested document content without arbitrary owner metadata', () => {
    const game = new SimulationEngine();
    game.vfs.createFile({
      name: 'Notes.txt', path: 'C:/Documents/Notes.txt', parentPath: 'C:/Documents',
      kind: 'text', sizeBytes: 5, content: 'hello',
      metadata: {
        textContent: 'editor fallback',
        isAdware: true,
        internalPayload: { secret: 'OWNER_PRIVATE_FILE_METADATA', nested: ['not-for-ui'] },
        inaccessibleCallback: () => 'not-cloneable',
      },
    });
    game.vfs.createFile({
      name: 'Other.txt', path: 'C:/Documents/Other.txt', parentPath: 'C:/Documents',
      kind: 'text', sizeBytes: 100, content: 'OTHER_FILE_BODY',
    });

    const broad = vi.spyOn(game, 'getState');
    const vfsState = vi.spyOn(game.vfs, 'getState');
    const fullFile = vi.spyOn(game.vfs, 'readFile');
    const result = game.getFileRead('C:/Documents/Notes.txt');
    expect(result.file?.name).toBe('Notes.txt');
    expect(result.file?.content).toBe('hello');
    expect(result.file?.metadata?.textContent).toBe('editor fallback');
    expect(JSON.stringify(result)).not.toContain('OWNER_PRIVATE_FILE_METADATA');
    expect(JSON.stringify(result)).not.toContain('OTHER_FILE_BODY');
    expect(JSON.stringify(result)).not.toContain('inaccessibleCallback');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(broad).not.toHaveBeenCalled();
    expect(vfsState).not.toHaveBeenCalled();
    expect(fullFile).not.toHaveBeenCalled();

    result.file!.metadata!.textContent = 'tampered';
    expect(game.getFileRead('C:/Documents/Notes.txt').file?.metadata?.textContent).toBe('editor fallback');
    expect(game.vfs.readFile('C:/Documents/Notes.txt')?.metadata?.isAdware).toBe(true);
  });

  it('retains Notepad fallback text and does not publish a revision from a read', () => {
    const game = new SimulationEngine();
    game.vfs.createFile({
      name: 'Fallback.txt', path: 'C:/Documents/Fallback.txt', parentPath: 'C:/Documents',
      kind: 'text', sizeBytes: 8, metadata: { textContent: 'read this' },
    });
    const initial = game.getRevision();
    expect(game.getFileRead('C:/Documents/Fallback.txt').file?.metadata?.textContent).toBe('read this');
    expect(game.getFileRead('C:/Documents/Fallback.txt').file?.content).toBeUndefined();
    expect(game.getFileRead('C:/Documents/missing.txt').file).toBeNull();
    expect(game.getFileRead('').file).toBeNull();
    expect(game.getRevision()).toBe(initial);
  });

  it('reads the current PC boot status without cloning hardware assembly', () => {
    const game = new SimulationEngine();
    const expected = game.hardware.getComputerBootStatus();
    const clone = vi.spyOn(game.hardware, 'getComputerState');
    const broad = vi.spyOn(game, 'getState');
    const apps = game.getAppRead();
    expect(apps.computer).toEqual(expected);
    expect(JSON.parse(JSON.stringify(apps))).toEqual(apps);
    expect(clone).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
  });
});
