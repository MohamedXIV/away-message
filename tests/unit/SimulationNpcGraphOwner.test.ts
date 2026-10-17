import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import {
  SocialEngine, affinityKey, npcBondKey, neutralNpcBond,
  ROOM_BUMP_DAILY_CAP, ROOM_BUMP_PER_TURN,
} from '../../src/engine/SocialEngine';

describe('#173 canonical sparse NPC graph owner', () => {
  it('keeps default strangers sparse, directed bonds independent and read values detached', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const [a, b] = social.getBuddies();
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const key = npcBondKey(a!.id, b!.id);
    const reverse = npcBondKey(b!.id, a!.id);
    expect(key).not.toBe(reverse);
    expect(social.getState().npcBonds).toEqual({});
    expect(social.getNpcBond(a!.id, b!.id)).toEqual(neutralNpcBond());
    expect(social.isDatingAnyone(a!.id)).toBe(false);
    expect(social.getState().npcBonds).toEqual({});

    const emit = vi.spyOn(bus, 'emit');
    const adjusted = social.adjustNpcBond(a!.id, b!.id,
      { familiarity: 17, trust: 23, affection: 35 }, 4)!;
    expect(adjusted.updatedDay).toBe(4);
    expect(adjusted.dims.affection).toBe(35);
    expect(social.getNpcBond(b!.id, a!.id)).toEqual(neutralNpcBond());
    expect(Object.keys(social.getState().npcBonds!)).toEqual([key]);
    expect(emit).toHaveBeenCalledWith('social:npc_bond_updated', expect.objectContaining({
      fromId: a!.id, toId: b!.id,
    }));
    adjusted.dims.affection = 999;
    expect(social.getNpcBond(a!.id, b!.id).dims.affection).toBe(35);
    const romance = social.setNpcRomance(a!.id, b!.id, 'dating', 5);
    expect(romance?.romanceSinceDay).toBe(5);
    expect(social.setNpcRomance(a!.id, b!.id, 'dating', 6)).toEqual(romance);
    expect(social.isDatingAnyone(a!.id)).toBe(true);
    expect(social.isDatingAnyone(b!.id)).toBe(true);
    expect(social.buildRomanceContext(a!.id)).toContain(b!.displayName);
    expect(social.buildBondContext(a!.id)).toContain(b!.displayName);
    expect(social.setNpcRomance(b!.id, a!.id, 'none', 5)?.romance).toBe('none');
    expect(social.getState().npcBonds?.[reverse]).toBeUndefined();
    expect(social.applyNpcSocialAction(a!.id, b!.id, 'not_an_action', 6))
      .toEqual(social.getNpcBond(a!.id, b!.id));
    expect(social.adjustNpcBond(a!.id, a!.id, { trust: 3 }, 9)).toBeNull();
    expect(social.getState().npcBonds?.[reverse]).toBeUndefined();
  });

  it('retains bounded per-pair room affinity, authored seeds and exact snapshot round-trip', () => {
    const social = new SocialEngine(new EventBus());
    const [a, b, c] = social.getBuddies();
    expect(c).toBeDefined();
    const key = affinityKey(a!.id, b!.id);
    expect(key).toBe(affinityKey(b!.id, a!.id));
    const before = social.getAffinity(a!.id, b!.id);
    expect(social.bumpRoomAffinity([a!.id, b!.id, a!.id], 11)).toBe(1);
    expect(social.bumpRoomAffinity([a!.id, b!.id], 11)).toBe(1);
    expect(social.bumpRoomAffinity([a!.id, b!.id], 11)).toBe(1);
    expect(social.bumpRoomAffinity([a!.id, b!.id], 11)).toBe(0);
    expect(social.getAffinity(a!.id, b!.id)).toBe(before + ROOM_BUMP_DAILY_CAP);
    const dayKey = `${key}_11`;
    expect(social.getState().affinityCaps?.[dayKey]).toBe(ROOM_BUMP_DAILY_CAP);
    expect(ROOM_BUMP_PER_TURN).toBe(2);
    expect(social.bumpRoomAffinity([a!.id, b!.id], 12, 0)).toBe(0);
    expect(social.bumpRoomAffinity([a!.id, b!.id], 15)).toBe(1);
    expect(social.getState().affinityCaps?.[dayKey]).toBeUndefined();

    const fixed = social.adjustAffinity(a!.id, c!.id, 250);
    expect(fixed).toBe(100);
    expect(social.adjustAffinity(a!.id, c!.id, Number.NaN)).toBe(100);
    const snap = social.getState();
    const copy = new SocialEngine(new EventBus(), snap);
    expect(copy.getState()).toEqual(snap);
    expect(copy.getAffinity(a!.id, b!.id)).toBe(social.getAffinity(a!.id, b!.id));
    expect(copy.getState().npcBonds).toEqual(snap.npcBonds);
    expect(copy.buildAffinityContext(a!.id)).toBe(social.buildAffinityContext(a!.id));

    const left = copy.removeBuddy(a!.id);
    expect(left).toBe(true);
    expect(Object.keys(copy.getState().affinities ?? {}).some(k => k.split('__').includes(a!.id))).toBe(false);
    expect(Object.keys(copy.getState().affinityCaps ?? {}).some(k => k.includes(key))).toBe(false);
    expect(social.getState()).toEqual(snap);
  });

  it('validates corrupt graph restore, preserves sparse snapshot semantics and deterministic owner events', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const [a, b] = social.getBuddies();
    expect(b).toBeDefined();
    const initial = social.getState();
    const malformed = structuredClone(initial);
    const key = npcBondKey(a!.id, b!.id);
    malformed.npcBonds = {
      [key]: {
        dims: { ...neutralNpcBond().dims, trust: 550, annoyance: -70 },
        romance: 'dating', romanceSinceDay: 7, updatedDay: 8,
      },
      bad__bad: neutralNpcBond(),
    };
    malformed.affinities = {
      [affinityKey(a!.id, b!.id)]: 990,
      z__z: 12,
    };
    malformed.affinityCaps = { [`${affinityKey(a!.id, b!.id)}_4`]: 87 };
    social.restoreState(malformed);
    const cleaned = social.getState();
    expect(Object.keys(cleaned.npcBonds ?? {})).toEqual([key]);
    expect(cleaned.npcBonds?.[key]?.dims.trust).toBe(100);
    expect(cleaned.npcBonds?.[key]?.dims.annoyance).toBe(0);
    expect(cleaned.npcBonds?.[key]?.romance).toBe('dating');
    expect(cleaned.affinities?.[affinityKey(a!.id, b!.id)]).toBe(100);
    expect(cleaned.affinities?.z__z).toBeUndefined();
    expect(cleaned.affinityCaps?.[`${affinityKey(a!.id, b!.id)}_4`]).toBe(6);
    expect(new SocialEngine(new EventBus(), cleaned).getState()).toEqual(cleaned);
    expect(social.removeBuddy(a!.id)).toBe(true);
    expect(Object.keys(social.getState().npcBonds ?? {})).toEqual([]);
  });
});
