import type { SimulationDesktopRead } from '../../engine/kernel/SimulationPublication';

/** Only apps with real Worker-backed presentation can be launched from installed shortcuts. */
const WORKER_PORTED_APPS: Readonly<Record<string, { id: string; icon: string }>> = {
  'app.pulse': { id: 'pulse', icon: '💬' },
  'app.flashfetch': { id: 'flashfetch', icon: '⚡' },
  'app.weatherbuddy': { id: 'weatherbuddy', icon: '🐸' },
  'app.safesweep': { id: 'safesweep', icon: '🛡️' },
  'app.zipmate': { id: 'zipmate', icon: '📦' },
  'app.retroamp': { id: 'retroamp', icon: '🎵' },
  'app.photobox': { id: 'photobox', icon: '🖼️' },
};
const OTHER_ICONS: Readonly<Record<string, string>> = {};

export interface WorkerInstalledShortcut {
  id: string;
  label: string;
  icon: string;
  appId: string;
  launchId: string | null;
}

/** Owner-published VFS shortcut plus a matching installed software record are both required. */
export function getWorkerInstalledShortcuts(read: Pick<SimulationDesktopRead, 'desktopFiles' | 'installedApps'>):
  WorkerInstalledShortcut[] {
  const installed = new Set(read.installedApps.map(app => app.appId));
  return read.desktopFiles.filter(file =>
    file.parentPath === 'C:/Desktop' &&
    file.kind === 'shortcut' &&
    typeof file.appAssociation === 'string' &&
    installed.has(file.appAssociation)
  ).slice(0, 64).map(file => {
    const appId = file.appAssociation!;
    return {
      id: file.id,
      label: file.name.toLowerCase().endsWith('.lnk') ? file.name.slice(0, -4) : file.name,
      icon: WORKER_PORTED_APPS[appId]?.icon ?? OTHER_ICONS[appId] ?? '📦',
      appId,
      launchId: WORKER_PORTED_APPS[appId]?.id ?? null,
    };
  });
}

/** Start menu shows installed programs even when a UI hasn't yet been migrated. */
export function getWorkerInstalledPrograms(read: Pick<SimulationDesktopRead, 'installedApps'>) {
  return read.installedApps
    .slice(0, 64)
    .map(app => ({
      id: WORKER_PORTED_APPS[app.appId]?.id ?? app.appId,
      label: app.name,
      available: !!WORKER_PORTED_APPS[app.appId],
    }));
}
