import { useEffect, useState } from 'react';
import type { SimulationChromeRead, SimulationDesktopRead } from '../../engine/kernel/SimulationPublication';
import { getOsPresentationProfile } from '../../desktop/host/OsPresentation';
import { WindowFrameChrome } from '../../desktop/WindowFrameChrome';
import { WindowManagerChrome } from '../../desktop/WindowManagerChrome';
import { TaskbarChrome } from '../../desktop/TaskbarChrome';
import { StartMenuChrome } from '../../desktop/StartMenuChrome';
import { SystemTrayChrome } from '../../desktop/SystemTrayChrome';
import { useWindowStore, type WindowState } from '../../store/useWindowStore';
import { WorkerPulsePanel } from './WorkerPulsePanel';
import { WorkerFileExplorer, WorkerNotepad } from './WorkerDesktopVfsApps';
import { WorkerSystemPanel } from './WorkerSystemPanel';
import { WorkerPublicSites } from './WorkerPublicSites';
import { WorkerMailboxPanel } from './WorkerMailboxPanel';
import { WorkerFlashFetchPanel } from './WorkerOsHostProvider';
import { WorkerVoyagerPanel } from './WorkerVoyagerPanel';
import { WorkerInstallerPanel } from './WorkerInstallerPanel';
import { WorkerWeatherBuddyPanel } from './WorkerWeatherBuddyPanel';
import { WorkerSafeSweepPanel } from './WorkerSafeSweepPanel';
import { WorkerZipMatePanel } from './WorkerZipMatePanel';
import { WorkerRetroAmpPanel } from './WorkerRetroAmpPanel';
import { WorkerPhotoBoxPanel } from './WorkerPhotoBoxPanel';
import { getWorkerInstalledPrograms, getWorkerInstalledShortcuts } from './WorkerInstalledAppLinks';
import type { WorkerGameSession } from './WorkerGameSession';

const APPLICATIONS = [
  { id: 'fileexplorer', label: 'My Computer', icon: '📁' },
  { id: 'notepad', label: 'Notepad', icon: '📝' },
  { id: 'pulse', label: 'Pulse Messenger', icon: '💬' },
  { id: 'system', label: 'Computer & Setup', icon: '💻' },
  { id: 'publicweb', label: 'Town Sites', icon: '🌐' },
  { id: 'browser', label: 'Voyager Browser', icon: '🌐' },
  { id: 'mailbox', label: 'Mailbox', icon: '✉️' },
  { id: 'flashfetch', label: 'FlashFetch', icon: '⚡' },
] as const;

/**
 * Reuses the game's existing useWindowStore (UI-only windowing) and
 * OsPresentation profiles. All game state, file bodies and messages are
 * read/modified through the ONE WorkerGameSession.
 *
 * Shared authored WindowFrameChrome handles actual OS window presentation,
 * resizing, dragging, animations and taskbar lifecycle. The legacy wrapper
 * WindowFrame and its OsHostProvider still import the main-thread engine;
 * do NOT import those adapters on the Worker-only HTML entry.
 */
