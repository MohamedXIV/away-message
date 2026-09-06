import { describe, it, expect } from 'vitest';
import { SocialEngine, SEED_AFFINITIES, BUDDY_ID_ALIASES } from '../../src/engine/SocialEngine';
import { EventBus } from '../../src/engine/EventBus';
import {
  CORE_BY_ID,
  CORE_BUDDIES,
  CORE_IDS,
  coreBuddyDef,
  coreBuddyIds,
  isCoreBuddyId,
} from '../../src/engine/coreBuddies';
import {
  CORE_ID_TO_ARCHETYPE,
  CORE_TRAITS,
  CORE_SIGNATURE_COLORS,
  traitsForBuddy,
  buddySignatureColor,
  isCoreBuddyId as templatesIsCore,
} from '../../src/engine/characterTemplates';
import { CORE_PROFILE_ALIASES } from '../../src/engine/MyPlaceEngine';
import { buddyPersonaLine } from '../../src/apps/pulse/utils/chatContext';

// Phase 1 registry contract: every derived map matches the authored values
// byte-for-byte. Phase 2 renames change the store; these tests pin the move.

describe('Core registry (single source of truth)', () => {
  it('holds the four canonical buddies with exact identity', () => {
    expect(coreBuddyIds().sort()).toEqual(['henderson', 'maya', 'nora', 'ryan']);
    expect(CORE_BUDDIES).toHaveLength(4);
    expect(CORE_BY_ID['maya']).toMatchObject({
      displayName: 'Maya', handle: 'starlight_maya', myplace: 'maya_x',
      archetype: 'artist', status: 'acquaintance', color: '#6a3fa0', typingSpeedWpm: 60,
    });
    expect(CORE_BY_ID['ryan']).toMatchObject({
      displayName: 'Ryan', handle: 'ryan_foodcart', status: 'friend', typingSpeedWpm: 80,
    });
    expect(CORE_IDS).toEqual({ RYAN: 'ryan', MAYA: 'maya', NORA: 'nora', HENDERSON: 'henderson' });
    expect(isCoreBuddyId('maya')).toBe(true);
    expect(isCoreBuddyId('sam_guitar')).toBe(false);
    expect(templatesIsCore('nora')).toBe(true);
  });

  it('seeds SocialEngine roster byte-identically (14-day schedules included)', () => {
    const social = new SocialEngine(new EventBus());
    // Roster order is load-bearing (seeded rolls iterate it) — store.json authorial order.
    expect(social.getBuddies().map((b) => b.id)).toEqual(['ryan', 'maya', 'nora', 'henderson']);
    for (const id of coreBuddyIds()) {
      const expected = coreBuddyDef(id);
      expect(social.getBuddy(id)).toEqual(expected);
      expect(Object.keys(expected.schedule).map(Number).sort((a, b) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    }
    // Ryan online gaming late, Henderson at the desk mornings
    expect(social.getPresence('ryan')).toBeDefined();
  });

  it('derives every legacy map from the registry', () => {
    expect(BUDDY_ID_ALIASES).toEqual({
      starlight_maya: 'maya', ryan_foodcart: 'ryan', NightOwl87: 'nora', motel_office: 'henderson',
    });
    expect(CORE_PROFILE_ALIASES).toEqual({
      maya: 'maya_x', starlight_maya: 'maya_x',
      ryan: 'tacocart_ryan', ryan_foodcart: 'tacocart_ryan',
      nora: 'nightowl87', NightOwl87: 'nightowl87',
    });
    expect(SEED_AFFINITIES).toEqual({
      maya__ryan: 15, henderson__maya: 10, henderson__ryan: 10,
      maya__nora: 5, henderson__nora: 0, nora__ryan: -5,
    });
    expect(CORE_ID_TO_ARCHETYPE).toEqual({ ryan: 'coworker', maya: 'artist', nora: 'nightowl', henderson: 'regular' });
    expect(CORE_TRAITS['maya']).toEqual({ shyness: 88, warmth: 62, discipline: 48, spontaneity: 45, loyalty: 85 });
    expect(CORE_SIGNATURE_COLORS).toEqual({ ryan: '#d96c3b', maya: '#6a3fa0', nora: '#2e7f86', henderson: '#7a5c3e' });
    expect(traitsForBuddy('maya', 'artist').shyness).toBe(88);
    expect(buddySignatureColor('nora', 'nightowl')).toBe('#2e7f86');
    expect(buddySignatureColor('stranger_x', 'student')).toBe('#4e9e4e');
  });

  it('voices core personas from the registry', () => {
    expect(buddyPersonaLine('maya', null)).toContain('gentle honesty');
    expect(buddyPersonaLine('henderson', null)).toContain('property calm');
  });
});
