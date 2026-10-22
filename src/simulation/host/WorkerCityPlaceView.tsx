import { useState } from 'react';
import type { SimulationAction } from '../../engine/types';
import type { SimulationHudProjection, SimulationPlayerStatusRead, SimulationWorldRead } from '../../engine/kernel/SimulationPublication';
import { CITY_NODES, type CityNodeId, type TravelMode } from '../../engine/CityMap';
import { DOOR_OPTIONS, isOptionOpen } from '../../world/data/roomInteractables';
import type { RoomActivityOption } from '../../world/types';
import type { WorkerGameSession } from './WorkerGameSession';
import { WorkerCafePresencePanel } from './WorkerCafePresencePanel';

/** Authored P7 place actions, with canonical effects requested via the sole Worker. */
export function actionsForCityLocation(location: CityNodeId): RoomActivityOption[] {
  switch (location) {
    case 'cart': return DOOR_OPTIONS.filter(option => option.actionType === 'work');
    case 'diner': return DOOR_OPTIONS.filter(option => option.id.startsWith('diner_'));
    case 'cafe': return DOOR_OPTIONS.filter(option => option.id === 'visit_cafe');
    case 'canal': return DOOR_OPTIONS.filter(option => option.id === 'canal_walk');
    case 'laundry': return DOOR_OPTIONS.filter(option => option.id === 'laundromat');
    default: return [];
  }
}

export function WorkerCityPlaceView({
  world, hud, player, session, onOpenMap, onReturnHome, arrivalNotice,
}: {
  world: SimulationWorldRead;
  hud: SimulationHudProjection;
  player: SimulationPlayerStatusRead;
  session: WorkerGameSession;
  onOpenMap: () => void;
  onReturnHome: () => void;
  arrivalNotice?: string | null;
}) {
  const location = world.playerLocation;
  const node = CITY_NODES[location];
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const activities = actionsForCityLocation(location);

  const run = async (action: SimulationAction, successLabel: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setNotice(null);
    try {
      const result = await session.dispatch(action);
      if (!result.success) {
        setNotice(result.error || 'The world did not allow that interaction.');
        return false;
      }
      const data = result.data as { summary?: string; rumor?: string; earnedWage?: number } | undefined;
      const detail = [data?.summary, data?.rumor].filter(Boolean).join(' — ');
      setNotice(detail || (data?.earnedWage !== undefined
        ? 'Shift complete — earned $' + data.earnedWage.toFixed(2) : successLabel));
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runActivity = (option: RoomActivityOption): void => {
    if (option.actionType === 'work') {
      void run({
        type: 'PLAYER_WORK_SHIFT',
        durationMinutes: option.durationMinutes,
        wage: option.cashReward,
      }, 'Shift completed.');
    } else {
      void run({ type: 'PLAYER_CITY_OUTING', outingId: option.id }, option.title + ' completed.');
    }
  };

  const returnHome = async (): Promise<void> => {
    if (await run({ type: 'TRAVEL_TO', to: 'home', mode: travelMode }, 'Returned home.')) {
      onReturnHome();
    }
  };

  return (
    <section data-testid="worker-city-place" data-location={location}
      className="flex flex-col gap-3 rounded border border-slate-700 bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-2xl">{node.icon}</span>
          <div>
            <h2 className="font-bold text-amber-200" data-testid="worker-city-place-location">{node.name}</h2>
            <p className="text-xs text-slate-400">
              Day {hud.time.day} · {String(hud.time.hour).padStart(2, '0')}:{String(hud.time.minute).padStart(2, '0')}
              {' · '}{world.environment.weather.condition}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-300">
          <div>{'$' + hud.cash.toFixed(2)}</div>
          <div>Energy {Math.round(player.needs.energy)}%</div>
        </div>
      </header>
      <div className="space-y-3 px-4 py-2">
        <p className="text-sm text-slate-300">{node.blurb}</p>
        {arrivalNotice && <p role="status" data-testid="worker-city-arrival"
          className="rounded border border-emerald-900/60 bg-emerald-950/30 p-3 text-xs text-emerald-200">
          {arrivalNotice}
        </p>}
        {location === 'cafe' && (
          <WorkerCafePresencePanel session={session} world={world} revision={hud.revision} />
        )}
        {location === 'lobby' && (
          <div className="rounded border border-slate-700 bg-slate-900 p-4" data-testid="worker-place-rent">
            <h3 className="font-semibold text-amber-200">Front desk · Rent</h3>
            <p className="my-2 text-sm text-slate-300">
              {'$' + player.rent.rentAmount.toFixed(2)} due day {player.rent.rentDueDay}
              {' · '}{player.rent.rentPaid ? 'Paid' : 'Unpaid'}
            </p>
            {!player.rent.rentPaid && (
              <button type="button" disabled={busy || hud.cash < player.rent.rentAmount}
                className="rounded border border-emerald-600 px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => void run({ type: 'PLAYER_PAY_RENT' }, 'Rent paid.')}>
                Pay rent
              </button>
            )}
          </div>
        )}
        {activities.map(option => {
          const open = isOptionOpen(option, hud.time.hour);
          const affordable = (option.cashCost ?? 0) <= hud.cash;
          return (
            <article key={option.id} data-testid="worker-city-place-action"
              className="flex flex-wrap items-center gap-3 rounded border border-slate-700 bg-slate-900 p-3">
              <span aria-hidden="true" className="text-2xl">{option.icon}</span>
              <div className="min-w-48 flex-1">
                <h3 className="font-semibold text-amber-100">{option.title}</h3>
                <p className="text-xs text-slate-400">{option.description}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {option.durationMinutes} min
                  {option.cashCost ? ' · Cost $' + option.cashCost.toFixed(2) : ''}
                  {option.cashReward ? ' · Earn $' + option.cashReward.toFixed(2) : ''}
                  {!open ? ' · Closed now' : ''}
                </p>
              </div>
              <button type="button" disabled={busy || !open || !affordable}
                onClick={() => runActivity(option)} aria-label={'Go: ' + option.title}
                className="rounded border border-amber-500 px-3 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-40">
                Go
              </button>
            </article>
          );
        })}
        {activities.length === 0 && location !== 'lobby' && (
          <p className="rounded border border-slate-800 p-4 text-sm text-slate-400">
            Look around, or open the map to visit another part of Oakhaven.
          </p>
        )}
        {notice && <p data-testid="worker-city-place-receipt" role="status"
          className="rounded border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">
          {notice}
        </p>}
      </div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-700 bg-slate-900 px-4 py-3">
        <button type="button" onClick={onOpenMap} disabled={busy}
          className="rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">
          Open city map
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Return by
          <select aria-label="Return travel mode" value={travelMode}
            onChange={event => setTravelMode(event.target.value as TravelMode)}
            className="rounded border border-slate-600 bg-slate-800 p-2">
            <option value="walk">Walking</option>
            <option value="bus">Bus if available</option>
          </select>
        </label>
        <button type="button" onClick={() => void returnHome()} disabled={busy}
          className="ml-auto rounded border border-emerald-600 px-3 py-2 text-sm disabled:opacity-50">
          Return home
        </button>
      </footer>
    </section>
  );
}