export function WorkerDesktop({
  session, revision, onStepAway,
}: {
  session: WorkerGameSession;
  revision: number;
  onStepAway: () => void;
}) {
  const [desktop, setDesktop] = useState<SimulationDesktopRead | null>(null);
  const [chrome, setChrome] = useState<SimulationChromeRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openWindow = useWindowStore(s => s.openWindow);

  useEffect(() => {
    let current = true;
    void Promise.all([
      session.read({ kind: 'desktop' }), session.read({ kind: 'chrome' }),
    ]).then(([nextDesktop, nextChrome]) => {
      if (!current || nextDesktop.revision !== revision || nextChrome.revision !== revision) return;
      setDesktop(nextDesktop);
      setChrome(nextChrome);
      setError(null);
    }).catch(cause => { if (current) setError(String(cause)); });
    return () => { current = false; };
  }, [session, revision]);

  const open = (appId: string, customState?: Record<string, unknown>) =>
    openWindow(appId, customState ?? {});
  const openDocument = (path: string) => open('notepad', { filePath: path });
  const openInstaller = (path: string) => open('installer', { filePath: path });
  const openArchive = (path: string) => open('zipmate', { archivePath: path });
  const openArtwork = (path: string) => open('photobox', { artworkPath: path });
  const openAudio = (path: string) => open('retroamp', { audioPath: path });
  const profile = chrome?.osVersion ? getOsPresentationProfile(chrome.osVersion) : null;
  const installedShortcuts = desktop ? getWorkerInstalledShortcuts(desktop) : [];
  const installedPrograms = desktop ? getWorkerInstalledPrograms(desktop) : [];
  const allowedApps = ['browser', 'fileexplorer', 'notepad', 'controlpanel', 'pulse',
    ...installedPrograms.filter(program => program.available).map(program => program.id)];
  const resolveAppId = (id: string): string | null => ({
    browser: 'browser', fileexplorer: 'fileexplorer', notepad: 'notepad',
    controlpanel: 'system', pulse: 'pulse', flashfetch: 'flashfetch',
  } as Record<string, string>)[id] ?? null;

  return (
    <section data-testid="worker-desktop"
      className="relative h-[570px] overflow-hidden rounded-md border border-slate-600 bg-[#008080] text-black"
      style={{ fontFamily: profile?.uiFontStack ?? 'Tahoma, sans-serif' }}>
      <div className="pointer-events-none absolute right-3 top-2 text-xs text-white/80">
        {chrome?.osVersion ?? 'No OS installed'} · Worker-backed desktop
      </div>
      {!desktop?.osVersion && (
        <p data-testid="worker-desktop-uninstalled"
          className="absolute left-3 right-3 top-3 rounded border border-amber-700 bg-amber-100/95 p-2 text-xs">
          No canonical OS is installed. Window/file operations here are an engineering
          migration surface, not an unlocked in-world computer.
        </p>
      )}
      <div className="absolute left-3 top-24 flex w-28 flex-col gap-3">
        {APPLICATIONS.map(app => (
          <button type="button" key={app.id} onClick={() => open(app.id)}
            className="flex flex-col items-center gap-1 rounded px-1 py-1 text-xs text-white hover:bg-white/20"
            aria-label={'Open ' + app.label}>
            <span className="text-3xl">{app.icon}</span>{app.label}
          </button>
        ))}
      </div>
      {installedShortcuts.length > 0 && (
        <div data-testid="worker-installed-shortcuts"
          className="absolute left-36 top-24 flex max-h-[390px] w-32 flex-col gap-3 overflow-y-auto">
          {installedShortcuts.map(shortcut => (
            <button type="button" key={shortcut.id}
              disabled={!shortcut.launchId}
              title={shortcut.launchId ? 'Open installed ' + shortcut.label :
                shortcut.label + ': installed, Worker UI not migrated yet'}
              onClick={() => { if (shortcut.launchId) open(shortcut.launchId); }}
              aria-label={'Installed shortcut: ' + shortcut.label}
              className="flex flex-col items-center gap-1 rounded px-1 py-1 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-55">
              <span className="text-3xl">{shortcut.icon}</span>{shortcut.label}
            </button>
          ))}
        </div>
      )}

      <WindowManagerChrome
        renderFrame={(win, isActive, children) => (
          <WindowFrameChrome window={win} isActive={isActive}
            osVersion={chrome?.osVersion ?? null}
            testId={'worker-window-' + win.appId}>
            {children}
          </WindowFrameChrome>
        )}
        renderApp={win => (
          <WorkerDesktopApp window={win} session={session} revision={revision}
            openDocument={openDocument} openInstaller={openInstaller} openArchive={openArchive}
            openArtwork={openArtwork} openAudio={openAudio} />
        )}
      />

      <TaskbarChrome contained testId="worker-desktop-taskbar"
        osVersion={chrome?.osVersion ?? null} pulseInstalled={chrome?.pulseInstalled ?? false}
        onStepAway={onStepAway} browserAppId="browser"
        renderStartMenu={(close, isOpen) => (
          <StartMenuChrome isOpen={isOpen} onClose={close}
            osVersion={chrome?.osVersion ?? null} pulseInstalled={chrome?.pulseInstalled ?? false}
            availableApps={allowedApps} installedPrograms={installedPrograms}
            resolveAppId={resolveAppId}
            launchApp={open} onOpenDialUp={() => open('system')}
            rest={() => {
              void session.dispatch({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 })
                .catch(cause => setError(String(cause)));
            }} />
        )}
        tray={<div data-testid="worker-taskbar-tray" className="ml-auto h-full">
          {chrome ? <SystemTrayChrome chrome={chrome}
            onOpenDialUp={() => open('system')} /> : (
            <div role="status" className="px-2 py-1 text-xs">––:––</div>
          )}
        </div>}
      />
      {error && <p role="alert" className="absolute bottom-11 right-3 bg-red-100 p-2 text-xs">{error}</p>}
    </section>
  );
}


