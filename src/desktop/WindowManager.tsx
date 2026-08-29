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
import { PulseMessengerApp } from '../apps/pulse/PulseMessengerApp';
import { RetroAmpApp } from '../apps/retroamp/RetroAmpApp';
import { FlashFetchApp } from '../apps/flashfetch/FlashFetchApp';
import { ZipMateApp } from '../apps/zipmate/ZipMateApp';
import { PhotoBoxApp } from '../apps/photobox/PhotoBoxApp';
import { WeatherBuddyApp } from '../apps/weatherbuddy/WeatherBuddyApp';
import { SafeSweepApp } from '../apps/safesweep/SafeSweepApp';
import { MailboxApp } from '../apps/mailbox/MailboxApp';
import { AILabApp } from '../apps/ailab/AILabApp';

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

  pulse: () => <PulseMessengerApp />,
  'app.pulse': () => <PulseMessengerApp />,
  pulse_messenger: () => <PulseMessengerApp />,
  'app.pulse_messenger': () => <PulseMessengerApp />,

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
};

interface WindowManagerProps {
  customAppRegistry?: AppRegistry;
}

export const WindowManager: React.FC<WindowManagerProps> = ({ customAppRegistry = {} }) => {
  const windows = useWindowStore((s) => s.windows);
  const windowOrder = useWindowStore((s) => s.windowOrder);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
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
        closeWindow(activeWindowId);
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
  }, [activeWindowId, visibleWindows, closeWindow, focusWindow]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" id="window-manager-root">
      {visibleWindows.map((win) => {
        const AppComponent = registry[win.appId] || DefaultAppPlaceholder;
        const isActive = activeWindowId === win.id;

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
