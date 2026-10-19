import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const windowFrameSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowFrame.tsx', import.meta.url)),
  'utf8',
);

const windowChromeSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowFrameChrome.tsx', import.meta.url)),
  'utf8',
);

const desktopShellSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/DesktopShell.tsx', import.meta.url)),
  'utf8',
);

const taskbarSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/Taskbar.tsx', import.meta.url)),
  'utf8',
);

const windowManagerSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowManager.tsx', import.meta.url)), 'utf8',
);
const windowManagerChromeSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowManagerChrome.tsx', import.meta.url)), 'utf8',
);

const taskbarChromeSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/TaskbarChrome.tsx', import.meta.url)), 'utf8',
);

const startMenuSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/StartMenu.tsx', import.meta.url)),
  'utf8',
);

const startMenuChromeSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/StartMenuChrome.tsx', import.meta.url)), 'utf8',
);

const systemTraySource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/SystemTray.tsx', import.meta.url)), 'utf8',
);
const systemTrayChromeSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/SystemTrayChrome.tsx', import.meta.url)), 'utf8',
);

const osThemeCssSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/themes/os-themes.css', import.meta.url)),
  'utf8',
);

describe('central desktop OS presentation routing', () => {
  it('does not route Orion generations with per-component version string checks', () => {
    for (const source of [windowFrameSource, windowChromeSource, desktopShellSource, taskbarSource, taskbarChromeSource, startMenuSource, startMenuChromeSource]) {
      expect(source).not.toContain("version.includes('5.')");
      expect(source).not.toContain("version.includes('6.')");
      expect(source).not.toContain("version.includes('7.')");
      expect(source).not.toContain("v.includes('5.')");
      expect(source).not.toContain("v.includes('6.')");
      expect(source).not.toContain("v.includes('7.')");
      expect(source).not.toContain("osVersion === 'Orion_6.0'");
    }
  });

  it('keeps the legacy engine adapter out of the shared Worker window chrome', () => {
    expect(windowFrameSource).toContain('useSimulationChrome');
    expect(windowFrameSource).toContain('OsHostProvider');
    expect(windowFrameSource).toContain('<WindowFrameChrome');
    expect(windowChromeSource).toContain('osVersion: OsVersion | null');
    expect(windowChromeSource).toContain('useWindowStore');
    expect(windowChromeSource).not.toContain("from '../store/useBoundedSimulationRead'");
    expect(windowChromeSource).not.toContain("from '../store/useSimulationStore'");
    expect(windowChromeSource).not.toContain("from './host/OsHostContext'");
    expect(windowChromeSource).not.toContain('<OsHostProvider');
  });

  it('isolates authored taskbar and Start Menu from the legacy synchronous adapters', () => {
    expect(taskbarSource).toContain('<TaskbarChrome');
    expect(startMenuSource).toContain('<StartMenuChrome');
    for (const source of [taskbarChromeSource, startMenuChromeSource]) {
      expect(source).not.toContain('useSimulationStore');
      expect(source).not.toContain('useSimulationChrome');
      expect(source).not.toContain('OsHostProvider');
    }
    expect(startMenuChromeSource).toContain('availableApps');
  });

  it('routes bounded SystemTray Chrome reads without importing legacy simulation in Worker', () => {
    expect(systemTraySource).toContain("engine.events.on('social:message_received'");
    expect(systemTraySource).toContain('<SystemTrayChrome');
    expect(systemTrayChromeSource).toContain('SimulationChromeRead');
    expect(systemTrayChromeSource).toContain('chrome.unreadCount');
    expect(systemTrayChromeSource).toContain('chrome.connectionSpeedKbps');
    expect(systemTrayChromeSource).not.toContain('useSimulationStore');
    expect(systemTrayChromeSource).not.toContain('useSimulationChrome');
    expect(systemTrayChromeSource).not.toContain('engine.events');
  });

  it('shares real window lifecycle without the synchronous app registry on the Worker entry', () => {
    expect(windowManagerSource).toContain("import { TerminalApp }");
    expect(windowManagerSource).toContain('<WindowManagerChrome');
    expect(windowManagerChromeSource).toContain("e.altKey && e.key === 'F4'");
    expect(windowManagerChromeSource).toContain("e.altKey && e.key === 'Tab'");
    expect(windowManagerChromeSource).toContain("win.isFrameless");
    expect(windowManagerChromeSource).toContain('renderApp(win)');
    expect(windowManagerChromeSource).toContain('renderFrame(win, isActive, app)');
    expect(windowManagerChromeSource).not.toContain('SimulationEngine');
    expect(windowManagerChromeSource).not.toContain('useSimulationStore');
    expect(windowManagerChromeSource).not.toContain('VoyagerBrowserApp');
    expect(windowManagerChromeSource).not.toContain('DefaultAppPlaceholder');
  });

  it('routes taskbar presentation through the central OS profile', () => {
    expect(taskbarChromeSource).toContain('getOsPresentationProfile');
    expect(taskbarChromeSource).toContain('osPresentation?.shell.taskbarId');
    expect(taskbarChromeSource).toContain('data-os-taskbar={taskbarPresentation}');
  });

  it('routes start-menu presentation through the central OS profile', () => {
    expect(startMenuChromeSource).toContain('getOsPresentationProfile');
    expect(startMenuChromeSource).toContain('osPresentation?.shell.startMenuId');
    expect(startMenuChromeSource).toContain('data-os-start-menu={startMenuPresentation}');
    expect(startMenuChromeSource).not.toContain('Orion <b>4.8</b>');
  });

  it('routes WindowFrame sounds from the resolved nullable OS presentation scheme', () => {
    expect(windowChromeSource).toContain('osPresentation?.soundSchemeId');
    expect(windowChromeSource).not.toMatch(/playWindowSound\([^\n]*osVersion/);
  });

  it('routes rendered window animation through the central transition resolver and honors reduced motion', () => {
    expect(windowChromeSource).toContain('resolveWindowTransition');
    expect(windowChromeSource).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(windowChromeSource).toContain("resolveWindowTransition(osPresentation, 'open', reducedMotion)");
    expect(windowChromeSource).toContain('data-os-window-animation={windowOpenTransition}');
    expect(osThemeCssSource).toContain('[data-os-window-animation="classic-scale"]');
    expect(osThemeCssSource).toContain('[data-os-window-animation="soft-scale"]');
    expect(osThemeCssSource).toContain('[data-os-window-animation="gloss-zoom"]');
    expect(osThemeCssSource).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('routes close and minimize through OS-owned exit transitions before committing lifecycle state', () => {
    expect(windowChromeSource).toContain("beginExitAction('close')");
    expect(windowChromeSource).toContain("beginExitAction('minimize')");
    expect(windowChromeSource).toContain('resolveWindowTransition(osPresentation, action, reducedMotion)');
    expect(windowChromeSource).toContain('data-os-window-transition-phase={pendingExitAction ? \'exit\' : \'enter\'}');
    expect(windowChromeSource).toContain('onAnimationEnd={handleLifecycleAnimationEnd}');
    expect(osThemeCssSource).toContain('[data-os-window-transition-phase="exit"]');
  });
});
