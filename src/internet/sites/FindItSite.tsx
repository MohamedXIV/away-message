import React, { useMemo, useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { generateFindItCandidates, searchInternet } from '../searchIndex';

export const FindItSite: React.FC<SiteRouteProps> = (props) => {
  const currentDay = useSimulationStore((s) => s.state.time.day);
  const narrativeFlags = useSimulationStore((s) => s.state.narrative.flags);
  const doNavigate = props.navigate || props.onNavigate || (() => {});

  const queryParams = { ...props.searchParams, ...props.queryParams };
  const initialQuery = queryParams['q'] || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));

  const indexedResults = searchInternet(searchQuery, currentDay, narrativeFlags);
  const generatedResults = useMemo(() => generateFindItCandidates(searchQuery, currentDay), [searchQuery, currentDay]);
  const results = useMemo(() => [...indexedResults, ...generatedResults].slice(0, 8), [indexedResults, generatedResults]);

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
              results.map((item) => (
              <div key={item.id} className={`space-y-0.5 text-left border-b border-gray-100 pb-3 ${item.isGenerated ? 'bg-[#fffdf0] px-2 py-2' : ''}`}>
                <button
                  onClick={() => doNavigate(item.url)}
                  className="text-blue-800 hover:underline font-bold text-sm text-left block"
                >
                  {item.title}
                </button>
                <span className="text-[11px] text-green-700 font-mono block">{item.url}</span>
                {item.isGenerated && <span className="inline-block bg-yellow-100 px-1 text-[10px] text-yellow-800">AI-generated discovery</span>}
                <p className="text-xs text-gray-700">{item.snippet}</p>
                {item.generatedSiteHint && <p className="text-[10px] italic text-gray-500">{item.generatedSiteHint}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8 text-[11px] text-gray-400 text-center">
        © 2006 FindIt Corporation. Indexing the Orion Web Ecosystem.
      </div>
    </div>
  );
};
