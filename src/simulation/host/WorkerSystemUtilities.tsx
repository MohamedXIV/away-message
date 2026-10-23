import { useEffect, useState } from 'react';
import { AUTOSAVE_ID, SAVE_SLOTS, deleteSlot, listSlots, type SlotSummary } from '../../persistence/slotUi';
import type { SimulationDirectoryRead, SimulationInstalledProgramsRead } from '../../engine/kernel/SimulationPublication';
import { useWindowStore } from '../../store/useWindowStore';
import type { WorkerGameSession } from './WorkerGameSession';

const button = 'rounded border border-gray-500 bg-[#eee] px-2 py-1 text-xs text-black disabled:opacity-40';

/** Owner-paged metadata. Never pull VFS state or file bodies into a Recycle Bin window. */
export function WorkerRecycleBinPanel({ session, revision }: {
  session: WorkerGameSession; revision: number;
}) {
  const [page, setPage] = useState<SimulationDirectoryRead | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void session.read({ kind: 'directory', path: 'C:/Trash', offset, limit: 32 })
      .then(read => { if (alive && read.revision === revision) setPage(read); })
      .catch(error => { if (alive) setNotice(String(error)); });
    return () => { alive = false; };
  }, [session, revision, offset]);

  const act = async (action: Parameters<WorkerGameSession['dispatch']>[0], message: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await session.dispatch(action);
      if (!result.success) throw new Error(result.error ?? 'Worker refused this operation');
      setSelected(null);
      setConfirmEmpty(false);
      setNotice(message);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const selectedFile = page?.files.find(file => file.path === selected);
  return <section data-testid="worker-recycle-bin" className="flex h-full min-h-0 flex-col bg-[#c0c0c0] text-black text-xs">
    <div className="flex flex-wrap gap-2 border-b border-gray-500 bg-[#dfdfdf] p-2">
      <button className={button} disabled={busy || !selectedFile}
        onClick={() => { if (selectedFile) void act({ type: 'VFS_RESTORE_TRASH', trashPath: selectedFile.path }, 'Restored ' + selectedFile.name); }}>
        Restore selected
      </button>
      <button className={button} disabled={busy || !page?.files.length}
        onClick={() => setConfirmEmpty(value => !value)}>Empty Recycle Bin</button>
      {confirmEmpty && <button className={button + ' text-red-700'} disabled={busy}
        onClick={() => void act({ type: 'VFS_EMPTY_TRASH' }, 'Recycle Bin emptied by Worker')}>
        Confirm permanent deletion
      </button>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto bg-white p-2">
      {(page?.files ?? []).map(file =>
        <button key={file.id} type="button" aria-pressed={selected === file.path}
          aria-label={'Select trashed: ' + file.name} onClick={() => setSelected(file.path)}
          className={'flex w-full flex-wrap justify-between gap-1 rounded px-2 py-1 text-left ' +
            (selected === file.path ? 'bg-blue-600 text-white' : 'hover:bg-blue-50')}>
          <span>{file.name}</span>
          <span className="text-[10px]">{String(file.metadata?.originalTrashPath ?? 'Unknown source')} · {file.sizeBytes} B</span>
        </button>)}
      {page && page.files.length === 0 && <p>The Recycle Bin is empty.</p>}
    </div>
    <div className="flex items-center justify-between border-t border-gray-500 bg-[#dfdfdf] px-2 py-1">
      <span>{page?.files.length ?? 0} on this page {page?.hasMore ? '· more pages' : ''}</span>
      <div className="flex gap-2">
        <button disabled={offset === 0} onClick={() => { setOffset(v => Math.max(0, v - 32)); setSelected(null); }}>Previous</button>
        <button disabled={!page?.hasMore} onClick={() => { setOffset(v => v + 32); setSelected(null); }}>Next</button>
      </div>
    </div>
    {notice && <p role="status" className="border-t bg-[#fff7c7] px-2 py-1">{notice}</p>}
  </section>;
}

/** Small installed-software query, not the legacy AppRead with downloads and hardware. */
export function WorkerAddRemovePanel({ session, revision }: {
  session: WorkerGameSession; revision: number;
}) {
  const [read, setRead] = useState<SimulationInstalledProgramsRead | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void session.read({ kind: 'installedPrograms' })
      .then(result => { if (alive && result.revision === revision) setRead(result); })
      .catch(error => { if (alive) setNotice(String(error)); });
    return () => { alive = false; };
  }, [session, revision]);
  const programs = read?.programs.filter(p => !p.isPortable) ?? [];
  const selectedProgram = programs.find(p => p.id === selected);
  const uninstall = async () => {
    if (!selectedProgram || busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await session.dispatch({ type: 'SOFTWARE_UNINSTALL', installedId: selectedProgram.id });
      if (!result.success) throw new Error(result.error ?? 'Uninstall refused by canonical Worker');
      setNotice('Removed ' + selectedProgram.name);
      setSelected(null); setConfirm(false);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <section data-testid="worker-addremove" className="flex h-full min-h-0 flex-col bg-[#c0c0c0] text-black text-xs">
    <div className="border-b border-gray-500 bg-[#dfdfdf] p-3">
      <h2 className="font-bold">Add/Remove Programs</h2>
      <p className="text-gray-600">Select installed software to uninstall it from the canonical computer.</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto bg-white p-2">
      {programs.length === 0 && <p>No installed programs found.</p>}
      {programs.map(program => <button key={program.id} type="button"
        onClick={() => { setSelected(program.id); setConfirm(false); }}
        aria-pressed={selected === program.id} aria-label={'Select program: ' + program.name}
        className={'block w-full rounded border p-2 text-left ' + (selected === program.id ? 'border-blue-700 bg-blue-100' : 'border-transparent hover:bg-gray-100')}>
        <strong>{program.name}</strong> · v{program.version}
        <span className="ml-2 text-gray-600">{(program.installedBytes / 1048576).toFixed(1)} MB</span>
        {program.isAdware && <span className="block text-amber-700">Bundled components present</span>}
      </button>)}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-gray-500 bg-[#dfdfdf] p-2">
      <span>{programs.length} installed programs</span>
      <button className={button} disabled={busy || !selectedProgram} onClick={() => setConfirm(true)}>
        Remove selected
      </button>
      {confirm && selectedProgram && <>
        <span>Remove {selectedProgram.name}?</span>
        <button className={button} disabled={busy} onClick={() => void uninstall()}>Confirm uninstall</button>
        <button className={button} onClick={() => setConfirm(false)}>Cancel</button>
      </>}
    </div>
    {notice && <p role="status" className="bg-[#fff7c7] px-2 py-1">{notice}</p>}
  </section>;
}

/** Save/load UI is presentation only. All full snapshots stay in Worker + IDB. */
export function WorkerSaveLoadPanel({ session }: { session: WorkerGameSession }) {
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const refresh = async () => {
    const records = await listSlots();
    setSlots(records);
  };
  useEffect(() => {
    let alive = true;
    void listSlots().then(result => { if (alive) setSlots(result); })
      .catch(error => { if (alive) setNotice(String(error)); });
    return () => { alive = false; };
  }, [session]);

  const save = async (id: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      await session.save(id);
      setNotice('Saved to ' + id);
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const load = async (id: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      // UI windows never cross timeline boundaries even when a cold load
      // finishes before React renders an intermediate loading phase.
      useWindowStore.setState({
        windows: {}, windowOrder: [], activeWindowId: null,
        highestZIndex: 10, cascadeCounter: 0,
      });
      await session.loadGame(id);
      // A failed cold load is surfaced by the session's error phase.
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (busy || id === session.getSnapshot().slotId) return;
    setBusy(true); setNotice(null);
    try {
      await deleteSlot(id);
      setDeleteCandidate(null);
      setNotice('Deleted ' + id);
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const byId = new Map(slots.map(s => [s.id, s]));
  const rows = [...SAVE_SLOTS, AUTOSAVE_ID];
  const active = session.getSnapshot().slotId;
  return <section data-testid="worker-save-load" className="flex h-full min-h-0 flex-col bg-[#ece9d8] text-black text-xs">
    <h2 className="border-b border-gray-500 bg-[#dfdfdf] p-3 font-bold">Save / Load Game — Worker-owned world</h2>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      {rows.map((id, index) => {
        const summary = byId.get(id);
        const isActive = active === id;
        return <div key={id} data-testid={'worker-save-row-' + id} className="rounded border border-gray-400 bg-white p-2">
          <div className="flex justify-between gap-3">
            <strong>{id === AUTOSAVE_ID ? 'Autosave' : 'Slot ' + (index + 1)} {isActive ? '· Active' : ''}</strong>
            <span>{summary?.hasSnapshot ? summary.name + ' · Day ' + summary.day : 'empty'}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {id !== AUTOSAVE_ID && <button className={button} disabled={busy}
              onClick={() => void save(id)}>Save</button>}
            <button className={button} disabled={busy || !summary?.hasSnapshot}
              onClick={() => void load(id)}>Load</button>
            <button className={button} disabled={busy || !summary || isActive}
              title={isActive ? 'Cannot delete the active cold-reader slot' : undefined}
              onClick={() => setDeleteCandidate(id)}>Delete</button>
            {deleteCandidate === id && !isActive && <>
              <button className={button} disabled={busy} onClick={() => void remove(id)}>Confirm delete</button>
              <button className={button} onClick={() => setDeleteCandidate(null)}>Cancel</button>
            </>}
          </div>
        </div>;
      })}
      <p className="text-[11px] text-gray-600">Loading starts a fresh Dedicated Worker. The active slot is protected while its cold conversation reader is in use.</p>
    </div>
    {notice && <p role="status" className="border-t border-gray-400 bg-[#fff7c7] px-2 py-1">{notice}</p>}
  </section>;
}
