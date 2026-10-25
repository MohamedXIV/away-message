import { useEffect, useState } from 'react';
import { WeatherBuddyView } from '../../apps/weatherbuddy/WeatherBuddyView';
import type { SimulationWeatherBuddyRead, SimulationAppRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

/** Weather and SearchMate effects come from two finite reads of one Worker revision.
 * A failed, stale or uninstalled read cannot render a fictional forecast.
 */
export function WorkerWeatherBuddyPanel({ session, revision }: {
  session: WorkerGameSession;
  revision: number;
}) {
  const [weather, setWeather] = useState<SimulationWeatherBuddyRead | null>(null);
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([session.read({ kind: 'weatherBuddy' }), session.read({ kind: 'apps' })])
      .then(([nextWeather, nextApps]) => {
        if (!active || nextWeather.revision !== revision || nextApps.revision !== revision) return;
        setWeather(nextWeather);
        setApps(nextApps);
        setError(null);
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { active = false; };
  }, [session, revision]);
  return <section className="h-full" data-testid="worker-weatherbuddy">
    {error && <p role="alert" className="p-2 text-xs text-red-800">{error}</p>}
    {weather?.revision === revision && apps?.revision === revision ? (
      apps.installedSoftware.some(app => app.appId === 'app.weatherbuddy') ? (
        <WeatherBuddyView currentCondition={weather.current}
          forecast={weather.forecast} installedSoftware={apps.installedSoftware} />
      ) : (
        <p className="p-3 text-xs">WeatherBuddy is not installed on this computer.</p>
      )
    ) : !error && <p role="status" className="p-3 text-xs">Reading live five-day weather…</p>}
  </section>;
}
