// src/world/components/CityMapView.tsx
// P7 Oakhaven schematic map — 2005 tourist-map styling, click a node to go.
// Shows open/closed per headline hours, you-are-here, NPC hints, and a
// walk/bus quote (time + fare) before confirming.

import React, { useState } from 'react';
import {
  CITY_NODES,
  CITY_NODE_IDS,
  streetSegments,
  isNodeOpen,
  quoteTravel,
  BUS_FARE,
  type CityNodeId,
  type TravelMode,
} from '../../engine/CityMap';
import { soundManager } from '../../audio/SoundManager';

interface CityMapViewProps {
  currentNode: CityNodeId;
  hour: number;
  cash: number;
  energy: number;
  raining: boolean;
  storming: boolean;
  onTravel: (to: CityNodeId, mode: TravelMode) => void;
}

export const CityMapView: React.FC<CityMapViewProps> = ({
  currentNode,
  hour,
  cash,
  energy,
  raining,
  storming,
  onTravel,
}) => {
  const [selected, setSelected] = useState<CityNodeId | null>(null);
  const [mode, setMode] = useState<TravelMode>('walk');

  const pick = (id: CityNodeId) => {
    soundManager.play('click');
    setSelected((prev) => (prev === id ? null : id));
  };

  const quote = selected && selected !== currentNode
    ? quoteTravel(currentNode, selected, mode, raining)
    : null;
  const selectedNode = selected ? CITY_NODES[selected] : null;
  const selectedOpen = selectedNode ? isNodeOpen(selectedNode, hour) : true;
  const canAffordBus = cash >= BUS_FARE;
  const goDisabled =
    !quote ||
    (quote.busUsed && !canAffordBus) ||
    (quote.mode === 'walk' && energy < 10 && quote.minutes > 0) ||
    (selected === 'canal' && storming);

  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-full rounded border border-slate-700 bg-[#0d1626]" role="img" aria-label="Oakhaven city map">
        {/* Night-paper background grid */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 10} y1={0} x2={(i + 1) * 10} y2={100} stroke="#1b2942" strokeWidth={0.3} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i + 1) * 10} x2={100} y2={(i + 1) * 10} stroke="#1b2942" strokeWidth={0.3} />
        ))}
        {/* Canal ribbon */}
        <path d="M 8 18 Q 30 12 52 20 T 96 14" fill="none" stroke="#274b73" strokeWidth={3.2} strokeLinecap="round" />
        <path d="M 8 18 Q 30 12 52 20 T 96 14" fill="none" stroke="#3f6ea5" strokeWidth={1} strokeDasharray="2 2" />
        {/* Streets */}
        {streetSegments().map((s) => {
          const a = CITY_NODES[s.a];
          const b = CITY_NODES[s.b];
          return (
            <g key={`${s.a}-${s.b}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#33415e" strokeWidth={1.6} strokeLinecap="round" />
              {s.bus && (
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8a6d2f" strokeWidth={0.5} strokeDasharray="1.5 1.5" />
              )}
            </g>
          );
        })}
        {/* Nodes */}
        {CITY_NODE_IDS.map((id) => {
          const node = CITY_NODES[id];
          const isHere = id === currentNode;
          const isSel = id === selected;
          const open = isNodeOpen(node, hour);
          return (
            <g
              key={id}
              onClick={() => pick(id)}
              className="cursor-pointer"
              opacity={isHere ? 1 : open ? 1 : 0.55}
            >
              {isSel && <circle cx={node.x} cy={node.y} r={6.4} fill="none" stroke="#f4d58d" strokeWidth={0.8} strokeDasharray="1.5 1" />}
              {isHere && <circle cx={node.x} cy={node.y} r={5.2} fill="none" stroke="#f4d58d" strokeWidth={0.7} />}
              <circle
                cx={node.x}
                cy={node.y}
                r={4}
                fill={isHere ? '#4a2390' : open ? '#1d3a2a' : '#3a2330'}
                stroke={isHere ? '#ffd400' : open ? '#2ecc71' : '#e05a5a'}
                strokeWidth={0.7}
              />
              <text x={node.x} y={node.y + 1.6} textAnchor="middle" fontSize={4.4}> {node.icon} </text>
              <text
                x={node.x}
                y={node.y + 8.6}
                textAnchor="middle"
                fontSize={3}
                fill={isHere ? '#ffd400' : '#cbd5e1'}
                fontWeight={isHere ? 'bold' : 'normal'}
              >
                {node.name}{isHere ? ' (you)' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
        <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2ecc71] mr-1" />open</span>
        <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e05a5a] mr-1" />closed</span>
        <span className="text-[#8a6d2f]">┄ bus line</span>
        {raining && <span className="text-sky-300">🌧️ walks ×1.25</span>}
        {storming && <span className="text-red-300 font-bold">⛈️ canal closed</span>}
      </div>

      {/* Selection panel */}
      {selectedNode && selected !== currentNode && (
        <div className="mt-2 rounded border border-slate-700 bg-slate-800/80 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-100">{selectedNode.icon} {selectedNode.name}</span>
            <span className={`text-[10px] font-bold ${selectedOpen ? 'text-emerald-400' : 'text-red-400'}`}>
              {selectedOpen ? '● open' : '● closed'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{selectedNode.blurb}</p>
          <p className="mt-0.5 text-[10px] italic text-slate-500">{selectedNode.hint}</p>
          {quote && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex rounded border border-slate-600 overflow-hidden text-[11px] font-bold">
                <button
                  onClick={() => { soundManager.play('click'); setMode('walk'); }}
                  className={`px-2.5 py-1 cursor-pointer ${mode === 'walk' ? 'bg-slate-200 text-slate-900' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  🚶 {quote.mode === 'walk' ? `${quote.minutes}m` : 'walk'}
                </button>
                <button
                  onClick={() => { soundManager.play('click'); setMode('bus'); }}
                  className={`px-2.5 py-1 cursor-pointer ${mode === 'bus' ? 'bg-slate-200 text-slate-900' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  🚌 {quote.busUsed ? `${quote.minutes}m · $${BUS_FARE.toFixed(2)}` : 'no line'}
                </button>
              </div>
              <button
                onClick={() => selected && onTravel(selected, quote.busUsed ? 'bus' : 'walk')}
                disabled={goDisabled}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-bold transition-all ${
                  goDisabled ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow cursor-pointer'
                }`}
              >
                Go → {quote.minutes}m
              </button>
            </div>
          )}
          {!canAffordBus && mode === 'bus' && (
            <div className="mt-1 text-[10px] font-bold text-red-300">Bus fare is ${BUS_FARE.toFixed(2)} — walk it instead?</div>
          )}
          {selected === 'canal' && storming && (
            <div className="mt-1 text-[10px] font-bold text-red-300">Walkway closed in the storm.</div>
          )}
        </div>
      )}
      {selected === currentNode && (
        <div className="mt-2 text-center text-[11px] italic text-slate-500">You are here. Pick somewhere else to go.</div>
      )}
    </div>
  );
};
