import { describe, expect, it } from 'vitest';
import { getWorkerInstalledPrograms, getWorkerInstalledShortcuts } from '../../src/simulation/host/WorkerInstalledAppLinks';
import type { SimulationDesktopRead } from '../../src/engine/kernel/SimulationPublication';
type Desktop = Pick<SimulationDesktopRead, 'installedApps' | 'desktopFiles'>;
const make = (installedApps: Desktop['installedApps'], desktopFiles: Desktop['desktopFiles'] = []): Desktop =>
  ({ installedApps, desktopFiles });
const shortcut = (id: string, appAssociation: string, name: string) => ({
  id, appAssociation, name, kind: 'shortcut' as const, parentPath: 'C:/Desktop',
  path: 'C:/Desktop/' + name,
});
describe('Worker-installed software shortcuts', () => {
  it('does not produce icons until a real installed program AND shortcut both exist', () => {
    const file = shortcut('lnk1', 'app.pulse', 'Pulse Messenger.lnk');
    expect(getWorkerInstalledShortcuts(make([], [file]))).toEqual([]);
    expect(getWorkerInstalledShortcuts(make([{ appId: 'app.pulse', name: 'Pulse Messenger', version: '5.2' }]))).toEqual([]);
    expect(getWorkerInstalledShortcuts(make([{ appId: 'app.pulse', name: 'Pulse Messenger', version: '5.2' }], [file])))
      .toEqual([{ id: 'lnk1', label: 'Pulse Messenger', icon: '💬', appId: 'app.pulse', launchId: 'pulse' }]);
  });
  it('respects shortcut opt-out, VFS file kind and unsupported installed app UI', () => {
    const apps = [
      { appId: 'app.pulse', name: 'Pulse Messenger', version: '5.2' },
      { appId: 'app.retroamp', name: 'RetroAmp', version: '2.95' },
      { appId: 'app.flashfetch', name: 'FlashFetch', version: '3.1' },
    ];
    const icons = getWorkerInstalledShortcuts(make(apps, [
      shortcut('r', 'app.retroamp', 'RetroAmp.lnk'),
      shortcut('f', 'app.flashfetch', 'FlashFetch.lnk'),
      { ...shortcut('x', 'app.pulse', 'Spoofed.txt'), kind: 'text' },
      { ...shortcut('y', 'app.pulse', 'Outside.lnk'), parentPath: 'C:/Downloads' },
    ]));
    expect(icons.map(icon => ({ label: icon.label, launchId: icon.launchId }))).toEqual([
      { label: 'RetroAmp', launchId: null },
      { label: 'FlashFetch', launchId: 'flashfetch' },
    ]);
    expect(getWorkerInstalledPrograms(make(apps))).toEqual([
      { id: 'app.retroamp', label: 'RetroAmp', available: false },
      { id: 'flashfetch', label: 'FlashFetch', available: true },
    ]);
  });
  it('enables SafeSweep only when it exists in the canonical installed list', () => {
    const app = { appId: 'app.safesweep', name: 'SafeSweep', version: '2.0' };
    expect(getWorkerInstalledPrograms(make([app]))).toEqual([
      { id: 'safesweep', label: 'SafeSweep', available: true },
    ]);
    expect(getWorkerInstalledShortcuts(make([app], [
      shortcut('s', 'app.safesweep', 'SafeSweep.lnk'),
    ]))[0]).toMatchObject({ launchId: 'safesweep' });
    expect(getWorkerInstalledShortcuts(make([], [
      shortcut('s', 'app.safesweep', 'SafeSweep.lnk'),
    ]))).toEqual([]);
  });

  it('enables WeatherBuddy only when the Worker-owned install record exists', () => {
    const weather = { appId: 'app.weatherbuddy', name: 'WeatherBuddy', version: '1.4' };
    expect(getWorkerInstalledPrograms(make([]))).toEqual([]);
    expect(getWorkerInstalledPrograms(make([weather]))).toEqual([
      { id: 'weatherbuddy', label: 'WeatherBuddy', available: true },
    ]);
    expect(getWorkerInstalledShortcuts(make([weather], [
      shortcut('wb', 'app.weatherbuddy', 'WeatherBuddy.lnk'),
    ]))[0]).toMatchObject({ label: 'WeatherBuddy', launchId: 'weatherbuddy' });
  });
});
