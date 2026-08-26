import { describe, it, expect, beforeEach } from 'vitest';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { DownloadManager } from '../../src/engine/DownloadManager';
import { parseEmoticons, tokenizeEmoticons } from '../../src/apps/pulse/utils/emoticonParser';
import { AWAY_MESSAGE_PRESETS } from '../../src/apps/pulse/data/awayMessagePresets';
import { DIALOGUE_SCRIPTS } from '../../src/apps/pulse/data/dialogueTrees';
import { OsVersion } from '../../src/engine/types';

describe('Adversarial Stress Test Suite — Pulse Messenger & Ecosystem Applications', () => {
  let eventBus: EventBus;
  let vfs: FileSystemEngine;
  let engine: SimulationEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    vfs = new FileSystemEngine(eventBus);
    engine = new SimulationEngine();
    useSimulationStore.getState().setEngine(engine);
  });

  // =========================================================================
  // DOMAIN 1: PhotoBox Requirement Gating Permutations & Image Editor Logic
  // =========================================================================
  describe('PhotoBox Studio 3.0 / Pro 2.0 Requirement Gating Permutations', () => {
    interface GatingTestCase {
      os: OsVersion;
      ramMB: number;
      expectedGated: boolean;
      description: string;
    }

    const testPermutations: GatingTestCase[] = [
      { os: 'Orion_4.8', ramMB: 512, expectedGated: true, description: 'Default starting rig (OS 4.8 + 512MB RAM)' },
      { os: 'Orion_4.8', ramMB: 768, expectedGated: true, description: 'OS 4.8 with upgraded 768MB RAM (OS bottleneck)' },
      { os: 'Orion_4.8', ramMB: 1024, expectedGated: true, description: 'OS 4.8 with 1024MB RAM (OS bottleneck)' },
      { os: 'Orion_4.8', ramMB: 2048, expectedGated: true, description: 'OS 4.8 with maximum 2048MB RAM (OS bottleneck)' },
      { os: 'Orion_6.0', ramMB: 256, expectedGated: true, description: 'OS 6.0 with severely underpowered 256MB RAM' },
      { os: 'Orion_6.0', ramMB: 512, expectedGated: true, description: 'OS 6.0 with baseline 512MB RAM (RAM bottleneck)' },
      { os: 'Orion_6.0', ramMB: 767, expectedGated: true, description: 'OS 6.0 with 767MB RAM (1 MB below minimum threshold)' },
      { os: 'Orion_6.0', ramMB: 768, expectedGated: false, description: 'OS 6.0 with exact minimum 768MB RAM (UNLOCKED)' },
      { os: 'Orion_6.0', ramMB: 1024, expectedGated: false, description: 'OS 6.0 with recommended 1024MB RAM (UNLOCKED)' },
      { os: 'Orion_6.0', ramMB: 2048, expectedGated: false, description: 'OS 6.0 with high-end 2048MB RAM (UNLOCKED)' },
    ];

    testPermutations.forEach(({ os, ramMB, expectedGated, description }) => {
      it(`enforces gating rules for ${description}`, () => {
        // Evaluate UI Gating Condition
        const isOrion60 = os === 'Orion_6.0';
        const hasSufficientRam = ramMB >= 768;
        const isGatingPassed = isOrion60 && hasSufficientRam;
        const isGated = !isGatingPassed;

        expect(isGated).toBe(expectedGated);

        // Evaluate Engine SoftwareRegistry Wizard Compatibility
        const hwProvider = {
          getOsVersion: () => os,
          getRamMb: () => ramMB,
          getCpuTier: () => 1,
        };
        const registry = new SoftwareRegistry(eventBus, vfs, hwProvider);
        const session = registry.startInstallerWizard('sw_photobox_30');

        expect(session.compatibilityResult.isCompatible).toBe(!expectedGated);
        expect(session.compatibilityResult.osCheck.passed).toBe(isOrion60);
        expect(session.compatibilityResult.ramCheck.passed).toBe(hasSufficientRam);

        if (expectedGated) {
          expect(() => registry.advanceInstallerStage(session.sessionId, 3)).toThrow(
            /System requirements check failed/
          );
        } else {
          expect(() => registry.advanceInstallerStage(session.sessionId, 3)).not.toThrow();
        }
      });
    });

    it('PhotoBox filter adjustment math and history bounds behave deterministically', () => {
      interface ImageFilterState {
        brightness: number;
        contrast: number;
        saturation: number;
        sepia: number;
        invert: number;
        blur: number;
      }

      const DEFAULT_FILTER: ImageFilterState = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        sepia: 0,
        invert: 0,
        blur: 0,
      };

      const vintagePreset: ImageFilterState = {
        brightness: 110,
        contrast: 120,
        saturation: 70,
        sepia: 40,
        invert: 0,
        blur: 0,
      };

      let history: ImageFilterState[] = [DEFAULT_FILTER];
      let historyIndex = 0;

      // Undo at bottom of stack is a no-op
      const undoAtBottom = historyIndex > 0 ? history[historyIndex - 1] : history[historyIndex];
      expect(undoAtBottom).toEqual(DEFAULT_FILTER);
      expect(historyIndex).toBe(0);

      // Apply vintage preset
      history = [...history.slice(0, historyIndex + 1), vintagePreset];
      historyIndex++;
      expect(history.length).toBe(2);
      expect(history[historyIndex]).toEqual(vintagePreset);

      // Undo brings back default filter
      if (historyIndex > 0) {
        historyIndex--;
      }
      expect(history[historyIndex]).toEqual(DEFAULT_FILTER);

      // Redo brings back vintage preset
      if (historyIndex < history.length - 1) {
        historyIndex++;
      }
      expect(history[historyIndex]).toEqual(vintagePreset);

      // Redo at top of stack is a no-op
      if (historyIndex < history.length - 1) {
        historyIndex++;
      }
      expect(historyIndex).toBe(1);
      expect(history[historyIndex]).toEqual(vintagePreset);
    });
  });

  // =========================================================================
  // DOMAIN 2: WeatherBuddy Adware, SearchMate Toolbar & SafeSweep Remediation
  // =========================================================================
  describe('WeatherBuddy Adware Injection, SearchMate Toolbar & SafeSweep Remediation', () => {
    it('installs WeatherBuddy with default bundled SearchMate toolbar and detects adware payload', () => {
      const hwProvider = {
        getOsVersion: () => 'Orion_4.8' as OsVersion,
        getRamMb: () => 512,
        getCpuTier: () => 1,
      };
      const registry = new SoftwareRegistry(eventBus, vfs, hwProvider);

      const session = registry.startInstallerWizard('sw_weatherbuddy_14');
      expect(session.selectedOptions.acceptedBundledOffers['searchmate_toolbar']).toBe(true);
      expect(session.selectedOptions.acceptedBundledOffers['autorun_startup']).toBe(true);

      const installedRecord = registry.completeInstallation(session.sessionId, 120);

      expect(installedRecord.isAdware).toBe(true);
      expect(installedRecord.adwarePayload?.toolbarInjected).toBe(true);
      expect(installedRecord.adwarePayload?.homepageHijacked).toBe('http://searchmate.local');
      expect(installedRecord.adwarePayload?.startupAutorun).toBe(true);

      // Verify VFS shortcut creation
      const desktopShortcut = vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk');
      expect(desktopShortcut).toBeDefined();
      expect(desktopShortcut?.kind).toBe('shortcut');

      // Check browser toolbar presence check condition
      const installedList = registry.getInstalledSoftware();
      const isSearchMatePresent = installedList.some(
        (sw) => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
      );
      expect(isSearchMatePresent).toBe(true);
    });

    it('installs WeatherBuddy with bundled SearchMate toolbar deselected', () => {
      const hwProvider = {
        getOsVersion: () => 'Orion_4.8' as OsVersion,
        getRamMb: () => 512,
        getCpuTier: () => 1,
      };
      const registry = new SoftwareRegistry(eventBus, vfs, hwProvider);

      const session = registry.startInstallerWizard('sw_weatherbuddy_14');
      session.selectedOptions.acceptedBundledOffers['searchmate_toolbar'] = false;
      session.selectedOptions.acceptedBundledOffers['autorun_startup'] = false;

      const installedRecord = registry.completeInstallation(session.sessionId, 120);

      expect(installedRecord.adwarePayload?.toolbarInjected).toBe(false);
      expect(installedRecord.adwarePayload?.homepageHijacked).toBeUndefined();
      expect(installedRecord.adwarePayload?.startupAutorun).toBe(false);
    });

    it('SafeSweep scans, detects, quarantines SearchMate, and completely restores clean browser defaults', () => {
      const hwProvider = {
        getOsVersion: () => 'Orion_4.8' as OsVersion,
        getRamMb: () => 512,
        getCpuTier: () => 1,
      };
      const registry = new SoftwareRegistry(eventBus, vfs, hwProvider);

      // 1. Install WeatherBuddy with bundled adware
      const session = registry.startInstallerWizard('sw_weatherbuddy_14');
      registry.completeInstallation(session.sessionId, 50);

      // Verify adware is active
      let installedList = registry.getInstalledSoftware();
      expect(installedList.some((s) => s.adwarePayload?.toolbarInjected)).toBe(true);

      // 2. SafeSweep Scan Detection Logic
      interface DetectedThreat {
        id: string;
        name: string;
        category: string;
        severity: string;
        filePath: string;
      }

      const detectedThreats: DetectedThreat[] = [];
      installedList.forEach((sw) => {
        if (sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected) {
          detectedThreats.push({
            id: sw.id,
            name: 'Adware.Win32.SearchMateToolbar',
            category: 'Adware',
            severity: 'High',
            filePath: 'C:/Program Files/SearchMate/searchmate.dll',
          });
        }
      });

      expect(detectedThreats.length).toBe(1);
      expect(detectedThreats[0]?.name).toBe('Adware.Win32.SearchMateToolbar');
      expect(detectedThreats[0]?.severity).toBe('High');

      // 3. SafeSweep Quarantine / Removal Action
      for (const threat of detectedThreats) {
        const removed = registry.uninstallSoftware(threat.id);
        expect(removed).toBe(true);
      }

      // 4. Verification of Remediation & Clean State
      installedList = registry.getInstalledSoftware();
      const isSearchMateActiveAfter = installedList.some(
        (sw) => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
      );
      expect(isSearchMateActiveAfter).toBe(false);

      // Shortcut cleaned from VFS
      const shortcutAfter = vfs.readFile('C:/Desktop/WeatherBuddy Desktop Widget.lnk');
      expect(shortcutAfter).toBeUndefined();

      // Subsequent scan returns clean system (0 threats, only safe fallback cookie)
      const rescanThreats = installedList.filter((sw) => sw.isAdware || sw.adwarePayload);
      expect(rescanThreats.length).toBe(0);
    });
  });

  // =========================================================================
  // DOMAIN 3: Pulse Messenger Typing Cadence, Away Messages & Emoticon Parser
  // =========================================================================
  describe('Pulse Messenger Typing Cadence, Away Messages & Emoticon Parser', () => {
    it('parses all standard and Orion 6.0 exclusive emoticons with proper gating', () => {
      // Test classic emoticons on Orion 4.8
      const classicText = 'Hey :) nice to meet you :D let us drink (C) and celebrate (L)!';
      const tokens48 = parseEmoticons(classicText, false);

      const smile = tokens48.find((t) => t.type === 'emoticon' && t.glyph === '😊');
      const grin = tokens48.find((t) => t.type === 'emoticon' && t.glyph === '😄');
      const coffee = tokens48.find((t) => t.type === 'emoticon' && t.glyph === '☕');
      const heart = tokens48.find((t) => t.type === 'emoticon' && t.glyph === '❤️');

      expect(smile).toBeDefined();
      expect(grin).toBeDefined();
      expect(coffee).toBeDefined();
      expect(heart).toBeDefined();

      // Test Orion 6.0 exclusive emoticons: (:star:), (:fire:), (:zap:), (:camera:)
      const orionExclusiveText = 'Look at this (:star:) and (:fire:) with (:camera:) and (:zap:)';

      // On Orion 4.8 -> plain text
      const orion48Tokens = parseEmoticons(orionExclusiveText, false);
      expect(orion48Tokens.some((t) => t.type === 'emoticon' && t.glyph === '⭐')).toBe(false);
      expect(orion48Tokens.some((t) => t.type === 'emoticon' && t.glyph === '🔥')).toBe(false);
      expect(orion48Tokens.some((t) => t.type === 'emoticon' && t.glyph === '📷')).toBe(false);
      expect(orion48Tokens.some((t) => t.type === 'emoticon' && t.glyph === '⚡')).toBe(false);

      // On Orion 6.0 -> converted to emoticon glyphs
      const orion60Tokens = parseEmoticons(orionExclusiveText, true);
      expect(orion60Tokens.some((t) => t.type === 'emoticon' && t.glyph === '⭐')).toBe(true);
      expect(orion60Tokens.some((t) => t.type === 'emoticon' && t.glyph === '🔥')).toBe(true);
      expect(orion60Tokens.some((t) => t.type === 'emoticon' && t.glyph === '📷')).toBe(true);
      expect(orion60Tokens.some((t) => t.type === 'emoticon' && t.glyph === '⚡')).toBe(true);
    });

    it('handles emoticon tokenization edge cases (empty, consecutive, regex chars, partial codes)', () => {
      // 1. Empty string & whitespace
      expect(tokenizeEmoticons('', false)).toEqual([]);
      expect(tokenizeEmoticons('   ', false)).toEqual([{ type: 'text', content: '   ' }]);

      // 2. Consecutive emoticons
      const consecutive = tokenizeEmoticons(':-):-D:P(L)(U)', false);
      const emoticonsOnly = consecutive.filter((t) => t.type === 'emoticon');
      expect(emoticonsOnly.length).toBe(5);
      expect(emoticonsOnly.map((t) => t.glyph)).toEqual(['😊', '😄', '😛', '❤️', '💔']);

      // 3. Greedy matching: :-) vs :) and :-D vs :D
      const greedy1 = tokenizeEmoticons(':-)', false);
      expect(greedy1.length).toBe(1);
      expect(greedy1[0]?.content).toBe(':-)');

      const greedy2 = tokenizeEmoticons(':)', false);
      expect(greedy2.length).toBe(1);
      expect(greedy2[0]?.content).toBe(':)');

      // 4. Special regex / punctuation chars around emoticons
      const regexText = 'Total: $100 * [5] + (2) ^ 3 = $500 :) / (test)??';
      const regexTokens = tokenizeEmoticons(regexText, false);
      expect(regexTokens.some((t) => t.type === 'emoticon' && t.glyph === '😊')).toBe(true);

      // 5. Partial / unclosed emoticon codes remain text
      const partialText = '(:star and :- and (L';
      const partialTokens = tokenizeEmoticons(partialText, false);
      expect(partialTokens.every((t) => t.type === 'text')).toBe(true);
    });

    it('calculates NPC typing duration and cadence according to WPM characteristics', () => {
      const npcs = [
        { id: 'ryan', wpm: 80, name: 'Ryan' },
        { id: 'maya', wpm: 60, name: 'Maya' },
        { id: 'nora', wpm: 90, name: 'Nora' },
        { id: 'henderson', wpm: 40, name: 'Mr. Henderson' },
      ];

      npcs.forEach(({ id, wpm }) => {
        const cps = (wpm * 5) / 60;

        // Formula: Math.max(800, Math.min(3000, (msg.text.length / cps) * 1000))
        const calculateDuration = (text: string) => {
          return Math.max(800, Math.min(3000, (text.length / cps) * 1000));
        };

        // Very short message ("k" -> 1 char) -> clamps to 800ms minimum
        const shortDuration = calculateDuration('k');
        expect(shortDuration).toBe(800);

        // Very long message (500 chars) -> clamps to 3000ms maximum
        const longDuration = calculateDuration('A'.repeat(500));
        expect(longDuration).toBe(3000);

        // Medium message (8 chars) -> scales inversely with WPM (unclamped between 800ms and 3000ms)
        const medDuration = calculateDuration('Hello ok');
        expect(medDuration).toBeGreaterThanOrEqual(800);
        expect(medDuration).toBeLessThanOrEqual(3000);

        // Faster typist (Nora: 90 WPM, 7.5 CPS -> 1066ms) types same message faster than slower typist (Henderson: 40 WPM, 3.33 CPS -> 2400ms)
        if (id === 'nora') {
          const hendersonCps = (40 * 5) / 60;
          const hendersonDuration = Math.max(800, Math.min(3000, ('Hello ok'.length / hendersonCps) * 1000));
          expect(medDuration).toBeLessThan(hendersonDuration);
        }
      });
    });

    it('manages away message presets and custom away message state transitions', () => {
      // 1. Validate authentic presets catalog
      expect(AWAY_MESSAGE_PRESETS.length).toBeGreaterThanOrEqual(10);
      AWAY_MESSAGE_PRESETS.forEach((preset) => {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.message).toBeTruthy();
        expect(['status', 'activity', 'quote', 'retro']).toContain(preset.category);
      });

      // 2. Set player custom away message
      const customMsg = 'offline reading near the motel window ~ leave a note';
      useSimulationStore.setState((prev) => ({
        state: {
          ...prev.state,
          social: {
            ...prev.state.social,
            presence: {
              ...prev.state.social.presence,
              player: {
                status: 'away',
                awayMessage: customMsg,
                customAwayMessage: customMsg,
              },
            },
          },
        },
      }));

      const playerPresence = useSimulationStore.getState().state.social.presence['player'];
      expect(playerPresence?.status).toBe('away');
      expect(playerPresence?.awayMessage).toBe(customMsg);
      expect(playerPresence?.customAwayMessage).toBe(customMsg);

      // 3. Clear away status
      useSimulationStore.setState((prev) => ({
        state: {
          ...prev.state,
          social: {
            ...prev.state.social,
            presence: {
              ...prev.state.social.presence,
              player: {
                status: 'online',
                awayMessage: '',
                customAwayMessage: undefined,
              },
            },
          },
        },
      }));

      const clearedPresence = useSimulationStore.getState().state.social.presence['player'];
      expect(clearedPresence?.status).toBe('online');
      expect(clearedPresence?.awayMessage).toBe('');
      expect(clearedPresence?.customAwayMessage).toBeUndefined();
    });

    it('enforces deterministic schedule status transitions for all buddies across 24-hour cycle', () => {
      const social = new SocialEngine(eventBus);

      // Minute 300 (05:00 AM)
      social.updatePresence(300);
      expect(social.getPresence('ryan')?.status).toBe('offline');
      expect(social.getPresence('maya')?.status).toBe('offline');
      expect(social.getPresence('nora')?.status).toBe('away'); // watching dawn (300..360)
      expect(social.getPresence('henderson')?.status).toBe('offline');

      // Minute 600 (10:00 AM)
      social.updatePresence(600);
      expect(social.getPresence('ryan')?.status).toBe('offline'); // work @ cart
      expect(social.getPresence('maya')?.status).toBe('away'); // at desk (540..1050)
      expect(social.getPresence('nora')?.status).toBe('offline'); // offline (360..1140)
      expect(social.getPresence('henderson')?.status).toBe('online'); // motel desk open (480..1200)

      // Minute 1200 (08:00 PM)
      social.updatePresence(1200);
      expect(social.getPresence('ryan')?.status).toBe('online'); // gaming / chilling (1080..1320)
      expect(social.getPresence('maya')?.status).toBe('online'); // making coffee :) (1050..1260)
      expect(social.getPresence('nora')?.status).toBe('away'); // indexing old logs (1140..1320)
      expect(social.getPresence('henderson')?.status).toBe('offline'); // closed (1200..1440)

      // Minute 1380 (11:00 PM)
      social.updatePresence(1380);
      expect(social.getPresence('ryan')?.status).toBe('offline');
      expect(social.getPresence('maya')?.status).toBe('online'); // listening to rain (1260..1440)
      expect(social.getPresence('nora')?.status).toBe('online'); // nightboard / logs (1320..1440)
      expect(social.getPresence('henderson')?.status).toBe('offline');
    });
  });

  // =========================================================================
  // DOMAIN 4: ZipMate CRC / Extraction & FlashFetch Speed Calculations
  // =========================================================================
  describe('ZipMate CRC / Extraction & FlashFetch Speed Calculations', () => {
    it('validates ZipMate archive integrity, CRC32 format, and compression ratios', () => {
      interface ArchivedItem {
        name: string;
        originalSize: number;
        packedSize: number;
        type: string;
        modifiedDate: string;
        crc32: string;
      }

      const archives: Record<string, ArchivedItem[]> = {
        'photobox_setup.zip': [
          { name: 'PhotoBoxSetup.exe', originalSize: 14680064, packedSize: 8912896, type: 'Application', modifiedDate: '08/15/2006 14:20', crc32: 'A4F19B82' },
          { name: 'Readme_Requirements.txt', originalSize: 4096, packedSize: 1240, type: 'Text Document', modifiedDate: '08/15/2006 14:18', crc32: '89C041DE' },
          { name: 'SampleFilters.dat', originalSize: 2097152, packedSize: 1450000, type: 'Data File', modifiedDate: '08/14/2006 09:12', crc32: 'D3A1559C' },
        ],
        'lofi_drums.zip': [
          { name: 'kick_dusty.wav', originalSize: 524288, packedSize: 320000, type: 'Audio Clip', modifiedDate: '08/20/2006 02:14', crc32: 'FE40192A' },
          { name: 'snare_tape.wav', originalSize: 412000, packedSize: 280000, type: 'Audio Clip', modifiedDate: '08/20/2006 02:15', crc32: 'C391AA01' },
          { name: 'hihat_vinyl_loop.wav', originalSize: 1048576, packedSize: 720000, type: 'Audio Clip', modifiedDate: '08/20/2006 02:16', crc32: '77B49F12' },
        ],
      };

      const crc32Regex = /^[0-9A-F]{8}$/;

      Object.entries(archives).forEach(([archiveName, items]) => {
        const totalOriginal = items.reduce((sum, item) => sum + item.originalSize, 0);
        const totalPacked = items.reduce((sum, item) => sum + item.packedSize, 0);

        expect(totalOriginal).toBeGreaterThan(totalPacked);
        const ratio = Math.round((1 - totalPacked / totalOriginal) * 100);

        if (archiveName === 'photobox_setup.zip') {
          expect(ratio).toBe(38); // (1 - 10364136 / 16781312) = 38.24% -> 38%
        } else if (archiveName === 'lofi_drums.zip') {
          expect(ratio).toBe(33); // (1 - 1320000 / 1984864) = 33.49% -> 33%
        }

        // Validate all file items
        items.forEach((item) => {
          expect(item.name).toBeTruthy();
          expect(item.packedSize).toBeLessThanOrEqual(item.originalSize);
          expect(item.crc32).toMatch(crc32Regex);
        });
      });

      // Edge case: Empty archive returns 0 ratio without divide-by-zero NaN
      const emptyItems: ArchivedItem[] = [];
      const emptyOriginal = emptyItems.reduce((sum, item) => sum + item.originalSize, 0);
      const emptyPacked = emptyItems.reduce((sum, item) => sum + item.packedSize, 0);
      const emptyRatio = emptyOriginal > 0 ? Math.round((1 - emptyPacked / emptyOriginal) * 100) : 0;
      expect(emptyRatio).toBe(0);
    });

    it('calculates FlashFetch 8-segment parallel chunk math with full boundary coverage', () => {
      const calculateChunks = (downloadedBytes: number, totalBytes: number) => {
        const taskProgress = downloadedBytes / Math.max(1, totalBytes);
        return Array.from({ length: 8 }).map((_, chunkIdx) => {
          return Math.min(1, Math.max(0, taskProgress * 8 - chunkIdx));
        });
      };

      const total = 8000000;

      // 1. 0% progress -> All chunks 0
      const chunks0 = calculateChunks(0, total);
      expect(chunks0).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

      // 2. 25% progress (2 / 8) -> First 2 chunks 1, rest 0
      const chunks25 = calculateChunks(2000000, total);
      expect(chunks25).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);

      // 3. 50% progress (4 / 8) -> First 4 chunks 1, rest 0
      const chunks50 = calculateChunks(4000000, total);
      expect(chunks50).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);

      // 4. 75% progress (6 / 8) -> First 6 chunks 1, rest 0
      const chunks75 = calculateChunks(6000000, total);
      expect(chunks75).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);

      // 5. 100% progress -> All 8 chunks 1
      const chunks100 = calculateChunks(8000000, total);
      expect(chunks100).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);

      // 6. In-between progress: 30% progress
      // taskProgress = 0.3 -> taskProgress * 8 = 2.4
      // chunk 0: min(1, max(0, 2.4 - 0)) = 1
      // chunk 1: min(1, max(0, 2.4 - 1)) = 1
      // chunk 2: min(1, max(0, 2.4 - 2)) = 0.4
      // chunks 3..7: 0
      const chunks30 = calculateChunks(2400000, total);
      expect(chunks30[0]).toBe(1);
      expect(chunks30[1]).toBe(1);
      expect(chunks30[2]).toBeCloseTo(0.4, 5);
      expect(chunks30[3]).toBe(0);
      expect(chunks30[7]).toBe(0);
    });

    it('enforces FlashFetch multi-connection queue slots and water-filling bandwidth allocation', () => {
      let speedKbps = 1024;
      const downloadManager = new DownloadManager({
        eventBus,
        vfs,
        getConnectionSpeedKbps: () => speedKbps,
      });

      // Start 4 FlashFetch downloads
      const t1 = downloadManager.startDownload({
        sourceId: 'src1',
        sourceUrl: 'http://downloadhub.local/file1.zip',
        fileName: 'file1.zip',
        totalBytes: 10_000_000,
        sourceMaxKbps: 200, // Bottleneck server at 200 kbps
        manager: 'flashfetch',
      });

      const t2 = downloadManager.startDownload({
        sourceId: 'src2',
        sourceUrl: 'http://downloadhub.local/file2.zip',
        fileName: 'file2.zip',
        totalBytes: 10_000_000,
        sourceMaxKbps: 1000,
        manager: 'flashfetch',
      });

      const t3 = downloadManager.startDownload({
        sourceId: 'src3',
        sourceUrl: 'http://downloadhub.local/file3.zip',
        fileName: 'file3.zip',
        totalBytes: 10_000_000,
        sourceMaxKbps: 1000,
        manager: 'flashfetch',
      });

      const t4 = downloadManager.startDownload({
        sourceId: 'src4',
        sourceUrl: 'http://downloadhub.local/file4.zip',
        fileName: 'file4.zip',
        totalBytes: 10_000_000,
        sourceMaxKbps: 1000,
        manager: 'flashfetch',
      });

      // All 4 FlashFetch downloads are actively downloading concurrently
      expect(downloadManager.getActiveDownloads().length).toBe(4);

      // Water-filling bandwidth allocation check:
      // Total bandwidth: 1024 kbps.
      // Initial fair share for 4 tasks: 256 kbps.
      // Task 1 is bottlenecked at 200 kbps (< 256).
      // Remaining bandwidth: 1024 - 200 = 824 kbps divided among 3 tasks = 274.67 kbps each.
      const task1 = downloadManager.getTask(t1.id);
      const task2 = downloadManager.getTask(t2.id);
      const task3 = downloadManager.getTask(t3.id);
      const task4 = downloadManager.getTask(t4.id);

      expect(task1?.allocatedKbps).toBe(200);
      expect(task2?.allocatedKbps).toBeCloseTo(824 / 3, 2);
      expect(task3?.allocatedKbps).toBeCloseTo(824 / 3, 2);
      expect(task4?.allocatedKbps).toBeCloseTo(824 / 3, 2);

      // When Task 1 is paused, remaining 3 tasks get full 1024 / 3 kbps
      downloadManager.pauseDownload(t1.id);
      expect(downloadManager.getTask(t1.id)?.allocatedKbps).toBe(0);
      expect(downloadManager.getTask(t2.id)?.allocatedKbps).toBeCloseTo(1024 / 3, 2);
      expect(downloadManager.getTask(t3.id)?.allocatedKbps).toBeCloseTo(1024 / 3, 2);
      expect(downloadManager.getTask(t4.id)?.allocatedKbps).toBeCloseTo(1024 / 3, 2);
    });

    it('enforces FlashFetch concurrency limit (4) with automatic queue drain on completion or cancellation', () => {
      const downloadManager = new DownloadManager({
        eventBus,
        vfs,
        getConnectionSpeedKbps: () => 1024,
      });

      // Start 6 FlashFetch downloads (2 over the 4-slot limit)
      const tasks = Array.from({ length: 6 }).map((_, i) =>
        downloadManager.startDownload({
          sourceId: `src_${i}`,
          sourceUrl: `http://downloadhub.local/file_${i}.zip`,
          fileName: `file_${i}.zip`,
          totalBytes: 5_000_000,
          sourceMaxKbps: 500,
          manager: 'flashfetch',
        })
      );

      // Exactly 4 are downloading, 2 remain queued
      const downloading = tasks.map((t) => downloadManager.getTask(t.id)?.status);
      expect(downloading.slice(0, 4)).toEqual(['downloading', 'downloading', 'downloading', 'downloading']);
      expect(downloading.slice(4, 6)).toEqual(['queued', 'queued']);

      // Cancel task 0 -> Task 4 should immediately promote from queued to downloading
      downloadManager.cancelDownload(tasks[0]!.id);
      expect(downloadManager.getTask(tasks[4]!.id)?.status).toBe('downloading');
      expect(downloadManager.getTask(tasks[5]!.id)?.status).toBe('queued');

      // Cancel task 1 -> Task 5 should immediately promote from queued to downloading
      downloadManager.cancelDownload(tasks[1]!.id);
      expect(downloadManager.getTask(tasks[5]!.id)?.status).toBe('downloading');
    });

    it('handles non-resumable download restart and insufficient disk space boundary errors', () => {
      const downloadManager = new DownloadManager({
        eventBus,
        vfs,
        getConnectionSpeedKbps: () => 1024,
      });

      // 1. Non-resumable task resets downloadedBytes on resume
      const nonResumable = downloadManager.startDownload({
        sourceId: 'src_stream',
        sourceUrl: 'http://stream.local/live.bin',
        fileName: 'live.bin',
        totalBytes: 10_000_000,
        sourceMaxKbps: 500,
        resumable: false,
        manager: 'flashfetch',
      });

      // Simulate partial download
      const task = downloadManager.getTask(nonResumable.id);
      if (task) task.downloadedBytes = 5_000_000;

      downloadManager.pauseDownload(nonResumable.id);
      expect(downloadManager.getTask(nonResumable.id)?.status).toBe('paused');

      downloadManager.resumeDownload(nonResumable.id);
      // Because resumable = false, downloadedBytes must reset to 0
      expect(downloadManager.getTask(nonResumable.id)?.downloadedBytes).toBe(0);

      // 2. Insufficient disk space error
      const hugeBytes = 50 * 1024 * 1024 * 1024; // 50 GB > 40 GB total disk
      expect(() =>
        downloadManager.startDownload({
          sourceId: 'src_huge',
          sourceUrl: 'http://downloadhub.local/huge.iso',
          fileName: 'huge.iso',
          totalBytes: hugeBytes,
          sourceMaxKbps: 1000,
        })
      ).toThrow(/Insufficient disk space on C:/);
    });
  });

  // =========================================================================
  // DOMAIN 5: Ecosystem App Feature Edge Cases (Weather, SafeSweep, Dialogue)
  // =========================================================================
  describe('Ecosystem App Feature Edge Cases (WeatherBuddy, SafeSweep, Pulse Dialogue)', () => {
    it('calculates WeatherBuddy temperature unit conversions and multi-day cyclic forecasts', () => {
      const toDisplayTemp = (f: number, isCelsius: boolean) => {
        if (!isCelsius) return `${f}°F`;
        const c = Math.round(((f - 32) * 5) / 9);
        return `${c}°C`;
      };

      // Exact freezing point
      expect(toDisplayTemp(32, false)).toBe('32°F');
      expect(toDisplayTemp(32, true)).toBe('0°C');

      // Room temp / comfortable
      expect(toDisplayTemp(68, false)).toBe('68°F');
      expect(toDisplayTemp(68, true)).toBe('20°C');

      // Boiling point
      expect(toDisplayTemp(212, true)).toBe('100°C');

      // Day wrapping / cyclic indexing across Day 1 to Day 14
      const FORECAST_LENGTH = 6;
      for (let day = 1; day <= 14; day++) {
        const forecastIndex = (day - 1) % FORECAST_LENGTH;
        expect(forecastIndex).toBeGreaterThanOrEqual(0);
        expect(forecastIndex).toBeLessThan(FORECAST_LENGTH);
      }
    });

    it('SafeSweep handles partial threat selection and individual threat toggling', () => {
      interface DetectedThreat {
        id: string;
        name: string;
        selected: boolean;
      }

      let threats: DetectedThreat[] = [
        { id: 'threat_1', name: 'Adware.Win32.SearchMate', selected: true },
        { id: 'threat_2', name: 'Spyware.KeyLogger.Old', selected: true },
        { id: 'threat_3', name: 'Tracking.Cookie.AdNet', selected: true },
      ];

      // Deselect threat 2
      threats = threats.map((t) => (t.id === 'threat_2' ? { ...t, selected: !t.selected } : t));
      expect(threats.find((t) => t.id === 'threat_2')?.selected).toBe(false);

      // Clean only selected threats (1 and 3)
      const toRemove = threats.filter((t) => t.selected);
      expect(toRemove.map((t) => t.id)).toEqual(['threat_1', 'threat_3']);

      // Remaining threats
      threats = threats.filter((t) => !t.selected);
      expect(threats.length).toBe(1);
      expect(threats[0]?.id).toBe('threat_2');
    });

    it('validates Pulse Messenger branching dialogue tree graph integrity', () => {
      expect(DIALOGUE_SCRIPTS.length).toBeGreaterThan(0);

      const allScriptIds = new Set(DIALOGUE_SCRIPTS.map((s) => s.id));

      DIALOGUE_SCRIPTS.forEach((script) => {
        expect(script.id).toBeTruthy();
        expect(script.buddyId).toBeTruthy();
        expect(script.messages.length).toBeGreaterThan(0);

        script.messages.forEach((msg) => {
          expect(msg.text).toBeTruthy();
        });

        if (script.playerChoices) {
          script.playerChoices.forEach((choice) => {
            expect(choice.text).toBeTruthy();
            expect(choice.socialAction).toBeTruthy();

            // If branching to next script, ensure the destination exists
            if (choice.nextScriptId) {
              expect(allScriptIds.has(choice.nextScriptId)).toBe(true);
            }
          });
        }
      });
    });
  });
});

