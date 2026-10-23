import type { WorkerGameSession } from './WorkerGameSession';

/** Commands format a bounded result, but file truth and writes are Worker-owned. */
export type TerminalPort = Pick<WorkerGameSession, 'read' | 'dispatch'>;
export interface TerminalOutcome {
  text?: string;
  nextPath?: string;
  clear?: boolean;
  exit?: boolean;
  error?: string;
}
export const WORKER_TERMINAL_HELP = [
  'Orion commands (all file operations are Worker-backed):',
  'HELP                 Supported commands',
  'DIR [path]           Up to 32 files from a real directory',
  'CD [path]            Change directory',
  'TYPE <file>          Read one text document',
  'SAVE <file.txt> text Create a new text file in C:/Documents',
  'DEL <file.txt>       Move a Documents text file to Recycle Bin',
  'UNZIP <archive.zip>  Extract a canonical ZIP archive',
  'VER / CLS / EXIT     Version / clear screen / close window',
].join('\n');
const fail = (error: string): TerminalOutcome => ({ error });

/** Resolve only canonical C: paths, without escaping drive root. */
export function resolveTerminalPath(cwd: string, rawArgument: string): string | null {
  const raw = rawArgument.trim().replace(/^"|"$/g, '').replace(/\\/g, '/');
  if (!raw) return cwd;
  if (/^[a-z]:/i.test(raw) && !/^c:/i.test(raw)) return null;
  const absolute = /^c:/i.test(raw) || raw.startsWith('/');
  const segments = absolute || cwd === 'C:' ? [] : cwd.slice(3).split('/');
  for (const part of raw.replace(/^c:/i, '').replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!segments.length) return null;
      segments.pop();
    } else if (/^[a-z0-9_ .-]{1,80}$/i.test(part)) segments.push(part);
    else return null;
  }
  return 'C:' + (segments.length ? '/' + segments.join('/') : '');
}

export async function executeWorkerTerminalCommand(
  port: TerminalPort, cwd: string, commandLine: string, osVersion: string | null,
): Promise<TerminalOutcome> {
  const raw = commandLine.trim();
  if (!raw) return {};
  const firstSpace = raw.search(/\s/);
  const op = (firstSpace < 0 ? raw : raw.slice(0, firstSpace)).toLowerCase();
  const arg = firstSpace < 0 ? '' : raw.slice(firstSpace + 1).trim();
  if (op === 'help' || op === '?') return { text: WORKER_TERMINAL_HELP };
  if (op === 'cls' || op === 'clear') return { clear: true };
  if (op === 'exit') return { exit: true };
  if (op === 'ver') return { text: 'Orion OS [Version ' + (osVersion?.replace(/^Orion_/, '') ?? 'not installed') + ']' };

  if (op === 'cd') {
    if (!arg) return { text: cwd };
    const path = resolveTerminalPath(cwd, arg);
    if (!path) return fail('Invalid path: only the C: drive is supported.');
    const result = await port.read({ kind: 'file', path });
    return result.file?.kind === 'directory' ? { nextPath: path } : fail('Directory not found: ' + path);
  }
  if (op === 'dir' || op === 'ls') {
    const path = resolveTerminalPath(cwd, arg);
    if (!path) return fail('Invalid directory path.');
    const target = await port.read({ kind: 'file', path });
    if (target.file?.kind !== 'directory') return fail('Directory not found: ' + path);
    const page = await port.read({ kind: 'directory', path, offset: 0, limit: 32 });
    const rows = page.files.map(f => f.kind === 'directory'
      ? '  <DIR>           ' + f.name
      : '  ' + String(f.sizeBytes).padStart(14, ' ') + '  ' + f.name);
    return { text: 'Directory of ' + path + '\n' + (rows.join('\n') || '(empty)') +
      (page.hasMore ? '\nMore files exist; open File Explorer for more pages.' : '') +
      '\nFree space: ' + page.freeDiskBytes + ' bytes' };
  }
  if (op === 'type' || op === 'cat') {
    const path = resolveTerminalPath(cwd, arg);
    if (!arg || !path) return fail('Usage: TYPE <file>');
    const file = (await port.read({ kind: 'file', path })).file;
    if (!file) return fail('File not found: ' + path);
    if (file.kind !== 'text') return fail('TYPE only supports text documents. Binary files are not displayed.');
    const text = file.content ?? (typeof file.metadata?.textContent === 'string' ? file.metadata.textContent : '');
    return { text: text.length > 8192 ? text.slice(0, 8192) + '\n[Output truncated]' : text };
  }
  if (op === 'save') {
    const match = /^(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/.exec(arg);
    if (!match) return fail('Usage: SAVE <file.txt> <text>');
    const path = resolveTerminalPath(cwd, match[1] ?? match[2] ?? '');
    const content = match[3] ?? '';
    if (!path || !/^C:\/Documents\/[a-z0-9_ .-]{1,64}\.txt$/i.test(path) ||
        content.length > 2048) return fail('SAVE requires a new C:/Documents/*.txt (max 2048 characters).');
    const name = path.slice('C:/Documents/'.length);
    const result = await port.dispatch({ type: 'VFS_CREATE_FILE', file: {
      name, path, parentPath: 'C:/Documents', kind: 'text',
      sizeBytes: new TextEncoder().encode(content).length,
      content, metadata: { textContent: content }, appAssociation: 'app.notepad',
    } });
    return result.success ? { text: 'Saved ' + path } : fail(result.error ?? 'Owner refused the file');
  }
  if (op === 'del') {
    const path = resolveTerminalPath(cwd, arg);
    if (!arg || !path || !/^C:\/Documents\/[a-z0-9_ .-]{1,80}\.txt$/i.test(path))
      return fail('DEL only supports Documents .txt files.');
    const file = (await port.read({ kind: 'file', path })).file;
    if (!file || file.kind !== 'text') return fail('Text document not found: ' + path);
    const result = await port.dispatch({ type: 'VFS_MOVE_TRASH', path });
    return result.success ? { text: 'Moved to Recycle Bin: ' + path }
      : fail(result.error ?? 'Owner refused to trash the file');
  }
  if (op === 'unzip') {
    const path = resolveTerminalPath(cwd, arg);
    if (!arg || !path || !/\.zip$/i.test(path)) return fail('Usage: UNZIP <archive.zip>');
    const file = (await port.read({ kind: 'file', path })).file;
    if (!file || file.kind !== 'archive') return fail('Archive not found: ' + path);
    const result = await port.dispatch({ type: 'VFS_ARCHIVE_EXTRACT', archivePath: path });
    return result.success ? { text: 'Worker extracted archive: ' + path }
      : fail(result.error ?? 'Archive extraction failed');
  }
  return fail('Unsupported command: ' + op + '. Type HELP. No fictional results.');
}
