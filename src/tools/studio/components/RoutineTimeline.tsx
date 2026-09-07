// src/tools/studio/components/RoutineTimeline.tsx
import React from 'react';
import { WORK_SHIFT_OPTIONS, minuteToTimeStr } from '../types';

interface Props {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

const HANGOUT_SUGGESTIONS = ['cafe', 'cart', 'canal', 'motel', 'arcade', 'library', 'park'];

export const RoutineTimeline: React.FC<Props> = ({ data, onChange }) => {
  const wake = Number(data['wakeMinute'] ?? 420);
  const sleep = Number(data['sleepMinute'] ?? 1380);
  const shift = String(data['workShift'] ?? 'day');
  const hangout = String(data['preferredHangout'] ?? 'cafe');

  // Compute percentage widths for the 24h timeline
  // 1440 total minutes = 100%
  const renderTimelineSegments = () => {
    // Standard Day Person: sleep > wake
    if (sleep > wake) {
      const sleep1Pct = (wake / 1440) * 100;
      const awakePct = ((sleep - wake) / 1440) * 100;
      const sleep2Pct = ((1440 - sleep) / 1440) * 100;

      return (
        <div className="h-7 w-full flex rounded overflow-hidden border border-purple-800/60 bg-[#0d0718]">
          <div
            style={{ width: `${sleep1Pct}%` }}
            className="bg-indigo-950/80 border-r border-indigo-900 flex items-center justify-center text-[10px] text-indigo-300 select-none"
            title={`Asleep: 12:00 AM – ${minuteToTimeStr(wake)}`}
          >
            Sleep
          </div>
          <div
            style={{ width: `${awakePct}%` }}
            className="bg-amber-900/40 border-r border-amber-800/60 flex items-center justify-center text-[10px] text-amber-200 select-none font-semibold"
            title={`Active / ${shift} shift: ${minuteToTimeStr(wake)} – ${minuteToTimeStr(sleep)}`}
          >
            Active ({shift}) • {hangout}
          </div>
          <div
            style={{ width: `${sleep2Pct}%` }}
            className="bg-indigo-950/80 flex items-center justify-center text-[10px] text-indigo-300 select-none"
            title={`Asleep: ${minuteToTimeStr(sleep)} – 12:00 AM`}
          >
            Sleep
          </div>
        </div>
      );
    } else {
      // Night Owl: wake > sleep
      const active1Pct = (sleep / 1440) * 100;
      const sleepPct = ((wake - sleep) / 1440) * 100;
      const active2Pct = ((1440 - wake) / 1440) * 100;

      return (
        <div className="h-7 w-full flex rounded overflow-hidden border border-purple-800/60 bg-[#0d0718]">
          <div
            style={{ width: `${active1Pct}%` }}
            className="bg-amber-900/40 border-r border-amber-800/60 flex items-center justify-center text-[10px] text-amber-200 select-none font-semibold"
            title={`Active night: 12:00 AM – ${minuteToTimeStr(sleep)}`}
          >
            Night Active
          </div>
          <div
            style={{ width: `${sleepPct}%` }}
            className="bg-indigo-950/80 border-r border-indigo-900 flex items-center justify-center text-[10px] text-indigo-300 select-none"
            title={`Sleeping day: ${minuteToTimeStr(sleep)} – ${minuteToTimeStr(wake)}`}
          >
            Sleep (Day)
          </div>
          <div
            style={{ width: `${active2Pct}%` }}
            className="bg-amber-900/40 flex items-center justify-center text-[10px] text-amber-200 select-none font-semibold"
            title={`Active: ${minuteToTimeStr(wake)} – 12:00 AM`}
          >
            Active ({shift})
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual 24h timeline preview */}
      <div className="rounded border border-purple-900/60 bg-[#130d24] p-3">
        <div className="flex justify-between items-center text-xs text-gray-300 mb-1.5">
          <span className="font-semibold text-purple-200">24-Hour Life Cycle Preview</span>
          <span className="text-[11px] text-gray-400">
            Wake: <strong className="text-purple-300">{minuteToTimeStr(wake)}</strong> • Sleep:{' '}
            <strong className="text-purple-300">{minuteToTimeStr(sleep)}</strong>
          </span>
        </div>
        {renderTimelineSegments()}
        <div className="flex justify-between text-[9px] text-gray-500 mt-1 font-mono">
          <span>00:00 (Midnight)</span>
          <span>06:00 AM</span>
          <span>12:00 PM (Noon)</span>
          <span>18:00 PM</span>
          <span>24:00</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wake Time */}
        <div className="rounded border border-purple-900/40 bg-[#130d24] p-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-gray-300">Wake Up Minute</label>
            <span className="text-xs font-bold text-purple-300">{minuteToTimeStr(wake)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1439"
            step="15"
            value={wake}
            onChange={(e) => onChange('wakeMinute', Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="text-[10px] text-gray-400 mt-1">Minute: {wake} (0..1439)</div>
        </div>

        {/* Sleep Time */}
        <div className="rounded border border-purple-900/40 bg-[#130d24] p-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-gray-300">Bedtime Minute</label>
            <span className="text-xs font-bold text-purple-300">{minuteToTimeStr(sleep)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1439"
            step="15"
            value={sleep}
            onChange={(e) => onChange('sleepMinute', Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="text-[10px] text-gray-400 mt-1">Minute: {sleep} (0..1439)</div>
        </div>

        {/* Work Shift */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Work Shift Type
          </label>
          <div className="flex rounded border border-purple-800/60 overflow-hidden bg-[#130d24]">
            {WORK_SHIFT_OPTIONS.map((s) => {
              const active = shift === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange('workShift', s)}
                  className={`flex-1 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    active ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred Hangout */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Preferred Hangout Spot
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={hangout}
              onChange={(e) => onChange('preferredHangout', e.target.value)}
              className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-3 py-1.5 text-sm text-purple-100 focus:border-purple-400 focus:outline-none"
              placeholder="e.g. cafe, cart, canal"
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {HANGOUT_SUGGESTIONS.map((spot) => (
              <button
                key={spot}
                type="button"
                onClick={() => onChange('preferredHangout', spot)}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  hangout === spot
                    ? 'bg-purple-800 border-purple-600 text-white'
                    : 'bg-[#1a1135] border-purple-900/60 text-gray-400 hover:text-purple-200'
                }`}
              >
                {spot}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
