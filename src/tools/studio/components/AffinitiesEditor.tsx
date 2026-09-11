// src/tools/studio/components/AffinitiesEditor.tsx
import React from 'react';
import { AFFINITY_DEFINITIONS } from '../types';

interface Props {
  data: Record<string, unknown>;
  onChange: (key: string, value: number) => void;
}

export const AffinitiesEditor: React.FC<Props> = ({ data, onChange }) => {
  const positives = AFFINITY_DEFINITIONS.filter((d) => d.category === 'positive');
  const tensions = AFFINITY_DEFINITIONS.filter((d) => d.category === 'tension');

  const renderSliders = (items: typeof AFFINITY_DEFINITIONS) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item) => {
        const val = Number(data[item.key] ?? 0);
        return (
          <div
            key={item.key}
            className="rounded border border-purple-900/40 bg-[#130d24] p-2.5 flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-purple-200">{item.label}</span>
              <span className="text-xs font-mono font-bold" style={{ color: item.color }}>
                {val}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={val}
                onChange={(e) => onChange(item.key, Math.max(0, Math.min(100, Number(e.target.value))))}
                className="flex-1 h-1.5 rounded bg-[#21153b] cursor-pointer"
                style={{ accentColor: item.color }}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={val}
                onChange={(e) => onChange(item.key, Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-12 rounded bg-[#1a1135] border border-purple-800/60 px-1.5 py-0.5 text-xs text-center text-purple-100 font-mono"
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Positive Bond Dimensions (0..100)
          </h3>
        </div>
        {renderSliders(positives)}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Tension & Friction Dimensions (0..100)
          </h3>
        </div>
        {renderSliders(tensions)}
      </div>
    </div>
  );
};
