// src/world/components/CityPlaceView.tsx
// P7 place screen — rendered instead of the room canvas while away from home.
// Node actions run here (work shifts at the cart, diner menu at the diner,
// walks, laundry, cafe entry, front-desk rent). All effects resolve in-engine.

import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';
import { CITY_NODES, type CityNodeId } from '../../engine/CityMap';
import { DOOR_OPTIONS } from '../data/roomInteractables';
import { getWeatherForDay } from '../../engine/WeatherEngine';
import type { RoomActivityOption } from '../types';
import { SiliconSparesModal } from '../modals/SiliconSparesModal';

interface CityPlaceViewProps {
  location: CityNodeId;
  onOpenMap: () => void;
}

function formatDuration(totalMin: number): string {
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h${m}m` : `${h}h`;
  }
  return `${totalMin}m`;
}

export const CityPlaceView: React.FC<CityPlaceViewProps> = ({ location, onOpenMap }) => {
  const time = useSimulationStore((s) => s.state.time);
  const player = useSimulationStore((s) => s.state.player);
  const workShift = useSimulationStore((s) => s.workShift);
  const cityOuting = useSimulationStore((s) => s.cityOuting);
  const payRent = useSimulationStore((s) => s.payRent);
  const switchView = useSimulationStore((s) => s.switchView);
  const [notice, setNotice] = useState<string | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);

  const node = CITY_NODES[location];
  const weather = getWeatherForDay(time.day);

  // Actions available at this node (data-driven from the old door options)
  const actions: RoomActivityOption[] = (() => {
    switch (location) {
      case 'cart':
        return DOOR_OPTIONS.filter((o) => o.actionType === 'work');
      case 'diner':
        return DOOR_OPTIONS.filter((o) => o.id.startsWith('diner_'));
      case 'canal':
        return DOOR_OPTIONS.filter((o) => o.id === 'canal_walk');
      case 'laundry':
        return DOOR_OPTIONS.filter((o) => o.id === 'laundromat');
      default:
        return [];
    }
  })();

  const runAction = (option: RoomActivityOption) => {
    if (option.actionType === 'work') {
      workShift(option.durationMinutes, option.cashReward);
      setNotice(`Shift done — $${(option.cashReward ?? 0).toFixed(2)} earned.`);
    } else if (option.actionType === 'diner' || option.actionType === 'outing') {
      const res = cityOuting(option.id) as unknown as { success: boolean; error?: string; data?: { summary?: string; rumor?: string } };
      if (res?.success) {
        setNotice([res.data?.summary, res.data?.rumor].filter(Boolean).join(' — ') || 'Done.');
        soundManager.play('door_open');
      } else {
        setNotice(res?.error || 'Could not do that here.');
      }
    }
  };

  const formattedTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden font-sans">
      {/* Header */}
      <div className="z-30 h-10 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{node.icon}</span>
          <span className="font-bold text-amber-300">{node.name}</span>
          <span className="font-mono text-slate-400">Day {time.day} • {formattedTime}</span>
          <span className="text-slate-400">{weather.icon} {weather.label}</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span className="font-bold text-green-400">${player.cash.toFixed(2)}</span>
          <span className="text-amber-300">⚡{player.energy}%</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-xs text-slate-400">{node.blurb}</p>
        <p className="text-[11px] italic text-slate-500">{node.hint}</p>

        {location === 'cafe' && (
          <button
            onClick={() => switchView('cafe')}
            className="w-full p-3 rounded border border-amber-500/60 bg-amber-950/30 hover:bg-amber-950/50 text-left cursor-pointer"
          >
            <div className="text-xs font-bold text-amber-200">☕ Enter Starlight Café</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Warm coffee and in-person conversation.</div>
          </button>
        )}

        {location === 'techmart' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowShopModal(true)}
              className="w-full p-3.5 rounded border border-cyan-500/60 bg-cyan-950/40 hover:bg-cyan-950/60 text-left cursor-pointer shadow-lg"
            >
              <div className="text-sm font-bold text-cyan-200">🖥️ Enter Silicon &amp; Spares Store</div>
              <div className="text-xs text-slate-300 mt-1">Browse refurbished computers, CRT monitors, RAM sticks, and OS upgrade CDs.</div>
            </button>
            {showShopModal && <SiliconSparesModal onClose={() => setShowShopModal(false)} />}
          </div>
        )}

        {location === 'lobby' && (
          <div className="p-3 rounded border border-slate-700 bg-slate-800/80">
            <div className="text-xs font-bold text-slate-100">🛎️ Front Desk</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Rent: <b className="text-slate-200">${player.rentAmount.toFixed(2)}</b> due day {player.rentDueDay} —{' '}
              {player.rentPaid ? <span className="text-emerald-400 font-bold">paid ✓</span> : <span className="text-amber-300">unpaid</span>}
            </div>
            {!player.rentPaid && player.cash >= player.rentAmount && (
              <button
                onClick={() => { payRent(); setNotice('Rent paid. Henderson nods approvingly.'); }}
                className="mt-2 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Pay ${player.rentAmount.toFixed(2)}
              </button>
            )}
          </div>
        )}

        {actions.map((option) => (
          <div key={option.id} className="p-3 border rounded bg-slate-800/80 border-slate-700 hover:border-slate-500 transition-colors">
            <div className="flex items-start gap-3">
              <div className="text-2xl pt-0.5">{option.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-xs text-slate-100 truncate">{option.title}</h4>
                  <span className="text-[11px] font-mono text-amber-400 shrink-0">{formatDuration(option.durationMinutes)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{option.description}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono">
                  {option.cashReward ? <span className="text-green-400 font-bold">+${option.cashReward.toFixed(2)} Wages</span> : null}
                  {option.cashCost ? <span className="text-slate-200">Cost: ${option.cashCost.toFixed(2)}</span> : null}
                  <span className={option.energyChange < 0 ? 'text-amber-400' : 'text-cyan-400'}>
                    {option.energyChange > 0 ? `+${option.energyChange}` : option.energyChange} Energy
                  </span>
                </div>
              </div>
              <button
                onClick={() => runAction(option)}
                className="px-3 py-1.5 rounded bg-slate-200 hover:bg-white text-slate-950 text-xs font-bold shrink-0 self-center shadow cursor-pointer"
              >
                Go
              </button>
            </div>
          </div>
        ))}

        {location !== 'cafe' && location !== 'lobby' && actions.length === 0 && (
          <p className="text-[11px] italic text-slate-500">Nothing to do here but look around. Open the map to go somewhere else.</p>
        )}

        {notice && (
          <div className="p-2.5 rounded border border-amber-500/60 bg-amber-950/30 text-[11px] text-amber-100">
            {notice}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-800/95 border-t border-slate-700 flex justify-between items-center shrink-0">
        <button
          onClick={() => onOpenMap()}
          className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold cursor-pointer"
        >
          🗺️ Map
        </button>
        <TravelHomeButton />
      </div>
    </div>
  );
};

const TravelHomeButton: React.FC = () => {
  const travelHome = useSimulationStore((s) => s.dispatchAction);
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={() => {
        setBusy(true);
        try {
          travelHome({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' });
        } finally {
          window.setTimeout(() => setBusy(false), 300);
        }
      }}
      className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
    >
      🏠 Go home
    </button>
  );
};
