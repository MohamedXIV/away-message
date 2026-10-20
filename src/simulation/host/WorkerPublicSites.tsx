import { useEffect, useState } from 'react';
import type {
  SimulationJobBoardRead, SimulationWebsiteRead,
} from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

type Page =
  | { kind: 'news'; read: SimulationWebsiteRead }
  | { kind: 'jobs'; read: SimulationJobBoardRead };

/**
 * Small Worker-only reader for two already-authored public sites.
 * Their facts are projected by the canonical owners; this is a staged
 * content consumer, NOT a replacement for the full legacy Voyager browser.
 */
export function WorkerPublicSites({
  session, revision, initialTab = 'news',
}: {
  session: WorkerGameSession;
  revision: number;
  initialTab?: 'news' | 'jobs';
}) {
  const [tab, setTab] = useState<'news' | 'jobs'>(initialTab);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Preserve the previous bounded page through ordinary clock revisions.
    // Only a tab switch replaces the displayed page; otherwise rapid ticks
    // would flash a loading skeleton between every website read.
    setError(null);
    const load = async () => {
      if (tab === 'news') {
        const read = await session.read({ kind: 'website' });
        if (active && read.revision === revision) setPage({ kind: 'news', read });
      } else {
        const read = await session.read({ kind: 'jobBoard' });
        if (active && read.revision === revision) setPage({ kind: 'jobs', read });
      }
    };
    void load().catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, revision, tab]);

  return (
    <section data-testid="worker-public-sites"
      className="flex h-full flex-col bg-[#fcfbf9] text-slate-900">
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-400 bg-[#e8e7e1] p-2 text-xs">
        <span className="font-semibold">Oakhaven's public network</span>
        <button type="button" aria-pressed={tab === 'news'} onClick={() => setTab('news')}
          className="rounded border border-gray-500 bg-white px-2 py-1">CityWire</button>
        <button type="button" aria-pressed={tab === 'jobs'} onClick={() => setTab('jobs')}
          className="rounded border border-gray-500 bg-white px-2 py-1">Jobs.local</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-xs">
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {(!page || page.kind !== tab) && !error && <p role="status">Reading public records from the Worker…</p>}
        {page?.kind === 'news' && (
          <>
            <h2 className="border-b-2 border-slate-900 pb-2 text-xl font-bold">The City Wire</h2>
            <p className="my-2 text-gray-600">
              Day {page.read.time.day} · {page.read.world.triggeredEvents.length} published world events
            </p>
            {page.read.world.triggeredEvents.map(event => (
              <article key={event.id} className="border-b border-gray-300 py-2">
                <h3 className="font-semibold">{event.title}</h3>
                <p className="text-gray-600">Day {event.triggerDay}</p>
              </article>
            ))}
            {page.read.world.triggeredEvents.length === 0 &&
              <p>No public city stories have been recorded yet.</p>}
          </>
        )}
        {page?.kind === 'jobs' && (
          <>
            <h2 className="border-b-2 border-slate-900 pb-2 text-xl font-bold">Oakhaven Job Board</h2>
            <p className="my-2 text-gray-600">Canonical available gigs, up to 32 listings</p>
            {page.read.jobs.map(job => (
              <article key={job.gigId} className="border-b border-gray-300 py-2">
                <h3 className="font-semibold">{job.title}</h3>
                <p>{job.blurb}</p>
                <p className="mt-1 text-gray-600">
                  Contact: {job.contactName} · Pay: ${job.pay} · {job.durationMin} min
                  {job.pending ? ' · Awaiting response' : ''}
                </p>
              </article>
            ))}
            {page.read.jobs.length === 0 && <p>There are no open public jobs today.</p>}
          </>
        )}
      </div>
      <footer className="shrink-0 border-t border-gray-300 bg-[#e8e7e1] px-2 py-1 text-[10px] text-gray-700">
        Live public simulation facts. Applications and external network access are not enabled here.
      </footer>
    </section>
  );
}
