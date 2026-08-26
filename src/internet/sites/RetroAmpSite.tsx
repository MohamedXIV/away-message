import React from 'react';
import { SiteRouteProps } from '../types';

export const RetroAmpSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  return (
    <div className="w-full min-h-full bg-[#18181b] text-gray-200 font-sans text-xs p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full border-b-2 border-emerald-500 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl text-emerald-400">📻</span>
          <div>
            <h1 className="text-xl font-bold font-mono text-emerald-400 leading-none">
              RetroAmp Audio Systems
            </h1>
            <span className="text-[10px] text-gray-400">
              "It Really Whips The Byte's Tail" // High Fidelity MP3 & WAV Decoder
            </span>
          </div>
        </div>

        <button
          onClick={() => doNavigate('downloadhub.local')}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded text-xs shadow cursor-pointer font-mono"
        >
          ⬇ Get RetroAmp 2.95
        </button>
      </div>

      <div className="max-w-4xl w-full mt-6 bg-[#27272a] border border-gray-700 rounded p-6 shadow-xl space-y-3">
        <h2 className="text-base font-bold text-emerald-400 font-mono">
          Features of RetroAmp 2.95:
        </h2>
        <ul className="space-y-1.5 text-gray-300 list-disc list-inside">
          <li>10-Band Graphic Equalizer with custom ±12dB pre-amp curves</li>
          <li>19-Band Real-Time Fast Fourier Transform (FFT) spectrum visualizer</li>
          <li>Full playlist manager with M3U / PLS playlist import</li>
          <li>Ultra-lightweight footprint (under 4MB of RAM)</li>
        </ul>
      </div>
    </div>
  );
};
