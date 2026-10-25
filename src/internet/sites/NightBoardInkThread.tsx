import React, { useEffect, useState } from 'react';
import type { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import type { SurfacePromotionResult } from '../../engine/types';
import {
  buildNightBoardNarrative,
  createFakeNetRuntime,
  type SurfaceAuthor,
  type SurfaceNarrative,
} from '../../narrative/fakeNet';
import { SurfaceProvenanceBadge } from '../components/SurfaceProvenanceBadge';

export const NightBoardInkThread: React.FC<{
  navigate: SiteRouteProps['navigate'];
  onClose?: () => void;
}> = ({ navigate, onClose }) => {
  const engine = useSimulationStore((s) => s.engine);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const [narrative, setNarrative] = useState<SurfaceNarrative | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNarrative(null);
    setError(null);
    setNotice(null);
    if (!engine) return;
    void buildNightBoardNarrative(createFakeNetRuntime(engine))
      .then((built) => { if (!cancelled) setNarrative(built); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Thread unavailable.');
      });
    return () => { cancelled = true; };
  }, [engine]);

  const promote = (author: SurfaceAuthor) => {
    const result = dispatchAction({
      type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
      identity: {
        source: 'nightboard',
        username: author.handle,
        handle: author.handle,
        displayName: author.displayName,
      },
      silent: true,
    });
    if (!result.success) {
      setNotice(result.error ?? 'Could not add this handle to Pulse.');
      return;
    }
    const data = result.data as SurfacePromotionResult | undefined;
    setPromoted((previous) => [...previous, author.handle]);
    setNotice(data?.created
      ? `@${author.handle} added to Pulse as a remote contact.`
      : data?.alreadyKnown
        ? `@${author.handle} is already in your Pulse contacts.`
        : `@${author.handle} could not be added.`);
  };

  return (
    <div className="w-full border border-emerald-800 bg-[#0b1220] p-3 font-mono text-xs text-gray-200">
      <div className="flex items-start justify-between gap-3 border-b border-gray-700 pb-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-emerald-500">NightBoard discussion</div>
          <h2 className="text-sm font-bold text-emerald-300">{narrative?.title ?? 'Canal pumps & the low hum'}</h2>
          <div className="text-[10px] text-gray-500">
            People share rumors, opinions and local news. Read with care.
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-emerald-300 hover:bg-gray-700"
          >
            close thread
          </button>
        )}
      </div>

      {error && <div className="mt-3 border border-rose-800 bg-rose-950 p-2 text-rose-300">{error}</div>}
      {!error && !narrative && <div className="mt-3 text-gray-500">Loading discussion…</div>}

      {narrative && (
        <div className="mt-3 space-y-2">
          {narrative.statements.map((statement) => (
            <div key={statement.id} className="border-l-2 border-gray-700 pl-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                <span className="font-bold text-emerald-400">{statement.author.displayName}</span>
                <span>@{statement.author.handle}</span>
                <SurfaceProvenanceBadge provenance={statement.provenance} />
                {statement.author.kind === 'surface_only' && !promoted.includes(statement.author.handle) && (
                  <button
                    onClick={() => promote(statement.author)}
                    className="border border-gray-600 px-1 text-[9px] text-gray-300 hover:bg-gray-800"
                  >
                    add to Pulse
                  </button>
                )}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-gray-200">{statement.text}</div>
            </div>
          ))}

          {notice && <div className="border border-emerald-800 bg-emerald-950 px-2 py-1 text-emerald-300">{notice}</div>}

          {narrative.clueIds.includes('intake_map') && (
            <button
              onClick={() => navigate('http://canalwatch.local/')}
              className="mt-2 border border-amber-700 bg-amber-950 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-900"
            >
              Follow the hand-drawn map → canalwatch.local
            </button>
          )}
        </div>
      )}
    </div>
  );
};
