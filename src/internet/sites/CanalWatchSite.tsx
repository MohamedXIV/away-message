import React, { useEffect, useState } from 'react';
import type { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  buildGeneratedSiteNarrative,
  createFakeNetRuntime,
  type SurfaceNarrative,
  type SurfaceStatement,
} from '../../narrative/fakeNet';
import { SurfaceProvenanceBadge } from '../components/SurfaceProvenanceBadge';

interface SectionGroup {
  heading: string;
  statements: SurfaceStatement[];
}

export const CanalWatchSite: React.FC<SiteRouteProps> = ({ navigate }) => {
  const engine = useSimulationStore((s) => s.engine);
  const [narrative, setNarrative] = useState<SurfaceNarrative | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNarrative(null);
    setError(null);
    if (!engine) return;
    void buildGeneratedSiteNarrative(createFakeNetRuntime(engine))
      .then((built) => { if (!cancelled) setNarrative(built); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Page unavailable.');
      });
    return () => { cancelled = true; };
  }, [engine]);

  const groups: SectionGroup[] = [];
  if (narrative) {
    for (const statement of narrative.statements) {
      if (statement.role !== 'section') continue;
      const heading = statement.heading ?? 'notes';
      const group = groups.find((candidate) => candidate.heading === heading);
      if (group) group.statements.push(statement);
      else groups.push({ heading, statements: [statement] });
    }
  }
  const guestbook = narrative?.statements.filter((statement) => statement.role === 'guestbook') ?? [];

  return (
    <div className="min-h-full bg-[#f3eedf] font-serif text-[#2a241c]">
      <header className="border-b-4 border-[#7a5c3a] bg-[#d9c7a3] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6a563d]">a north bank personal page</div>
            <h1 className="text-2xl font-bold tracking-tight">{narrative?.title ?? 'CANAL WATCH'}</h1>
            <p className="mt-1 text-xs italic text-[#5e4b35]">
              field notes, pump schedules and things overheard near the water
            </p>
          </div>
          <div className="border border-[#a58c66] bg-[#efe4cd] px-2 py-1 text-right font-mono text-[9px] text-[#5e4b35]">
            <div>updated whenever the hum changes</div>
            <div>best viewed at 800×600</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-4 border border-[#b49a72] bg-[#fbf6e9] p-2 font-mono text-[10px] leading-4 text-[#5e4b35]">
          <span className="font-bold">a note about sources:</span>{' '}
          <span className="border border-emerald-700 px-1 text-emerald-800">reported</span> items appear in town records.
          <span className="border border-amber-700 px-1 text-amber-800"> rumors / claims</span> may be secondhand;
          <span className="border border-sky-700 px-1 text-sky-800"> opinions</span> are personal;
          <span className="border border-rose-700 px-1 text-rose-800"> disputed</span> accounts have conflicting stories.
          Read carefully and compare sources.
        </div>

        {error && <div className="border border-rose-700 bg-rose-100 p-2 font-mono text-xs text-rose-900">{error}</div>}
        {!error && !narrative && <div className="font-mono text-xs text-[#6a563d]">loading the page…</div>}

        {narrative && (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.heading} className="border border-[#b49a72] bg-[#fbf6e9] p-3 shadow-[2px_2px_0_rgba(90,70,45,0.25)]">
                <h2 className="border-b border-dashed border-[#c9b48e] pb-1 text-sm font-bold uppercase tracking-wide text-[#5b4027]">
                  {group.heading.replace(/[_-]+/g, ' ')}
                </h2>
                <div className="mt-2 space-y-2">
                  {group.statements.map((statement) => (
                    <article key={statement.id}>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-[#7a6549]">
                        <SurfaceProvenanceBadge provenance={statement.provenance} />
                        <span>@{statement.author.handle}</span>
                      </div>
                      <p className="mt-0.5 text-sm leading-6">{statement.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {guestbook.length > 0 && (
              <section className="border border-[#b49a72] bg-[#efe4cd] p-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#5b4027]">guestbook</h2>
                <div className="mt-2 space-y-2">
                  {guestbook.map((statement) => (
                    <article key={statement.id} className="border-b border-dashed border-[#c9b48e] pb-2 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-[#7a6549]">
                        <SurfaceProvenanceBadge provenance={statement.provenance} />
                        <span>@{statement.author.handle}</span>
                      </div>
                      <p className="mt-0.5 text-sm italic leading-6">{statement.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {narrative.clueIds.includes('intake_map') && (
              <div className="border-2 border-dashed border-[#8a6a3c] bg-[#fff9e8] p-3 font-mono text-[11px]">
                <div className="font-bold text-[#6a4a22]">clue: intake map</div>
                <p className="mt-1">
                  The hand-drawn map points back toward the NightBoard thread. The page owner has clearly been reading
                  the same posts.
                </p>
                <button
                  onClick={() => navigate('http://nightboard.local/')}
                  className="mt-2 border border-[#7a5c3a] bg-[#d9c7a3] px-2 py-1 text-[10px] hover:bg-[#cbb68e]"
                >
                  ← back to NightBoard
                </button>
              </div>
            )}
          </div>
        )}

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#c9b48e] pt-3 font-mono text-[10px] text-[#6a563d]">
          <span>canalwatch.local · a fictional page on the Orion web</span>
          <div className="flex gap-3">
            <button className="underline" onClick={() => navigate('http://nightboard.local/')}>nightboard.local</button>
            <button className="underline" onClick={() => navigate('http://findit.local/')}>findit.local</button>
          </div>
        </footer>
      </main>
    </div>
  );
};
