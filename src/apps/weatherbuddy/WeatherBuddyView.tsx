import React, { useState } from 'react';
import type { EnvironmentSnapshot } from '../../engine/EnvironmentEngine';
import type { InstalledSoftwareRecord } from '../../engine/types';

/** Original WeatherBuddy authored frog/outlook/adware UI: display inputs only.
 * Both normal and Worker browser routes use the same presentation.
 */
export const WeatherBuddyView: React.FC<{
  currentCondition: EnvironmentSnapshot;
  forecast: EnvironmentSnapshot[];
  installedSoftware: InstalledSoftwareRecord[];
}> = ({ currentCondition, forecast, installedSoftware }) => {
  const [isCelsius, setIsCelsius] = useState(false);
  const selectedCity = 'Oakhaven - Industrial Canal';

  // Adware check: SearchMate toolbar injection
  const hasAdware = installedSoftware.some(
    sw => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
  );

  const toDisplayTemp = (f: number) => {
    if (!isCelsius) return `${f}°F`;
    const c = Math.round(((f - 32) * 5) / 9);
    return `${c}°C`;
  };

  // Current weather and authored outlook arrive from one revision-safe read.
  const displayMeta = (condition: EnvironmentSnapshot['weather']['condition']) => ({
    rain: { label: 'Canal Rain', icon: '🌧️' },
    drizzle: { label: 'Light Drizzle', icon: '🌦️' },
    overcast: { label: 'Heavy Overcast', icon: '☁️' },
    fog: { label: 'Canal Fog', icon: '🌫️' },
    clear: { label: 'Break in Clouds', icon: '⛅' },
    heat: { label: 'Heat Wave', icon: '☀️' },
    storm: { label: 'Canal Storm', icon: '⛈️' },
  })[condition];
  const dayLabel = (day: number): string => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return names[new Date(2006, 7, 21 + Math.max(1, day)).getDay()]!;
  };
  const currentMeta = displayMeta(currentCondition.weather.condition);

  return (
    <div className="w-full h-full bg-gradient-to-b from-sky-400 via-sky-200 to-amber-100 text-black font-sans text-xs select-none flex flex-col justify-between p-3 border-2 border-emerald-600 shadow-2xl relative overflow-hidden">
      {/* SearchMate Adware Injected Banner Hook */}
      {hasAdware && (
        <div className="bg-yellow-300 text-yellow-950 px-2 py-1 -mt-2 -mx-2 mb-2 border-b border-yellow-500 text-[10px] flex justify-between items-center animate-pulse">
          <span className="font-bold">⭐ SearchMate Deal: Cheap RAM & Dialup Modems!</span>
          <span className="text-[9px] bg-yellow-400 px-1 rounded cursor-pointer">Visit TechMart »</span>
        </div>
      )}

      {/* Header & City Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-emerald-950 flex items-center gap-1">
            <span>🐸</span> WeatherBuddy 3.1
          </h2>
          <span className="text-[10px] text-emerald-800 font-medium">{selectedCity}</span>
        </div>

        <button
          onClick={() => setIsCelsius(!isCelsius)}
          className="px-2 py-0.5 bg-white/80 hover:bg-white border border-emerald-700 rounded text-[10px] font-bold shadow-xs cursor-pointer"
        >
          Units: {isCelsius ? '°C' : '°F'}
        </button>
      </div>

      {/* Animated Frog Mascot & Current Temp Pane */}
      <div className="flex items-center justify-around my-2 bg-white/60 backdrop-blur-xs p-3 rounded-lg border border-white/80 shadow-inner">
        {/* Frog Mascot */}
        <div className="flex flex-col items-center">
          <div className="text-5xl animate-bounce duration-1000">🐸</div>
          <span className="text-[10px] font-bold text-emerald-900 mt-1">"Ribbit! {currentMeta.label} today!"</span>
        </div>

        {/* Current Weather Stats */}
        <div className="text-right">
          <div className="text-3xl font-extrabold text-slate-800 font-mono">
            {toDisplayTemp(currentCondition.weather.highF)}
          </div>
          <div className="text-xs font-bold text-slate-700">{currentMeta.label}</div>
          <div className="text-[10px] text-slate-500">
            Low: {toDisplayTemp(currentCondition.weather.lowF)} | Wind index: {Math.round(currentCondition.weather.wind * 100)}/100
          </div>
        </div>
      </div>

      {/* 5-Day Forecast Grid */}
      <div className="bg-white/70 p-2 rounded border border-emerald-300">
        <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wide block mb-1">
          5-Day Forecast:
        </span>
        <div className="grid grid-cols-5 gap-1 text-center">
          {forecast.map((d) => {
            const meta = displayMeta(d.weather.condition);
            return (
            <div key={d.day} className="bg-white/80 p-1 rounded border border-emerald-100 flex flex-col items-center">
              <span className="font-bold text-[10px] text-gray-700">{dayLabel(d.day)}</span>
              <span className="text-base my-0.5">{meta.icon}</span>
              <span className="font-mono text-[10px] font-bold text-gray-800">
                {toDisplayTemp(d.weather.highF)}
              </span>
            </div>
            );
          })}
        </div>
      </div>

      {/* Footer Quote */}
      <div className="text-center text-[10px] text-emerald-950 font-serif italic">
        "Never leave the motel without an umbrella." — WeatherBuddy
      </div>
    </div>
  );
};
