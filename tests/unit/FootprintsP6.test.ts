import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { getStreetSighting } from '../../src/world/data/windowThoughts';
import { formatLastSeen } from '../../src/apps/pulse/components/BuddyItem';
import { buildWeeklyNpcThreads } from '../../src/engine/BoardDirector';
import type { BoardBuddy } from '../../src/engine/BoardDirector';

const BUDDIES: BoardBuddy[] = [
  { id: 'maya', displayName: 'Maya', handle: 'starlight_maya', archetype: 'artist', stage: 'acquaintance', status: 'acquaintance' },
  { id: 'ryan', displayName: 'Ryan', handle: 'ryan_foodcart', archetype: 'coworker', stage: 'friend', status: 'friend' },
  { id: 'nora', displayName: 'Nora', handle: 'NightOwl87', archetype: 'nightowl', stage: 'acquaintance', status: 'acquaintance' },
];

const AFF = (a: string, b: string): number => {
  const key = [a, b].sort().join('__');
  const table: Record<string, number> = { maya__ryan: 15, maya__nora: 5, nora__ryan: -5 };
  return table[key] ?? 0;
};

describe('P6.5 street sightings (witnessed, not messenger inference)', () => {
  const observed = {
    id: 'actor_evening', displayName: 'Alex',
    reach: 'local' as const, knownToPlayer: true,
    physicallyVisibleFromWindow: true,
  };

  it('captions only an actually witnessed local person', () => {
    expect(getStreetSighting([observed], 'evening', 3)).toContain('Alex');
    expect(getStreetSighting([], 'evening', 3)).toBeNull();
    expect(getStreetSighting([
      { ...observed, physicallyVisibleFromWindow: false },
    ], 'evening', 3)).toBeNull();
    expect(getStreetSighting([{ ...observed, reach: 'remote' }], 'evening', 3)).toBeNull();
  });

  it('does not invent missing-person observations from a distant relationship', () => {
    const distant = { ...observed, displayName: 'Sam',
      lifecycleStatus: 'distant', physicallyVisibleFromWindow: false };
    for (let day = 1; day <= 100; day++) {
      expect(getStreetSighting([distant], 'evening', day)).toBeNull();
    }
  });

  it('is deterministic for the same witnessed actor and day', () => {
    expect(getStreetSighting([observed], 'night', 5))
      .toBe(getStreetSighting([observed], 'night', 5));
  });
});

describe('P6.5 timed board posts', () => {
  it('staggers OPs and replies inside their week, ascending', () => {
    const threads = buildWeeklyNpcThreads(3, BUDDIES, AFF, []);
    expect(threads.length).toBeGreaterThan(0);
    for (const t of threads) {
      expect(t.day).toBeGreaterThanOrEqual(1);
      expect(t.day).toBeLessThanOrEqual(7);
      let prev = t.day;
      for (const r of t.replies) {
        expect(r.day).toBeGreaterThan(prev);
        expect(r.day).toBeLessThanOrEqual(7);
        prev = r.day;
      }
    }
  });
});

describe('P6.5 last footprints (SocialEngine + formatter)', () => {
  let social: SocialEngine;
  beforeEach(() => { social = new SocialEngine(new EventBus()); });

  it('tracks the latest conversation minute per buddy', () => {
    expect(social.getLastActivityMinute('maya')).toBe(0);
    social.sendMessage('maya', 'player', 'maya', 'hey', 1500);
    social.sendMessage('maya', 'maya', 'player', 'yo', 1600);
    expect(social.getLastActivityMinute('maya')).toBe(1600);
    expect(social.getLastActivityMinute('ryan')).toBe(0);
  });

  it('formats last-seen labels', () => {
    expect(formatLastSeen(0)).toBe('');
    expect(formatLastSeen(1500)).toBe('last seen Day 2, 01:00');
  });
});
