import { describe, expect, it, vi } from 'vitest';
import { executeWorkerTerminalCommand as run, resolveTerminalPath } from '../../src/simulation/host/WorkerTerminalCommands';
import type { TerminalPort } from '../../src/simulation/host/WorkerTerminalCommands';

describe('#175 Worker terminal pure command boundary', () => {
  it('allows canonical C: relative paths but never escapes the drive root', () => {
    expect(resolveTerminalPath('C:/Documents', '../Downloads/tool.zip')).toBe('C:/Downloads/tool.zip');
    expect(resolveTerminalPath('C:', 'C:/Documents')).toBe('C:/Documents');
    expect(resolveTerminalPath('C:', '../../Windows')).toBeNull();
    expect(resolveTerminalPath('C:/Documents', 'D:/Other')).toBeNull();
    expect(resolveTerminalPath('C:', 'C:/Documents/<script>')).toBeNull();
  });
  it('reads only selected directory/file queries with a 32-entry budget', async () => {
    const read = vi.fn(async (query: { kind: string; path: string; limit?: number }) => {
      if (query.kind === 'directory') return { files: [{ kind: 'text', name: 'one.txt', sizeBytes: 3 }], hasMore: true, freeDiskBytes: 900 };
      return { file: query.path === 'C:/Documents' ? { kind: 'directory' } : { kind: 'text', content: 'hello' } };
    });
    const dispatch = vi.fn();
    const port = { read, dispatch } as unknown as TerminalPort;
    expect((await run(port, 'C:', 'DIR C:/Documents', 'Orion_4.8')).text).toContain('one.txt');
    expect(read).toHaveBeenCalledWith({ kind: 'directory', path: 'C:/Documents', offset: 0, limit: 32 });
    expect((await run(port, 'C:/Documents', 'TYPE one.txt', null)).text).toBe('hello');
    expect((await run(port, 'C:', 'PING local', null)).error).toContain('Unsupported command');
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('saves with canonical Worker action only and refuses arbitrary locations', async () => {
    const dispatch = vi.fn(async () => ({ success: true }));
    const port = { read: vi.fn(), dispatch } as unknown as TerminalPort;
    expect((await run(port, 'C:/Documents', 'SAVE hi.txt one note', null)).text).toBe('Saved C:/Documents/hi.txt');
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'VFS_CREATE_FILE',
      file: expect.objectContaining({ path: 'C:/Documents/hi.txt', content: 'one note' }) }));
    expect((await run(port, 'C:', 'SAVE C:/Windows/malware.txt blocked', null)).error).toContain('SAVE requires');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('deletes only authentic selected Documents text files through owner trash action', async () => {
    const read = vi.fn(async () => ({ file: { kind: 'text', name: 'hello.txt' } }));
    const dispatch = vi.fn(async () => ({ success: true }));
    const port = { read, dispatch } as unknown as TerminalPort;
    expect((await run(port, 'C:/Documents', 'DEL hello.txt', null)).text).toContain('Recycle Bin');
    expect(dispatch).toHaveBeenCalledWith({ type: 'VFS_MOVE_TRASH', path: 'C:/Documents/hello.txt' });
    expect((await run(port, 'C:', 'DEL C:/Windows/OS.exe', null)).error).toContain('DEL only');
  });
});
