import React from 'react';

/** Exact original Voyager OS toolbar and chrome; no simulation or site router imports. */
export interface VoyagerBrowserChromeProps {
  currentUrl: string;
  inputUrl: string;
  onInputUrlChange: (url: string) => void;
  historyIndex: number;
  historyLength: number;
  isFileMenuOpen: boolean;
  setIsFileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveNotice: string | null;
  isLoading: boolean;
  loadProgress: number;
  statusText: string;
  isSearchMateInstalled: boolean;
  connectionType: string | null | undefined;
  content: React.ReactNode;
  onNavigate: (url: string, addToHistory?: boolean) => void;
  onNavigateSubmit: (event: React.FormEvent) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onHome: () => void;
  onSavePage: () => void;
}
export const VoyagerBrowserChrome: React.FC<VoyagerBrowserChromeProps> = ({
  currentUrl, inputUrl, onInputUrlChange, historyIndex, historyLength,
  isFileMenuOpen, setIsFileMenuOpen, saveNotice, isLoading, loadProgress,
  statusText, isSearchMateInstalled, connectionType, content, onNavigate,
  onNavigateSubmit, onBack, onForward, onRefresh, onHome, onSavePage,
}) => {
  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden" onClick={() => setIsFileMenuOpen(false)}>
      {/* Top Menu Bar — now live */}
      <div className="flex gap-3 px-2 py-0.5 bg-[#dfdfdf] border-b border-gray-400 text-xs text-gray-800 relative">
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setIsFileMenuOpen((v) => !v); }} className={`px-1.5 py-0.5 hover:bg-[#000080] hover:text-white ${isFileMenuOpen ? 'bg-[#000080] text-white' : ''}`}>File</button>
          {isFileMenuOpen && (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-[180px] border border-gray-500 bg-[#c0c0c0] p-0.5 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { onHome(); setIsFileMenuOpen(false); }} className="block w-full px-3 py-1 text-left hover:bg-[#000080] hover:text-white">New Window</button>
              <button onClick={() => { setIsFileMenuOpen(false); }} className="block w-full px-3 py-1 text-left hover:bg-[#000080] hover:text-white">Open...</button>
              <div className="my-0.5 h-px bg-gray-400" />
              <button onClick={() => onSavePage()} className="block w-full px-3 py-1 text-left hover:bg-[#000080] hover:text-white font-bold">💾 Save Page</button>
              <button onClick={() => onSavePage()} className="block w-full px-3 py-1 text-left hover:bg-[#000080] hover:text-white">Save As...</button>
              <div className="my-0.5 h-px bg-gray-400" />
              <button type="button" disabled title="No printer is installed"
                className="block w-full px-3 py-1 text-left opacity-50 cursor-not-allowed">Print... (no printer)</button>
              <button onClick={() => setIsFileMenuOpen(false)} className="block w-full px-3 py-1 text-left hover:bg-[#000080] hover:text-white">Close</button>
            </div>
          )}
        </div>
        <span className="hover:underline cursor-pointer opacity-60">Edit</span>
        <span className="hover:underline cursor-pointer opacity-60">View</span>
        <span className="hover:underline cursor-pointer">Favorites</span>
        <span className="hover:underline cursor-pointer opacity-60">Tools</span>
        <span className="hover:underline cursor-pointer opacity-60">Help</span>
        {saveNotice && <span className="ml-auto rounded bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800 border border-green-300">✓ {saveNotice}</span>}
      </div>

      {/* Main Navigation Toolbar */}
      <div className="bg-[#f0f0f0] border-b border-gray-400 p-1 flex items-center gap-1">
        <button
          onClick={onBack}
          disabled={historyIndex <= 0}
          className="px-2 py-1 bg-white hover:bg-gray-100 disabled:opacity-40 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          ◀ Back
        </button>
        <button
          onClick={onForward}
          disabled={historyIndex >= historyLength - 1}
          className="px-2 py-1 bg-white hover:bg-gray-100 disabled:opacity-40 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          Forward ▶
        </button>
        <button
          onClick={onRefresh}
          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🔄 Refresh
        </button>
        <button
          onClick={onHome}
          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🏠 Home
        </button>

        {/* URL Address Input Bar */}
        <form onSubmit={onNavigateSubmit} title={currentUrl} className="flex-1 flex items-center gap-1 ml-2">
          <span className="font-semibold text-gray-600">Address:</span>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => onInputUrlChange(e.target.value)}
            className="flex-1 px-2 py-1 bg-white border border-gray-400 rounded text-xs outline-none shadow-inner"
            placeholder="http://findit.local"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded text-xs shadow cursor-pointer"
          >
            Go
          </button>
          <button
            type="button"
            onClick={onSavePage}
            className="ml-1 rounded border border-gray-400 bg-white px-2 py-1 text-xs font-bold hover:bg-blue-50"
            title="Save current page to C:/Documents"
          >
            💾 Save Page
          </button>
        </form>
      </div>

      {/* Bookmarks Bar */}
      <div className="bg-[#e4e4e4] border-b border-gray-300 px-2 py-0.5 flex gap-3 text-[11px] text-blue-900">
        <span
          onClick={() => onNavigate('findit.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          ⭐ FindIt
        </span>
        <span
          onClick={() => onNavigate('downloadhub.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          💾 DownloadHub
        </span>
        <span
          onClick={() => onNavigate('techmart.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          💻 TechMart
        </span>
        <span
          onClick={() => onNavigate('nightboard.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          🦉 NightBoard
        </span>
        <span
          onClick={() => onNavigate('myplace.local', true)}
          className="hover:underline cursor-pointer flex items-center gap-1"
        >
          🌟 MyPlace
        </span>
        <span
          onClick={() => onNavigate('citywire.local', true)}
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
                  onNavigate(`searchmate.local?q=${encodeURIComponent(q)}`, true);
                }
              }}
              className="px-2 py-0.5 bg-white border border-amber-400 rounded text-xs outline-none w-64 shadow-inner"
            />
            <span className="text-[10px] text-amber-800 italic">Sponsored Smart Search</span>
          </div>

          <button
            onClick={() => onNavigate('searchmate.local', true)}
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
        {content}
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#dfdfdf] border-t border-gray-400 px-2 py-0.5 flex justify-between items-center text-[10px] text-gray-600">
        <span className="truncate max-w-sm">{statusText}</span>
        <div className="flex items-center gap-2 font-mono">
          <span>{connectionType ? connectionType.toUpperCase() : 'OFFLINE'}</span>
          <span>|</span>
          <span>Voyager 6.0</span>
        </div>
      </div>
    </div>
  );

};
