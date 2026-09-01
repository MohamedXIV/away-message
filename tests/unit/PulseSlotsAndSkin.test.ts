import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPulseState, savePulseState, makeDefaultPulseState, getCurrentPulseSlotId, setCurrentPulseSlotId, getPulseSlotStorageKey } from '../../src/apps/pulse/persistence';

describe('Pulse Save-Slot-Specific State', () => {
  beforeEach(() => {
    // Clear all pulse keys
    if (typeof window !== 'undefined') {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('away_message_pulse_state')) keys.push(key);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.removeItem('pulse_current_slot');
    }
  });

  it('defaults to slot_1 and isolates slot_1 vs slot_2', () => {
    let stored: Record<string, string> = {};
    const fakeWindow: any = {
      localStorage: {
        getItem: (k: string) => stored[k] || null,
        setItem: (k: string, v: string) => { stored[k] = v; },
        removeItem: (k: string) => { delete stored[k]; },
        clear: () => { stored = {}; },
        get length() { return Object.keys(stored).length; },
        key: (i: number) => Object.keys(stored)[i] || null,
      },
    };
    vi.stubGlobal('window', fakeWindow);

    expect(getCurrentPulseSlotId()).toBe('slot_1');

    const state1 = makeDefaultPulseState();
    state1.activityFeed = [{ id: 'a1', buddyId: 'maya', kind: 'message', text: 'Maya in slot1', minute: 600, createdAt: Date.now(), isRead: false }];
    state1.blockedBuddyIds = ['ryan'];
    savePulseState(state1, 'slot_1');

    const state2 = makeDefaultPulseState();
    state2.activityFeed = [{ id: 'a2', buddyId: 'nora', kind: 'message', text: 'Nora in slot2', minute: 700, createdAt: Date.now(), isRead: false }];
    state2.blockedBuddyIds = ['maya'];
    savePulseState(state2, 'slot_2');

    const loaded1 = loadPulseState('slot_1');
    const loaded2 = loadPulseState('slot_2');

    expect(loaded1.activityFeed[0]!.text).toContain('slot1');
    expect(loaded1.blockedBuddyIds).toContain('ryan');
    expect(loaded2.activityFeed[0]!.text).toContain('slot2');
    expect(loaded2.blockedBuddyIds).toContain('maya');
    expect(loaded2.activityFeed[0]!.text).not.toBe(loaded1.activityFeed[0]!.text);

    vi.unstubAllGlobals();
  });

  it('setCurrentPulseSlotId and getCurrentPulseSlotId round-trip', () => {
    let stored: Record<string, string> = {};
    const fakeWindow: any = {
      localStorage: {
        getItem: (k: string) => stored[k] || null,
        setItem: (k: string, v: string) => { stored[k] = v; },
        removeItem: (k: string) => { delete stored[k]; },
        clear: () => { stored = {}; },
        get length() { return Object.keys(stored).length; },
        key: (i: number) => Object.keys(stored)[i] || null,
      },
    };
    vi.stubGlobal('window', fakeWindow);

    setCurrentPulseSlotId('slot_3');
    expect(getCurrentPulseSlotId()).toBe('slot_3');
    expect(window.localStorage.getItem('pulse_current_slot')).toBe('slot_3');

    // Invalid slot id should be sanitized
    setCurrentPulseSlotId('  ');
    expect(getCurrentPulseSlotId()).toBe('slot_1');

    vi.unstubAllGlobals();
  });

  it('getPulseSlotStorageKey is deterministic', () => {
    expect(getPulseSlotStorageKey('slot_1')).toBe('away_message_pulse_state_v1:slot_1');
    expect(getPulseSlotStorageKey('slot_2')).toBe('away_message_pulse_state_v1:slot_2');
  });

  it('migrates legacy global key to slot-specific on first load', () => {
    let stored: Record<string, string> = {};
    const fakeWindow: any = {
      localStorage: {
        getItem: (k: string) => stored[k] || null,
        setItem: (k: string, v: string) => { stored[k] = v; },
        removeItem: (k: string) => { delete stored[k]; },
        clear: () => { stored = {}; },
        get length() { return Object.keys(stored).length; },
        key: (i: number) => Object.keys(stored)[i] || null,
      },
    };
    vi.stubGlobal('window', fakeWindow);

    const legacyState = makeDefaultPulseState();
    legacyState.activityFeed = [{ id: 'legacy', buddyId: 'ryan', kind: 'sign_in', text: 'Ryan signed in.', minute: 500, createdAt: Date.now(), isRead: false }];
    // Write only to legacy key (simulating old version)
    window.localStorage.setItem('away_message_pulse_state_v1', JSON.stringify(legacyState));

    // Loading slot_1 should find legacy and return its data (migration)
    const loaded = loadPulseState('slot_1');
    expect(loaded.activityFeed.some((e) => e.text.includes('Ryan signed in'))).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('Pulse Classic Skins', () => {
  it('defaults to blue skin', () => {
    const state = makeDefaultPulseState();
    expect(state.pulseSkin).toBe('blue');
  });

  it('persists skin per slot and isolates', () => {
    let stored: Record<string, string> = {};
    const fakeWindow: any = {
      localStorage: {
        getItem: (k: string) => stored[k] || null,
        setItem: (k: string, v: string) => { stored[k] = v; },
        removeItem: (k: string) => { delete stored[k]; },
        clear: () => { stored = {}; },
        get length() { return Object.keys(stored).length; },
        key: (i: number) => Object.keys(stored)[i] || null,
      },
    };
    vi.stubGlobal('window', fakeWindow);

    const state1 = makeDefaultPulseState();
    state1.pulseSkin = 'dark';
    savePulseState(state1, 'slot_1');

    const state2 = makeDefaultPulseState();
    state2.pulseSkin = 'silver';
    savePulseState(state2, 'slot_2');

    expect(loadPulseState('slot_1').pulseSkin).toBe('dark');
    expect(loadPulseState('slot_2').pulseSkin).toBe('silver');

    // Invalid skin falls back to blue
    const raw = { ...makeDefaultPulseState(), pulseSkin: 'neon' as any };
    window.localStorage.setItem(getPulseSlotStorageKey('slot_3'), JSON.stringify(raw));
    expect(loadPulseState('slot_3').pulseSkin).toBe('blue');

    vi.unstubAllGlobals();
  });

  it('has three valid skin options', () => {
    const skins = ['blue', 'silver', 'dark'] as const;
    skins.forEach((skin) => {
      const state = makeDefaultPulseState();
      state.pulseSkin = skin;
      expect(['blue', 'silver', 'dark']).toContain(state.pulseSkin);
    });
  });
});
