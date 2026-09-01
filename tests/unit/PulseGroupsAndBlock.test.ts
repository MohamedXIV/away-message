import { describe, it, expect, vi } from 'vitest';
import { loadPulseState, makeDefaultPulseState, savePulseState } from '../../src/apps/pulse/persistence';
import { PULSE_GROUPS } from '../../src/apps/pulse/data/pulseRooms';

describe('Pulse Groups, Block & Context Menu Persistence', () => {
  it('initializes with blocked empty, groupLabels empty and groupOrder covering all groups', () => {
    const state = makeDefaultPulseState();
    expect(state.blockedBuddyIds).toEqual([]);
    expect(state.groupLabels).toEqual({});
    expect(state.groupOrder).toEqual(Object.keys(PULSE_GROUPS));
  });

  it('persists blocked buddies and restores them', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const state = makeDefaultPulseState();
    state.blockedBuddyIds = ['ryan', 'nora'];
    state.groupLabels = { friends: 'My Crew' };
    state.groupOrder = ['work', 'friends'];
    savePulseState(state);

    const restored = loadPulseState();
    expect(restored.blockedBuddyIds).toEqual(['ryan', 'nora']);
    expect(restored.groupLabels['friends']).toBe('My Crew');
    expect(restored.groupOrder[0]).toBe('work');
    expect(restored.groupOrder[1]).toBe('friends');

    vi.unstubAllGlobals();
  });

  it('sanitizes invalid groupLabels and groupOrder on load', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const raw = {
      ...makeDefaultPulseState(),
      groupLabels: { friends: '  New Friends Name That Is Way Too Long And Should Be Sliced At Thirty Two Characters Exactly!!! ', unknownGroup: 'should be ignored', work: '' },
      groupOrder: ['friends', 'friends', 'unknown_group', 'work'],
      blockedBuddyIds: ['maya', 123 as any, null as any, 'ryan'],
    };
    // bypass save sanitization by writing raw JSON directly
    (globalThis as any).window.localStorage.setItem('away_message_pulse_state_v1', JSON.stringify(raw));
    const restored = loadPulseState();
    // only known groups, trimmed, non-empty
    expect(restored.groupLabels['friends']!.length).toBeLessThanOrEqual(32);
    expect(restored.groupLabels['unknownGroup']).toBeUndefined();
    expect(restored.groupLabels['work']).toBeUndefined(); // empty string ignored
    // duplicate and unknown filtered, but all groups must still appear
    expect(new Set(restored.groupOrder).size).toBe(restored.groupOrder.length);
    expect(restored.groupOrder).toContain('friends');
    expect(restored.groupOrder).toContain('work');
    expect(restored.groupOrder).not.toContain('unknown_group');
    // blocked sanitized to strings only
    expect(restored.blockedBuddyIds).toEqual(['maya', 'ryan']);

    vi.unstubAllGlobals();
  });

  it('preserves awayHistory alongside blocked and groups', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const state = makeDefaultPulseState();
    const awayEntry = {
      id: 'activity_maya_600_away',
      buddyId: 'maya',
      kind: 'away' as const,
      text: 'Maya is away: at the desk... dont look at me',
      minute: 600,
      createdAt: Date.now(),
      isRead: false,
    };
    state.awayHistory = { maya: [awayEntry] };
    state.blockedBuddyIds = ['henderson'];
    state.groupLabels = { work: 'Motel Staff' };
    savePulseState(state);
    const restored = loadPulseState();
    expect(restored.awayHistory.maya?.[0]?.text).toContain('Maya is away');
    expect(restored.blockedBuddyIds).toContain('henderson');
    expect(restored.groupLabels.work).toBe('Motel Staff');

    vi.unstubAllGlobals();
  });

  it('groupOrder reorder logic maintains all groups', () => {
    const state = makeDefaultPulseState();
    // simulate moving friends down
    const order = [...state.groupOrder];
    const idx = order.indexOf('friends');
    if (idx !== -1 && idx < order.length - 1) {
      const tmp = order[idx]!;
      order[idx] = order[idx + 1]!;
      order[idx + 1] = tmp;
    }
    state.groupOrder = order;
    expect(state.groupOrder).toContain('friends');
    expect(state.groupOrder).toContain('work');
    // ensure no duplicates
    expect(new Set(state.groupOrder).size).toBe(state.groupOrder.length);
  });
});
