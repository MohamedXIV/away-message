import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWindowStore, WindowState } from '../store/useWindowStore';
import { soundManager } from '../audio/SoundManager';
import { getOsPresentationProfile } from './host/OsPresentation';
import { StartMenu } from './StartMenu';
import { SystemTray } from './SystemTray';
import { Globe, MessageSquare, LayoutGrid, X, Minus, Square, Home } from 'lucide-react';

interface TaskbarProps {
  onOpenDialUp: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({ onOpenDialUp }) => {
  const osVersion = useSimulationStore((s) => s.state.os.currentOsId);
  const osPresentation = osVersion ? getOsPresentationProfile(osVersion) : null;
  const taskbarPresentation = osPresentation?.shell.taskbarId ?? 'classic';
  const isCanalTaskbar = taskbarPresentation === 'canal';
  const switchView = useSimulationStore((s) => s.switchView);
  const windows = useWindowStore((s) => s.windows);
  const windowOrder = useWindowStore((s) => s.windowOrder);
  const openWindows: WindowState[] = useMemo(
    () => windowOrder.map((id) => windows[id]).filter((w): w is WindowState => !!w && w.isOpen),
    [windows, windowOrder]
  );
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const openWindow = useWindowStore((s) => s.openWindow);
  const minimizeAll = useWindowStore((s) => s.minimizeAll);
  const isPulseInstalled = useSimulationStore((s) => s.state.installedSoftware.some((sw: any) => String(sw.appId).includes('pulse')));

  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ windowId: string; x: number; y: number } | null>(null);

  const startButtonRef = useRef<HTMLButtonElement>(null);

  // Toggle Start Menu
  const handleStartToggle = () => {
    soundManager.play('click');
    setIsStartMenuOpen((prev) => !prev);
  };

