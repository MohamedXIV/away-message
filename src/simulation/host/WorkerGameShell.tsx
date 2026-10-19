import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { WorkerGameSession } from './WorkerGameSession';
import { WorkerPhysicalRoom } from './WorkerPhysicalRoom';
import { WorkerPulsePanel } from './WorkerPulsePanel';
import { WorkerDesktop } from './WorkerDesktop';

/**
 * Opt-in Worker-first gameplay vertical slice. Never imports App, Zustand,
 * SimulationKernel or a legacy engine; all facts are bounded RPC projections.
 * Full authored UI migration is a separate step of #175 on this Draft PR.
 */
export function WorkerGameShell() {
  const session = useMemo(() => new WorkerGameSession(), []);
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [slot, setSlot] = useState('slot_1');
  const [panel, setPanel] = useState<'summary' | 'room' | 'pulse' | 'desktop'>('summary');

  useEffect(() => () => session.dispose(), [session]);

  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setLocalError(null);
    try { await operation(); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const control = 'rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <main className="min-h-full w-full bg-slate-950 p-6 text-slate-100" data-testid="worker-first-shell">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="border-b border-slate-700 pb-4">
          <p className="text-xs uppercase tracking-widest text-emerald-400">Away Message / #175 Worker-first vertical slice</p>
          <h1 className="mt-2 text-2xl font-semibold">Dedicated Simulation Worker</h1>
          <p className="mt-1 text-sm text-slate-400">One canonical world, bounded projections. Legacy UI is not mounted in this mode.</p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <span data-testid="worker-phase" className="rounded-full border border-emerald-800 px-3 py-1 text-sm text-emerald-300">
            {view.phase}
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Save slot
            <select aria-label="Save slot" value={slot} onChange={event => setSlot(event.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-2 py-2">
              <option value="slot_1">Slot 1</option>
              <option value="slot_2">Slot 2</option>
              <option value="slot_3">Slot 3</option>
              <option value="autosave">Autosave</option>
            </select>
          </label>
        </div>

        {(view.phase === 'menu' || view.phase === 'error') && (
          <section className="flex flex-wrap gap-3">
            <button className={control} disabled={busy} onClick={() => void act(() => session.newGame())}>New game</button>
            <button className={control} disabled={busy} onClick={() => void act(() => session.loadGame(slot))}>Load game</button>
          </section>
        )}
        {view.phase === 'loading' && <p role="status">Starting canonical Worker world…</p>}
        {(view.error || localError) && (
          <p role="alert" className="rounded-md border border-red-800 p-3 text-sm text-red-300">
            {view.error || localError}
          </p>
        )}

        {view.phase === 'game' && view.hud && view.world && view.player && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="worker-hud">
              <div className="rounded-md border border-slate-700 p-4">
                <div className="text-xs text-slate-400">World minute</div>
                <div className="text-xl font-semibold" data-testid="worker-minute">{view.hud.time.totalMinutes}</div>
              </div>
              <div className="rounded-md border border-slate-700 p-4">
                <div className="text-xs text-slate-400">Day / Time</div>
                <div className="text-xl font-semibold">Day {view.hud.time.day} · {String(view.hud.time.hour).padStart(2, '0')}:{String(view.hud.time.minute).padStart(2, '0')}</div>
              </div>
              <div className="rounded-md border border-slate-700 p-4">
                <div className="text-xs text-slate-400">Cash</div>
                <div className="text-xl font-semibold">{view.hud.cash}</div>
              </div>
              <div className="rounded-md border border-slate-700 p-4">
                <div className="text-xs text-slate-400">Revision</div>
                <div className="text-xl font-semibold">{view.hud.revision}</div>
              </div>
            </div>
            <section className="rounded-md border border-slate-700 p-4" data-testid="worker-world">
              <h2 className="mb-2 font-semibold">Canonical world projection</h2>
              <p className="text-sm text-slate-300">View: {view.world.activeView} · Place: {view.world.residencePlaceId} · Battery: {view.hud.socialBattery}</p>
              <p className="mt-1 text-sm text-slate-400">Mood: {view.player.moodBand} · Rent due: {view.player.rent.rentDueDay}</p>
            </section>
            <div className="flex flex-wrap gap-2">
              <button className={control} disabled={busy} onClick={() => void act(() => session.advanceMinutes(15))}>Advance 15 minutes</button>
              <button className={control} disabled={busy} onClick={() => void act(async () => {
                await session.dispatch({ type: 'TIME_SET_PAUSED', paused: !view.hud!.paused });
              })}>{view.hud.paused ? 'Resume clock' : 'Pause clock'}</button>
              <button className={control} disabled={busy} onClick={() => void act(() => session.save(slot))}>Save game</button>
              <button className={control} disabled={busy} onClick={() => { session.backToMenu(); setLocalError(null); }}>Return to menu</button>
            </div>
            {view.saved && <p role="status" className="text-sm text-emerald-300">{view.saved}</p>}
            <nav aria-label="Worker gameplay panels" className="flex gap-2 border-b border-slate-700 pb-2">
              {(['summary', 'room', 'pulse', 'desktop'] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setPanel(tab)}
                  aria-pressed={panel === tab}
                  className={`rounded border px-3 py-1 text-sm capitalize ${
                    panel === tab ? 'border-emerald-400 bg-emerald-900/50' : 'border-slate-600'
                  }`}>
                  {tab}
                </button>
              ))}
            </nav>
            {panel === 'room' && (
              <WorkerPhysicalRoom world={view.world}
                dispatch={action => session.dispatch(action)} />
            )}
            {panel === 'pulse' && (
              <WorkerPulsePanel session={session} revision={view.hud.revision} />
            )}
            {panel === 'desktop' && (
              <WorkerDesktop session={session} revision={view.hud.revision} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
