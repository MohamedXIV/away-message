import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine, SEED_AFFINITIES, BUDDY_ID_ALIASES } from '../../src/engine/SocialEngine';
import {
  SEED_BY_ID,
  SEED_CHARACTERS,
  seedCharacterDef,
  seedCharacterIds,
  isSeedCharacter,
} from '../../src/engine/seedCharacters';
import {
  SEED_ID_TO_ARCHETYPE,
  SEED_TRAITS,
  SEED_SIGNATURE_COLORS,
  traitsForBuddy,
  buddySignatureColor,
} from '../../src/engine/characterTemplates';
import { SEED_PROFILE_ALIASES } from '../../src/engine/MyPlaceEngine';
import { buddyPersonaLine } from '../../src/apps/pulse/utils/chatContext';

describe('Seed character registry', () => {
  it('provides authored defaults without imposing a sacred count or identity list', () => {
    expect(SEED_CHARACTERS.length).toBeGreaterThan(0);
    const ids = seedCharacterIds();
    expect(new Set(ids).size).toBe(ids.length);

    for (const seed of SEED_CHARACTERS) {
      expect(seed.id).toBeTruthy();
      expect(seed.displayName).toBeTruthy();
      expect(seed.handle).toBeTruthy();
      expect(SEED_BY_ID[seed.id]?.id).toBe(seed.id);
      expect(isSeedCharacter(seed.id)).toBe(true);

      const def = seedCharacterDef(seed.id);
      expect(def.id).toBe(seed.id);
      expect(Object.keys(def.schedule).map(Number).sort((a, b) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7]);
    }

    expect(isSeedCharacter('not_an_authored_seed')).toBe(false);
  });

  it('seeds SocialEngine from content while keeping the runtime roster mutable', () => {
    const social = new SocialEngine(new EventBus());
    expect(social.getBuddies().map((buddy) => buddy.id)).toEqual(seedCharacterIds());

    const first = social.getBuddies()[0];
    expect(first).toBeDefined();
    if (!first) return;

    expect(social.removeBuddy(first.id)).toBe(true);
    expect(social.getBuddy(first.id)).toBeUndefined();
  });

  it('derives aliases, traits, archetypes, colors and profiles from seed data', () => {
    for (const seed of SEED_CHARACTERS) {
      expect(BUDDY_ID_ALIASES[seed.handle]).toBe(seed.id);
      expect(SEED_ID_TO_ARCHETYPE[seed.id]).toBe(seed.archetype);
      expect(SEED_TRAITS[seed.id]).toEqual(seed.traits);
      expect(SEED_SIGNATURE_COLORS[seed.id]).toBe(seed.color);
      expect(traitsForBuddy(seed.id, seed.archetype)).toEqual(seed.traits);
      expect(buddySignatureColor(seed.id, seed.archetype)).toBe(seed.color);
      if (seed.myplace) {
        expect(SEED_PROFILE_ALIASES[seed.id]).toBe(seed.myplace);
        expect(SEED_PROFILE_ALIASES[seed.handle]).toBe(seed.myplace);
      }
      expect(buddyPersonaLine(seed.id, seedCharacterDef(seed.id))).toBeTruthy();
    }

    for (const [pair, value] of Object.entries(SEED_AFFINITIES)) {
      const [a, b] = pair.split('__');
      expect(a && isSeedCharacter(a)).toBe(true);
      expect(b && isSeedCharacter(b)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-100);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
