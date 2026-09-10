import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const windowFrameSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/WindowFrame.tsx', import.meta.url)),
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

const startMenuSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/StartMenu.tsx', import.meta.url)),
  'utf8',
);

const osThemeCssSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/themes/os-themes.css', import.meta.url)),
  'utf8',
);

describe('central desktop OS presentation routing', () => {
  it('does not route Orion generations with per-component version string checks', () => {
    for (const source of [windowFrameSource, desktopShellSource, taskbarSource, startMenuSource]) {
      expect(source).not.toContain("version.includes('5.')");
      expect(source).not.toContain("version.includes('6.')");
      expect(source).not.toContain("version.includes('7.')");
      expect(source).not.toContain("v.includes('5.')");
      expect(source).not.toContain("v.includes('6.')");
      expect(source).not.toContain("v.includes('7.')");
      expect(source).not.toContain("osVersion === 'Orion_6.0'");
    }
  });

  it('routes taskbar presentation through the central OS profile', () => {
    expect(taskbarSource).toContain('getOsPresentationProfile');
    expect(taskbarSource).toContain('osPresentation?.shell.taskbarId');
    expect(taskbarSource).toContain('data-os-taskbar={taskbarPresentation}');
  });

  it('routes start-menu presentation through the central OS profile', () => {
    expect(startMenuSource).toContain('getOsPresentationProfile');
    expect(startMenuSource).toContain('osPresentation?.shell.startMenuId');
    expect(startMenuSource).toContain('data-os-start-menu={startMenuPresentation}');
    expect(startMenuSource).not.toContain('Orion <b>4.8</b>');
  });

  it('routes WindowFrame sounds from the resolved nullable OS presentation scheme', () => {
    expect(windowFrameSource).toContain('osPresentation?.soundSchemeId');
    expect(windowFrameSource).not.toMatch(/playWindowSound\([^\n]*osVersion/);
  });

  it('routes rendered window animation through the central transition resolver and honors reduced motion', () => {
    expect(windowFrameSource).toContain('resolveWindowTransition');
    expect(windowFrameSource).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(windowFrameSource).toContain("resolveWindowTransition(osPresentation, 'open', reducedMotion)");
    expect(windowFrameSource).toContain('data-os-window-animation={windowOpenTransition}');
    expect(osThemeCssSource).toContain('[data-os-window-animation="classic-scale"]');
    expect(osThemeCssSource).toContain('[data-os-window-animation="soft-scale"]');
    expect(osThemeCssSource).toContain('[data-os-window-animation="gloss-zoom"]');
    expect(osThemeCssSource).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('routes close and minimize through OS-owned exit transitions before committing lifecycle state', () => {
    expect(windowFrameSource).toContain("beginExitAction('close')");
    expect(windowFrameSource).toContain("beginExitAction('minimize')");
    expect(windowFrameSource).toContain('resolveWindowTransition(osPresentation, action, reducedMotion)');
    expect(windowFrameSource).toContain('data-os-window-transition-phase={pendingExitAction ? \'exit\' : \'enter\'}');
    expect(windowFrameSource).toContain('onAnimationEnd={handleLifecycleAnimationEnd}');
    expect(osThemeCssSource).toContain('[data-os-window-transition-phase="exit"]');
  });
});
