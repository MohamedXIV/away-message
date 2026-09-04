import React, { useEffect, useMemo } from 'react';
import { WindowFrame } from './WindowFrame';
import { useWindowStore, WindowState } from '../store/useWindowStore';
import { TerminalApp } from '../apps/terminal/TerminalApp';
import { FileExplorerApp } from '../apps/fileexplorer/FileExplorerApp';
import { ControlPanelApp } from '../apps/controlpanel/ControlPanelApp';
import { AddRemoveApp } from '../apps/addremove/AddRemoveApp';
import { NotepadApp } from '../apps/notepad/NotepadApp';
import { TrashApp } from '../apps/trash/TrashApp';
import { VoyagerBrowserApp } from '../apps/browser/VoyagerBrowserApp';
import { PulseAppGate } from '../apps/pulse/components/PulseAppGate';
import { RetroAmpApp } from '../apps/retroamp/RetroAmpApp';
import { FlashFetchApp } from '../apps/flashfetch/FlashFetchApp';
import { ZipMateApp } from '../apps/zipmate/ZipMateApp';
import { PhotoBoxApp } from '../apps/photobox/PhotoBoxApp';
import { WeatherBuddyApp } from '../apps/weatherbuddy/WeatherBuddyApp';
import { SafeSweepApp } from '../apps/safesweep/SafeSweepApp';
import { MailboxApp } from '../apps/mailbox/MailboxApp';
import { AILabApp } from '../apps/ailab/AILabApp';
import { InstallerWizard } from '../apps/installer/InstallerWizard';

export interface AppRegistryProps {
  window: WindowState;
}

// Fallback component for apps in development
const DefaultAppPlaceholder: React.FC<{ window: WindowState }> = ({ window }) => (
  <div className="p-6 font-pixel text-gray-800 flex flex-col items-center justify-center h-full text-center select-text">
    <div className="text-4xl mb-3">{window.icon}</div>
    <div className="font-bold text-sm mb-1">{window.title}</div>
    <div className="text-xs text-gray-600 mb-4">Application ID: {window.appId}</div>
    <div className="text-[11px] bg-yellow-50 border border-yellow-300 p-2.5 rounded max-w-sm">
      This application is initializing its subsystem. Window management controls (drag, resize, minimize, maximize) and state are fully functional.
    </div>
  </div>
);

export type AppRegistry = Record<string, React.ComponentType<AppRegistryProps>>;

// Built-in App Component Map
const defaultAppComponents: AppRegistry = {
  terminal: ({ window }) => <TerminalApp windowId={window.id} />,
  'app.terminal': ({ window }) => <TerminalApp windowId={window.id} />,
  fileexplorer: ({ window }) => <FileExplorerApp initialPath={window.customState?.initialPath} />,
  'app.fileexplorer': ({ window }) => <FileExplorerApp initialPath={window.customState?.initialPath} />,
  controlpanel: () => <ControlPanelApp />,
  'app.controlpanel': () => <ControlPanelApp />,
  addremove: () => <AddRemoveApp />,
  'app.addremove': () => <AddRemoveApp />,
  notepad: ({ window }) => <NotepadApp filePath={window.customState?.filePath} />,
  'app.notepad': ({ window }) => <NotepadApp filePath={window.customState?.filePath} />,
  trash: () => <TrashApp />,
  'app.trash': () => <TrashApp />,

  // Milestone 3 Applications
  browser: ({ window }) => <VoyagerBrowserApp initialUrl={window.customState?.initialUrl} />,
  'app.browser': ({ window }) => <VoyagerBrowserApp initialUrl={window.customState?.initialUrl} />,
  voyager: ({ window }) => <VoyagerBrowserApp initialUrl={window.customState?.initialUrl} />,
  'app.voyager': ({ window }) => <VoyagerBrowserApp initialUrl={window.customState?.initialUrl} />,

  pulse: () => <PulseAppGate />,
  'app.pulse': () => <PulseAppGate />,
  pulse_messenger: () => <PulseAppGate />,
  'app.pulse_messenger': () => <PulseAppGate />,

  retroamp: () => <RetroAmpApp />,
  'app.retroamp': () => <RetroAmpApp />,

  flashfetch: () => <FlashFetchApp />,
  'app.flashfetch': () => <FlashFetchApp />,

  zipmate: () => <ZipMateApp />,
  'app.zipmate': () => <ZipMateApp />,

  photobox: () => <PhotoBoxApp />,
  'app.photobox': () => <PhotoBoxApp />,
  photobox_pro: () => <PhotoBoxApp />,
  'app.photobox_pro': () => <PhotoBoxApp />,

  weatherbuddy: () => <WeatherBuddyApp />,
  'app.weatherbuddy': () => <WeatherBuddyApp />,

  safesweep: () => <SafeSweepApp />,
  'app.safesweep': () => <SafeSweepApp />,

  mailbox: () => <MailboxApp />,
  'app.mailbox': () => <MailboxApp />,

  ailab: () => <AILabApp />,
  'app.ailab': () => <AILabApp />,

  installer: ({ window }) => <InstallerWizard window={window} />,
  'app.installer': ({ window }) => <InstallerWizard window={window} />,
};

