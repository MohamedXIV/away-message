import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { InternetRouter } from '../../internet/InternetRouter';
import { RouteMatchResult, ParsedUrl } from '../../internet/types';
import { soundManager } from '../../audio/SoundManager';

interface HistoryEntry {
  url: string;
  title: string;
}

interface VoyagerBrowserAppProps {
  initialUrl?: string;
}

export const VoyagerBrowserApp: React.FC<VoyagerBrowserAppProps> = ({ initialUrl = 'findit.local' }) => {
  const connectionType = useSimulationStore((s) => s.state.hardware.connectionType);
  const installedSoftware = useSimulationStore((s) => s.state.installedSoftware || []);

  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [inputUrl, setInputUrl] = useState<string>(initialUrl);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { url: initialUrl, title: 'FindIt Web Search' },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [statusText, setStatusText] = useState('Done');
  const [matchResult, setMatchResult] = useState<RouteMatchResult | null>(null);

  const router = useMemo(() => new InternetRouter(), []);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if SearchMate toolbar is installed
  const softwareList = Array.isArray(installedSoftware) ? installedSoftware : Object.values(installedSoftware || {});
  const isSearchMateInstalled = softwareList.some(
    (sw: any) => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
  );

  const loadPage = (targetUrl: string, addToHistory = true) => {
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    router.abortCurrentLoad();

    setIsLoading(true);
    setLoadProgress(10);
    setStatusText(`Connecting to ${cleanUrl}...`);

    const result = router.resolveRoute(cleanUrl);

    router.simulatePageLoad(
      cleanUrl,
      connectionType,
      (progress) => {
        setLoadProgress(progress);
        setStatusText(`Transferring data from ${result.host}... ${progress}%`);
      },
      () => {
        setIsLoading(false);
        setLoadProgress(100);
        setStatusText('Done');
        setMatchResult(result);
        const resolvedUrl = result.parsedUrl ? result.parsedUrl.rawUrl : cleanUrl;
        setCurrentUrl(resolvedUrl);
        setInputUrl(resolvedUrl);

        if (addToHistory) {
          const newEntry = { url: resolvedUrl, title: result.pageTitle };
          setHistory((prev) => [...prev.slice(0, historyIndex + 1), newEntry]);
          setHistoryIndex((prev) => prev + 1);
        }

        soundManager.play('im_recv');
      }
    );
  };

  useEffect(() => {
    loadPage('findit.local', false);
    return () => {
      router.abortCurrentLoad();
    };
  }, []);

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPage(inputUrl, true);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevEntry = history[historyIndex - 1];
      if (prevEntry) {
        setHistoryIndex(historyIndex - 1);
        loadPage(prevEntry.url, false);
      }
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      if (nextEntry) {
        setHistoryIndex(historyIndex + 1);
        loadPage(nextEntry.url, false);
      }
    }
  };

  const handleRefresh = () => {
    loadPage(currentUrl, false);
  };

  const handleHome = () => {
    loadPage('findit.local', true);
  };

  const defaultParsedUrl: ParsedUrl = {
    rawUrl: currentUrl,
    normalizedUrl: currentUrl,
    protocol: 'http:',
    host: 'findit.local',
    pathname: '/',
    pathSegments: [],
    searchParams: {},
    hash: '',
  };

  const ActivePageComponent = matchResult?.component;

  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden">
      {/* Top Menu Bar */}
      <div className="flex gap-3 px-2 py-0.5 bg-[#dfdfdf] border-b border-gray-400 text-xs text-gray-800">
        <span className="hover:underline cursor-pointer">File</span>
        <span className="hover:underline cursor-pointer">Edit</span>
        <span className="hover:underline cursor-pointer">View</span>
        <span className="hover:underline cursor-pointer">Favorites</span>
        <span className="hover:underline cursor-pointer">Tools</span>
        <span className="hover:underline cursor-pointer">Help</span>
      </div>

      {/* Main Navigation Toolbar */}
      <div className="bg-[#f0f0f0] border-b border-gray-400 p-1 flex items-center gap-1">
        <button
          onClick={handleBack}
          disabled={historyIndex <= 0}
          className="px-2 py-1 bg-white hover:bg-gray-100 disabled:opacity-40 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          ◀ Back
        </button>
        <button
          onClick={handleForward}
          disabled={historyIndex >= history.length - 1}
          className="px-2 py-1 bg-white hover:bg-gray-100 disabled:opacity-40 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          Forward ▶
        </button>
        <button
          onClick={handleRefresh}
          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🔄 Refresh
        </button>
        <button
          onClick={handleHome}
          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🏠 Home
        </button>

        {/* URL Address Input Bar */}
        <form onSubmit={handleNavigateSubmit} className="flex-1 flex items-center gap-1 ml-2">
          <span className="font-semibold text-gray-600">Address:</span>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 px-2 py-1 bg-white border border-gray-400 rounded text-xs outline-none shadow-inner"
            placeholder="http://findit.local"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded text-xs shadow cursor-pointer"
          >
            Go
          </button>
        </form>
      </div>

      {/* Bookmarks Bar */}
      <div className="bg-[#e4e4e4] border-b border-gray-300 px-2 py-0.5 flex gap-3 text-[11px] text-blue-900">
        <span
          onClick={() => loadPage('findit.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          ⭐ FindIt
        </span>
        <span
          onClick={() => loadPage('downloadhub.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          💾 DownloadHub
        </span>
        <span
          onClick={() => loadPage('techmart.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          💻 TechMart
        </span>
        <span
          onClick={() => loadPage('nightboard.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          🦉 NightBoard
        </span>
        <span
          onClick={() => loadPage('myplace.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          🌟 MyPlace
        </span>
        <span
          onClick={() => loadPage('citywire.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          📰 CityWire
        </span>
      </div>

      {/* SearchMate Adware Injected Toolbar */}
      {isSearchMateInstalled && (
        <div className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 border-b border-amber-400 px-2 py-1 flex items-center justify-between text-xs text-amber-950">
          <div className="flex items-center gap-2 flex-1">
            <span className="font-bold flex items-center gap-1 text-amber-900">
              <span>⭐</span> SearchMate:
            </span>
            <input
              type="text"
              placeholder="Search with SmartMate..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value;
                  loadPage(`searchmate.local?q=${encodeURIComponent(q)}`, true);
                }
              }}
              className="px-2 py-0.5 bg-white border border-amber-400 rounded text-xs outline-none w-64 shadow-inner"
            />
            <span className="text-[10px] text-amber-800 italic">Sponsored Smart Search</span>
          </div>

          <button
            onClick={() => loadPage('searchmate.local', true)}
            className="text-[11px] text-blue-700 hover:underline font-semibold"
          >
            Portal Home »
          </button>
        </div>
      )}

      {/* Loading Progress Indicator */}
      {isLoading && (
        <div className="w-full bg-gray-200 h-1">
          <div
            className="bg-blue-600 h-full transition-all duration-100"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 bg-white overflow-auto relative">
        {ActivePageComponent && matchResult ? (
          <ActivePageComponent
            url={matchResult.parsedUrl || defaultParsedUrl}
            navigate={(u: string) => loadPage(u, true)}
            params={matchResult.routeParams || {}}
            searchParams={matchResult.parsedUrl?.searchParams || {}}
            onNavigate={(u: string) => loadPage(u, true)}
            queryParams={matchResult.parsedUrl?.searchParams || {}}
            routeParams={matchResult.routeParams || {}}
          />
        ) : (
          <div className="p-6 text-center text-gray-500 italic">Initializing browser engine...</div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#dfdfdf] border-t border-gray-400 px-2 py-0.5 flex justify-between items-center text-[10px] text-gray-600">
        <span className="truncate max-w-sm">{statusText}</span>
        <div className="flex items-center gap-2 font-mono">
          <span>{connectionType.toUpperCase()}</span>
          <span>|</span>
          <span>Voyager 6.0</span>
        </div>
      </div>
    </div>
  );
};
