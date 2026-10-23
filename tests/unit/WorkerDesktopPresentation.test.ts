import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildWorkerDesktopIcons,
  getWorkerSystemDesktopIcons,
} from '../../src/simulation/host/workerDesktopIcons';
import type { WorkerInstalledShortcut } from '../../src/simulation/host/WorkerInstalledAppLinks';

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const workerDesktopSource = source('../../src/simulation/host/WorkerDesktop.tsx');
const osThemeCss = source('../../src/desktop/themes/os-themes.css');
const desktopIconGridSource = source('../../src/desktop/DesktopIconGrid.tsx');
const windowChromeSource = source('../../src/desktop/WindowFrameChrome.tsx');

const shortcut = (overrides: Partial<WorkerInstalledShortcut>): WorkerInstalledShortcut => ({
  id: 'shortcut',
  label: 'Installed App',
  icon: '',
  appId: 'app.installed',
  launchId: 'installed',
  ...overrides,
});

describe('Worker Orion desktop presentation', () => {
  it('keeps the canonical shell rails on the desktop without inventing software', () => {
    const icons = getWorkerSystemDesktopIcons();
    expect(icons.map((icon) => icon.appId)).toEqual(expect.arrayContaining([
      'fileexplorer', 'browser', 'notepad', 'terminal', 'publicweb', 'system',
      'mailbox', 'trash', 'addremove', 'savegame', 'ailab', 'pulse', 'flashfetch',
    ]));
    expect(new Set(icons.map((icon) => icon.label)).size).toBe(icons.length);
    expect(icons.every((icon) => icon.source === 'system')).toBe(true);
  });

  it('adds only canonical installed shortcuts and deduplicates core launch targets', () => {
    const icons = buildWorkerDesktopIcons([
      shortcut({ id: 'pulse-shortcut', label: 'Pulse Messenger', appId: 'app.pulse', launchId: 'pulse' }),
      shortcut({ id: 'browser-shortcut', label: 'Voyager Browser', appId: 'app.browser', launchId: 'browser' }),
      shortcut({ id: 'weather', label: 'WeatherBuddy', appId: 'app.weatherbuddy', launchId: 'weatherbuddy' }),
      shortcut({ id: 'photo', label: 'PhotoBox 3.0', appId: 'app.photobox', launchId: null }),
      shortcut({ id: 'weather', label: 'WeatherBuddy', appId: 'app.weatherbuddy', launchId: 'weatherbuddy' }),
    ]);
    const installed = icons.filter((icon) => icon.source === 'installed');
    expect(installed.map((icon) => icon.label)).toEqual(['WeatherBuddy', 'PhotoBox 3.0']);
    expect(installed[0]).toMatchObject({ disabled: false, kind: 'weather' });
    expect(installed[1]).toMatchObject({ disabled: true, kind: 'photo' });
    expect(installed[1]?.title).toContain('Worker UI not migrated yet');
  });

  it('presents the installed OS as an in-world desktop, not a Worker diagnostic label', () => {
    expect(workerDesktopSource).toContain('data-os-wallpaper');
    expect(workerDesktopSource).toContain('data-os-icon-style');
    expect(workerDesktopSource).toContain('DesktopIconGrid');
    expect(workerDesktopSource).toContain('buildWorkerDesktopIcons');
    expect(workerDesktopSource).toContain('worker-desktop-os-badge');
    expect(workerDesktopSource).not.toContain('Worker-backed desktop');
    expect(workerDesktopSource).not.toContain('w-28 flex-col');
  });

  it('flows icons into responsive columns and keeps one visible focus path', () => {
    expect(osThemeCss).toContain('.os-desktop-icon-grid');
    expect(osThemeCss).toContain('flex-flow: column wrap');
    expect(osThemeCss).toContain('[data-os-wallpaper="harbor_classic"]');
    expect(osThemeCss).toContain('[data-os-wallpaper="aperture_sand"]');
    expect(osThemeCss).toContain('[data-os-wallpaper="canal_bliss"]');
    expect(osThemeCss).toContain('[data-os-wallpaper="lumen_gloss"]');
    expect(osThemeCss).toContain('.os-desktop-icon:focus-visible');
    expect(osThemeCss).toContain('.os-desktop-icon[data-selected="true"]');
    expect(desktopIconGridSource).toContain("event.key === 'ArrowDown'");
    expect(desktopIconGridSource).toContain("event.key === 'ArrowRight'");
    expect(desktopIconGridSource).toContain('data-desktop-icon');
  });

  it('keeps the authored shell controls reachable inside the contained desktop', () => {
    expect(windowChromeSource).toContain('offsetParent');
    expect(windowChromeSource).toContain('taskbarHeightPx');
    expect(osThemeCss).toContain('.os-start-button:focus-visible');
    expect(osThemeCss).toContain('.os-task-button:focus-visible');
    expect(osThemeCss).toContain('.os-tray-button:focus-visible');
    expect(osThemeCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(osThemeCss).toContain('.os-desktop-icon,');
  });
});
