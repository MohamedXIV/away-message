import { useEffect, useState } from 'react';
import type { SimulationDirectoryRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

const DOCUMENTS = 'C:/Documents';

/** Canonical directory pages and file bodies only. No VFS state cache on the UI. */
export function WorkerFileExplorer({
  session, revision, openDocument, openInstaller, openArchive, openArtwork, openAudio,
}: {
  session: WorkerGameSession;
  revision: number;
  openDocument: (path: string) => void;
  openInstaller: (path: string) => void;
  openArchive: (path: string) => void;
  openArtwork: (path: string) => void;
  openAudio: (path: string) => void;
}) {
  const [page, setPage] = useState<SimulationDirectoryRead | null>(null);
  const [offset, setOffset] = useState(0);
  const [folder, setFolder] = useState<'C:/Documents' | 'C:/Downloads' | 'C:/Pictures' | 'C:/Music'>(DOCUMENTS);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const openFile = (file: SimulationDirectoryRead['files'][number]) => {
    if (file.kind === 'audio') openAudio(file.path);
    else if (file.kind === 'image') openArtwork(file.path);
    else if (file.kind === 'archive') openArchive(file.path);
    else if (file.kind === 'installer') openInstaller(file.path);
    else if (file.kind === 'text') openDocument(file.path);
    else setError('Unsupported file type.');
  };

  useEffect(() => {
    let active = true;
    void session.read({ kind: 'directory', path: folder, offset, limit: 32 })
      .then(result => {
        if (active && result.revision === revision) {
          setPage(result);
          setError(null);
        }
      })
      .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [session, revision, offset, folder]);

  return (
    <section data-testid="worker-explorer" className="flex h-full flex-col bg-[#fff] text-black">
      <div className="border-b border-gray-400 bg-[#ddd] px-2 py-1 text-xs">
        Address: {folder} · {(page?.files.length ?? 0)} visible files
      </div>
      <nav aria-label="Explorer folders" className="flex gap-2 border-b bg-[#eee] p-1 text-xs">
        {([DOCUMENTS, 'C:/Downloads', 'C:/Pictures', 'C:/Music'] as const).map(path => (
          <button type="button" key={path} aria-pressed={folder === path}
            onClick={() => { setFolder(path); setPage(null); setOffset(0); setSelectedFileId(null); }}
            className="rounded border px-2 py-1">{path.split('/').pop()}</button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 text-xs">
        {(page?.files ?? []).map(file => (
          <button type="button" key={file.id}
            aria-pressed={selectedFileId === file.id}
            onClick={event => {
              // Local files select on click and open on double-click.
              // Keyboard/assistive activation has detail=0 and opens directly.
              setSelectedFileId(file.id);
              if (event.detail === 0) openFile(file);
            }}
            onDoubleClick={event => { if (event.button === 0) openFile(file); }}
            className={`block w-full rounded px-2 py-1 text-left hover:bg-blue-100 ${selectedFileId === file.id ? 'bg-blue-200 outline outline-1 outline-blue-500' : ''}`}
            aria-label={'Open file: ' + file.name}>
            {file.kind === 'text' ? '📄' : '📦'} {file.name}
          </button>
        ))}
        {page && page.files.length === 0 && (
          <p className="text-gray-500">No files in this directory.</p>
        )}
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </div>
      <div className="flex gap-2 border-t border-gray-400 bg-[#ddd] px-2 py-1 text-xs">
        <button disabled={offset === 0} onClick={() => { setOffset(n => Math.max(0, n - 32)); setSelectedFileId(null); }}>
          Previous
        </button>
        <button disabled={!page?.hasMore} onClick={() => { setOffset(n => n + 32); setSelectedFileId(null); }}>Next</button>
      </div>
    </section>
  );
}

/** Notepad writes an actual VFS_CREATE_FILE command into the Worker owner. */
export function WorkerNotepad({
  session, filePath,
}: {
  session: WorkerGameSession;
  filePath?: string;
}) {
  const [name, setName] = useState('WorkerNote.txt');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!filePath) return () => { active = false; };
    void session.read({ kind: 'file', path: filePath })
      .then(result => {
        if (!active) return;
        if (!result.file) {
          setError('File is no longer available');
          return;
        }
        setName(result.file.name);
        setContent(result.file.content ?? String(result.file.metadata?.textContent ?? ''));
        setSaved(null);
      }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [session, filePath]);

  const save = async () => {
    const filename = name.trim();
    // Never make a path from arbitrary folder separators or special paths.
    if (!/^[\w .-]{1,64}\.txt$/i.test(filename) || filename === '..txt') {
      setError('Use a simple .txt filename (letters, digits, spaces, dash, underscore).');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const path = DOCUMENTS + '/' + filename;
      const result = await session.dispatch({
        type: 'VFS_CREATE_FILE',
        file: {
          name: filename, path, parentPath: DOCUMENTS, kind: 'text',
          sizeBytes: new TextEncoder().encode(content).length,
          content, metadata: { textContent: content },
        },
      });
      if (!result.success) throw new Error(result.error || 'File could not be saved');
      setSaved(path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="worker-notepad" className="flex h-full flex-col bg-white text-black">
      <div className="flex items-center gap-2 border-b border-gray-300 bg-[#ddd] p-2 text-xs">
        <label htmlFor="worker-document-name">Name</label>
        <input id="worker-document-name" value={name} onChange={e => setName(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-500 bg-white px-1 py-0.5" />
        <button type="button" disabled={busy} onClick={() => void save()}
          className="rounded border border-gray-500 bg-[#eee] px-3 py-1 disabled:opacity-50">
          Save
        </button>
      </div>
      <textarea aria-label="Notepad document" value={content}
        onChange={e => { setContent(e.target.value); setSaved(null); }}
        className="min-h-0 flex-1 resize-none px-3 py-2 font-mono text-sm outline-none" />
      {saved && <p role="status" className="border-t bg-green-50 px-2 py-1 text-xs">
        Saved {saved}
      </p>}
      {error && <p role="alert" className="border-t bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
    </section>
  );
}
