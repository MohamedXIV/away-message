import { describe, it, expect, vi } from 'vitest';
import { collectMissedPresenceActivities, pickOfflineMessage, OFFLINE_MESSAGE_POOLS, hashString } from '../../src/apps/pulse/PulseMessengerApp';
import { loadPulseState, makeDefaultPulseState, savePulseState } from '../../src/apps/pulse/persistence';

describe('Pulse Offline Messages & Activity Feed', () => {
  it('hashString is deterministic', () => {
    expect(hashString('maya:100')).toBe(hashString('maya:100'));
    expect(hashString('maya:100')).not.toBe(hashString('ryan:100'));
  });

  it('picks offline message from pool deterministically', () => {
    const msg1 = pickOfflineMessage('maya', 500);
    const msg2 = pickOfflineMessage('maya', 500);
    expect(msg1).toBe(msg2);
    expect(OFFLINE_MESSAGE_POOLS.maya).toContain(msg1);
    expect(OFFLINE_MESSAGE_POOLS.ryan).toContain(pickOfflineMessage('ryan', 510));
    expect(OFFLINE_MESSAGE_POOLS.nora).toContain(pickOfflineMessage('nora', 520));
    expect(OFFLINE_MESSAGE_POOLS.henderson).toContain(pickOfflineMessage('henderson', 530));
  });

  it('generates missed presence activities for schedule interval', () => {
    // Use a minimal mock schedule: maya is away 540-1050, online 1050-1260
    const mockGetBuddy = (id: string) => {
      if (id === 'maya') {
        return {
          displayName: 'Maya',
          schedule: {
            1: [
              { startMinuteOfDay: 0, endMinuteOfDay: 480, status: 'offline', awayMessage: 'sleeping' },
              { startMinuteOfDay: 480, endMinuteOfDay: 540, status: 'offline', awayMessage: 'morning tea' },
              { startMinuteOfDay: 540, endMinuteOfDay: 1050, status: 'away', awayMessage: 'at the desk... dont look at me' },
              { startMinuteOfDay: 1050, endMinuteOfDay: 1260, status: 'online', awayMessage: 'home! making coffee :)' },
              { startMinuteOfDay: 1260, endMinuteOfDay: 1440, status: 'online', awayMessage: 'listening to the rain ~ myplace/mayablue' },
            ],
          } as any,
        };
      }
      if (id === 'ryan') {
        return {
          displayName: 'Ryan',
          schedule: {
            1: [
              { startMinuteOfDay: 0, endMinuteOfDay: 420, status: 'offline', awayMessage: 'asleep' },
              { startMinuteOfDay: 420, endMinuteOfDay: 540, status: 'offline', awayMessage: 'commute' },
              { startMinuteOfDay: 540, endMinuteOfDay: 960, status: 'offline', awayMessage: 'work @ cart' },
              { startMinuteOfDay: 960, endMinuteOfDay: 1080, status: 'away', awayMessage: 'afk grabbin tacos' },
              { startMinuteOfDay: 1080, endMinuteOfDay: 1320, status: 'online', awayMessage: 'gaming / chilling' },
            ],
          } as any,
        };
      }
      return undefined;
    };

    // Interval 480 -> 1100 should capture maya's away at 540 and online at 1050, and ryan's away at 960 and online at 1080
    const activities = collectMissedPresenceActivities(480, 1100, mockGetBuddy as any, ['maya', 'ryan']);
    // Should contain at least 4 entries
    expect(activities.length).toBeGreaterThanOrEqual(4);
    const mayaAway = activities.find((a) => a.buddyId === 'maya' && a.kind === 'away');
    expect(mayaAway).toBeDefined();
    expect(mayaAway?.text).toContain('Maya is away');
    const mayaOnline = activities.find((a) => a.buddyId === 'maya' && a.kind === 'sign_in');
    expect(mayaOnline).toBeDefined();
    const ryanAway = activities.find((a) => a.buddyId === 'ryan' && a.kind === 'away');
    expect(ryanAway).toBeDefined();
    // Activities should be sorted by minute
    for (let i = 1; i < activities.length; i++) {
      expect(activities[i]!.minute).toBeGreaterThanOrEqual(activities[i - 1]!.minute);
    }
  });

  it('returns empty for tiny elapsed intervals', () => {
    const mockGetBuddy = () => ({ displayName: 'Maya', schedule: { 1: [] } } as any);
    expect(collectMissedPresenceActivities(500, 505, mockGetBuddy as any, ['maya'])).toEqual([]);
    expect(collectMissedPresenceActivities(500, 500, mockGetBuddy as any, ['maya'])).toEqual([]);
  });

  it('persists awayHistory alongside activityFeed', () => {
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
    state.activityFeed = [awayEntry];
    state.awayHistory = { maya: [awayEntry] };
    state.lastSeenTotalMinutes = 700;
    savePulseState(state);

    const restored = loadPulseState();
    expect(restored.awayHistory.maya).toBeDefined();
    expect(restored.awayHistory.maya?.[0]?.text).toContain('Maya is away');
    expect(restored.activityFeed[0]?.buddyId).toBe('maya');
    // Ensure slicing respects limits
    expect(restored.activityFeed.length).toBe(1);

    vi.unstubAllGlobals();
  });

  it('offline pools have at least 5 variants per buddy for variety', () => {
    expect((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['maya']!.length).toBeGreaterThanOrEqual(5);
    expect((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['ryan']!.length).toBeGreaterThanOrEqual(5);
    expect((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['nora']!.length).toBeGreaterThanOrEqual(5);
    expect((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['henderson']!.length).toBeGreaterThanOrEqual(5);
    // Ensure variety — pools are not all identical strings
    const mayaPool = (OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['maya']!;
    const allMayaUnique = new Set(mayaPool).size === mayaPool.length;
    expect(allMayaUnique).toBe(true);
  });
});
