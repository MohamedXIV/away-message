import React, { useMemo } from 'react';
import { WindowFrame } from './WindowFrame';
import { type WindowState } from '../store/useWindowStore';
import { WindowManagerChrome, type AppRegistryProps } from './WindowManagerChrome';
export type { AppRegistryProps } from './WindowManagerChrome';
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
import { SaveLoadApp } from '../apps/savegame/SaveLoadApp';
import { AILabApp } from '../apps/ailab/AILabApp';
import { InstallerWizard } from '../apps/installer/InstallerWizard';

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

  savegame: () => <SaveLoadApp />,
  'app.savegame': () => <SaveLoadApp />,
  ailab: () => <AILabApp />,
  'app.ailab': () => <AILabApp />,

  installer: ({ window }) => <InstallerWizard window={window} />,
  'app.installer': ({ window }) => <InstallerWizard window={window} />,
};

interface WindowManagerProps {
  customAppRegistry?: AppRegistry;
}

/** Legacy synchronous app registry adapter. Never imported on worker.html. */
export const WindowManager: React.FC<WindowManagerProps> = ({ customAppRegistry = {} }) => {
  const registry = useMemo(
    () => ({ ...defaultAppComponents, ...customAppRegistry }),
    [customAppRegistry],
  );
  return (
    <WindowManagerChrome
      renderApp={(win) => {
        const AppComponent = registry[win.appId] || DefaultAppPlaceholder;
        return <AppComponent window={win} />;
      }}
      renderFrame={(win, isActive, children) => (
        <WindowFrame window={win} isActive={isActive}>{children}</WindowFrame>
      )}
    />
  );
};
