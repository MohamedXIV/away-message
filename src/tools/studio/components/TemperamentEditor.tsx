// src/tools/studio/components/TemperamentEditor.tsx
import React from 'react';
import { TRAIT_DEFINITIONS } from '../types';

interface Props {
  data: Record<string, unknown>;
  onChange: (key: string, value: number) => void;
}

export const TemperamentEditor: React.FC<Props> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="rounded border border-purple-900/60 bg-[#160d2e]/30 p-3 text-xs text-purple-200">
        <span className="font-semibold text-purple-300">Big5-Lite Quantitative Temperament:</span> All
        values are strictly clamped between 0 and 100. These values are hand-authored rules foundations
        that govern NPC initiative nerve, goodbye phrasing, chat warmth, and friendship formation.
      </div>

      <div className="grid grid-cols-1 gap-4">
        {TRAIT_DEFINITIONS.map((trait) => {
          const val = Number(data[trait.key] ?? 50);
          return (
            <div
              key={trait.key}
              className="rounded border border-purple-900/60 bg-[#130d24] p-3 transition-colors hover:border-purple-700/60"
            >
              <div className="flex justify-between items-center mb-1">
                <div>
                  <span className="text-sm font-bold text-purple-200">{trait.label}</span>
                  <span className="text-[11px] text-gray-400 ml-2">{trait.description}</span>
                </div>
                <span className="text-sm font-extrabold text-purple-300 font-mono">
                  {val} / 100
                </span>
              </div>

              <div className="my-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={val}
                  onChange={(e) => onChange(trait.key, Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-full accent-purple-500 cursor-pointer h-2 bg-[#21153b] rounded-lg"
                />
              </div>

              <div className="flex justify-between text-[11px] text-gray-400 font-medium">
                <span className={val < 40 ? 'text-purple-300 font-semibold' : ''}>
                  0: {trait.lowLabel}
                </span>
                <span className={val >= 40 && val <= 60 ? 'text-purple-300 font-semibold' : ''}>
                  50: Neutral
                </span>
                <span className={val > 60 ? 'text-purple-300 font-semibold' : ''}>
                  100: {trait.highLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
