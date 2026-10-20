import { useEffect, useState } from 'react';
import { SafeSweepView } from '../../apps/safesweep/SafeSweepView';
import type { SimulationAppRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

/** Canonical installed-software inventory + typed owner uninstall; no fake threats. */
export function WorkerSafeSweepPanel({ session, revision }: {
  session: WorkerGameSession; revision: number;
}) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void session.read({ kind: 'apps' }).then(result => {
      if (live && result.revision === revision) {
        setApps(result);
        setError(null);
      }
    }).catch(cause => {
      if (live) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { live = false; };
  }, [session, revision]);
  return <section data-testid="worker-safesweep" className="h-full">
    {error && <p role="alert" className="p-2 text-xs text-red-900">{error}</p>}
    {apps?.revision === revision ? (
      apps.installedSoftware.some(app => app.appId === 'app.safesweep') ? (
        <SafeSweepView installedSoftware={apps.installedSoftware}
          onUninstall={installedId => session.dispatch({
            type: 'SOFTWARE_UNINSTALL', installedId,
          })} />
      ) : <p className="p-3 text-xs">SafeSweep is not installed on this computer.</p>
    ) : !error && <p role="status" className="p-3 text-xs">Reading installed programs…</p>}
  </section>;
}
