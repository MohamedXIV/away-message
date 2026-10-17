import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { filterPlayerVisiblePulseActivity } from '../../src/apps/pulse/components/BuddyListWindow';
import type { PulseActivityEntry } from '../../src/apps/pulse/types';

describe('#172 player-visible Pulse activity is limited by actual contact knowledge', () => {
  it('hides unknown one-to-one activity without mutating the saved Pulse feed', () => {
    const game = new SimulationEngine();
    const visible = game.social.getBuddies()[0]!;
    expect(visible).toBeDefined();
    // Seed roster knowledge varies with authored backstory. Register an
    // explicitly undiscovered actor rather than guessing who is unknown.
    const hidden = game.social.registerBuddy({
      ...visible,
      id: 'unlearned_activity_actor',
      handle: 'unlearned_activity_actor',
      displayName: 'Unlearned Activity Actor',
      status: 'stranger',
      reach: 'local',
    });
    expect(game.social.learnHandle(visible.id, visible.handle)).toBe(true);
    expect(game.social.isKnown(hidden.id)).toBe(false);
    const activity: PulseActivityEntry[] = [
      { id: 'a', buddyId: hidden!.id, kind: 'sign_in', text: 'SECRET NAME signed in', minute: 480, createdAt: 1, isRead: false },
      { id: 'b', buddyId: visible!.id, kind: 'away', text: 'Known contact away', minute: 481, createdAt: 2, isRead: false },
      { id: 'c', buddyId: 'room_public', kind: 'room', text: 'Public channel update', minute: 482, createdAt: 3, isRead: false },
      { id: 'd', buddyId: hidden!.id, kind: 'message', text: 'SECRET MESSAGE arrived', minute: 483, createdAt: 4, isRead: false },
    ];
    const frozenBaseline = JSON.parse(JSON.stringify(activity));
    const whole = vi.spyOn(game, 'getState');
    const canonical = vi.spyOn(game.social, 'getState');
    const shown = filterPlayerVisiblePulseActivity(activity, id => game.social.isKnown(id));

    expect(shown.map(a => a.id)).toEqual(['b', 'c']);
    expect(JSON.stringify(shown)).not.toContain('SECRET');
    expect(activity).toEqual(frozenBaseline);
    expect(whole).not.toHaveBeenCalled();
    expect(canonical).not.toHaveBeenCalled();

    expect(game.social.learnHandle(hidden!.id, hidden!.handle)).toBe(true);
    const revealed = filterPlayerVisiblePulseActivity(activity, id => game.social.isKnown(id));
    expect(revealed.map(a => a.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(JSON.parse(JSON.stringify(revealed))).toEqual(revealed);
  });
});
