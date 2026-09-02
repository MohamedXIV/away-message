import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { ProceduralDirector } from '../../engine/ProceduralDirector';

export const CityWireSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});
  const world = useSimulationStore((s) => s.state.world);
  const time = useSimulationStore((s) => s.state.time);
  const engine = useSimulationStore((s) => s.engine);

  const [generating, setGenerating] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ source: string; error?: string } | null>(null);

  // Build dynamic articles from triggered sandbox events
  const triggered = [...world.triggeredEvents]
    .filter((e) => e.triggerDay <= time.day)
    .sort((a, b) => (b.triggeredAtMinute ?? b.triggerDay * 1440) - (a.triggeredAtMinute ?? a.triggerDay * 1440));

  const lead = triggered[0];
  const sidebar = triggered.slice(1, 4);

  // Controls info for procedural generation
  const pendingCount = engine.world.getPendingEvents().length;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const director = new ProceduralDirector(engine.world);
      const res = await director.generateNextBatch(time.day, time.totalMinutes, {
        worldSeed: `oakhaven-citywire-${time.day}-${Date.now()}`,
        maxEvents: 2,
        allowedCategories: ['city_news', 'site_launch', 'economy', 'culture'],
        tone: 'grounded',
        useAI: true,
      });
      setLastMeta({ source: res.meta.source, error: res.meta.error });
    } catch (err) {
      setLastMeta({ source: 'error', error: err instanceof Error ? err.message : String(err) });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full min-h-full bg-[#fcfbf9] text-gray-900 font-serif text-xs p-4 flex flex-col items-center">
      {/* Newspaper Header */}
      <div className="max-w-4xl w-full border-b-4 border-black pb-2 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tight font-serif text-black">
          THE CITY WIRE
        </h1>
        <div className="flex justify-between items-center text-[10px] uppercase font-sans border-y border-black py-1 mt-1 font-bold">
          <span>Oakhaven District Edition</span>
          <span>Day {time.day} • {String(time.hour).padStart(2, '0')}:{String(time.minute).padStart(2, '0')} • 2006</span>
          <span>Price: $0.75</span>
        </div>
        <div className="text-[9px] font-mono text-gray-500 mt-1">
          Sandbox Wire • {triggered.length} filed • {pendingCount} queued • governed procedural
        </div>
      </div>

      {/* Procedural Controls Bar (governed) */}
      <div className="max-w-4xl w-full mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 px-3 py-2 text-[10px] font-sans">
        <div className="text-gray-700">
          <span className="font-bold">Wire Director:</span> AI + templates • era-locked 1998-2006 • .local only • Zod-validated
          {lastMeta && (
            <span className="ml-2 text-gray-500">last: {lastMeta.source}{lastMeta.error ? ` • ${lastMeta.error.slice(0, 60)}` : ''}</span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1 bg-black text-white font-bold uppercase text-[10px] hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating…' : `Generate Next Week (${pendingCount} queued)`}
        </button>
      </div>

      {/* Main Newspaper Grid */}
      <div className="max-w-4xl w-full grid grid-cols-3 gap-6 mt-4">
        {/* Lead Story (2 Cols) — dynamic from most recent triggered event */}
        <div className="col-span-2 space-y-2 border-r border-gray-300 pr-4">
          {lead ? (
            <>
              <div className="inline-block bg-black text-white text-[8px] font-sans font-bold px-2 py-0.5 uppercase tracking-widest">
                {lead.category} • Day {lead.triggerDay}
              </div>
              <h2 className="text-xl font-bold font-serif leading-tight">{lead.title}</h2>
              <span className="text-[10px] font-sans font-semibold text-gray-500 uppercase block">
                By CityWire Staff // Day {lead.triggerDay} • {lead.category}
              </span>
              <p className="text-xs leading-relaxed text-justify">{lead.description}</p>
              <p className="text-xs leading-relaxed text-justify text-gray-700 italic">“{lead.knowledgePrompt}”</p>
              {lead.siteUrl && (
                <button
                  onClick={() => {
                    try { doNavigate(new URL(lead.siteUrl as string).hostname); } catch { doNavigate('citywire.local'); }
                  }}
                  className="text-[11px] text-blue-700 hover:underline font-sans font-bold"
                >
                  Open {(() => { try { return new URL(lead.siteUrl as string).hostname; } catch { return 'citywire.local'; } })()} »
                </button>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
          {/* Archive of older triggered */}
          {triggered.length > 1 && (
            <div className="border-t border-gray-300 pt-3 mt-4 space-y-2">
              <h4 className="font-bold text-xs font-sans uppercase tracking-widest text-gray-600">Filed this week</h4>
              {triggered.slice(1, 5).map((e) => (
                <div key={e.id} className="text-xs border-l-2 border-gray-300 pl-2 py-1">
                  <div className="font-bold font-serif">{e.title}</div>
                  <div className="text-gray-600 text-[11px]">{e.description}</div>
                  <div className="text-[10px] text-gray-400">
                    Day {e.triggerDay} • {e.category} {e.siteUrl ? `• ${new URL(e.siteUrl).hostname}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Stories (1 Col) */}
        <div className="col-span-1 space-y-4">
          {sidebar.length > 0 ? (
            sidebar.map((e) => (
              <div key={e.id} className="space-y-1 border-b border-gray-200 pb-3">
                <div className="text-[8px] font-sans font-bold uppercase text-gray-500">
                  {e.category} • Day {e.triggerDay}
                </div>
                <h3 className="font-bold text-sm font-serif">{e.title}</h3>
                <p className="text-xs leading-relaxed text-justify text-gray-700">{e.description}</p>
                {e.siteUrl && (
                  <button
                    onClick={() => {
                      try { doNavigate(new URL(e.siteUrl as string).hostname); } catch { doNavigate('citywire.local'); }
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-sans font-bold"
                  >
                    Open {(() => { try { return new URL(e.siteUrl as string).hostname; } catch { return 'citywire.local'; } })()} »
                  </button>
                )}
              </div>
            ))
          ) : (
            <>
              <div className="space-y-1">
                <h3 className="font-bold text-sm font-serif">New Broadband DSL Rollout Expands to Motel Row</h3>
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
                <h3 className="font-bold text-sm font-serif">Local Weather: Persistent Canal Rain Continues</h3>
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
            </>
          )}
          {/* Governance note */}
          <div className="bg-gray-50 border border-gray-200 p-2 text-[10px] leading-relaxed text-gray-600 font-sans">
            <div className="font-bold uppercase text-[9px] tracking-widest">How this wire works</div>
            <p className="mt-1">
              Governed procedural: AI proposes within <span className="font-mono">GLOBAL_EVENTS_CATALOG</span> shape, Zod validates, worldLore grounds era, .local-only, deduplicated, then queued for future days. Templates guarantee offline play.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
