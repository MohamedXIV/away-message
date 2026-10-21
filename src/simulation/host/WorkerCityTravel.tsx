import { useMemo, useState } from 'react';
import {
  CITY_NODE_IDS, CITY_NODES, quoteTravel, streetSegments,
  isNodeOpen, type CityNodeId, type TravelMode,
} from '../../engine/CityMap';
import type { SimulationWorldRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

/**
 * The CityMap is a public, immutable topology only. The Worker owns money,
 * weather, fatigue, world minutes, NPC encounters and the actual location.
 * Quotes are previews; the canonical TRAVEL_TO action adjudicates the trip.
 */
export function WorkerCityTravel({
  world, session, onReturnToRoom,
}: {
  world: SimulationWorldRead;
  session: WorkerGameSession;
  onReturnToRoom: () => void;
}) {
  const [selected, setSelected] = useState<CityNodeId>('cafe');
  const [mode, setMode] = useState<TravelMode>('walk');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const location = world.playerLocation;
  const wet = world.environment.weather.tags.includes('wet');
  const estimate = useMemo(
    () => quoteTravel(location, selected, mode, wet),
    [location, selected, mode, wet],
  );

  const travel = async (destination: CityNodeId) => {
    setBusy(true);
    setNotice(null);
    try {
      // Do NOT update location optimistically: trip time, cash, energy,
      // closures and encounters belong to the canonical Worker.
      const result = await session.dispatch({ type: 'TRAVEL_TO', to: destination, mode });
      if (!result.success) {
        setNotice(result.error ?? 'Travel was refused by the simulation');
        return;
      }
      const data = result.data as { summary?: string; encounter?: string } | undefined;
      setNotice([data?.summary, data?.encounter].filter(Boolean).join(' — ') || 'Travel completed');
      if (destination === 'home') onReturnToRoom();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="worker-city-travel"
      className="space-y-4 rounded-md border border-slate-700 bg-slate-900 p-4 text-slate-100">
      <header>
        <h2 className="text-lg font-semibold">Oakhaven · City Map</h2>
        <p data-testid="worker-city-location" className="text-sm text-emerald-300">
          You are at {CITY_NODES[location].name}
        </p>
        <p className="text-xs text-slate-400">
          Choose a place to visit. Longer journeys cost time and energy.
        </p>
      </header>

      <svg viewBox="0 0 100 100" role="img" aria-label="Oakhaven city map"
        className="max-h-56 w-full rounded border border-slate-700 bg-slate-950 p-2">
        {streetSegments().map((segment, i) => (
          <line key={i} x1={CITY_NODES[segment.a].x} y1={CITY_NODES[segment.a].y}
            x2={CITY_NODES[segment.b].x} y2={CITY_NODES[segment.b].y}
            stroke={segment.bus ? '#8db4e9' : '#63748a'} strokeWidth="0.7" />
        ))}
        {CITY_NODE_IDS.map(id => {
          const node = CITY_NODES[id];
          return (
            <g key={id}>
              <circle cx={node.x} cy={node.y} r={id === location ? 3.2 : 2.3}
                fill={id === location ? '#34d399' : id === selected ? '#fbbf24' : '#e2e8f0'} />
              <text x={node.x + 2.8} y={node.y - 2.5} fontSize="3.3" fill="#f8fafc">
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CITY_NODE_IDS.map(id => (
          <button key={id} type="button" onClick={() => setSelected(id)}
            aria-pressed={selected === id} aria-label={'Choose ' + CITY_NODES[id].name}
            className={`rounded border px-2 py-2 text-left text-xs ${selected === id
              ? 'border-amber-300 bg-slate-700' : 'border-slate-600 hover:bg-slate-800'}`}>
            <span className="block font-semibold">{CITY_NODES[id].name}</span>
            <span className="text-slate-300">
              {isNodeOpen(CITY_NODES[id], world.time.hour) ? 'Usual hours: open' : 'Usual hours: closed'}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Travel mode
          <select aria-label="Travel mode" value={mode}
            onChange={event => setMode(event.target.value as TravelMode)}
            className="rounded border border-slate-500 bg-slate-800 px-2 py-1">
            <option value="walk">Walk</option>
            <option value="bus">Bus if route allows</option>
          </select>
        </label>
        <span data-testid="worker-city-quote" className="text-slate-300">
          Preview: {estimate.minutes} min, {estimate.busUsed ? '$2 bus' : 'walking'}
          {mode === 'bus' && !estimate.busUsed ? ' (no full bus route)' : ''}
        </span>
        <button disabled={busy || selected === location}
          onClick={() => void travel(selected)}
          className="rounded border border-emerald-500 px-3 py-1 disabled:opacity-40">
          Travel to {CITY_NODES[selected].name}
        </button>
      </div>
      {location !== 'home' && (
        <button disabled={busy} onClick={() => void travel('home')}
          className="rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-40">
          Return home
        </button>
      )}
      {notice && <p role="status" data-testid="worker-city-receipt" className="text-sm text-amber-200">
        {notice}
      </p>}
    </section>
  );
}
