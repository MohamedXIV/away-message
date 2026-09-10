import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import { getOsPresentationProfile } from '../../src/desktop/host/OsPresentation';
import type { OsVersion } from '../../src/engine/types';

describe('SoftwareRegistry (6-Stage Wizard, Requirements Gating & Adware)', () => {
  let eventBus: EventBus;
  let vfs: FileSystemEngine;
  let registry: SoftwareRegistry;
  let osVersion: OsVersion | null;
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

  it('does not treat Orion-bundled system components as ordinary installed apps', () => {
    expect(registry.isInstalled('app.browser')).toBe(false);
    expect(registry.isInstalled('app.pulse')).toBe(false);
    expect(registry.getInstalledSoftware()).toEqual([]);

    osVersion = null;
    const noOsRegistry = new SoftwareRegistry(eventBus, vfs, {
      getOsVersion: () => osVersion,
      getRamMb: () => ramMb,
      getCpuTier: () => cpuTier,
    });
    expect(noOsRegistry.getInstalledSoftware()).toEqual([]);
  });

  it('reports None and fails compatibility when no OS is installed', () => {
    osVersion = null;
    const noOsRegistry = new SoftwareRegistry(eventBus, vfs, {
      getOsVersion: () => osVersion,
      getRamMb: () => ramMb,
      getCpuTier: () => cpuTier,
    });

    const wizard = noOsRegistry.startInstallerWizard('sw_pulse_52');
    expect(wizard.compatibilityResult.isCompatible).toBe(false);
    expect(wizard.compatibilityResult.osCheck).toMatchObject({
      passed: false,
      required: 'Orion_4.8',
      current: 'None',
    });
  });

  it('steps through the 6-stage installer wizard for Pulse Messenger 5.2', () => {
    const wizard = registry.startInstallerWizard('sw_pulse_52');
    expect(wizard.currentStage).toBe(1);
    expect(wizard.compatibilityResult.isCompatible).toBe(true);

    const stage2 = registry.advanceInstallerStage(wizard.sessionId, 2);
    expect(stage2.currentStage).toBe(2);
    const stage3 = registry.advanceInstallerStage(wizard.sessionId, 3);
    expect(stage3.currentStage).toBe(3);
    const stage4 = registry.advanceInstallerStage(wizard.sessionId, 4);
    expect(stage4.currentStage).toBe(4);

    const installed = registry.completeInstallation(wizard.sessionId, 10);
    expect(installed.name).toBe('Pulse Messenger');
    expect(installed.appId).toBe('app.pulse');
    expect(registry.isInstalled('app.pulse')).toBe(true);

    const shortcut = vfs.readFile('C:/Desktop/Pulse Messenger.lnk');
    expect(shortcut).toBeDefined();
    expect(shortcut?.kind).toBe('shortcut');
  });

  it('keeps the same Pulse 5.2 install while Orion changes the host presentation', () => {
    const wizard = registry.startInstallerWizard('sw_pulse_52');
    registry.completeInstallation(wizard.sessionId, 10);

    const before = registry.getInstalledSoftware().find((software) => software.appId === 'app.pulse');
    const orion48Presentation = getOsPresentationProfile('Orion_4.8');

    osVersion = 'Orion_7.0';
    const after = registry.getInstalledSoftware().find((software) => software.appId === 'app.pulse');
    const orion70Presentation = getOsPresentationProfile('Orion_7.0');

    expect(before).toMatchObject({ id: 'inst_sw_pulse_52', appId: 'app.pulse', version: '5.2' });
    expect(after).toEqual(before);
    expect(orion70Presentation.themeId).not.toBe(orion48Presentation.themeId);
    expect(orion70Presentation.window.chromeId).not.toBe(orion48Presentation.window.chromeId);
    expect(orion70Presentation.soundSchemeId).not.toBe(orion48Presentation.soundSchemeId);
  });

  it('replaces an older installed release when the same app is upgraded', () => {
    const pulse52 = registry.startInstallerWizard('sw_pulse_52');
    registry.completeInstallation(pulse52.sessionId, 10);

    osVersion = 'Orion_6.0';
    ramMb = 1024;
    const pulse60 = registry.startInstallerWizard('sw_pulse_60');
    registry.completeInstallation(pulse60.sessionId, 20);

    const installedPulse = registry
      .getInstalledSoftware()
      .filter((software) => software.appId === 'app.pulse');

    expect(installedPulse).toHaveLength(1);
    expect(installedPulse[0]).toMatchObject({
      id: 'inst_sw_pulse_60',
      appId: 'app.pulse',
      version: '6.0',
      installedAtMinute: 20,
    });
    expect(osVersion).toBe('Orion_6.0');
  });

  it('blocks installation of PhotoBox 3.0 when requirements are unmet', () => {
    const wizard = registry.startInstallerWizard('sw_photobox_30');
    expect(wizard.compatibilityResult.isCompatible).toBe(false);
    expect(wizard.compatibilityResult.osCheck.passed).toBe(false);
    expect(wizard.compatibilityResult.ramCheck.passed).toBe(false);

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

    const uninstalledOk = registry.uninstallSoftware(installed.id);
    expect(uninstalledOk).toBe(true);
    expect(registry.isInstalled('app.retroamp')).toBe(false);
    expect(vfs.readFile('C:/Desktop/RetroAmp Audio Player.lnk')).toBeUndefined();
  });
});
