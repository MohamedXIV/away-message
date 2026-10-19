import { useEffect, useState } from 'react';
import type { SimulationChromeRead, SimulationDesktopRead } from '../../engine/kernel/SimulationPublication';
import { getOsPresentationProfile } from '../../desktop/host/OsPresentation';
import { useWindowStore, type WindowState } from '../../store/useWindowStore';
import { WorkerPulsePanel } from './WorkerPulsePanel';
import { WorkerFileExplorer, WorkerNotepad } from './WorkerDesktopVfsApps';
import { WorkerSystemPanel } from './WorkerSystemPanel';
import { WorkerPublicSites } from './WorkerPublicSites';
import type { WorkerGameSession } from './WorkerGameSession';

const APPLICATIONS = [
  { id: 'fileexplorer', label: 'My Computer', icon: '📁' },
  { id: 'notepad', label: 'Notepad', icon: '📝' },
  { id: 'pulse', label: 'Pulse Messenger', icon: '💬' },
  { id: 'system', label: 'Computer & Setup', icon: '💻' },
  { id: 'publicweb', label: 'Town Sites', icon: '🌐' },
] as const;

/**
 * Reuses the game's existing useWindowStore (UI-only windowing) and
 * OsPresentation profiles. All game state, file bodies and messages are
 * read/modified through the ONE WorkerGameSession.
 *
 * This is not yet the fully migrated DesktopShell/WindowFrame/Taskbar:
 * the old components import an eager SimulationEngine at module load and
 * must not be loaded on the Worker-only HTML entry.
 */
export function WorkerDesktop({
  session, revision,
}: {
  session: WorkerGameSession;
  revision: number;
}) {
  const [desktop, setDesktop] = useState<SimulationDesktopRead | null>(null);
  const [chrome, setChrome] = useState<SimulationChromeRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const windows = useWindowStore(s => s.windows);
  const windowOrder = useWindowStore(s => s.windowOrder);
  const activeId = useWindowStore(s => s.activeWindowId);
  const openWindow = useWindowStore(s => s.openWindow);
  const closeWindow = useWindowStore(s => s.closeWindow);
  const minimizeWindow = useWindowStore(s => s.minimizeWindow);
  const restoreWindow = useWindowStore(s => s.restoreWindow);
  const focusWindow = useWindowStore(s => s.focusWindow);
  const toggleMaximize = useWindowStore(s => s.toggleMaximize);

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
  const canal = profile?.shell.taskbarId === 'canal';

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
        <WorkerDesktopWindow
          key={win.id} window={win} active={win.id === activeId}
          chrome={chrome} onFocus={() => focusWindow(win.id)}
          onClose={() => closeWindow(win.id)}
          onMinimize={() => minimizeWindow(win.id)}
          onMaximize={() => toggleMaximize(win.id)}>
          {win.appId === 'fileexplorer' ? (
            <WorkerFileExplorer session={session} revision={revision} openDocument={openDocument} />
          ) : win.appId === 'notepad' ? (
            <WorkerNotepad session={session}
              filePath={typeof win.customState?.filePath === 'string'
                ? win.customState.filePath : undefined} />
          ) : win.appId === 'system' ? (
            <WorkerSystemPanel session={session} revision={revision} />
          ) : win.appId === 'publicweb' ? (
            <WorkerPublicSites session={session} revision={revision} />
          ) : win.appId === 'pulse' ? (
            <div className="h-full overflow-y-auto bg-slate-900 p-2">
              <WorkerPulsePanel session={session} revision={revision} />
            </div>
          ) : null}
        </WorkerDesktopWindow>
      ))}

      <footer data-testid="worker-desktop-taskbar"
        className={`absolute inset-x-0 bottom-0 flex h-9 items-center gap-1 border-t px-2 ${canal
          ? 'border-blue-300 bg-[#245edb] text-white' : 'border-white bg-[#c0c0c0] text-black'}`}>
        <button type="button" className="mr-2 rounded border px-2 py-1 text-xs font-bold"
          onClick={() => open('fileexplorer')}>Start</button>
        {openWindows.map(win => (
          <button type="button" key={win.id} onClick={() => win.isMinimized
            ? restoreWindow(win.id) : focusWindow(win.id)}
            aria-label={'Taskbar ' + win.title}
            aria-pressed={!win.isMinimized && activeId === win.id}
            className={`max-w-36 truncate rounded border px-2 py-1 text-xs ${win.isMinimized
              ? 'opacity-60' : activeId === win.id ? 'border-amber-300 font-bold' : ''}`}>
            {win.icon} {win.title}
          </button>
        ))}
        <span className="ml-auto text-xs">
          {chrome?.time ? String(chrome.time.hour).padStart(2, '0') + ':' +
            String(chrome.time.minute).padStart(2, '0') : '––:––'}
        </span>
      </footer>
      {error && <p role="alert" className="absolute bottom-11 right-3 bg-red-100 p-2 text-xs">{error}</p>}
    </section>
  );
}

function WorkerDesktopWindow({
  window: win, active, chrome, onFocus, onClose, onMinimize, onMaximize, children,
}: {
  window: WindowState;
  active: boolean;
  chrome: SimulationChromeRead | null;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  children: React.ReactNode;
}) {
  const profile = chrome?.osVersion ? getOsPresentationProfile(chrome.osVersion) : null;
  return (
    <section data-testid={'worker-window-' + win.appId} onPointerDown={onFocus}
      className={`absolute flex flex-col overflow-hidden border-2 bg-[#c0c0c0] shadow-xl ${active
        ? 'border-white' : 'border-gray-600'}`}
      style={win.isMaximized
        ? { left: 0, top: 0, right: 0, bottom: 36, zIndex: win.zIndex }
        : {
          left: win.position.x, top: win.position.y,
          width: Math.min(win.size.width, 640), height: Math.min(win.size.height, 440),
          zIndex: win.zIndex,
        }}>
      <header className="flex h-7 shrink-0 items-center gap-2 bg-[#000080] px-2 text-xs text-white"
        style={{ fontFamily: profile?.titlebar.fontStack }}>
        <span className="min-w-0 flex-1 truncate">{win.icon} {win.title}</span>
        <button type="button" aria-label={'Minimize ' + win.title}
          onClick={onMinimize} className="rounded bg-[#c0c0c0] px-2 text-black">_</button>
        <button type="button" aria-label={'Maximize ' + win.title}
          onClick={onMaximize} className="rounded bg-[#c0c0c0] px-2 text-black">□</button>
        <button type="button" aria-label={'Close ' + win.title}
          onClick={onClose} className="rounded bg-[#c0c0c0] px-2 text-black">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