/** One stable React component identity per app/window, across Worker revisions. */
function WorkerDesktopApp({ window: win, session, revision, openDocument, openInstaller, openArchive, openArtwork, openAudio }: {
  window: WindowState;
  session: WorkerGameSession;
  revision: number;
  openDocument: (path: string) => void;
  openInstaller: (path: string) => void;
  openArchive: (path: string) => void;
  openArtwork: (path: string) => void;
  openAudio: (path: string) => void;
}) {
  if (win.appId === 'fileexplorer') {
    return <WorkerFileExplorer session={session} revision={revision}
      openDocument={openDocument} openInstaller={openInstaller} openArchive={openArchive}
      openArtwork={openArtwork} openAudio={openAudio} />;
  }
  if (win.appId === 'notepad') {
    return <WorkerNotepad session={session}
      filePath={typeof win.customState?.filePath === 'string'
        ? win.customState.filePath : undefined} />;
  }
  if (win.appId === 'installer') return <WorkerInstallerPanel session={session} revision={revision} windowId={win.id} filePath={typeof win.customState?.filePath === 'string' ? win.customState.filePath : undefined} />;
  if (win.appId === 'weatherbuddy') return <WorkerWeatherBuddyPanel session={session} revision={revision} />;
  if (win.appId === 'safesweep') return <WorkerSafeSweepPanel session={session} revision={revision} />;
  if (win.appId === 'retroamp') return <WorkerRetroAmpPanel session={session} revision={revision}
    initialPath={typeof win.customState?.audioPath === 'string' ? win.customState.audioPath : undefined} />;
  if (win.appId === 'photobox') return <WorkerPhotoBoxPanel session={session} revision={revision}
    initialPath={typeof win.customState?.artworkPath === 'string' ? win.customState.artworkPath : undefined} />;
  if (win.appId === 'zipmate') return <WorkerZipMatePanel session={session} revision={revision}
    initialPath={typeof win.customState?.archivePath==='string'?win.customState.archivePath:undefined} />;
  if (win.appId === 'system') return <WorkerSystemPanel session={session} revision={revision} />;
  if (win.appId === 'mailbox') return <WorkerMailboxPanel session={session} revision={revision} />;
  if (win.appId === 'flashfetch') return <WorkerFlashFetchPanel session={session} revision={revision} windowId={win.id} />;
  if (win.appId === 'browser') return <WorkerVoyagerPanel session={session} revision={revision} windowId={win.id}
    initialUrl={typeof win.customState?.initialUrl === 'string' ? win.customState.initialUrl : undefined} />;
  if (win.appId === 'publicweb') return <WorkerPublicSites session={session} revision={revision} />;
  if (win.appId === 'pulse') {
    return <div className="h-full overflow-y-auto bg-slate-900 p-2">
      <WorkerPulsePanel session={session} revision={revision} />
    </div>;
  }
  return <p role="alert" className="p-3 text-xs text-red-800">
    This app is not available in the Worker desktop: {win.appId}
  </p>;
}
