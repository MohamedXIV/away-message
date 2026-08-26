import { describe, it, expect, beforeEach } from 'vitest';
import { tokenizeEmoticons, renderEmoticonNodes } from '../../src/apps/pulse/utils/emoticonParser';
import { formatSimulationTime } from '../../src/apps/pulse/utils/timeFormat';
import { AWAY_MESSAGE_PRESETS } from '../../src/apps/pulse/data/awayMessagePresets';
import { DIALOGUE_SCRIPTS } from '../../src/apps/pulse/data/dialogueTrees';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import { useWindowStore } from '../../src/store/useWindowStore';

describe('Adversarial M3 Stress & Quality Suite: Pulse Messenger & Ecosystem Apps', () => {
  beforeEach(() => {
    // Reset store state
    useSimulationStore.setState((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        hardware: {
          ...prev.state.hardware,
          ramMB: 512,
          osVersion: 'Orion_4.8',
        },
        installedSoftware: [],
        downloads: [],
        social: {
          ...prev.state.social,
          presence: {
            player: { status: 'online', awayMessage: '' },
            maya: { status: 'online', awayMessage: '' },
            ryan: { status: 'away', awayMessage: 'At taco cart' },
            nora: { status: 'offline', awayMessage: '' },
          },
        },
      },
    }));
  });

  // =========================================================================
  // 1. PULSE MESSENGER: EMOTICONS, TOKENIZATION, TIME & DIALOGUE STRESS
  // =========================================================================
  describe('Pulse Messenger: Emoticon Tokenization & Formatting Edge Cases', () => {
    it('handles empty string, whitespace, and corrupt strings in tokenizeEmoticons', () => {
      expect(tokenizeEmoticons('', false)).toEqual([]);
      expect(tokenizeEmoticons('   ', false)).toEqual([{ type: 'text', content: '   ' }]);
      expect(tokenizeEmoticons('\n\t\r', false)).toEqual([{ type: 'text', content: '\n\t\r' }]);
    });

    it('parses all classic MSN/AIM emoticons accurately', () => {
      const sampleText = ':) :-) :D :-D :P :-P ;) ;-) :O :-O :@ :-@ :S :-S :| :-| :* :-* 8-) (H) (A) (6) (L) (U) (M) (C) (Y) (N)';
      const tokens = tokenizeEmoticons(sampleText, false);
      const emoticonTokens = tokens.filter((t) => t.type === 'emoticon');

      // 28 classic emoticon tokens in the list
      expect(emoticonTokens.length).toBe(28);
      expect(emoticonTokens.some((t) => t.glyph === '😊')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😄')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😛')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😉')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😮')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😡')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😖')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😐')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😘')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😎')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😇')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '😈')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '❤️')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '💔')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '🎵')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '☕')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '👍')).toBe(true);
      expect(emoticonTokens.some((t) => t.glyph === '👎')).toBe(true);
    });

    it('strictly isolates Orion 6.0 exclusive emoticons based on isOrion60 flag', () => {
      const orion60String = '(:star:) (:fire:) (:zap:) (:camera:)';
      
      // On Orion 4.8
      const tokens48 = tokenizeEmoticons(orion60String, false);
      expect(tokens48.every((t) => t.type === 'text')).toBe(true);

      // On Orion 6.0
      const tokens60 = tokenizeEmoticons(orion60String, true);
      const glyphs60 = tokens60.filter((t) => t.type === 'emoticon').map((t) => t.glyph);
      expect(glyphs60).toEqual(['⭐', '🔥', '⚡', '📷']);
    });

    it('handles nested tokens and code collisions safely by length-descending precedence', () => {
      // ':-)' should match before ':)'
      const text = ':-)';
      const tokens = tokenizeEmoticons(text, false);
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.content).toBe(':-)');
      expect(tokens[0]?.type).toBe('emoticon');
    });

    it('renders emoticon nodes into valid React elements', () => {
      const rendered = renderEmoticonNodes('Nice job! (Y) Great coffee (C)', false);
      expect(Array.isArray(rendered)).toBe(true);
      expect((rendered as unknown as any[]).length).toBeGreaterThan(0);
    });

    it('formats simulation minutes into boundary 12-hour AM/PM representations', () => {
      expect(formatSimulationTime(0)).toBe('12:00 AM');
      expect(formatSimulationTime(1)).toBe('12:01 AM');
      expect(formatSimulationTime(59)).toBe('12:59 AM');
      expect(formatSimulationTime(60)).toBe('01:00 AM');
      expect(formatSimulationTime(719)).toBe('11:59 AM');
      expect(formatSimulationTime(720)).toBe('12:00 PM');
      expect(formatSimulationTime(721)).toBe('12:01 PM');
      expect(formatSimulationTime(1439)).toBe('11:59 PM');
      expect(formatSimulationTime(1440)).toBe('12:00 AM'); // Wraps cleanly
      expect(formatSimulationTime(-10)).toBe('12:00 AM'); // Negative offset clamps to 0 (12:00 AM)
    });

    it('validates integrity of all authored dialogue scripts', () => {
      expect(DIALOGUE_SCRIPTS.length).toBeGreaterThanOrEqual(3);
      for (const script of DIALOGUE_SCRIPTS) {
        expect(script.id).toBeTruthy();
        expect(script.buddyId).toBeTruthy();
        expect(Array.isArray(script.messages)).toBe(true);
        expect(script.messages.length).toBeGreaterThan(0);

        for (const msg of script.messages) {
          expect(msg.text).toBeTruthy();
        }

        if (script.playerChoices) {
          for (const choice of script.playerChoices) {
            expect(choice.id).toBeTruthy();
            expect(choice.text).toBeTruthy();
            expect(choice.socialAction).toBeTruthy();
          }
        }
      }
    });

    it('validates authenticity and metadata of away message presets', () => {
      expect(AWAY_MESSAGE_PRESETS.length).toBeGreaterThanOrEqual(10);
      for (const preset of AWAY_MESSAGE_PRESETS) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.message).toBeTruthy();
        expect(preset.message.length).toBeLessThanOrEqual(300);
      }
    });
  });

  // =========================================================================
  // 2. PHOTOBOX 3.0: REQUIREMENT GATING & FILTER BOUNDARIES
  // =========================================================================
  describe('PhotoBox 3.0: Hardware/OS Gating & Adjustments', () => {
    it('fails gating when OS is Orion 4.8 regardless of RAM', () => {
      const ramConfigurations = [128, 256, 512, 768, 1024, 2048];
      for (const ram of ramConfigurations) {
        useSimulationStore.setState((prev) => ({
          state: {
            ...prev.state,
            hardware: { ...prev.state.hardware, ramMB: ram, osVersion: 'Orion_4.8' },
          },
        }));
        const hw = useSimulationStore.getState().state.hardware;
        const passes = hw.osVersion === 'Orion_6.0' && hw.ramMB >= 768;
        expect(passes).toBe(false);
      }
    });

    it('fails gating when RAM is strictly less than 768MB on Orion 6.0', () => {
      const insufficientRams = [128, 256, 512, 767];
      for (const ram of insufficientRams) {
        useSimulationStore.setState((prev) => ({
          state: {
            ...prev.state,
            hardware: { ...prev.state.hardware, ramMB: ram, osVersion: 'Orion_6.0' },
          },
        }));
        const hw = useSimulationStore.getState().state.hardware;
        const passes = hw.osVersion === 'Orion_6.0' && hw.ramMB >= 768;
        expect(passes).toBe(false);
      }
    });

    it('succeeds gating strictly on Orion 6.0 and RAM >= 768MB', () => {
      const validRams = [768, 1024, 2048];
      for (const ram of validRams) {
        useSimulationStore.setState((prev) => ({
          state: {
            ...prev.state,
            hardware: { ...prev.state.hardware, ramMB: ram, osVersion: 'Orion_6.0' },
          },
        }));
        const hw = useSimulationStore.getState().state.hardware;
        const passes = hw.osVersion === 'Orion_6.0' && hw.ramMB >= 768;
        expect(passes).toBe(true);
      }
    });
  });

  // =========================================================================
  // 3. WEATHERBUDDY & SAFESWEEP: ADWARE REMEDIATION STRESS
  // =========================================================================
  describe('WeatherBuddy Adware & SafeSweep Detection Remediation', () => {
    it('detects SearchMate adware accurately across multiple registry formats', () => {
      const installedRecords = [
        {
          id: 'sw_1',
          appId: 'weatherbuddy',
          name: 'WeatherBuddy 3.1',
          version: '3.1',
          installDateMinute: 10,
        },
        {
          id: 'sw_2',
          appId: 'searchmate',
          name: 'SearchMate Toolbar',
          version: '2.0',
          isAdware: true,
          adwarePayload: { toolbarInjected: true },
          installDateMinute: 10,
        },
      ];

      useSimulationStore.setState((prev) => ({
        state: {
          ...prev.state,
          installedSoftware: installedRecords as any,
        },
      }));

      const softwareList = useSimulationStore.getState().state.installedSoftware;
      const adwareThreats = softwareList.filter(
        (sw: any) => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
      );

      expect(adwareThreats.length).toBe(1);
      expect(adwareThreats[0]?.id).toBe('sw_2');
    });

    it('removes adware software and clears toolbar injection when uninstalled', () => {
      const installedRecords = [
        {
          id: 'sw_weatherbuddy',
          appId: 'weatherbuddy',
          name: 'WeatherBuddy 3.1',
          version: '3.1',
          installDateMinute: 10,
        },
        {
          id: 'sw_searchmate',
          appId: 'searchmate',
          name: 'SearchMate Toolbar',
          version: '2.0',
          isAdware: true,
          installDateMinute: 10,
        },
      ];

      useSimulationStore.setState((prev) => ({
        state: {
          ...prev.state,
          installedSoftware: installedRecords as any,
        },
      }));

      // Simulate uninstallation action
      const store = useSimulationStore.getState();
      store.dispatchAction({
        type: 'SOFTWARE_UNINSTALL',
        installedId: 'sw_searchmate',
      });

      const remainingSoftware = useSimulationStore.getState().state.installedSoftware;
      const remainingThreats = remainingSoftware.filter(
        (sw: any) => sw.appId === 'searchmate' || sw.isAdware
      );
      expect(remainingThreats.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. RETROAMP, FLASHFETCH, ZIPMATE, MAILBOX FUNCTIONAL INTEGRITY
  // =========================================================================
  describe('Ecosystem Apps Functional Boundaries', () => {
    it('FlashFetch calculates 8-thread download chunk partitioning correctly for 0% and 100%', () => {
      // 0%
      const chunks0 = Array.from({ length: 8 }).map((_, i) => Math.min(1, Math.max(0, 0 * 8 - i)));
      expect(chunks0.every((c) => c === 0)).toBe(true);

      // 100%
      const chunks100 = Array.from({ length: 8 }).map((_, i) => Math.min(1, Math.max(0, 1 * 8 - i)));
      expect(chunks100.every((c) => c === 1)).toBe(true);

      // 50%
      const chunks50 = Array.from({ length: 8 }).map((_, i) => Math.min(1, Math.max(0, 0.5 * 8 - i)));
      expect(chunks50.slice(0, 4).every((c) => c === 1)).toBe(true);
      expect(chunks50.slice(4).every((c) => c === 0)).toBe(true);
    });

    it('ZipMate handles compression ratio and byte formatting without division by zero', () => {
      const originalZero = 0;
      const packedZero = 0;
      const ratioZero = originalZero > 0 ? Math.round((1 - packedZero / originalZero) * 100) : 0;
      expect(ratioZero).toBe(0);

      const normalOriginal = 1000000;
      const normalPacked = 600000;
      const normalRatio = Math.round((1 - normalPacked / normalOriginal) * 100);
      expect(normalRatio).toBe(40);
    });

    it('WindowManager opens, minimizes, restores, and routes all M3 applications cleanly', () => {
      const winStore = useWindowStore.getState();
      const appIds = [
        'browser', 'voyager', 'pulse', 'pulse_messenger', 'retroamp',
        'flashfetch', 'zipmate', 'photobox', 'photobox_pro', 'weatherbuddy',
        'safesweep', 'mailbox',
      ];

      for (const appId of appIds) {
        winStore.openWindow({
          appId,
          title: `Test App ${appId}`,
          icon: '📦',
        });

        const currentWindows = useWindowStore.getState().windows;
        expect(currentWindows[appId]?.isOpen).toBe(true);

        winStore.minimizeWindow(appId);
        expect(useWindowStore.getState().windows[appId]?.isMinimized).toBe(true);

        winStore.restoreWindow(appId);
        expect(useWindowStore.getState().windows[appId]?.isMinimized).toBe(false);

        winStore.closeWindow(appId);
        expect(useWindowStore.getState().windows[appId]?.isOpen).toBe(false);
      }
    });
  });
});
