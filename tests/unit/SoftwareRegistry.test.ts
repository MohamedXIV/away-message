import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import { OsVersion } from '../../src/engine/types';

describe('SoftwareRegistry (6-Stage Wizard, Requirements Gating & Adware)', () => {
  let eventBus: EventBus;
  let vfs: FileSystemEngine;
  let registry: SoftwareRegistry;
  let osVersion: OsVersion;
  let ramMb: number;
  let cpuTier: number;

  beforeEach(() => {
    eventBus = new EventBus();
    vfs = new FileSystemEngine(eventBus);
    osVersion = 'Orion_4.8';
    ramMb = 512;
    cpuTier = 1;

    registry = new SoftwareRegistry(eventBus, vfs, {
      getOsVersion: () => osVersion,
      getRamMb: () => ramMb,
      getCpuTier: () => cpuTier,
    });
  });

  it('includes preinstalled Voyager Browser upon initialization', () => {
    expect(registry.isInstalled('app.browser')).toBe(true);
    expect(registry.isInstalled('app.pulse')).toBe(false);
  });

  it('steps through the 6-stage installer wizard for Pulse Messenger 5.2', () => {
    const wizard = registry.startInstallerWizard('sw_pulse_52');
    expect(wizard.currentStage).toBe(1);
    expect(wizard.compatibilityResult.isCompatible).toBe(true);

    // Stage 1 -> 2 (Compatibility)
    const stage2 = registry.advanceInstallerStage(wizard.sessionId, 2);
    expect(stage2.currentStage).toBe(2);

    // Stage 2 -> 3 (Destination)
    const stage3 = registry.advanceInstallerStage(wizard.sessionId, 3);
    expect(stage3.currentStage).toBe(3);

    // Stage 3 -> 4 (Options)
    const stage4 = registry.advanceInstallerStage(wizard.sessionId, 4);
    expect(stage4.currentStage).toBe(4);

    // Complete installation
    const installed = registry.completeInstallation(wizard.sessionId, 10);
    expect(installed.name).toBe('Pulse Messenger');
    expect(installed.appId).toBe('app.pulse');
    expect(registry.isInstalled('app.pulse')).toBe(true);

    // Verify desktop shortcut created in VFS
    const shortcut = vfs.readFile('C:/Desktop/Pulse Messenger.lnk');
    expect(shortcut).toBeDefined();
    expect(shortcut?.kind).toBe('shortcut');
  });

  it('blocks installation of PhotoBox 3.0 when requirements are unmet', () => {
    // PhotoBox requires Orion 6.0 and 768MB RAM; baseline is Orion 4.8 / 512MB
    const wizard = registry.startInstallerWizard('sw_photobox_30');
    expect(wizard.compatibilityResult.isCompatible).toBe(false);
    expect(wizard.compatibilityResult.osCheck.passed).toBe(false);
    expect(wizard.compatibilityResult.ramCheck.passed).toBe(false);

    // Advancing past stage 2 throws compatibility error
    expect(() => {
      registry.advanceInstallerStage(wizard.sessionId, 3);
    }).toThrow('System requirements check failed');
  });

  it('installs WeatherBuddy with optional bundled SearchMate adware toolbar', () => {
    const wizard = registry.startInstallerWizard('sw_weatherbuddy_14');
    expect(wizard.compatibilityResult.isCompatible).toBe(true);
    expect(wizard.softwareDef.isAdware).toBe(true);
    expect(wizard.selectedOptions.acceptedBundledOffers['searchmate_toolbar']).toBe(true);

    const installed = registry.completeInstallation(wizard.sessionId, 20);
    expect(installed.isAdware).toBe(true);
    expect(installed.adwarePayload?.toolbarInjected).toBe(true);
    expect(installed.adwarePayload?.homepageHijacked).toBe('http://searchmate.local');
  });

  it('uninstalls software and cleans up shortcuts from VFS', () => {
    const wizard = registry.startInstallerWizard('sw_retroamp_23');
    const installed = registry.completeInstallation(wizard.sessionId, 30);
    expect(registry.isInstalled('app.retroamp')).toBe(true);
    expect(vfs.readFile('C:/Desktop/RetroAmp Audio Player.lnk')).toBeDefined();

    // Uninstall
    const uninstalledOk = registry.uninstallSoftware(installed.id);
    expect(uninstalledOk).toBe(true);
    expect(registry.isInstalled('app.retroamp')).toBe(false);
    expect(vfs.readFile('C:/Desktop/RetroAmp Audio Player.lnk')).toBeUndefined();
  });
});
