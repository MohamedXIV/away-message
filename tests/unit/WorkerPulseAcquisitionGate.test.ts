import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildWorkerDesktopIcons, getWorkerSystemDesktopIcons } from '../../src/simulation/host/workerDesktopIcons';
import { getWorkerInstalledPrograms, getWorkerInstalledShortcuts } from '../../src/simulation/host/WorkerInstalledAppLinks';
import type { SimulationDesktopRead } from '../../src/engine/kernel/SimulationPublication';
import { DOWNLOAD_CATALOG } from '../../src/internet/sites/DownloadHubCatalog';
import { INSTALLER_SOFTWARE_IDS } from '../../src/engine/InstallerFileCatalog';

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('#214 clean Orion software ownership', () => {
  it('contains no OS-bundled Pulse or FlashFetch system launch targets', () => {
    const coreIds = getWorkerSystemDesktopIcons().map(icon => icon.appId);
    expect(coreIds).not.toContain('pulse');
    expect(coreIds).not.toContain('flashfetch');
    expect(source('../../src/simulation/host/WorkerGameShell.tsx'))
      .not.toContain("panel === 'pulse'");
    expect(source('../../src/desktop/SystemTrayChrome.tsx'))
      .toContain('chrome.pulseInstalled &&');
  });

  it('the genuine download catalog maps the real Pulse exe into the generic installer', () => {
    const published = DOWNLOAD_CATALOG.find(item => item.id === 'pulse_52');
    expect(published?.downloadUrl).toBe('http://downloadhub.local/files/pulse52_setup.exe');
    expect(INSTALLER_SOFTWARE_IDS.pulse52_setup.exe).toBe('sw_pulse_52');
  });

  it('only publishes an installed Pulse shortcut from canonical owner desktop files', () => {
    const blank = { installedApps: [], desktopFiles: [] } as unknown as SimulationDesktopRead;
    expect(getWorkerInstalledPrograms(blank)).toEqual([]);
    expect(buildWorkerDesktopIcons(getWorkerInstalledShortcuts(blank)).some(icon => icon.appId === 'pulse')).toBe(false);

    const withRecord = { ...blank,
      installedApps: [{ appId: 'app.pulse', name: 'Pulse Messenger' }],
      desktopFiles: [{ id: 'pulse-shortcut', kind: 'shortcut', parentPath: 'C:/Desktop',
        appAssociation: 'app.pulse', name: 'Pulse Messenger.lnk' }],
    } as unknown as SimulationDesktopRead;
    expect(getWorkerInstalledPrograms(withRecord).map(program => program.id)).toContain('pulse');
    expect(buildWorkerDesktopIcons(getWorkerInstalledShortcuts(withRecord))
      .filter(icon => icon.appId === 'pulse')).toHaveLength(1);

    const withoutRecord = { ...withRecord, installedApps: [] } as unknown as SimulationDesktopRead;
    expect(getWorkerInstalledShortcuts(withoutRecord)).toEqual([]);
    expect(buildWorkerDesktopIcons(getWorkerInstalledShortcuts(withoutRecord)).some(icon => icon.appId === 'pulse')).toBe(false);
  });

  it('does not authorize direct launch from static desktop routes or stale windows', () => {
    const file = source('../../src/simulation/host/WorkerDesktop.tsx');
    expect(file).toContain("!installedPrograms.some(program => program.available && program.id === appId)");
    expect(file).toContain("!availableInstalledApps.includes(win.appId)");
    expect(file).not.toContain("'controlpanel', 'pulse', 'trash'");
  });
});
