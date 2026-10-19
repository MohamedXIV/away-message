import { useEffect, useState } from 'react';
import type { SimulationChromeRead, SimulationDesktopRead } from '../../engine/kernel/SimulationPublication';
import { getOsPresentationProfile } from '../../desktop/host/OsPresentation';
import { WindowFrameChrome } from '../../desktop/WindowFrameChrome';
import { TaskbarChrome } from '../../desktop/TaskbarChrome';
import { StartMenuChrome } from '../../desktop/StartMenuChrome';
import { useWindowStore, type WindowState } from '../../store/useWindowStore';
import { WorkerPulsePanel } from './WorkerPulsePanel';
import { WorkerFileExplorer, WorkerNotepad } from './WorkerDesktopVfsApps';
import { WorkerSystemPanel } from './WorkerSystemPanel';
import { WorkerPublicSites } from './WorkerPublicSites';
import { WorkerMailboxPanel } from './WorkerMailboxPanel';
import type { WorkerGameSession } from './WorkerGameSession';

const APPLICATIONS = [
  { id: 'fileexplorer', label: 'My Computer', icon: '📁' },
  { id: 'notepad', label: 'Notepad', icon: '📝' },
  { id: 'pulse', label: 'Pulse Messenger', icon: '💬' },
  { id: 'system', label: 'Computer & Setup', icon: '💻' },
  { id: 'publicweb', label: 'Town Sites', icon: '🌐' },
  { id: 'mailbox', label: 'Mailbox', icon: '✉️' },
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
  const windows = useWindowStore(s => s.windows);
  const windowOrder = useWindowStore(s => s.windowOrder);
  const activeId = useWindowStore(s => s.activeWindowId);
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
  const openWindows = windowOrder.map(id => windows[id]).filter(
    (window): window is WindowState => !!window && window.isOpen,
  );
  const profile = chrome?.osVersion ? getOsPresentationProfile(chrome.osVersion) : null;
  const allowedApps = ['browser', 'fileexplorer', 'notepad', 'controlpanel', 'pulse'];
  const resolveAppId = (id: string): string | null => ({
    browser: 'publicweb', fileexplorer: 'fileexplorer', notepad: 'notepad',
    controlpanel: 'system', pulse: 'pulse',
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

      {openWindows.filter(win => !win.isMinimized).map(win => (
        <WindowFrameChrome
          key={win.id} window={win} isActive={win.id === activeId}
          osVersion={chrome?.osVersion ?? null}
          testId={'worker-window-' + win.appId}>
          {win.appId === 'fileexplorer' ? (
            <WorkerFileExplorer session={session} revision={revision} openDocument={openDocument} />
          ) : win.appId === 'notepad' ? (
            <WorkerNotepad session={session}
              filePath={typeof win.customState?.filePath === 'string'
                ? win.customState.filePath : undefined} />
          ) : win.appId === 'system' ? (
            <WorkerSystemPanel session={session} revision={revision} />
          ) : win.appId === 'mailbox' ? (
            <WorkerMailboxPanel session={session} revision={revision} />
          ) : win.appId === 'publicweb' ? (
            <WorkerPublicSites session={session} revision={revision} />
          ) : win.appId === 'pulse' ? (
            <div className="h-full overflow-y-auto bg-slate-900 p-2">
              <WorkerPulsePanel session={session} revision={revision} />
            </div>
          ) : null}
        </WindowFrameChrome>
      ))}

      <TaskbarChrome contained testId="worker-desktop-taskbar"
        osVersion={chrome?.osVersion ?? null} pulseInstalled={chrome?.pulseInstalled ?? false}
        onStepAway={onStepAway} browserAppId="publicweb"
        renderStartMenu={(close, isOpen) => (
          <StartMenuChrome isOpen={isOpen} onClose={close}
            osVersion={chrome?.osVersion ?? null} pulseInstalled={chrome?.pulseInstalled ?? false}
            availableApps={allowedApps} resolveAppId={resolveAppId}
            launchApp={open} onOpenDialUp={() => open('system')}
            rest={() => {
              void session.dispatch({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 })
                .catch(cause => setError(String(cause)));
            }} />
        )}
        tray={<div data-testid="worker-taskbar-tray"
          className="ml-auto flex h-full items-center gap-2 border-l border-white/30 px-2 text-xs">
          <span title={chrome?.connectionType ?? 'offline'}>📡</span>
          <button type="button" onClick={() => open('pulse')}
            title="Pulse Messenger" aria-label="Open Pulse from tray">💬
            {!!chrome?.unreadCount && <sup>{Math.min(chrome.unreadCount, 9)}{chrome.unreadCount > 9 ? '+' : ''}</sup>}
          </button>
          <span title={chrome?.time ? 'Day ' + chrome.time.day : 'Clock'}>
            {chrome?.time ? String(chrome.time.hour).padStart(2, '0') + ':' +
              String(chrome.time.minute).padStart(2, '0') : '––:––'}
          </span>
        </div>}
      />
      {error && <p role="alert" className="absolute bottom-11 right-3 bg-red-100 p-2 text-xs">{error}</p>}
    </section>
  );
}

