import React, { useMemo, useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { generateFindItCandidates, searchInternet } from '../searchIndex';
import { loadPulseState } from '../../apps/pulse/persistence';

export const FindItSite: React.FC<SiteRouteProps> = (props) => {
  const currentDay = useSimulationStore((s) => s.state.time.day);
  const narrativeFlags = useSimulationStore((s) => s.state.narrative.flags);
  const world = useSimulationStore((s) => s.state.world);
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  const queryParams = { ...props.searchParams, ...props.queryParams };
  const initialQuery = queryParams['q'] || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));

  const indexedResults = searchInternet(searchQuery, currentDay, narrativeFlags, world);
  const generatedResults = useMemo(() => generateFindItCandidates(searchQuery, currentDay), [searchQuery, currentDay]);

  const pulseState = useMemo(() => {
    try { return loadPulseState(); } catch { return null; }
  }, [searchQuery, hasSearched, currentDay, initialQuery]);

  const pulseResults = useMemo(() => {
    const links = pulseState?.sharedLinks || [];
    if (links.length === 0) return [];
    const query = searchQuery.toLowerCase().trim();
    const filtered = links.filter((link) => {
      if (!query) return true;
      const haystack = `${link.host} ${link.title} ${link.snippet} ${link.sharedByName}`.toLowerCase();
      if (haystack.includes(query)) return true;
      const tokens = query.split(/\s+/).filter((t) => t.length > 2);
      return tokens.some((token) => haystack.includes(token));
    });
    // Most recent first
    const sorted = [...filtered].sort((a, b) => b.minute - a.minute);
    return sorted.slice(0, 5).map((link) => ({
      id: link.id,
      title: link.title,
      url: link.url,
      snippet: `${link.snippet} — shared by ${link.sharedByName} on Day ${Math.floor(link.minute / 1440) + 1}`,
      category: 'discovered',
      keywords: [link.host],
      availableFromDay: 1,
      datePublished: `Day ${Math.floor(link.minute / 1440) + 1}`,
      isPulseDiscovered: true as const,
      sharedBy: link.sharedByName,
      minute: link.minute,
    }));
  }, [pulseState, searchQuery]);

  const discoveredHosts = pulseState?.discoveredHosts || [];

  const results = useMemo(() => {
    // Prioritize Pulse-discovered links at the top
    const combined = [...pulseResults, ...indexedResults, ...generatedResults];
    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped: typeof combined = [];
    for (const item of combined) {
      const key = (item.url || '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped.slice(0, 8);
  }, [pulseResults, indexedResults, generatedResults]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;
    setHasSearched(true);
    doNavigate(`http://findit.local/?q=${encodeURIComponent(cleanQuery)}`);
  };

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-6 flex flex-col items-center">
      {/* Logo & Header */}
      <div className="text-center my-4 space-y-1">
        <h1 className="text-3xl font-serif font-bold tracking-tight">
          <span className="text-blue-600">F</span>
          <span className="text-red-600">i</span>
          <span className="text-yellow-500">n</span>
          <span className="text-blue-600">d</span>
          <span className="text-green-600">I</span>
          <span className="text-red-600">t</span>
          <span className="text-xs text-gray-500 font-sans ml-1">Web Search</span>
        </h1>
        <p className="text-gray-500 text-[11px]">The Premier Directory & Crawler for Orion Network</p>
      </div>

      {/* Search Input Box */}
      <div className="max-w-xl w-full">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the web or type a URL..."
            className="flex-1 px-3 py-1.5 border border-gray-400 rounded text-sm outline-none shadow-inner"
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow cursor-pointer"
          >
            FindIt Search
          </button>
        </form>

        {/* Directory Categories */}
        <div className="flex justify-center gap-3 text-blue-700 text-[11px] mt-3">
          <span className="hover:underline cursor-pointer" onClick={() => { setSearchQuery('hardware'); setHasSearched(true); }}>Hardware</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer" onClick={() => { setSearchQuery('software'); setHasSearched(true); }}>Software & Downloads</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer" onClick={() => { setSearchQuery('community'); setHasSearched(true); }}>Community & Boards</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer" onClick={() => { setSearchQuery('motel'); setHasSearched(true); }}>Motel & District</span>
        </div>
      </div>

      {/* Discovered via Pulse — visible even before search */}
      {!hasSearched && pulseResults.length > 0 && (
        <div className="max-w-2xl w-full mt-6 border border-[#8ab4e0] bg-[#e8f1ff] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#1c4167]">
            <span>🔗</span>
            <span>Discovered via Pulse</span>
            <span className="font-normal text-gray-500">— links friends shared with you</span>
          </div>
          <div className="space-y-2">
            {pulseResults.slice(0, 3).map((item: any) => (
              <div key={item.id} className="border-b border-[#c8d9ed] pb-2 last:border-0">
                <button onClick={() => doNavigate(item.url)} className="text-left text-sm font-bold text-blue-800 hover:underline">
                  {item.title}
                </button>
                <span className="block font-mono text-[11px] text-green-700">{item.url}</span>
                <p className="text-xs text-gray-700">{item.snippet}</p>
                <span className="inline-block bg-[#dceafa] px-1 text-[10px] font-bold text-[#1c4167]">via Pulse • {item.sharedBy}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-500">These pages were unlocked because someone sent you the link in Pulse. They may not appear in normal searches.</div>
        </div>
      )}

      {/* Discovered hosts hint */}
      {!hasSearched && discoveredHosts.length > 0 && pulseResults.length === 0 && (
        <div className="max-w-xl w-full mt-4 border border-dashed border-gray-300 bg-[#f9f9f9] px-3 py-2 text-center text-[11px] text-gray-500">
          {discoveredHosts.length} host{discoveredHosts.length !== 1 ? 's' : ''} discovered via Pulse — try searching for their names.
        </div>
      )}

      {/* Search Results Display */}
      {hasSearched && (
        <div className="max-w-2xl w-full mt-6 space-y-4">
          <div className="text-gray-500 text-xs border-b border-gray-200 pb-1 flex justify-between">
            <span>Results 1 - {results.length} of {results.length} for <strong>"{searchQuery}"</strong></span>
            <span>(0.02 seconds)</span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500 italic">
              Your search - <strong>{searchQuery}</strong> - did not match any documents in the FindIt index.
            </div>
          ) : (
              results.map((item: any) => (
              <div key={item.id} className={`space-y-0.5 text-left border-b border-gray-100 pb-3 ${item.isGenerated ? 'bg-[#fffdf0] px-2 py-2' : ''} ${item.isPulseDiscovered ? 'bg-[#e8f1ff] px-2 py-2 border border-[#8ab4e0]' : ''}`}>
                <button
                  onClick={() => doNavigate(item.url)}
                  className="text-blue-800 hover:underline font-bold text-sm text-left block"
                >
                  {item.title}
                </button>
                <span className="text-[11px] text-green-700 font-mono block">{item.url}</span>
                {item.isPulseDiscovered && <span className="inline-block bg-[#dceafa] px-1 text-[10px] font-bold text-[#1c4167]">Discovered via Pulse • shared by {item.sharedBy}</span>}
                {item.isGenerated && !item.isPulseDiscovered && <span className="inline-block bg-yellow-100 px-1 text-[10px] text-yellow-800">AI-generated discovery</span>}
                <p className="text-xs text-gray-700">{item.snippet}</p>
                {item.generatedSiteHint && <p className="text-[10px] italic text-gray-500">{item.generatedSiteHint}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8 text-[11px] text-gray-400 text-center">
        © 2006 FindIt Corporation. Indexing the Orion Web Ecosystem. {discoveredHosts.length > 0 && `• ${discoveredHosts.length} Pulse-discovered host${discoveredHosts.length !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
};
