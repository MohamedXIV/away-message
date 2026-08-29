import { describe, it, expect, vi } from 'vitest';
import { parseEmoticons } from '../../src/apps/pulse/utils/emoticonParser';
import { AWAY_MESSAGE_PRESETS } from '../../src/apps/pulse/data/awayMessagePresets';
import { DIALOGUE_SCRIPTS } from '../../src/apps/pulse/data/dialogueTrees';
import { formatSimulationTime } from '../../src/apps/pulse/utils/timeFormat';
import { loadPulseState, makeDefaultPulseState, savePulseState } from '../../src/apps/pulse/persistence';

describe('Pulse Messenger Subsystem Test Suite', () => {
  it('formats simulation minutes into 12-hour AM/PM times', () => {
    expect(formatSimulationTime(0)).toBe('12:00 AM');
    expect(formatSimulationTime(480)).toBe('08:00 AM');
    expect(formatSimulationTime(720)).toBe('12:00 PM');
    expect(formatSimulationTime(1020)).toBe('05:00 PM');
    expect(formatSimulationTime(1439)).toBe('11:59 PM');
  });

  it('parses classic text emoticons into visual tokens', () => {
    const tokens = parseEmoticons('hello :) how are you? :D', false);
    expect(tokens.some((t) => t.type === 'emoticon' && t.glyph === '😊')).toBe(true);
    expect(tokens.some((t) => t.type === 'emoticon' && t.glyph === '😄')).toBe(true);
  });

  it('handles Orion 6.0 exclusive emoticons when OS is Orion 6.0', () => {
    const tokensOrion60 = parseEmoticons('check out (:camera:) photo', true);
    expect(tokensOrion60.some((t) => t.type === 'emoticon' && t.glyph === '📷')).toBe(true);

    const tokensOrion48 = parseEmoticons('check out (:camera:) photo', false);
    // When not Orion 6.0, remains raw text
    expect(tokensOrion48.some((t) => t.type === 'text' && t.content.includes('(:camera:)'))).toBe(true);
  });

  it('provides rich authentic away message presets across categories', () => {
    expect(AWAY_MESSAGE_PRESETS.length).toBeGreaterThanOrEqual(10);
    const categories = new Set(AWAY_MESSAGE_PRESETS.map((p) => p.category));
    expect(categories.has('status')).toBe(true);
    expect(categories.has('activity')).toBe(true);
    expect(categories.has('quote')).toBe(true);
    expect(categories.has('retro')).toBe(true);
  });

  it('persists room transcripts and request state across Pulse reloads', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const state = makeDefaultPulseState();
    state.joinedRoomIds = ['pc-help'];
    state.friendRequestStatus = 'accepted';
    state.roomMessages['pc-help'] = [{ id: 'room-1', senderId: 'player', senderName: 'wanderer06', text: 'anyone here? :)', minute: 1400 }];
    savePulseState(state);

    const restored = loadPulseState();
    expect(restored.joinedRoomIds).toEqual(['pc-help']);
    expect(restored.friendRequestStatus).toBe('accepted');
    expect(restored.roomMessages['pc-help']?.[0]?.text).toBe('anyone here? :)');
    vi.unstubAllGlobals();
  });

  it('has structured branching dialogue scripts with narrative action impacts', () => {
    const mayaScript = DIALOGUE_SCRIPTS.find((s) => s.id === 'maya_day1_greeting');
    expect(mayaScript).toBeDefined();
    expect(mayaScript?.messages.length).toBeGreaterThan(0);
    expect(mayaScript?.playerChoices?.length).toBeGreaterThan(0);

    const firstChoice = mayaScript?.playerChoices?.[0];
    expect(firstChoice?.socialAction).toBe('empathy');
    expect(firstChoice?.nextScriptId).toBe('maya_day1_fast');
  });
});
