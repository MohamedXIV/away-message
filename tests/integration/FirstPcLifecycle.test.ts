import { describe, expect, it } from 'vitest';
import { getOsPresentationProfile } from '../../src/desktop/host/OsPresentation';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function ownedInstance(engine: SimulationEngine, catalogItemId: string): string {
  const item = engine.getState().inventory.items.find((entry) => entry.catalogItemId === catalogItemId);
  expect(item, `owned ${catalogItemId}`).toBeDefined();
  return item!.instanceId;
}

function installedPulse52(engine: SimulationEngine) {
  return engine.software
    .getInstalledSoftware()
    .find((software) => software.appId === 'app.pulse');
}

describe('Issue #14 canonical first-PC lifecycle', () => {
  it('composes purchase, setup, no-OS boot, OS/app installs, independent display replacement, and save/reload', () => {
    const engine = new SimulationEngine();

    // 1. Fresh game: Room 104 starts with no machine, display, OS, or Pulse.
    expect(engine.getState().time.day).toBe(1);
    expect(engine.getState().player.location).toBe('home');
    expect(engine.getPcBootState()).toBe('no_computer');
    expect(engine.getState().computer.assembled).toBe(false);
    expect(engine.getState().display.monitor).toBeNull();
    expect(engine.getState().os.currentOsId).toBeNull();
    expect(installedPulse52(engine)).toBeUndefined();

    // 2. Travel to Silicon & Spares, buy the $35 physical starter package exactly once.
    expect(engine.dispatchAction({ type: 'TRAVEL_TO', to: 'techmart', mode: 'walk' }).success).toBe(true);
    const cashBeforeStarter = engine.getState().player.cash;
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(engine.getState().player.cash).toBe(cashBeforeStarter - 35);
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(false);
    expect(engine.getState().inventory.items).toHaveLength(10);
    expect(engine.getState().inventory.items.every((item) => item.location === 'room_package')).toBe(true);
    expect(engine.getState().computer.assembled).toBe(false);
    expect(engine.getState().display.monitor).toBeNull();
    expect(engine.getState().os.currentOsId).toBeNull();

    // 3. Return to Room 104 and assemble once; OS media stays a separate owned disc.
    expect(engine.dispatchAction({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' }).success).toBe(true);
    const setupStart = engine.getState().time.totalMinutes;
    expect(engine.setupComputerAtHome().success).toBe(true);
    expect(engine.getState().time.totalMinutes).toBe(setupStart + 15);
    expect(engine.setupComputerAtHome().success).toBe(false);
    expect(engine.getState().time.totalMinutes).toBe(setupStart + 15);
    expect(engine.getPcBootState()).toBe('powered_off');
    expect(engine.getState().computer.assembled).toBe(true);
    expect(engine.getState().computer.poweredOn).toBe(false);
    expect(engine.getState().display.monitor?.id).toBe('mon_beige_curved_14');
    expect(engine.getState().os.currentOsId).toBeNull();
    const orion48Disc = ownedInstance(engine, 'media_orion_48_setup');
    expect(engine.getState().inventory.items.find((item) => item.instanceId === orion48Disc)?.location).toBe('room_package');

    // 4. A real powered machine without an OS resolves to the no-boot-device state.
    expect(engine.setComputerPower(true).success).toBe(true);
    expect(engine.getPcBootState()).toBe('no_boot_device');
    expect(engine.getState().os.currentOsId).toBeNull();

    // 5. Install Orion 4.8 from the exact owned physical setup disc.
    expect(engine.insertOwnedMediaAtHome(orion48Disc).success).toBe(true);
    const freshInstall = engine.prepareOsInstallFromInsertedMedia();
    expect(freshInstall.success).toBe(true);
    expect(freshInstall.data).toMatchObject({ targetOs: 'Orion_4.8', mode: 'fresh' });
    const freeBeforeOrion48 = engine.getState().computer.storage[0]!.freeBytes;
    const timeBeforeOrion48 = engine.getState().time.totalMinutes;
    expect(engine.commitOsInstall(freshInstall.data!).success).toBe(true);
    expect(engine.getState().os.currentOsId).toBe('Orion_4.8');
    expect(engine.getPcBootState()).toBe('desktop');
    expect(engine.getState().time.totalMinutes - timeBeforeOrion48).toBe(freshInstall.data!.durationMinutes);
    expect(freeBeforeOrion48 - engine.getState().computer.storage[0]!.freeBytes).toBe(freshInstall.data!.installSizeBytes);
    expect(installedPulse52(engine)).toBeUndefined();

    // 6. Pulse is an ordinary independent app installed through the generic software path.
    const pulseInstaller = engine.software.startInstallerWizard('sw_pulse_52');
    expect(pulseInstaller.compatibilityResult.isCompatible).toBe(true);
    const installedPulse = engine.software.completeInstallation(
      pulseInstaller.sessionId,
      engine.getState().time.totalMinutes,
    );
    expect(installedPulse).toMatchObject({ appId: 'app.pulse', version: '5.2' });
    expect(installedPulse52(engine)).toMatchObject({ appId: 'app.pulse', version: '5.2' });

    // Earn later-upgrade money through the public economy API; starter price remains independently proven above.
    engine.economy.earnCash(200, '#14 integration fixture earnings');
    expect(engine.ejectOwnedMediaAtHome().success).toBe(true);
    expect(engine.dispatchAction({ type: 'TRAVEL_TO', to: 'techmart', mode: 'walk' }).success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'part_ram_128mb').success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'disc_orion_50').success).toBe(true);
    expect(engine.purchaseStoreItem('silicon_spares', 'part_mon_trinitron').success).toBe(true);
    expect(engine.dispatchAction({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' }).success).toBe(true);

    const extraRam = ownedInstance(engine, 'ram_sdram_128');
    expect(engine.installOwnedHardwareAtHome(extraRam, 'ram:1').success).toBe(true);
    expect(engine.getState().computer.ramSticks.reduce((sum, stick) => sum + stick.sizeMb, 0)).toBe(192);

    // 7. Upgrade Orion through owned media while the same Pulse 5.2 installation survives unchanged.
    const pulseBeforeOsUpgrade = installedPulse52(engine);
    const orion48Presentation = getOsPresentationProfile('Orion_4.8');
    const orion50Disc = ownedInstance(engine, 'media_orion_50_setup');
    expect(engine.insertOwnedMediaAtHome(orion50Disc).success).toBe(true);
    const osUpgrade = engine.prepareOsInstallFromInsertedMedia();
    expect(osUpgrade.success).toBe(true);
    expect(osUpgrade.data).toMatchObject({ targetOs: 'Orion_5.0', mode: 'upgrade' });
    expect(engine.commitOsInstall(osUpgrade.data!).success).toBe(true);
    expect(engine.getState().os.currentOsId).toBe('Orion_5.0');
    expect(installedPulse52(engine)).toEqual(pulseBeforeOsUpgrade);
    const orion50Presentation = getOsPresentationProfile('Orion_5.0');
    expect(orion50Presentation.themeId).not.toBe(orion48Presentation.themeId);
    expect(orion50Presentation.window.chromeId).not.toBe(orion48Presentation.window.chromeId);
    expect(orion50Presentation.soundSchemeId).not.toBe(orion48Presentation.soundSchemeId);

    // 8. Replace only the monitor: physical display profile changes while OS and Pulse stay fixed.
    const osBeforeMonitorSwap = engine.getState().os;
    const pulseBeforeMonitorSwap = installedPulse52(engine);
    const budgetMonitor = engine.getState().display.monitor!;
    const trinitron = ownedInstance(engine, 'mon_trinitron_17');
    expect(engine.installOwnedHardwareAtHome(trinitron, 'monitor:0').success).toBe(true);
    expect(engine.getState().display.monitor).toMatchObject({
      id: 'mon_trinitron_17',
      curvature: 0,
      scanlineIntensity: 0.2,
      bloomIntensity: 0.15,
      flicker: false,
    });
    expect(engine.getState().display.monitor?.curvature).not.toBe(budgetMonitor.curvature);
    expect(engine.getState().os).toEqual(osBeforeMonitorSwap);
    expect(installedPulse52(engine)).toEqual(pulseBeforeMonitorSwap);

    // 10. Stable final state survives export/reload without reconstituting or duplicating hardware/software.
    const finalSnapshot = engine.exportSnapshot();
    const restored = new SimulationEngine();
    restored.loadSnapshot(finalSnapshot);
    expect(restored.getState().inventory).toEqual(finalSnapshot.inventory);
    expect(restored.getState().computer).toEqual(finalSnapshot.computer);
    expect(restored.getState().display).toEqual(finalSnapshot.display);
    expect(restored.getState().os).toEqual(finalSnapshot.os);
    expect(restored.software.getInstalledSoftware()).toEqual(finalSnapshot.installedSoftware);
    expect(restored.getPcBootState()).toBe('desktop');
    expect(restored.getState().inventory.items.map((item) => item.instanceId).length)
      .toBe(new Set(restored.getState().inventory.items.map((item) => item.instanceId)).size);
  });
});
