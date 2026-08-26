import React from 'react';
import { SiteRouteProps } from '../types';

export const CityWireSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  return (
    <div className="w-full min-h-full bg-[#fcfbf9] text-gray-900 font-serif text-xs p-4 flex flex-col items-center">
      {/* Newspaper Header */}
      <div className="max-w-4xl w-full border-b-4 border-black pb-2 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tight font-serif text-black">
          THE CITY WIRE
        </h1>
        <div className="flex justify-between items-center text-[10px] uppercase font-sans border-y border-black py-1 mt-1 font-bold">
          <span>Oakhaven District Edition</span>
          <span>Tuesday, August 22, 2006</span>
          <span>Price: $0.75</span>
        </div>
      </div>

      {/* Main Newspaper Grid */}
      <div className="max-w-4xl w-full grid grid-cols-3 gap-6 mt-4">
        {/* Lead Story (2 Cols) */}
        <div className="col-span-2 space-y-2 border-r border-gray-300 pr-4">
          <h2 className="text-xl font-bold font-serif leading-tight">
            Canal Infrastructure Upgrades Spark Power Fluctuations Across West District
          </h2>
          <span className="text-[10px] font-sans font-semibold text-gray-500 uppercase block">
            By Arthur Vance // Senior Urban Reporter
          </span>
          <p className="text-xs leading-relaxed text-justify">
            Residents in the industrial canal district reported intermittent brownouts and low-frequency auditory hums late Monday night as municipal contractors energized high-voltage substations along the waterway. Officials claim the project will modernize telemetry routing for the local pumping stations, but night shift workers and motel guests described unusual flickering in commercial neon signs and telephone static.
          </p>
          <p className="text-xs leading-relaxed text-justify">
            "The lights in the 4th Street Diner dimmed down to an amber glow around 2:45 AM," said Maya Lin, a counter waitress. "The streetlights along the canal were buzzing like guitar amplifiers."
          </p>
        </div>

        {/* Sidebar Stories (1 Col) */}
        <div className="col-span-1 space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm font-serif">
              New Broadband DSL Rollout Expands to Motel Row
            </h3>
            <p className="text-xs leading-relaxed text-justify text-gray-700">
              Oakhaven Telecom announced the completion of copper DSL lines extending to Starlite Motel and nearby industrial depots, enabling speeds up to 1.0 Mbps.
            </p>
            <button
              onClick={() => doNavigate('techmart.local')}
              className="text-[11px] text-blue-700 hover:underline font-sans font-bold"
            >
              Order DSL modems via TechMart »
            </button>
          </div>

          <div className="border-t border-gray-300 pt-2 space-y-1">
            <h3 className="font-bold text-sm font-serif">
              Local Weather: Persistent Canal Rain Continues
            </h3>
            <p className="text-xs leading-relaxed text-justify text-gray-700">
              Low-pressure fronts sweeping off the industrial basin will bring heavy overcast skies and mist through Friday.
            </p>
            <button
              onClick={() => doNavigate('weatherbuddy.local')}
              className="text-[11px] text-blue-700 hover:underline font-sans font-bold"
            >
              View 5-Day Radar on WeatherBuddy »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