  // Close Start Menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (startButtonRef.current && !startButtonRef.current.contains(e.target as Node)) {
        const startMenuEl = document.getElementById('orion-start-menu');
        if (startMenuEl && !startMenuEl.contains(e.target as Node)) {
          setIsStartMenuOpen(false);
        }
      }
      setTabContextMenu(null);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <>
      {/* Start Menu Pop-up */}
      {isStartMenuOpen && (
        <StartMenu
          isOpen={isStartMenuOpen}
          onClose={() => setIsStartMenuOpen(false)}
          onOpenDialUp={onOpenDialUp}
        />
      )}

      {/* Taskbar Bar */}
      <div
        data-os-taskbar={taskbarPresentation}
        style={{ height: `${osPresentation?.shell.taskbarHeightPx ?? 28}px` }}
        className={`fixed bottom-0 left-0 right-0 w-full z-40 flex items-center px-1 select-none ${
          isCanalTaskbar
            ? 'bg-gradient-to-b from-[#1f48ab] via-[#245edb] to-[#122868] border-t border-[#3c7bf0]'
            : 'bg-[#c0c0c0] border-t border-white shadow-[inset_0_1px_0_#dfdfdf]'
        }`}
      >
        {/* 1. Start Button */}
        <button
          ref={startButtonRef}
          onClick={handleStartToggle}
          className={`flex items-center gap-1.5 px-2 py-0.5 font-bold cursor-pointer transition-none ${
            isCanalTaskbar
              ? `h-7 rounded-r-xl rounded-l-md px-3 text-white italic text-[13px] bg-gradient-to-b from-[#388e3c] via-[#2e7d32] to-[#1b5e20] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_3px_rgba(0,0,0,0.3)] hover:brightness-110 ${
                  isStartMenuOpen ? 'brightness-90 shadow-inner' : ''
                }`
              : `h-5.5 text-black text-[11px] orion-button ${
                  isStartMenuOpen ? 'is-active' : ''
                }`
          }`}
        >
          {/* Orion Flag Icon */}
          <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
            <div className="bg-red-500 rounded-[0.5px]" />
            <div className="bg-green-500 rounded-[0.5px]" />
            <div className="bg-blue-500 rounded-[0.5px]" />
            <div className="bg-yellow-400 rounded-[0.5px]" />
          </div>
          <span>{isCanalTaskbar ? 'start' : 'Start'}</span>
        </button>

        {/* 2. Quick Launch Separator & Icons */}
        <div className={`mx-1.5 h-4 w-[2px] ${isCanalTaskbar ? 'bg-[#193c94] border-r border-[#3c7bf0]' : 'border-l border-[#808080] border-r border-white'}`} />
        <div className="flex items-center gap-0.5 mr-1.5">
          <button
            onClick={() => minimizeAll()}
            title="Show Desktop"
            className="p-1 hover:bg-white/20 rounded cursor-pointer text-gray-700"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-blue-900 drop-shadow-sm" />
          </button>
          <button
            onClick={() => openWindow('browser')}
            title="Voyager Browser"
            className="p-1 hover:bg-white/20 rounded cursor-pointer text-gray-700"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-600 drop-shadow-sm" />
          </button>
          {isPulseInstalled && (
            <button
              onClick={() => openWindow('pulse')}
              title="Pulse Messenger"
              className="p-1 hover:bg-white/20 rounded cursor-pointer text-gray-700"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-500 drop-shadow-sm" />
            </button>
          )}
          <button
            onClick={() => {
              soundManager.play('click');
              switchView('room');
            }}
            title="Step Away to Room"
            className="p-1 hover:bg-white/20 rounded cursor-pointer text-gray-700"
          >
            <Home className="w-3.5 h-3.5 text-emerald-600 drop-shadow-sm" />
          </button>
        </div>
        <div className={`mr-1.5 h-4 w-[2px] ${isCanalTaskbar ? 'bg-[#193c94] border-r border-[#3c7bf0]' : 'border-l border-[#808080] border-r border-white'}`} />

        {/* 3. Window Tabs */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar h-full py-0.5">
          {openWindows.map((win) => {
            const isActive = activeWindowId === win.id && !win.isMinimized;

            return (
              <button
                key={win.id}
                onClick={() => {
                  soundManager.play('click');
                  if (win.isMinimized) {
                    restoreWindow(win.id);
                    focusWindow(win.id);
                  } else if (isActive) {
                    minimizeWindow(win.id);
                  } else {
                    focusWindow(win.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabContextMenu({ windowId: win.id, x: e.clientX, y: e.clientY - 80 });
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 max-w-[160px] min-w-[100px] h-full text-left truncate text-[11px] cursor-pointer transition-none ${
                  isCanalTaskbar
                    ? `rounded-t-sm ${
                        isActive
                          ? 'bg-gradient-to-b from-[#122a68] to-[#1e4598] text-white shadow-inner border-t border-[#0c1f4e]'
                          : 'bg-gradient-to-b from-[#386cd4] to-[#1e4598] text-gray-100 hover:brightness-110'
                      }`
                    : `${
                        isActive
                          ? 'orion-inset bg-[#dfdfdf] font-bold text-black'
                          : 'orion-button text-black'
                      }`
                }`}
              >
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-xs">
                  {win.icon || '🗂️'}
                </span>
                <span className="truncate flex-1">{win.title}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Tab Context Menu */}
        {tabContextMenu && (
          <div
            className="absolute z-50 orion-outset p-1 min-w-[120px] flex flex-col gap-0.5 text-black shadow-lg"
            style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="text-left px-2 py-1 hover:bg-orion-highlight hover:text-white flex items-center gap-1.5"
              onClick={() => {
                minimizeWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <Minus className="w-3 h-3" />
              <span>Minimize</span>
            </button>
            <button
              className="text-left px-2 py-1 hover:bg-orion-highlight hover:text-white flex items-center gap-1.5"
              onClick={() => {
                restoreWindow(tabContextMenu.windowId);
                focusWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <Square className="w-3 h-3" />
              <span>Restore</span>
            </button>
            <div className="h-[1px] bg-[#808080] my-0.5 border-b border-white" />
            <button
              className="text-left px-2 py-1 hover:bg-red-700 hover:text-white flex items-center gap-1.5 text-red-900 font-bold"
              onClick={() => {
                closeWindow(tabContextMenu.windowId);
                setTabContextMenu(null);
              }}
            >
              <X className="w-3 h-3" />
              <span>Close</span>
            </button>
          </div>
        )}

        {/* 5. System Tray */}
        <SystemTray onOpenDialUp={onOpenDialUp} />
      </div>
    </>
  );
};
