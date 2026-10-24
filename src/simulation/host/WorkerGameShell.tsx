import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { WorkerGameSession } from './WorkerGameSession';
import { WorkerPhysicalRoom } from './WorkerPhysicalRoom';
import { WorkerDesktop } from './WorkerDesktop';
import { WorkerCityTravel } from './WorkerCityTravel';
import { WorkerCityPlaceView } from './WorkerCityPlaceView';
import { useWindowStore } from '../../store/useWindowStore';
import { listSlots, type SlotSummary } from '../../persistence/slotUi';
import { GENERATED_PLACES } from '../../engine/worldContent.generated';
import { CITY_NODES } from '../../engine/CityMap';
import { WorkerStarterResidenceChoice } from './WorkerStarterResidenceChoice';
import { InGameContextMenu, type GameContextMenuState } from '../../desktop/InGameContextMenu';

const authoredPlaceNames = new Map(GENERATED_PLACES.map(place => [place.id, place.name] as const));

/**
 * Production Worker-first gameplay shell. Never imports App, Zustand,
 * SimulationKernel or a legacy engine; all facts are bounded RPC projections.
 * Full authored UI migration is a separate step of #175 on this Draft PR.
 */
export function WorkerGameShell() {
  const session = useMemo(() => new WorkerGameSession(), []);
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [slot, setSlot] = useState('slot_1');
  const [saveSummaries, setSaveSummaries] = useState<SlotSummary[]>([]);
  const [slotListError, setSlotListError] = useState<string | null>(null);
  const mostRecent = saveSummaries.find(saved => saved.hasSnapshot) ?? null;
  const [panel, setPanel] = useState<'summary' | 'room' | 'city' | 'desktop'>('room');
  const [chooseResidence, setChooseResidence] = useState(false);
  const [arrival, setArrival] = useState<{ location: string; receipt: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<GameContextMenuState | null>(null);

  useEffect(() => () => session.dispose(), [session]);

  // The selector is user-editable for Load/Save As, but after Continue or
  // cold Load its default MUST be the slot owned by this Worker session.
  // Otherwise loading slot_2 silently makes a later Save overwrite slot_1.
  useEffect(() => {
    // Slot identity can stay unchanged through a menu → Continue cycle even
    // when the user has manually selected a different Save As target there.
    if (view.phase === 'game') setSlot(view.slotId);
  }, [view.phase, view.slotId]);

  // UI-owned slot metadata only; no full save snapshot, canonical reader or
  // local simulation is created to display the last played world.
  useEffect(() => {
    if (view.phase !== 'menu' && view.phase !== 'error') return;
    let alive = true;
    void listSlots().then(summaries => {
      if (!alive) return;
      setSaveSummaries(summaries);
      setSlotListError(null);
    }).catch(error => {
      if (alive) setSlotListError(String(error));
    });
    return () => { alive = false; };
  }, [view.phase]);

  // Windows are presentation-only and belong to a *single* Worker session.
  // A menu/reload/failure must never leak the previous run's window stack
  // into a new canonical world. Do not touch the simulation owner here.
  useEffect(() => {
    if (view.phase !== 'game') {
      useWindowStore.setState({
        windows: {}, windowOrder: [], activeWindowId: null,
        highestZIndex: 10, cascadeCounter: 0,
      });
    }
  }, [view.phase]);

  // Start each new/cold-loaded world in its actual physical place. Never
  // carry a stale desktop/chat pane into a different Worker generation.
  useEffect(() => {
    if (view.phase === 'game') {
      setPanel('room');
      setChooseResidence(false);
      setArrival(null);
    }
  }, [view.phase]);

  const openClassicMenu = (): void => {
    // DEV-only diagnostic. A full navigation terminates the
    // Dedicated Worker; the legacy renderer is never co-mounted with it.
    const url = new URL('./', window.location.href);
    url.search = '';
    url.searchParams.set('runtime', 'legacy');
    window.location.assign(url.toString());
  };

  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setLocalError(null);
    try { await operation(); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const control = 'rounded border border-amber-800/60 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:border-amber-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <main className="h-full w-full overflow-y-auto bg-[#090e1b] text-slate-100" data-testid="worker-first-shell"
      onContextMenu={event => {
        // All gameplay surfaces consume right-click. Nested OS / app targets
        // stop propagation and expose their own contextual menus.
        event.preventDefault();
        if (view.phase !== 'game' || !view.hud) return;
        setContextMenu({
          x: event.clientX, y: event.clientY, label: panel === 'room' ? 'Your surroundings' : 'Game',
          items: [
            ...(panel !== 'room' ? [{ label: 'Look around', onSelect: () => setPanel('room') }] : []),
            { label: 'Open town map', onSelect: () => setPanel('city') },
            ...(view.world?.playerLocation === 'home' && panel !== 'desktop'
              ? [{ label: 'Use computer', onSelect: () => setPanel('desktop') }] : []),
            { label: view.hud.paused ? 'Resume time' : 'Pause time',
              onSelect: () => void act(() => session.dispatch({ type: 'TIME_SET_PAUSED', paused: !view.hud!.paused })) },
            { label: 'Save game', onSelect: () => void act(() => session.save(slot)) },
          ],
        });
      }}>
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/50 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-400">Oakhaven · early web years</p>
            <h1 className="text-2xl font-black tracking-wider text-amber-200">AWAY MESSAGE</h1>
            {view.phase === 'game' && view.world && (
              <p className="text-xs text-slate-400" data-testid="worker-residence-place"
                data-place-id={view.world.residencePlaceId}>
                {view.world.playerLocation === 'home'
                  ? authoredPlaceNames.get(view.world.residencePlaceId) ?? 'Your residence'
                  : CITY_NODES[view.world.playerLocation].name}
              </p>
            )}
          </div>
          <p className="max-w-xs text-right text-xs leading-relaxed text-slate-400">
            {view.phase === 'game' ? 'A quiet day in Oakhaven.' : 'A town, a second-hand computer, and people you have not met yet.'}
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <span data-testid="worker-phase" className={view.phase === 'game' ? 'sr-only' : 'rounded-full border border-amber-800 px-3 py-1 text-sm text-amber-300'}>
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
          <section className="flex flex-col gap-3" data-testid="worker-recovery-controls">
            {view.phase === 'error' && (
              <p className="text-sm text-amber-200" role="status">
                The canonical Worker stopped. Unsaved progress cannot be restored.
                Choose a saved slot to start a fresh Worker, or deliberately start a new game.
                No replacement simulation is running on this page.
              </p>
            )}
            {mostRecent && <p data-testid="worker-continue-summary" className="text-sm text-slate-300">
              Last save: {mostRecent.name} · Day {mostRecent.day} ·
              {new Date(mostRecent.updatedAt).toLocaleString()}
            </p>}
            {slotListError && <p role="alert" className="text-sm text-red-300">{slotListError}</p>}
            <div className="flex flex-wrap gap-3">
              {mostRecent && <button className={control} disabled={busy}
                onClick={() => void act(() => session.loadGame(mostRecent.id))}>
                Continue last save
              </button>}
              <button className={control} disabled={busy} onClick={() => void act(() => session.newGame())}>New game</button>
              <button className={control} disabled={busy} aria-expanded={chooseResidence}
                onClick={() => setChooseResidence(open => !open)}>Choose starting residence</button>
              {import.meta.env.DEV && (
                <button className={control} disabled={busy} onClick={openClassicMenu}>
                  Return to classic interface
                </button>
              )}
              <button className={control} disabled={busy} onClick={() => void act(() => session.loadGame(slot))}>
                {view.phase === 'error' ? 'Recover saved slot' : 'Load game'}
              </button>
              {view.phase === 'error' && slot !== 'autosave' && (
                <button className={control} disabled={busy} onClick={() => void act(() => session.loadGame('autosave'))}>
                  Recover autosave
                </button>
              )}
            </div>
            {chooseResidence && (
              <WorkerStarterResidenceChoice disabled={busy} onChoose={offerId => {
                void act(() => session.newGame(offerId));
              }} />
            )}
            {saveSummaries.some(saved => saved.hasSnapshot) && (
              <div className="border-t border-slate-700 pt-3 text-xs text-slate-400">
                Your saved worlds stay here. Starting a new story does not delete them.
              </div>
            )}
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
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-sm" data-testid="worker-hud">
              <div className="font-bold text-amber-200">Day {view.hud.time.day} · {String(view.hud.time.hour).padStart(2, '0')}:{String(view.hud.time.minute).padStart(2, '0')}</div>
              <div title="Cash on hand" className="text-emerald-300">${view.hud.cash.toFixed(2)}</div>
              <div title="Energy">Energy {Math.round(view.player.needs.energy)}%</div>
              <div title="Hunger">Hunger {Math.round(view.player.needs.hunger)}%</div>
              <div title="Social battery">Social {Math.round(view.hud.socialBattery)}%</div>
              <div className="text-slate-400">{view.player.moodBand} · {view.world.environment.weather.condition}</div>
              <span className="ml-auto text-[10px] text-slate-500" title="Elapsed in-world minutes">
                Minute <span data-testid="worker-minute">{view.hud.time.totalMinutes}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={control} disabled={busy} onClick={() => void act(() => session.advanceMinutes(15))}>Advance 15 minutes</button>
              <button className={control} disabled={busy} onClick={() => void act(async () => {
                await session.dispatch({ type: 'TIME_SET_PAUSED', paused: !view.hud!.paused });
              })}>{view.hud.paused ? 'Resume clock' : 'Pause clock'}</button>
              <button className={control} disabled={busy} onClick={() => void act(() => session.save(slot))}>Save game</button>
              <button className={control} disabled={busy} onClick={() => { session.backToMenu(); setLocalError(null); }}>Return to menu</button>
            </div>
            {view.saved && <p role="status" className="text-sm text-emerald-300">{view.saved}</p>}
            <nav aria-label="Worker gameplay panels" className="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
              {(['room', 'city', 'desktop', 'summary'] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setPanel(tab)}
                  aria-pressed={panel === tab}
                  className={`rounded border px-3 py-1 text-sm capitalize ${
                    panel === tab ? 'border-emerald-400 bg-emerald-900/50' : 'border-slate-600'
                  }`}>
                  {tab}
                </button>
              ))}
            </nav>
            {panel === 'summary' && (
              <section className="rounded border border-slate-700 bg-slate-900 p-5 text-sm" data-testid="worker-status">
                <h2 className="mb-3 text-lg font-semibold text-amber-200">How you're doing</h2>
                <p>Energy {Math.round(view.player.needs.energy)}% · Hunger {Math.round(view.player.needs.hunger)}% · Mood {view.player.moodBand}</p>
                <p className="mt-2 text-slate-400">Rent: ${view.player.rent.rentAmount} · due day {view.player.rent.rentDueDay}
                  {view.player.rent.rentPaid ? ' · paid' : ' · unpaid'}</p>
              </section>
            )}
            {panel === 'room' && view.world.playerLocation === 'home' && (
              <WorkerPhysicalRoom world={view.world}
                dispatch={action => session.dispatch(action)}
                onOpenCity={() => setPanel('city')}
                onOpenDesktop={() => setPanel('desktop')} />
            )}
            {panel === 'room' && view.world.playerLocation !== 'home' && (
              <WorkerCityPlaceView key={view.world.playerLocation}
                world={view.world} hud={view.hud} player={view.player} session={session}
                onOpenMap={() => setPanel('city')}
                onReturnHome={() => { setArrival(null); setPanel('room'); }}
                arrivalNotice={arrival?.location === view.world.playerLocation ? arrival.receipt : null} />
            )}
            {panel === 'city' && (
              <WorkerCityTravel world={view.world} session={session}
                onReturnToRoom={() => { setArrival(null); setPanel('room'); }}
                onArrived={(location, receipt) => {
                  setArrival({ location, receipt });
                  setPanel('room');
                }} />
            )}
            {panel === 'desktop' && (
              <WorkerDesktop session={session} revision={view.hud.revision} onStepAway={() => setPanel('room')} />
            )}
            <details data-testid="worker-world" className="rounded border border-slate-800 px-3 py-2 text-xs text-slate-500">
              <summary className="cursor-pointer">Technical diagnostics</summary>
              <h2>Canonical world projection</h2>
              <p>View: {view.world.activeView} · Place: {view.world.residencePlaceId} · Battery: {view.hud.socialBattery} · Revision: {view.hud.revision}</p>
            </details>
          </>
        )}
      </div>
      <InGameContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} testId="worker-world-context-menu" />
    </main>
  );
}
