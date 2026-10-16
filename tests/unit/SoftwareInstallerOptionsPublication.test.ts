import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import { DesktopStorageCommands } from '../../src/engine/kernel/DesktopStorageCommands';

function fixture(compatible = true) {
  const events = new EventBus();
  const vfs = new FileSystemEngine(events);
  const software = new SoftwareRegistry(events, vfs, {
    getOsVersion: () => compatible ? 'Orion_4.8' : null,
    getRamMb: () => 512,
    getCpuTier: () => 1,
  });
  const publish = vi.fn();
  const telemetry = { logEvent: vi.fn() };
  // Only software, VFS and telemetry are accessed by these two commands.
  const owners = {
    software, vfs, telemetry,
  } as unknown as ConstructorParameters<typeof DesktopStorageCommands>[0];
  const commands = new DesktopStorageCommands(owners, publish);
  return { software, vfs, commands, publish, telemetry };
}

describe('#172 installer owner options and no-op publication', () => {
  it('previews compatibility and defaults without starting a mutable owner session', () => {
    const { software } = fixture();
    const start = vi.spyOn(software, 'startInstallerWizard');
    const first = software.previewInstaller('sw_weatherbuddy_14');
    const second = software.previewInstaller('sw_weatherbuddy_14');
    expect(start).not.toHaveBeenCalled();
    expect(first.compatibilityResult.isCompatible).toBe(true);
    expect(first.selectedOptions.acceptedBundledOffers.searchmate_toolbar).toBe(true);
    first.selectedOptions.acceptedBundledOffers.searchmate_toolbar = false;
    expect(second.selectedOptions.acceptedBundledOffers.searchmate_toolbar).toBe(true);
    expect(software.getInstalledSoftware()).toEqual([]);
    expect(software.previewInstaller('sw_pulse_52').softwareDef.appId).toBe('app.pulse');
  });

  it('honors user opt-outs through the real SOFTWARE_INSTALL action and omits shortcuts', () => {
    const { software, vfs, commands, publish, telemetry } = fixture();
    const installed = commands.dispatch({
      type: 'SOFTWARE_INSTALL',
      softwareId: 'sw_weatherbuddy_14',
      selectedOptions: {
        searchmate_toolbar: false, autorun_startup: false, createDesktopShortcut: false,
        unknown_offer: true,
      },
    }, 720);
    expect(installed?.success).toBe(true);
    const record = software.getInstalledSoftware().find(s => s.appId === 'app.weatherbuddy');
    expect(record?.isAdware).toBe(true);
    expect(record?.adwarePayload).toMatchObject({
      toolbarInjected: false, startupAutorun: false,
    });
    expect(record?.adwarePayload?.homepageHijacked).toBeUndefined();
    expect(record?.shortcuts).toEqual([]);
    expect(vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk')).toBeUndefined();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(telemetry.logEvent).toHaveBeenCalledTimes(1);

    const noOp = commands.dispatch({ type: 'SOFTWARE_UNINSTALL', installedId: 'nonexistent' }, 721);
    expect(noOp?.success).toBe(false);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(telemetry.logEvent).toHaveBeenCalledTimes(1);

    const uninstall = commands.dispatch({ type: 'SOFTWARE_UNINSTALL', installedId: record!.id }, 722);
    expect(uninstall?.success).toBe(true);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(software.getInstalledSoftware()).toEqual([]);
  });

  it('retains default adware/desktop behavior when no options are overridden', () => {
    const { software, vfs, commands } = fixture();
    const result = commands.dispatch({ type: 'SOFTWARE_INSTALL', softwareId: 'sw_weatherbuddy_14' }, 30);
    expect(result?.success).toBe(true);
    const record = software.getInstalledSoftware()[0]!;
    expect(record.adwarePayload?.toolbarInjected).toBe(true);
    expect(record.adwarePayload?.startupAutorun).toBe(true);
    expect(vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk')?.kind).toBe('shortcut');
  });

  it('refuses an incompatible install before allocating an installer session or publication', () => {
    const { software, commands, publish, telemetry } = fixture(false);
    const start = vi.spyOn(software, 'startInstallerWizard');
    const result = commands.dispatch({ type: 'SOFTWARE_INSTALL', softwareId: 'sw_pulse_52' }, 90);
    expect(result?.success).toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(software.getInstalledSoftware()).toEqual([]);
    expect(publish).not.toHaveBeenCalled();
    expect(telemetry.logEvent).not.toHaveBeenCalled();
  });
});
