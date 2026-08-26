import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';

interface ForecastDay {
  dayName: string;
  tempHighF: number;
  tempLowF: number;
  condition: string;
  icon: string;
}

const FORECAST_DAYS: ForecastDay[] = [
  { dayName: 'Mon', tempHighF: 68, tempLowF: 54, condition: 'Heavy Overcast', icon: '☁️' },
  { dayName: 'Tue', tempHighF: 62, tempLowF: 48, condition: 'Industrial Canal Rain', icon: '🌧️' },
  { dayName: 'Wed', tempHighF: 58, tempLowF: 46, condition: 'Persistent Rain & Mist', icon: '🌧️' },
  { dayName: 'Thu', tempHighF: 64, tempLowF: 50, condition: 'Overcast & Humid', icon: '☁️' },
  { dayName: 'Fri', tempHighF: 59, tempLowF: 45, condition: 'Canal Fog & Drizzle', icon: '🌫️' },
  { dayName: 'Sat', tempHighF: 66, tempLowF: 52, condition: 'Break in Clouds', icon: '⛅' },
];

export const WeatherBuddyApp: React.FC = () => {
  const currentDay = useSimulationStore((s) => s.state.time.day);
  const installedSoftware = useSimulationStore((s) => s.state.installedSoftware || []);

  const [isCelsius, setIsCelsius] = useState(false);
  const selectedCity = 'Oakhaven - Industrial Canal';

  // Adware check: SearchMate toolbar injection
  const softwareList = Array.isArray(installedSoftware) ? installedSoftware : Object.values(installedSoftware || {});
  const hasAdware = softwareList.some(
    (sw: any) => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
  );

  const toDisplayTemp = (f: number) => {
    if (!isCelsius) return `${f}°F`;
    const c = Math.round(((f - 32) * 5) / 9);
    return `${c}°C`;
  };

  const currentCondition = FORECAST_DAYS[((currentDay - 1) % FORECAST_DAYS.length)] || FORECAST_DAYS[0]!;

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
          <span className="text-[10px] font-bold text-emerald-900 mt-1">"Ribbit! Rain ahead!"</span>
        </div>

        {/* Current Weather Stats */}
        <div className="text-right">
          <div className="text-3xl font-extrabold text-slate-800 font-mono">
            {toDisplayTemp(currentCondition.tempHighF)}
          </div>
          <div className="text-xs font-bold text-slate-700">{currentCondition.condition}</div>
          <div className="text-[10px] text-slate-500">
            Low: {toDisplayTemp(currentCondition.tempLowF)} | Humidity: 88%
          </div>
        </div>
      </div>

      {/* 5-Day Forecast Grid */}
      <div className="bg-white/70 p-2 rounded border border-emerald-300">
        <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wide block mb-1">
          5-Day Forecast:
        </span>
        <div className="grid grid-cols-5 gap-1 text-center">
          {FORECAST_DAYS.slice(0, 5).map((d, i) => (
            <div key={i} className="bg-white/80 p-1 rounded border border-emerald-100 flex flex-col items-center">
              <span className="font-bold text-[10px] text-gray-700">{d.dayName}</span>
              <span className="text-base my-0.5">{d.icon}</span>
              <span className="font-mono text-[10px] font-bold text-gray-800">
                {toDisplayTemp(d.tempHighF)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Quote */}
      <div className="text-center text-[10px] text-emerald-950 font-serif italic">
        "Never leave the motel without an umbrella." — WeatherBuddy
      </div>
    </div>
  );
};
