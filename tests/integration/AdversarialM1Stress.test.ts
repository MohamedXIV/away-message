import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/persistence/db';
import { SaveManager } from '../../src/persistence/SaveManager';
import {
  type FullSimulationSnapshot,
} from '../../src/persistence/schema';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { HardwareEngine } from '../../src/engine/HardwareEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Adversarial M1 Stress & Gating Suite', () => {
  let saveManager: SaveManager;

  const createBaseSnapshot = (day = 1, cash = 38): FullSimulationSnapshot => ({
    saveSlot: {
      id: 'slot_1',
      name: `Adversarial Save Day ${day}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      day,
      totalMinutes: (day - 1) * 1440 + 480,
      clockState: {
        day,
        hour: 8,
        minute: 0,
        totalMinutes: (day - 1) * 1440 + 480,
        timeOfDay: 'morning',
        isPaused: false,
      },
      playerState: {
        cash,
        energy: 100,
        fatigue: 0,
        socialBattery: 100,
        rentDueDay: 7,
        rentAmount: 140,
        rentPaid: false,
        consecutiveLateWarnings: 0,
      },
      hardwareState: {
        cpuTier: 1,
        ramMB: 512,
        hddTotalGB: 40,
        hddFreeGB: 32,
        connectionType: 'dsl_256k',
        connectionSpeedKbps: 256,
        osVersion: 'Orion_4.8',
        theme: 'orion_4_8',
        wallpaper: 'default_clouds',
      },
      narrativeFlags: {
        flag_test_1: true,
        flag_test_2: 'in_progress',
        flag_test_3: 42,
      },
    },
    vfsFiles: [
      {
        id: 'vfs_file_readme',
        name: 'readme.txt',
        path: 'C:/Documents/readme.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 512,
        content: 'System Initialized',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    ],
    downloads: [
      {
        id: 'dl_pulse_52',
        sourceId: 'downloadhub',
        url: 'http://downloadhub.local/pulse52.exe',
        fileName: 'PulseSetup.exe',
        destinationPath: 'C:/Downloads/PulseSetup.exe',
        totalBytes: 8388608,
        downloadedBytes: 4194304,
        sourceMaxKbps: 512,
        status: 'downloading',
        resumable: true,
        startedAt: Date.now(),
      },
    ],
    installedSoftware: [
      {
        appId: 'voyager_browser',
        version: '1.0',
        installPath: 'C:/Program Files/Voyager',
        occupiedSizeBytes: 16777216,
        isPortable: false,
        bundledComponents: [],
        registeredInAddRemove: false,
        desktopShortcut: true,
        startMenuEntry: true,
        installedAt: Date.now(),
      },
    ],
    messages: [
      {
        id: 'msg_1',
        buddyId: 'ryan_foodcart',
        sender: 'buddy',
        text: 'Stress test ping message',
        timestamp: 490,
        day: 1,
        isRead: false,
      },
    ],
    relationships: [
      {
        buddyId: 'ryan_foodcart',
        familiarity: 30,
        trust: 40,
        comfort: 50,
        respect: 35,
        annoyance: 5,
        lastInteractionDay: 1,
        unlockedNotes: ['met at cart'],
        flags: { first_chat: true },
      },
    ],
    narrativeState: [
      {
        key: 'active_beat',
        value: 'day1_intro',
        updatedAt: Date.now(),
      },
    ],
    telemetryLogs: [
      {
        id: 1,
        timestamp: Date.now(),
        gameDay: 1,
        gameMinutes: 480,
        eventType: 'stress_test_init',
        payload: { seed: 12345 },
      },
    ],
  });

  beforeEach(async () => {
    saveManager = new SaveManager(db);
    await saveManager.clearAll();
  });

  // =========================================================================
  // SUITE 1: High-Frequency Save/Load Cycles & Race Conditions
  // =========================================================================
  describe('Suite 1: High-Frequency Save/Load Cycles & Persistence Stress', () => {
    it('survives 100 rapid sequential save/load cycles without data divergence', async () => {
      for (let i = 1; i <= 100; i++) {
        const snap = createBaseSnapshot(i, 50 + i * 2);
        snap.vfsFiles.push({
          id: `vfs_seq_${i}`,
          name: `file_${i}.txt`,
          path: `C:/Documents/file_${i}.txt`,
          parentPath: 'C:/Documents',
          kind: 'text',
          sizeBytes: i * 100,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        });

        await saveManager.saveGame(`slot_${i % 5}`, `Save Seq ${i}`, () => snap);
        const loaded = await saveManager.loadGame(`slot_${i % 5}`);

        expect(loaded.saveSlot.day).toBe(i);
        expect(loaded.saveSlot.playerState.cash).toBe(50 + i * 2);
        expect(loaded.vfsFiles.some(f => f.name === `file_${i}.txt`)).toBe(true);
      }
    });

    it('handles 25 concurrent racing saveGame calls atomically without table corruption', async () => {
      const promises = Array.from({ length: 25 }, (_, idx) => {
        const snap = createBaseSnapshot(idx + 1, 100 + idx);
        return saveManager.saveGame(`concurrent_slot_${idx}`, `Concurrent ${idx}`, () => snap);
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(25);

      // Verify all 25 slots exist in database and are uncorrupted
      for (let idx = 0; idx < 25; idx++) {
        const loaded = await saveManager.loadGame(`concurrent_slot_${idx}`);
        expect(loaded.saveSlot.day).toBe(idx + 1);
        expect(loaded.saveSlot.playerState.cash).toBe(100 + idx);
        expect(loaded.installedSoftware[0]?.appId).toBe('voyager_browser');
      }
    });

    it('persists mid-download and multi-download state transitions losslessly', async () => {
      const snap = createBaseSnapshot(1, 100);
      snap.downloads = [
        {
          id: 'dl_task_1',
          sourceId: 'downloadhub',
          url: 'http://downloadhub.local/file1.zip',
          fileName: 'file1.zip',
          destinationPath: 'C:/Downloads/file1.zip',
          totalBytes: 10_000_000,
          downloadedBytes: 5_500_000,
          sourceMaxKbps: 512,
          status: 'downloading',
          resumable: true,
          startedAt: 1000,
        },
        {
          id: 'dl_task_2',
          sourceId: 'techmart',
          url: 'http://techmart.local/driver.exe',
          fileName: 'driver.exe',
          destinationPath: 'C:/Downloads/driver.exe',
          totalBytes: 2_000_000,
          downloadedBytes: 1_000_000,
          sourceMaxKbps: 256,
          status: 'paused',
          resumable: true,
          startedAt: 1050,
        },
        {
          id: 'dl_task_3',
          sourceId: 'retroamp',
          url: 'http://retroamp.local/skin.zip',
          fileName: 'skin.zip',
          destinationPath: 'C:/Downloads/skin.zip',
          totalBytes: 500_000,
          downloadedBytes: 500_000,
          sourceMaxKbps: 1024,
          status: 'complete',
          resumable: false,
          startedAt: 900,
          completedAt: 1100,
        },
      ];

      await saveManager.saveGame('slot_dl_stress', 'Download State Save', () => snap);
      const loaded = await saveManager.loadGame('slot_dl_stress');

      expect(loaded.downloads).toHaveLength(3);
      expect(loaded.downloads.find(d => d.id === 'dl_task_1')?.downloadedBytes).toBe(5_500_000);
      expect(loaded.downloads.find(d => d.id === 'dl_task_2')?.status).toBe('paused');
      expect(loaded.downloads.find(d => d.id === 'dl_task_3')?.status).toBe('complete');
    });

    it('simulates 14-day full progression with daily saves and state consistency', async () => {
      const sim = new SimulationEngine();

      for (let day = 1; day <= 14; day++) {
        sim.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 35, reason: `Day ${day} Shift` });
        sim.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });

        const snapshot = sim.exportSnapshot();
        const fullSnap: FullSimulationSnapshot = {
          saveSlot: {
            id: `day_${day}_save`,
            name: `Day ${day} Save`,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            day: snapshot.time.day,
            totalMinutes: snapshot.time.totalMinutes,
            clockState: {
              day: snapshot.time.day,
              hour: snapshot.time.hour,
              minute: snapshot.time.minute,
              totalMinutes: snapshot.time.totalMinutes,
              timeOfDay: snapshot.time.timeOfDay,
              isPaused: sim.clock.isPaused(),
            },
            playerState: {
              cash: snapshot.player.cash,
              energy: snapshot.player.energy,
              fatigue: snapshot.player.fatigue,
              socialBattery: snapshot.player.socialBattery,
              rentDueDay: snapshot.player.rentDueDay,
              rentAmount: snapshot.player.rentAmount,
              rentPaid: snapshot.player.rentPaid,
              consecutiveLateWarnings: 0,
            },
            hardwareState: {
              cpuTier: snapshot.hardware.cpuTier,
              ramMB: snapshot.hardware.ramMB,
              hddTotalGB: snapshot.hardware.hddTotalGB,
              hddFreeGB: snapshot.hardware.hddFreeGB,
              connectionType: snapshot.hardware.connectionType,
              connectionSpeedKbps: snapshot.hardware.connectionSpeedKbps,
              osVersion: snapshot.hardware.osVersion,
              theme: 'orion_4_8',
              wallpaper: 'default_clouds',
            },
            narrativeFlags: snapshot.narrative.flags,
          },
          vfsFiles: Object.values(snapshot.vfs.files).map(f => ({
            id: f.id,
            name: f.name,
            path: f.path,
            parentPath: f.parentPath,
            kind: f.kind === 'directory' ? 'directory' : (f.kind as any),
            sizeBytes: f.sizeBytes,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          })),
          downloads: snapshot.downloads.map(d => ({
            id: d.id,
            sourceId: d.sourceId,
            url: d.sourceUrl,
            fileName: d.fileName,
            destinationPath: `${d.targetDirectory}/${d.fileName}`,
            totalBytes: d.totalBytes,
            downloadedBytes: d.downloadedBytes,
            sourceMaxKbps: d.sourceMaxKbps,
            status: d.status,
            resumable: d.resumable,
            startedAt: d.startedAtMinute,
          })),
          installedSoftware: snapshot.installedSoftware.map(s => ({
            appId: s.appId,
            version: s.version,
            installPath: s.installPath,
            occupiedSizeBytes: s.installedBytes,
            isPortable: s.isPortable,
            bundledComponents: s.adwarePayload?.toolbarInjected ? ['searchmate_toolbar'] : [],
            registeredInAddRemove: !s.isPortable,
            desktopShortcut: s.shortcuts.length > 0,
            startMenuEntry: true,
            installedAt: s.installedAtMinute,
          })),
          messages: Object.values(snapshot.social.conversations).flat().map(m => ({
            id: m.id,
            buddyId: m.conversationId,
            sender: m.senderId === 'player' ? 'player' : 'buddy',
            text: m.text,
            timestamp: m.timestampMinute,
            day: m.day,
            isRead: m.isRead,
          })),
          relationships: Object.entries(snapshot.social.relationships).map(([buddyId, r]) => ({
            buddyId,
            familiarity: r.familiarity,
            trust: r.trust,
            comfort: r.comfort,
            respect: r.respect,
            annoyance: r.annoyance,
            lastInteractionDay: 1,
            unlockedNotes: [],
            flags: {},
          })),
          narrativeState: [
            { key: 'active_beat', value: snapshot.narrative.activeBeatId, updatedAt: Date.now() },
          ],
          telemetryLogs: snapshot.telemetry.logs.map((l, i) => ({
            id: i + 1,
            timestamp: l.realTimestampMs,
            gameDay: Math.floor(l.timestampMinutes / 1440) + 1,
            gameMinutes: l.timestampMinutes,
            eventType: `${l.category}:${l.action}`,
            payload: (l.data || {}) as Record<string, unknown>,
          })),
        };

        await saveManager.saveGame(`day_${day}_save`, `Day ${day}`, () => fullSnap);
        const reloaded = await saveManager.loadGame(`day_${day}_save`);
        expect(reloaded.saveSlot.day).toBe(day + 1);
      }
    });
  });

  // =========================================================================
  // SUITE 2: Corrupted JSON Import Fuzzing
  // =========================================================================
  describe('Suite 2: Corrupted JSON Import Fuzzing', () => {
    it('rejects malformed and non-JSON string payloads', async () => {
      const toxicInputs = [
        '',
        '   ',
        'not a json string',
        '{ invalid json token }',
        '{"saveSlot": ',
        '{"saveSlot": null}',
        'null',
        '12345',
        'true',
        '["array", "of", "strings"]',
        '{"saveSlot": {"id": "1"}, "extra": "\u0000\u0001\u0002"}',
      ];

      for (const input of toxicInputs) {
        await expect(saveManager.importSaveJson(input)).rejects.toThrow();
      }
    });

    it('rejects JSON imports missing essential top-level tables', async () => {
      const base = createBaseSnapshot(1, 100);

      const missingVfs = { ...base };
      delete (missingVfs as any).vfsFiles;
      await expect(saveManager.importSaveJson(JSON.stringify(missingVfs))).rejects.toThrow();

      const missingDownloads = { ...base };
      delete (missingDownloads as any).downloads;
      await expect(saveManager.importSaveJson(JSON.stringify(missingDownloads))).rejects.toThrow();

      const missingInstalled = { ...base };
      delete (missingInstalled as any).installedSoftware;
      await expect(saveManager.importSaveJson(JSON.stringify(missingInstalled))).rejects.toThrow();

      const missingSaveSlot = { ...base };
      delete (missingSaveSlot as any).saveSlot;
      await expect(saveManager.importSaveJson(JSON.stringify(missingSaveSlot))).rejects.toThrow();
    });

    it('rejects invalid nested schema types and out-of-bounds numeric fields', async () => {
      const invalidCases: Array<{ desc: string; mutate: (snap: any) => void }> = [
        {
          desc: 'negative day',
          mutate: s => { s.saveSlot.day = -1; },
        },
        {
          desc: 'string day instead of number',
          mutate: s => { s.saveSlot.day = 'Day 5'; },
        },
        {
          desc: 'negative totalMinutes',
          mutate: s => { s.saveSlot.totalMinutes = -500; },
        },
        {
          desc: 'invalid hour (25)',
          mutate: s => { s.saveSlot.clockState.hour = 25; },
        },
        {
          desc: 'invalid minute (60)',
          mutate: s => { s.saveSlot.clockState.minute = 60; },
        },
        {
          desc: 'invalid timeOfDay enum',
          mutate: s => { s.saveSlot.clockState.timeOfDay = 'dusk'; },
        },
        {
          desc: 'energy > 100',
          mutate: s => { s.saveSlot.playerState.energy = 150; },
        },
        {
          desc: 'fatigue < 0',
          mutate: s => { s.saveSlot.playerState.fatigue = -20; },
        },
        {
          desc: 'invalid OS version enum',
          mutate: s => { s.saveSlot.hardwareState.osVersion = 'Windows_XP_Professional'; },
        },
        {
          desc: 'invalid connectionType enum',
          mutate: s => { s.saveSlot.hardwareState.connectionType = 'fiber_gigabit'; },
        },
        {
          desc: 'version < 1',
          mutate: s => { s.saveSlot.version = 0; },
        },
      ];

      for (const tc of invalidCases) {
        const snap = createBaseSnapshot(1, 100);
        tc.mutate(snap);
        const json = JSON.stringify(snap);
        await expect(
          saveManager.importSaveJson(json),
          `Expected rejection for case: ${tc.desc}`
        ).rejects.toThrow();
      }
    });

    it('neutralizes prototype pollution payloads during import', async () => {
      const snap = createBaseSnapshot(1, 100);
      const pollutedJson = JSON.stringify({
        ...snap,
        __proto__: { isAdmin: true },
        constructor: { prototype: { isHacked: true } },
      });

      await saveManager.importSaveJson(pollutedJson, 'slot_pollution_test');
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect((Object.prototype as any).isHacked).toBeUndefined();
    });

    it('successfully imports and round-trips high-density data payloads (500 files, 500 messages)', async () => {
      const snap = createBaseSnapshot(5, 500);

      snap.vfsFiles = Array.from({ length: 500 }, (_, i) => ({
        id: `dense_file_${i}`,
        name: `document_${i}.txt`,
        path: `C:/Documents/document_${i}.txt`,
        parentPath: 'C:/Documents',
        kind: 'text' as const,
        sizeBytes: 1024,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      }));

      snap.messages = Array.from({ length: 500 }, (_, i) => ({
        id: `dense_msg_${i}`,
        buddyId: 'ryan_foodcart',
        sender: (i % 2 === 0 ? 'player' : 'buddy') as 'player' | 'buddy',
        text: `Message payload #${i}`,
        timestamp: 480 + i,
        day: 1 + Math.floor(i / 100),
        isRead: true,
      }));

      const exported = JSON.stringify(snap);
      await saveManager.importSaveJson(exported, 'slot_high_density');

      const loaded = await saveManager.loadGame('slot_high_density');
      expect(loaded.vfsFiles).toHaveLength(500);
      expect(loaded.messages).toHaveLength(500);
      expect(loaded.saveSlot.day).toBe(5);
    });
  });

  // =========================================================================
  // SUITE 3: SoftwareRegistry & Hardware Requirement Gating Bypass Tests
  // =========================================================================
  describe('Suite 3: SoftwareRegistry Hardware Gating Bypass Attacks', () => {
    let eventBus: EventBus;
    let vfs: FileSystemEngine;
    let hw: HardwareEngine;
    let registry: SoftwareRegistry;

    beforeEach(() => {
      eventBus = new EventBus();
      vfs = new FileSystemEngine(eventBus);
      hw = new HardwareEngine(eventBus, {
        osVersion: 'Orion_4.8',
        ramMB: 512,
        cpuTier: 1,
        hddFreeGB: 7.0,
      });

      registry = new SoftwareRegistry(eventBus, vfs, {
        getOsVersion: () => hw.getState().osVersion,
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

    it('blocks OS upgrade to Orion 6.0 until RAM >= 768MB, then permits PhotoBox 3.0 installation', () => {
      // 1. Attempt OS upgrade on 512MB RAM -> MUST FAIL
      const osUpgradeFail = hw.upgradeOs('Orion_6.0');
      expect(osUpgradeFail.success).toBe(false);
      expect(osUpgradeFail.error).toMatch(/Requires at least 768 MB RAM/i);
      expect(hw.getState().osVersion).toBe('Orion_4.8');

      // 2. Upgrade RAM to 1024MB
      const ramUpgrade = hw.upgradeRam(1024);
      expect(ramUpgrade).toBe(true);
      expect(hw.getState().ramMB).toBe(1024);

      // 3. Now upgrade OS to Orion 6.0 -> MUST SUCCEED
      const osUpgradeSuccess = hw.upgradeOs('Orion_6.0');
      expect(osUpgradeSuccess.success).toBe(true);
      expect(hw.getState().osVersion).toBe('Orion_6.0');

      // 4. Now attempt PhotoBox 3.0 wizard -> MUST BE FULLY COMPATIBLE
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
      hw.upgradeOs('Orion_6.0');

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
    let registry: SoftwareRegistry;

    beforeEach(() => {
      eventBus = new EventBus();
      vfs = new FileSystemEngine(eventBus);
      hw = new HardwareEngine(eventBus, {
        osVersion: 'Orion_4.8',
        ramMB: 512,
        cpuTier: 1,
        hddFreeGB: 10.0,
      });

      registry = new SoftwareRegistry(eventBus, vfs, {
        getOsVersion: () => hw.getState().osVersion,
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
      wizard.selectedOptions.acceptedBundledOffers['searchmate_toolbar'] = false;
      wizard.selectedOptions.acceptedBundledOffers['autorun_startup'] = false;

      const installed = registry.completeInstallation(wizard.sessionId, 100);
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
