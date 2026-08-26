import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { searchInternet } from '../searchIndex';

export const SearchMateSite: React.FC<SiteRouteProps> = ({ navigate, onNavigate, queryParams = {}, searchParams = {} }) => {
  const currentDay = useSimulationStore((s) => s.state.time.day);
  const narrativeFlags = useSimulationStore((s) => s.state.narrative.flags);
  const installedSoftware = useSimulationStore((s) => s.state.installedSoftware || []);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const doNavigate = navigate || onNavigate || (() => {});
  const effectiveParams = { ...queryParams, ...searchParams };
  const initialQuery = effectiveParams['q'] || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));

  const isSearchMateInstalled = Array.isArray(installedSoftware) && installedSoftware.some(
    (sw) => sw.appId === 'searchmate' || sw.isAdware
  );

  const searchResults = searchInternet(searchQuery, currentDay, narrativeFlags);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setHasSearched(true);
  };

  const handleInstallToolbar = () => {
    dispatchAction({
      type: 'SOFTWARE_INSTALL',
      softwareId: 'searchmate',
    });
  };

  return (
    <div className="w-full min-h-full bg-gradient-to-b from-yellow-50 via-white to-amber-50 text-black font-sans p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto border-b-2 border-amber-400 pb-3 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl">⭐</span>
          <div>
            <h1 className="text-xl font-bold text-amber-900 font-serif leading-none">
              SearchMate™ Search Portal
            </h1>
            <span className="text-[11px] text-amber-700">"The Smart Web Companion for Orion OS"</span>
          </div>
        </div>

        <div>
          {!isSearchMateInstalled ? (
            <button
              onClick={handleInstallToolbar}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded text-xs shadow-md cursor-pointer animate-pulse"
            >
              ⭐ Free 1-Click Toolbar Install!
            </button>
          ) : (
            <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-1 rounded border border-green-300">
              ✓ SearchMate Toolbar Active
            </span>
          )}
        </div>
      </div>

      {/* Main Search Bar */}
      <div className="max-w-xl mx-auto text-center my-6">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the web with SearchMate SmartEngine..."
            className="flex-1 px-3 py-1.5 border-2 border-amber-400 rounded text-sm outline-none shadow-inner"
          />
          <button
            type="submit"
            className="px-5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded text-sm shadow cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Sponsored Links / Adware Highlights */}
        <div className="mt-4 p-3 bg-yellow-100/70 border border-yellow-300 rounded text-left">
          <span className="text-[10px] font-bold text-yellow-800 uppercase tracking-wide block mb-1">
            Sponsored Advertisements
          </span>
          <div className="space-y-1.5 text-xs">
            <div>
              <a
                href="#deal"
                onClick={(e) => {
                  e.preventDefault();
                  doNavigate('techmart.local');
                }}
                className="text-blue-700 hover:underline font-bold"
              >
                Hot Deals on RAM & Sound Cards - TechMart Local
              </a>
              <p className="text-gray-600 text-[11px]">Upgrade your 256MB PC to 1024MB today! Low courier prices.</p>
            </div>
            <div>
              <a
                href="#weather"
                onClick={(e) => {
                  e.preventDefault();
                  doNavigate('weatherbuddy.local');
                }}
                className="text-blue-700 hover:underline font-bold"
              >
                Free Animated Desktop Frog Weather Gadget
              </a>
              <p className="text-gray-600 text-[11px]">Real-time forecasts and storm radar on your desktop.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="max-w-2xl mx-auto space-y-3 mt-6">
          <div className="text-xs text-gray-500 border-b border-gray-200 pb-1">
            Found {searchResults.length} results for <strong>"{searchQuery}"</strong> (0.04s)
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs italic">
              No results found for "{searchQuery}". Try searching for "download", "tech", "jobs", "weather", or "motel".
            </div>
          ) : (
            searchResults.map((res: any) => (
              <div key={res.id} className="text-left bg-white p-2.5 rounded border border-amber-200 shadow-xs">
                <button
                  onClick={() => doNavigate(res.url)}
                  className="text-blue-800 hover:underline font-bold text-sm text-left block"
                >
                  {res.title}
                </button>
                <span className="text-[11px] text-green-700 font-mono block">{res.url}</span>
                <p className="text-xs text-gray-700 mt-1">{res.snippet}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
