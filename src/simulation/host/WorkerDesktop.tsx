import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { SimulationChromeRead, SimulationDesktopRead } from '../../engine/kernel/SimulationPublication';
import { getReleaseById } from '../../engine/OsCatalog';
import { getOsPresentationProfile } from '../../desktop/host/OsPresentation';
import { DesktopIconGrid, type DesktopIconItem } from '../../desktop/DesktopIconGrid';
import { InGameContextMenu, type GameContextMenuState } from '../../desktop/InGameContextMenu';
import { WindowFrameChrome } from '../../desktop/WindowFrameChrome';
import { WindowManagerChrome } from '../../desktop/WindowManagerChrome';
import { TaskbarChrome } from '../../desktop/TaskbarChrome';
import { StartMenuChrome } from '../../desktop/StartMenuChrome';
import { SystemTrayChrome } from '../../desktop/SystemTrayChrome';
import { useWindowStore, type WindowState } from '../../store/useWindowStore';
import { WorkerPulsePanel } from './WorkerPulsePanel';
import { WorkerPreOrionShell } from './WorkerPreOrionShell';
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
import { WorkerTerminalPanel } from './WorkerTerminalPanel';
import { WorkerLabInspectorPanel } from './WorkerLabInspectorPanel';
import { WorkerRecycleBinPanel, WorkerAddRemovePanel, WorkerSaveLoadPanel } from './WorkerSystemUtilities';
import { getWorkerInstalledPrograms, getWorkerInstalledShortcuts } from './WorkerInstalledAppLinks';
import { buildWorkerDesktopIcons } from './workerDesktopIcons';
import type { WorkerGameSession } from './WorkerGameSession';

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
  const [contextMenu, setContextMenu] = useState<GameContextMenuState | null>(null);
  const [iconDetails, setIconDetails] = useState<DesktopIconItem | null>(null);
  const [bootPresentation, setBootPresentation] = useState(false);
  const [openingAppId, setOpeningAppId] = useState<string | null>(null);
  const bootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousBootState = useRef<string | null>(null);

  const showBoot = (editionId: string | null) => {
    if (bootTimer.current !== null) clearTimeout(bootTimer.current);
    setBootPresentation(true);
    // Visual transition only. The authoritative physical boot already spent
    // its hardware-dependent game minutes inside ComputerOwnershipRuntime.
    const seconds = editionId ? getReleaseById(editionId as NonNullable<SimulationChromeRead['osVersion']>)?.bootTimeSeconds ?? 38 : 38;
    bootTimer.current = setTimeout(() => setBootPresentation(false),
      Math.min(4200, Math.max(1800, seconds * 55)));
  };
  useEffect(() => () => { if (bootTimer.current !== null) clearTimeout(bootTimer.current); }, []);
  const desktopRef = useRef<HTMLElement>(null);
  const openWindow = useWindowStore(s => s.openWindow);
  const closeWindow = useWindowStore(s => s.closeWindow);

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

  useEffect(() => {
    const next = desktop?.pcBootState;
    // Both the first DOS boot and every installed Orion boot have a visual
    // transition. No boot sequence is shown while hardware is powered off.
    if ((next === 'desktop' || next === 'no_boot_device')
      && previousBootState.current && previousBootState.current !== next) {
      showBoot(desktop?.osVersion ?? null);
    }
    if (next) previousBootState.current = next;
  }, [desktop?.pcBootState]);

  const computerPowerAction = async (choice: 'shutdown' | 'restart') => {
    setError(null);
    if (choice === 'restart') setBootPresentation(true);
    try {
      const off = await session.hardware({ kind: 'power', poweredOn: false });
      if (!off.success) throw new Error(off.error ?? 'Computer shutdown was rejected');
      // Window geometry is UI-only. A powered-off machine cannot retain
      // running desktop windows or auto-resume them after power-on.
      const state = useWindowStore.getState();
      for (const id of state.windowOrder) {
        if (state.windows[id]?.isOpen) closeWindow(id);
      }
      if (choice === 'restart') {
        const on = await session.hardware({ kind: 'power', poweredOn: true });
        if (!on.success) throw new Error(on.error ?? 'Computer restart was rejected');
        showBoot(desktop?.osVersion ?? null);
      } else {
        setBootPresentation(false);
      }
    } catch (cause) {
      setBootPresentation(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const profile = chrome?.osVersion ? getOsPresentationProfile(chrome.osVersion) : null;
  const release = chrome?.osVersion ? getReleaseById(chrome.osVersion) : null;
  const installedShortcuts = useMemo(
    () => (desktop ? getWorkerInstalledShortcuts(desktop) : []),
    [desktop],
  );
  const installedPrograms = useMemo(
    () => (desktop ? getWorkerInstalledPrograms(desktop) : []),
    [desktop],
  );
  const desktopIcons = useMemo(
    () => buildWorkerDesktopIcons(installedShortcuts),
    [installedShortcuts],
  );

  const allowedApps = useMemo(() => ['terminal', 'ailab', 'browser', 'fileexplorer', 'notepad', 'controlpanel', 'trash', 'addremove', 'savegame',
    ...installedPrograms.filter(program => program.available).map(program => program.id)], [installedPrograms]);

  const resolveAppId = (id: string): string | null => {
    const mapped = id === 'controlpanel' ? 'system' : id;
    return allowedApps.includes(mapped) || allowedApps.includes(id) ? mapped : null;
  };

  /** Window geometry is UI-only. Size it to the actual contained desktop and
   * dock it beside the icon columns so the desktop remains usable while a
   * window is open. On narrow screens, fit the window into the remaining
   * space before falling back to an overlay position. */
  const open = async (appId: string, customState?: Record<string, unknown>) => {
    // Software eligibility belongs to the canonical installed-app read.
    // Historical taskbar windows/Run commands must not bypass a missing or
    // uninstalled third-party app. Core OS tools stay bundled.
    if (['pulse', 'flashfetch', 'weatherbuddy', 'safesweep', 'retroamp', 'photobox', 'zipmate'].includes(appId)
      && !installedPrograms.some(program => program.available && program.id === appId)) {
      setError('Install ' + appId + ' before opening it.');
      return;
    }
    // Running applications consumes canonical game time. The loading
    // indicator is presentation only; the Worker owns all time and work.
    // Cold boots are separate and are charged by physical PC power-on.
    if (openingAppId) return;
    // Focusing/restoring a running window is not a fresh process launch.
    const existing = useWindowStore.getState().windows[appId];
    if (existing?.isOpen) {
      openWindow({ appId, customState: customState ?? {} });
      return;
    }
    setOpeningAppId(appId);
    try {
      const read = await session.read({ kind: 'apps' });
      const heavy = ['pulse', 'browser', 'photobox', 'retroamp', 'ailab'].includes(appId);
      const baseMinutes = heavy ? 2 : 1;
      const memoryFactor = read.hardware.ramMB < 128 ? 2 : read.hardware.ramMB < 256 ? 1.5 : 1;
      const cpuFactor = Math.max(0.65, Math.min(2.5, 2 / Math.max(1, read.hardware.cpuTier)));
      const workMinutes = Math.max(1, Math.ceil(baseMinutes * memoryFactor * cpuFactor));
      await session.advanceMinutes(workMinutes);
      // Human-readable launch transition with the same hardware-dependent
      // ranking as world-time cost; no extra time owner or fake progress %.
      const presentationMs = Math.min(2200, Math.max(650, workMinutes * 230));
      await new Promise<void>(resolve => setTimeout(resolve, presentationMs));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setOpeningAppId(null);
      return;
    }
    setOpeningAppId(null);
    const bounds = desktopRef.current?.getBoundingClientRect();
    const desktopWidth = bounds?.width ?? 900;
    const desktopHeight = bounds?.height ?? 570;
    const taskbarHeight = profile?.shell.taskbarHeightPx ?? 28;
    const availableWidth = Math.max(240, desktopWidth - 24);
    const availableHeight = Math.max(160, desktopHeight - taskbarHeight - 24);
    const isPulse = appId === 'pulse' || appId === 'app.pulse';
    const desiredWidth = isPulse ? 360 : 620;
    const desiredHeight = isPulse ? 520 : 440;

    let iconRight = 0;
    if (desktopRef.current && bounds) {
      desktopRef.current.querySelectorAll<HTMLElement>('[data-desktop-icon]').forEach(button => {
        iconRight = Math.max(iconRight, button.getBoundingClientRect().right - bounds.left);
      });
    }
    const besideIconsX = iconRight > 0 ? Math.ceil(iconRight) + 10 : 60;
    const widthBesideIcons = desktopWidth - besideIconsX - 12;

    const size = widthBesideIcons >= 320
      ? { width: Math.min(desiredWidth, widthBesideIcons), height: Math.min(desiredHeight, availableHeight) }
      : { width: Math.min(desiredWidth, availableWidth), height: Math.min(desiredHeight, availableHeight) };
    const position = {
      x: widthBesideIcons >= 320
        ? besideIconsX
        : Math.max(8, Math.min(60, desktopWidth - size.width - 12)),
      y: Math.max(8, Math.min(40, desktopHeight - taskbarHeight - size.height - 12)),
    };

    openWindow({
      appId,
      customState: customState ?? {},
      defaultPosition: position,
      defaultSize: size,
      minSize: {
        width: Math.min(isPulse ? 340 : 320, size.width),
        height: Math.min(isPulse ? 300 : 220, size.height),
      },
    });
  };

  const openDocument = (path: string) => open('notepad', { filePath: path });
  const openInstaller = (path: string) => open('installer', { filePath: path });
  const openArchive = (path: string) => open('zipmate', { archivePath: path });
  const openArtwork = (path: string) => open('photobox', { artworkPath: path });
  const openAudio = (path: string) => open('retroamp', { audioPath: path });

  const refreshDesktop = () => {
    void Promise.all([session.read({ kind: 'desktop' }), session.read({ kind: 'chrome' })])
      .then(([nextDesktop, nextChrome]) => {
        setDesktop(nextDesktop);
        setChrome(nextChrome);
        setError(null);
      }).catch(cause => setError(String(cause)));
  };

  const contextForIcon = (icon: DesktopIconItem, x: number, y: number) => {
    setContextMenu({
      x, y, label: icon.label, items: [
        { label: 'Open', disabled: icon.disabled, onSelect: () => void open(icon.appId) },
        { label: 'Properties', onSelect: () => setIconDetails(icon), separatorBefore: true },
      ],
    });
  };

  const contextForDesktop = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if (target.closest('[data-desktop-icon]')) return;
    const windowElement = target.closest<HTMLElement>('[data-testid^="worker-window-"]');
    if (windowElement) {
      const appId = windowElement.dataset.testid?.replace(/^worker-window-/, '') ?? '';
      const window = Object.values(useWindowStore.getState().windows)
        .find(win => win.isOpen && win.appId === appId);
      if (window) {
        setContextMenu({
          x: event.clientX, y: event.clientY, label: window.title || 'Application',
          items: [
            { label: 'Minimize window', onSelect: () => useWindowStore.getState().minimizeWindow(window.id) },
            { label: 'Close window', onSelect: () => closeWindow(window.id) },
          ],
        });
      }
      return;
    }
    if (target.closest('[data-testid="worker-desktop-taskbar"]')) return;
    setContextMenu({
      x: event.clientX, y: event.clientY, label: 'Orion Desktop',
      items: [
        { label: 'Refresh desktop', onSelect: refreshDesktop },
        { label: 'My Computer', onSelect: () => void open('fileexplorer') },
        { label: 'Display & system settings', onSelect: () => void open('system'), separatorBefore: true },
      ],
    });
  };

  const shellStyle = {
    fontFamily: profile?.uiFontStack ?? 'Tahoma, sans-serif',
    fontSize: profile ? `${profile.baseFontSizePx}px` : undefined,
    '--os-taskbar-height': `${profile?.shell.taskbarHeightPx ?? 28}px`,
    '--os-icon-cell-width': `${profile?.desktop.iconCellWidthPx ?? 84}px`,
    '--os-icon-cell-height': `${profile?.desktop.iconCellHeightPx ?? 88}px`,
    '--os-icon-glyph-size': `${profile?.desktop.iconGlyphSizePx ?? 38}px`,
  } as CSSProperties;

  // The monitor cannot render an Orion desktop before the owner has booted
  // a genuine installed release. Pre-Orion states instead show a hardware
  // workbench, powered-off machine, or the minimal DOS command environment.
  if (!desktop || !chrome) {
    return <p role="status" data-testid="worker-desktop-loading">Reading physical computer state…</p>;
  }
  if (bootPresentation) {
    return <section data-testid="worker-orion-boot-screen" aria-label="Computer boot screen"
      data-os-theme={profile?.themeId} className="relative flex h-[clamp(380px,68vh,680px)] w-full flex-col items-center justify-center overflow-hidden bg-[#070e1c] text-[#dcefff]">
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_50%_45%,rgba(68,126,190,0.35),transparent_70%)]" />
      <div className="relative text-center">
        <div className="mb-3 text-5xl font-black tracking-[0.18em] drop-shadow-[0_0_25px_rgba(180,218,255,0.65)]">{release ? 'ORION' : 'OAKHAVEN'}</div>
        <div className="text-base tracking-[0.23em]">{release?.displayName ?? 'Oakhaven Compatible DOS'}</div>
        <div className="mx-auto my-8 flex w-28 justify-center gap-3" aria-hidden="true">
          <span className="h-3 w-3 animate-bounce rounded-full bg-sky-300" />
          <span className="h-3 w-3 animate-bounce rounded-full bg-sky-300 [animation-delay:150ms]" />
          <span className="h-3 w-3 animate-bounce rounded-full bg-sky-300 [animation-delay:300ms]" />
        </div>
        <p className="text-xs opacity-70">Initializing system hardware…</p>
      </div>
    </section>;
  }
  if (desktop.pcBootState !== 'desktop') {
    return <WorkerPreOrionShell desktop={desktop} session={session} revision={revision} />;
  }

  return (
    <section
      ref={desktopRef}
      data-testid="worker-desktop"
      data-theme={profile?.themeId}
      data-os-theme={profile?.themeId}
      data-os-wallpaper={profile?.desktop.wallpaperId}
      data-os-icon-style={profile?.desktop.iconStyle}
      data-os-release={chrome?.osVersion ?? undefined}
      aria-label="Orion desktop"
      onContextMenu={contextForDesktop}
      style={shellStyle}
      className="os-desktop h-[clamp(380px,68vh,680px)] w-full"
    >
      <div className="os-desktop-wallpaper" aria-hidden="true" />
      {release && <div className="os-desktop-emblem" aria-hidden="true">ORION</div>}

      <DesktopIconGrid
        icons={desktopIcons}
        onOpen={(icon) => open(icon.appId)}
        onIconContextMenu={(icon, event) => contextForIcon(icon, event.clientX, event.clientY)}
        testId="worker-desktop-icon-grid"
        ariaLabel="Desktop icons"
      />

      {release && (
        <div className="os-desktop-badge" data-testid="worker-desktop-os-badge" data-os-release={release.id}>
          <span className="os-desktop-badge-mark" aria-hidden="true">O</span>
          <span className="os-desktop-badge-copy">
            <strong>{release.displayName}</strong>
            <span>{release.codename} · Build {release.build}</span>
          </span>
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
            availableInstalledApps={installedPrograms.filter(program => program.available).map(program => program.id)}
            osVersion={chrome?.osVersion ?? null}
            openDocument={openDocument} openInstaller={openInstaller}
            openArchive={openArchive} openArtwork={openArtwork} openAudio={openAudio} />
        )}
      />

      <TaskbarChrome contained testId="worker-desktop-taskbar"
        osVersion={chrome?.osVersion ?? null} pulseInstalled={chrome?.pulseInstalled ?? false}
        onStepAway={onStepAway} launchApp={open} browserAppId="browser"
        renderStartMenu={(close, isOpen) => (
          <StartMenuChrome isOpen={isOpen} onClose={close}
            osVersion={chrome?.osVersion ?? null} pulseInstalled={chrome?.pulseInstalled ?? false}
            availableApps={allowedApps} installedPrograms={installedPrograms}
            resolveAppId={resolveAppId}
            launchApp={open} onOpenDialUp={() => open('system')}
            onPowerAction={choice => { void computerPowerAction(choice); }} />
        )}
        tray={<div data-testid="worker-taskbar-tray" className="ml-auto h-full">
          {chrome ? <SystemTrayChrome chrome={chrome}
            onOpenDialUp={() => open('system')} /> : (
            <div role="status" className="os-tray-clock px-2 py-1">--:--</div>
          )}
        </div>}
      />
      {openingAppId && <div role="status" data-testid="worker-app-startup"
        className="pointer-events-none absolute inset-x-0 top-2 z-40 mx-auto w-max max-w-[90%] rounded border border-white/50 bg-slate-900/95 px-4 py-2 font-mono text-xs text-white shadow-xl">
        Opening {openingAppId} on {release?.displayName ?? 'Orion'}…
      </div>}
      {error && <p role="alert" className="os-context-menu absolute bottom-10 right-3 z-50 max-w-sm p-2 text-xs text-red-800">{error}</p>}
      <InGameContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} testId="worker-os-context-menu" />
      {iconDetails && (
        <div role="dialog" aria-label={iconDetails.label + ' properties'} data-testid="worker-icon-properties"
          className="os-context-menu absolute left-1/2 top-1/4 z-[60] w-[min(340px,90%)] -translate-x-1/2 p-3 text-xs">
          <h3 className="mb-2 border-b pb-2 font-bold">{iconDetails.label} — Properties</h3>
          <p>Type: {iconDetails.source === 'installed' ? 'Installed program shortcut' : 'Orion system shortcut'}</p>
          <p>Target: {iconDetails.appId}</p>
          <p>Status: {iconDetails.disabled ? 'Unavailable' : 'Ready'}</p>
          <button type="button" className="os-context-item mt-3 justify-center border" onClick={() => setIconDetails(null)}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}


/** One stable React component identity per app/window, across Worker revisions. */
function WorkerDesktopApp({ window: win, session, revision, osVersion, availableInstalledApps, openDocument, openInstaller, openArchive, openArtwork, openAudio }: {
  window: WindowState;
  session: WorkerGameSession;
  revision: number;
  osVersion: SimulationChromeRead['osVersion'];
  availableInstalledApps: readonly string[];
  openDocument: (path: string) => void;
  openInstaller: (path: string) => void;
  openArchive: (path: string) => void;
  openArtwork: (path: string) => void;
  openAudio: (path: string) => void;
}) {
  // A previously open UI window is not an installation license: after
  // uninstall (or loading a different world) it must not show the old app.
  if (['pulse', 'flashfetch', 'weatherbuddy', 'safesweep', 'retroamp', 'photobox', 'zipmate'].includes(win.appId)
    && !availableInstalledApps.includes(win.appId)) {
    return <p role="status" className="p-3 text-xs text-amber-900">
      Software not installed. Download and run its setup file from My Computer.
    </p>;
  }
  if (win.appId === 'ailab') return <WorkerLabInspectorPanel session={session} revision={revision} />;
  if (win.appId === 'trash') return <WorkerRecycleBinPanel session={session} revision={revision} />;
  if (win.appId === 'addremove') return <WorkerAddRemovePanel session={session} revision={revision} />;
  if (win.appId === 'savegame') return <WorkerSaveLoadPanel session={session} />;
  if (win.appId === 'terminal') return <WorkerTerminalPanel session={session} windowId={win.id}
    osVersion={osVersion} />;
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
