import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/persistence/db';
import { saveSlot, loadSlotSnapshot, loadSlotEngine, slotCompatibility } from '../../src/persistence/slots';
import { conversationArchivePageKey, type ConversationArchiveManifest } from '../../src/persistence/conversationArchive';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { HardwareEngine } from '../../src/engine/HardwareEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { OsEngine } from '../../src/engine/OsEngine';
import { createPowerWorkstationBundle } from '../../src/engine/hardware/catalog';
import type { DownloadTask } from '../../src/engine/types';

/**
 * #174 replaces the old multi-table SaveManager stress paths with the ACTUAL
 * shipping slot document, owner-bound Social history and cold archive. Suites
 * 3/4 below retain the original hardware/software/adware adversarial checks.
 */
describe('Adversarial M1 Stress & Gating Suite', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.saves, db.conversation_pages, async () => {
      await db.saves.clear();
      await db.conversation_pages.clear();
    });
  });

  describe('Suite 1: Current-format high-frequency slot and simulation integrity', () => {
    it('survives 100 rapid sequential saves across five reusable slots', async () => {
      const sim = new SimulationEngine();
      const actor = sim.social.getBuddies()[0]!;
      for (let i = 1; i <= 100; i++) {
        sim.social.sendMessage(actor.id, actor.id, 'player', `stress-${i}`, 500 + i);
        await saveSlot(sim, `slot_${i % 5}`, `Save Seq ${i}`);
        const loaded = (await loadSlotSnapshot(`slot_${i % 5}`))!;
        expect(loaded.social.conversations[actor.id]).toHaveLength(i);
        expect(loaded.social.conversations[actor.id]!.at(-1)!.text).toBe(`stress-${i}`);
        expect(new SimulationEngine(loaded).social.getMessages(actor.id)).toHaveLength(i);
      }
    });

    it('commits 25 concurrent distinct slot saves without cross-slot corruption', async () => {
      const runs = Array.from({ length: 25 }, (_, i) => {
        const sim = new SimulationEngine();
        const actor = sim.social.getBuddies()[0]!;
        sim.social.sendMessage(actor.id, 'player', actor.id, `unique-${i}`, 1000 + i);
        return { sim, actorId: actor.id, id: `racing_${i}`, text: `unique-${i}` };
      });
      await Promise.all(runs.map(run => saveSlot(run.sim, run.id)));
      for (const run of runs) {
        const loaded = (await loadSlotSnapshot(run.id))!;
        expect(loaded.social.conversations[run.actorId]?.at(-1)?.text).toBe(run.text);
        expect((await slotCompatibility(run.id)).status).toBe('ok');
      }
      expect(await db.saves.count()).toBe(25);
    });

    it('preserves actual DownloadTask states and progress in the canonical snapshot', async () => {
      const base = new SimulationEngine();
      const tasks: DownloadTask[] = [
        { id: 'dl_task_1', sourceId: 'downloadhub', sourceUrl: 'http://downloadhub.local/file1.zip',
          fileName: 'file1.zip', targetDirectory: 'C:/Downloads', totalBytes: 10_000_000,
          downloadedBytes: 5_500_000, sourceMaxKbps: 512, allocatedKbps: 256,
          status: 'downloading', resumable: true, manager: 'browser',
          startedAtMinute: 1000, fileKind: 'archive' },
        { id: 'dl_task_2', sourceId: 'techmart', sourceUrl: 'http://techmart.local/driver.exe',
          fileName: 'driver.exe', targetDirectory: 'C:/Downloads', totalBytes: 2_000_000,
          downloadedBytes: 1_000_000, sourceMaxKbps: 256, allocatedKbps: 0,
          status: 'paused', resumable: true, manager: 'flashfetch',
          startedAtMinute: 1050, fileKind: 'installer' },
        { id: 'dl_task_3', sourceId: 'retroamp', sourceUrl: 'http://retroamp.local/skin.zip',
          fileName: 'skin.zip', targetDirectory: 'C:/Downloads', totalBytes: 500_000,
          downloadedBytes: 500_000, sourceMaxKbps: 1024, allocatedKbps: 0,
          status: 'complete', resumable: false, manager: 'browser',
          startedAtMinute: 900, completedAtMinute: 1100, fileKind: 'archive' },
      ];
      const source = new SimulationEngine({ ...base.exportSnapshot(), downloads: tasks });
      const committedTasks = source.exportSnapshot().downloads;
      await saveSlot(source, 'slot_dl_stress');
      const loaded = (await loadSlotSnapshot('slot_dl_stress'))!;
      expect(loaded.downloads).toEqual(committedTasks);
      expect(loaded.downloads).toHaveLength(3);
      expect(loaded.downloads.find(d => d.id === 'dl_task_1')?.downloadedBytes).toBe(5_500_000);
      expect(loaded.downloads.find(d => d.id === 'dl_task_2')?.status).toBe('paused');
      expect(loaded.downloads.find(d => d.id === 'dl_task_3')?.status).toBe('complete');
    });

    it('survives 14 world-day progression saves with owner-state parity', async () => {
      const sim = new SimulationEngine();
      for (let n = 1; n <= 14; n++) {
        const result = sim.dispatchAction({
          type: 'PLAYER_EARN_CASH', amount: 35, reason: `Shift ${n}`,
        });
        expect(result.success).toBe(true);
        sim.advanceGameMinutes(1440, 'adversarial world day');
        await saveSlot(sim, `day_${n}`);
        const restored = new SimulationEngine((await loadSlotSnapshot(`day_${n}`))!);
        expect(restored.clock.getTotalMinutes()).toBe(sim.clock.getTotalMinutes());
        expect(restored.economy.getCash()).toBe(sim.economy.getCash());
      }
    });
  });

  describe('Suite 2: Current-format hostile archive and density cases', () => {
    it('refuses a missing snapshot or unsupported future save format', async () => {
      await db.saves.put({ id: 'bad', version: 6, snapshot: null,
        createdAt: 1, updatedAt: 1 } as any);
      expect(await loadSlotSnapshot('bad')).toBeNull();
      expect((await slotCompatibility('bad')).status).not.toBe('ok');
      const game = new SimulationEngine();
      await saveSlot(game, 'future');
      const record = (await db.saves.get('future'))!;
      record.version = 99;
      await db.saves.put(record);
      expect(await loadSlotSnapshot('future')).toBeNull();
      expect((await slotCompatibility('future')).status).toBe('refused');
    });

    it('fails closed for missing cold page keys and corrupt owner-derived indices', async () => {
      const game = new SimulationEngine();
      const buddy = game.social.getBuddies()[0]!;
      for (let i = 0; i < 165; i++)
        game.social.sendMessage(buddy.id, buddy.id, 'player', `archive-${i}`, 1400 + i);
      await saveSlot(game, 'corrupt');
      await db.conversation_pages.delete(conversationArchivePageKey('corrupt', buddy.id, 0));
      expect(await loadSlotEngine('corrupt')).toBeNull();
      expect(await loadSlotSnapshot('corrupt')).toBeNull();

      await saveSlot(game, 'corrupt');
      const record = (await db.saves.get('corrupt'))!;
      const manifest = record.meta!.conversationArchive as ConversationArchiveManifest;
      manifest.indexes![buddy.id]!.unread = -1;
      await db.saves.put(record);
      expect(await loadSlotEngine('corrupt')).toBeNull();
      expect(await loadSlotSnapshot('corrupt')).toBeNull();
    });

    it('isolates 500 authored files and 500 cold messages in a single current-format save', async () => {
      const sim = new SimulationEngine();
      const actor = sim.social.getBuddies()[0]!;
      sim.social.learnHandle(actor.id, actor.handle);
      for (let n = 0; n < 500; n++) {
        sim.vfs.createFile({
          name: `document_${n}.txt`, path: `C:/Documents/document_${n}.txt`,
          parentPath: 'C:/Documents', kind: 'text', sizeBytes: 512,
          content: `file-${n}`,
        }, 1000 + n);
        sim.social.sendMessage(actor.id, actor.id, 'player', `message-${n}`, 2000 + n);
      }
      await saveSlot(sim, 'high_density');
      const loaded = (await loadSlotEngine('high_density'))!;
      expect(loaded.social.hasColdConversations()).toBe(true);
      const log = await loaded.getConversationLogAsync(actor.id);
      expect(log).toHaveLength(500);
      expect(log.at(0)?.text).toBe('message-0');
      expect(log.at(-1)?.text).toBe('message-499');
      const docs = loaded.vfs.listDirectory('C:/Documents')
        .filter(file => file.name.startsWith('document_'));
      expect(docs).toHaveLength(500);
    });
  });

  // =========================================================================
  // SUITE 3: SoftwareRegistry & Hardware Requirement Gating Bypass Tests
  // =========================================================================
  describe('Suite 3: SoftwareRegistry Hardware Gating Bypass Attacks', () => {
    let eventBus: EventBus;
    let vfs: FileSystemEngine;
    let hw: HardwareEngine;
    let os: OsEngine;
    let registry: SoftwareRegistry;

    beforeEach(() => {
      eventBus = new EventBus();
      vfs = new FileSystemEngine(eventBus);
      hw = new HardwareEngine(eventBus);
      hw.installModularHardware(createPowerWorkstationBundle());
      hw.upgradeRam(512);
      os = new OsEngine(eventBus, { currentOsId: 'Orion_4.8', installedPatchIds: [] });

      registry = new SoftwareRegistry(eventBus, vfs, {
        getOsVersion: () => os.getCurrentOsId(),
        getRamMb: () => hw.getState().ramMB,
        getCpuTier: () => hw.getState().cpuTier,
      });
    });

    it('strictly prevents PhotoBox 3.0 installer from advancing on baseline Orion 4.8 / 512MB RAM', () => {
      const wizard = registry.startInstallerWizard('sw_photobox_30');

      expect(wizard.compatibilityResult.isCompatible).toBe(false);
      expect(wizard.compatibilityResult.osCheck.passed).toBe(false);
      expect(wizard.compatibilityResult.ramCheck.passed).toBe(false);
      expect(wizard.compatibilityResult.osCheck.required).toBe('Orion_6.0');
      expect(wizard.compatibilityResult.ramCheck.required).toBe(768);

      // Attempting to advance beyond stage 2 must throw
      expect(() => registry.advanceInstallerStage(wizard.sessionId, 3)).toThrow(
        /System requirements check failed/i
      );
      expect(() => registry.advanceInstallerStage(wizard.sessionId, 4)).toThrow(
        /System requirements check failed/i
      );
      expect(() => registry.advanceInstallerStage(wizard.sessionId, 6)).toThrow(
        /System requirements check failed/i
      );
    });

    it('SimulationEngine disallows SOFTWARE_INSTALL action for PhotoBox 3.0 when requirements are unmet', () => {
      const sim = new SimulationEngine(); // starts at Orion 4.8 / 512MB RAM

      const result = sim.dispatchAction({
        type: 'SOFTWARE_INSTALL',
        softwareId: 'sw_photobox_30',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/incompatible/i);
      expect(sim.software.isInstalled('app.photobox')).toBe(false);
    });

    it('blocks Orion 6.0 in OsEngine until RAM >= 768MB, then permits PhotoBox 3.0 installation', () => {
      const osUpgradeFail = os.beginInstall('Orion_6.0', hw.getState(), 8, 0);
      expect(osUpgradeFail.success).toBe(false);
      expect(osUpgradeFail.error).toMatch(/Requires 768MB RAM/i);
      expect(os.getCurrentOsId()).toBe('Orion_4.8');

      const ramUpgrade = hw.upgradeRam(1024);
      expect(ramUpgrade).toBe(true);
      expect(hw.getState().ramMB).toBe(1024);

      const osUpgradeSuccess = os.beginInstall('Orion_6.0', hw.getState(), 8, 120);
      expect(osUpgradeSuccess.success).toBe(true);
      expect(os.getCurrentOsId()).toBe('Orion_6.0');

      const wizard = registry.startInstallerWizard('sw_photobox_30');
      expect(wizard.compatibilityResult.isCompatible).toBe(true);
      expect(wizard.compatibilityResult.osCheck.passed).toBe(true);
      expect(wizard.compatibilityResult.ramCheck.passed).toBe(true);

      registry.advanceInstallerStage(wizard.sessionId, 2);
      registry.advanceInstallerStage(wizard.sessionId, 3);
      registry.advanceInstallerStage(wizard.sessionId, 4);
      const installed = registry.completeInstallation(wizard.sessionId, 120);

      expect(installed.appId).toBe('app.photobox');
      expect(registry.isInstalled('app.photobox')).toBe(true);
      expect(vfs.readFile('C:/Desktop/PhotoBox Studio.lnk')).toBeDefined();
    });

    it('blocks installation if disk space is insufficient', () => {
      // PhotoBox requires 70MB (70_000_000 bytes). Consume almost all VFS disk space.
      const currentFree = vfs.getFreeDiskBytes();
      vfs.createFile({
        name: 'huge_dummy.bin',
        path: 'C:/Documents/huge_dummy.bin',
        parentPath: 'C:/Documents',
        kind: 'executable',
        sizeBytes: currentFree - 10_000_000, // Leaves only 10MB free (< 70MB required)
      });
      hw.upgradeRam(1024);
      os.beginInstall('Orion_6.0', hw.getState(), 8, 120);

      const wizard = registry.startInstallerWizard('sw_photobox_30');
      // Even though OS and RAM pass, disk check fails
      expect(wizard.compatibilityResult.isCompatible).toBe(false);
      expect(wizard.compatibilityResult.diskCheck.passed).toBe(false);
      expect(() => registry.advanceInstallerStage(wizard.sessionId, 3)).toThrow();
    });
  });

  // =========================================================================
  // SUITE 4: Adware Injection & Removal Idempotency
  // =========================================================================
  describe('Suite 4: Adware Injection & Removal Idempotency (WeatherBuddy -> SafeSweep)', () => {
    let eventBus: EventBus;
    let vfs: FileSystemEngine;
    let hw: HardwareEngine;
    let os: OsEngine;
    let registry: SoftwareRegistry;

    beforeEach(() => {
      eventBus = new EventBus();
      vfs = new FileSystemEngine(eventBus);
      hw = new HardwareEngine(eventBus);
      hw.installModularHardware(createPowerWorkstationBundle());
      hw.upgradeRam(512);
      os = new OsEngine(eventBus, { currentOsId: 'Orion_4.8', installedPatchIds: [] });

      registry = new SoftwareRegistry(eventBus, vfs, {
        getOsVersion: () => os.getCurrentOsId(),
        getRamMb: () => hw.getState().ramMB,
        getCpuTier: () => hw.getState().cpuTier,
      });
    });

    it('injects SearchMate toolbar and homepage hijack when WeatherBuddy is installed with defaults', () => {
      const wizard = registry.startInstallerWizard('sw_weatherbuddy_14');
      expect(wizard.selectedOptions.acceptedBundledOffers['searchmate_toolbar']).toBe(true);

      const installed = registry.completeInstallation(wizard.sessionId, 100);
      expect(installed.appId).toBe('app.weatherbuddy');
      expect(installed.isAdware).toBe(true);
      expect(installed.adwarePayload?.toolbarInjected).toBe(true);
      expect(installed.adwarePayload?.homepageHijacked).toBe('http://searchmate.local');
      expect(installed.adwarePayload?.startupAutorun).toBe(true);
      expect(vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk')).toBeDefined();
    });

    it('does NOT inject adware if player opts out of bundled offers', () => {
      const wizard = registry.startInstallerWizard('sw_weatherbuddy_14');
      // Opt-outs belong to the canonical install commit, not a mutable wizard return.

      const installed = registry.completeInstallation(wizard.sessionId, 100, {
        searchmate_toolbar: false, autorun_startup: false,
      });
      expect(installed.adwarePayload?.toolbarInjected).toBe(false);
      expect(installed.adwarePayload?.homepageHijacked).toBeUndefined();
      expect(installed.adwarePayload?.startupAutorun).toBe(false);
    });

    it('executes 25 repeated cycles of WeatherBuddy install & uninstall with clean VFS state', () => {
      const initialVfsFilesCount = Object.keys(vfs.getState().files).length;

      for (let cycle = 1; cycle <= 25; cycle++) {
        // 1. Install WeatherBuddy
        const wizard = registry.startInstallerWizard('sw_weatherbuddy_14');
        const installed = registry.completeInstallation(wizard.sessionId, cycle * 10);
        expect(registry.isInstalled('app.weatherbuddy')).toBe(true);
        expect(vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk')).toBeDefined();

        // 2. SafeSweep / Add-Remove uninstalls WeatherBuddy
        const uninstalled = registry.uninstallSoftware(installed.id);
        expect(uninstalled).toBe(true);
        expect(registry.isInstalled('app.weatherbuddy')).toBe(false);
        expect(vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk')).toBeUndefined();

        // 3. Second uninstall call on same ID must be a safe no-op returning false
        const duplicateUninstall = registry.uninstallSoftware(installed.id);
        expect(duplicateUninstall).toBe(false);

        // Verify VFS file count is exactly restored
        expect(Object.keys(vfs.getState().files).length).toBe(initialVfsFilesCount);
      }
    });

    it('maintains system stability when SafeSweep and WeatherBuddy are installed together', () => {
      // 1. Install WeatherBuddy with adware
      const wbWizard = registry.startInstallerWizard('sw_weatherbuddy_14');
      const wbInstalled = registry.completeInstallation(wbWizard.sessionId, 50);

      // 2. Install SafeSweep
      const ssWizard = registry.startInstallerWizard('sw_safesweep_20');
      const ssInstalled = registry.completeInstallation(ssWizard.sessionId, 60);

      expect(registry.isInstalled('app.weatherbuddy')).toBe(true);
      expect(registry.isInstalled('app.safesweep')).toBe(true);
      expect(vfs.readFile('C:/Desktop/SafeSweep Anti-Spyware.lnk')).toBeDefined();

      // 3. SafeSweep remediates WeatherBuddy
      registry.uninstallSoftware(wbInstalled.id);

      expect(registry.isInstalled('app.weatherbuddy')).toBe(false);
      expect(registry.isInstalled('app.safesweep')).toBe(true);
      expect(vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk')).toBeUndefined();
      expect(vfs.readFile('C:/Desktop/SafeSweep Anti-Spyware.lnk')).toBeDefined();

      // 4. Uninstall SafeSweep
      registry.uninstallSoftware(ssInstalled.id);
      expect(registry.isInstalled('app.safesweep')).toBe(false);
      expect(vfs.readFile('C:/Desktop/SafeSweep Anti-Spyware.lnk')).toBeUndefined();
    });
  });
});
