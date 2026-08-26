import React from 'react';
import { SiteRouteProps } from '../types';

export const SafeSweepSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full border-b-2 border-emerald-600 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl text-emerald-600">🛡️</span>
          <div>
            <h1 className="text-xl font-bold font-serif text-emerald-900 leading-none">
              SafeSweep Anti-Spyware & Security
            </h1>
            <span className="text-[10px] text-gray-500">
              Complete Protection from Adware, Toolbar Hijackers, and Keyloggers
            </span>
          </div>
        </div>

        <button
          onClick={() => doNavigate('downloadhub.local')}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow cursor-pointer"
        >
          ⬇ Download SafeSweep 4.2
        </button>
      </div>

      <div className="max-w-4xl w-full mt-6 bg-emerald-50 border border-emerald-300 rounded p-6 shadow space-y-2">
        <h2 className="text-sm font-bold text-emerald-950">Is Your Web Browser Hijacked by SearchMate?</h2>
        <p className="text-xs text-gray-700 leading-relaxed">
          SafeSweep 4.2 features deep registry inspection, automated quarantine of bundled adware DLLs, and 1-click removal of unwanted browser toolbars.
        </p>
      </div>
    </div>
  );
};