interface WindowManagerProps {
  customAppRegistry?: AppRegistry;
}

export const WindowManager: React.FC<WindowManagerProps> = ({ customAppRegistry = {} }) => {
  const windows = useWindowStore((s) => s.windows);
  const windowOrder = useWindowStore((s) => s.windowOrder);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const closeOrTrayWindow = useWindowStore((s) => s.closeOrTrayWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

  const registry = useMemo(() => {
    return { ...defaultAppComponents, ...customAppRegistry };
  }, [customAppRegistry]);

  // Filter open, non-minimized windows sorted by Z-Index
  const visibleWindows = useMemo(() => {
    return windowOrder
      .map((id) => windows[id])
      .filter((w): w is WindowState => !!w && w.isOpen && !w.isMinimized)
      .sort((a, b) => a.zIndex - b.zIndex);
  }, [windows, windowOrder]);

  // Global Keyboard Shortcuts (Alt+F4 to close, Alt+Tab cycling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F4' && activeWindowId) {
        e.preventDefault();
        closeOrTrayWindow(activeWindowId);
      } else if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        if (visibleWindows.length > 1) {
          const currentIndex = visibleWindows.findIndex((w) => w.id === activeWindowId);
          const nextIndex = (currentIndex + 1) % visibleWindows.length;
          const nextWin = visibleWindows[nextIndex];
          if (nextWin) focusWindow(nextWin.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWindowId, visibleWindows, closeOrTrayWindow, focusWindow]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" id="window-manager-root">
      {visibleWindows.map((win) => {
        const AppComponent = registry[win.appId] || DefaultAppPlaceholder;
        const isActive = activeWindowId === win.id;

        // Frameless windows (Pulse) — draggable via header, with custom chrome
        if (win.isFrameless) {
          return (
            <div
              key={win.id}
              className="pointer-events-auto absolute"
              style={{
                left: win.position.x,
                top: win.position.y,
                width: win.size.width,
                height: win.size.height,
                zIndex: win.zIndex,
              }}
              onMouseDown={() => focusWindow(win.id)}
            >
              <div className={`w-full h-full overflow-hidden shadow-2xl border flex flex-col ${isActive ? 'border-[#38516e]' : 'border-gray-500'} `}>
                {/* Custom frameless title bar — drag handle + window controls */}
                <div
                  className={`h-6 flex items-center justify-between px-2 text-white text-xs font-bold select-none ${isActive ? 'bg-[#27456d]' : 'bg-gray-600'}`}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startPos = { ...win.position };
                    const onMove = (ev: MouseEvent) => {
                      const dx = ev.clientX - startX;
                      const dy = ev.clientY - startY;
                      const { setWindowPosition } = useWindowStore.getState();
                      setWindowPosition(win.id, { x: startPos.x + dx, y: startPos.y + dy });
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  <span className="flex items-center gap-1.5 truncate"><span>💬</span> {win.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); const { minimizeWindow } = useWindowStore.getState(); minimizeWindow(win.id); }}
                      className="w-5 h-4 bg-[#d7d7d7] hover:bg-[#e8e8e8] text-black text-[10px] leading-none border border-gray-400"
                      title="Minimize"
                    >
                      _
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                      className="w-5 h-4 bg-[#c0392b] hover:bg-[#e74c3c] text-white text-[10px] leading-none border border-gray-400"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden bg-white">
                  <AppComponent window={win} />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={win.id} className="pointer-events-auto">
            {/* Modal Backdrop if window is modal */}
            {win.isModal && isActive && (
              <div
                style={{ zIndex: win.zIndex - 1 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-auto"
              />
            )}

            <WindowFrame window={win} isActive={isActive}>
              <AppComponent window={win} />
            </WindowFrame>
          </div>
        );
      })}
    </div>
  );
};
