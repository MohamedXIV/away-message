import React from 'react';
import { SiteRouteProps } from '../types';

export const WeatherBuddySite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  return (
    <div className="w-full min-h-full bg-[#f0fdf4] text-black font-sans text-xs p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full border-b-2 border-emerald-600 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🐸</span>
          <div>
            <h1 className="text-xl font-bold font-serif text-emerald-950 leading-none">
              WeatherBuddy Desktop Companion
            </h1>
            <span className="text-[10px] text-emerald-700">
              The World's Favorite Weather Frog & Forecaster
            </span>
          </div>
        </div>

        <button
          onClick={() => doNavigate('downloadhub.local')}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow cursor-pointer"
        >
          ⬇ Get WeatherBuddy Free
        </button>
      </div>

      <div className="max-w-4xl w-full mt-6 bg-white border border-emerald-200 rounded p-6 shadow-md space-y-3">
        <h2 className="text-sm font-bold text-emerald-900">
          Animated Forecasts Right on Your Desktop
        </h2>
        <p className="text-xs text-gray-700 leading-relaxed">
          WeatherBuddy sits right on your desktop, croaking when storm fronts roll in across the industrial canal.
        </p>
      </div>
    </div>
  );
};
