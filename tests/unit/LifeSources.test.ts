import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildCharacter } from '../../src/engine/CharacterEngine';
import { createLifeSources } from '../../src/engine/life/LifeSources';

describe('Life Matrix source boundary', () => {
  it('exposes reads without exposing source mutation', () => {
    const sources = createLifeSources({
      getBuddy: (id) =>
        id === 'sam'
          ? ({ id: 'sam', schedule: {} } as { id: string; schedule: Record<number, unknown[]> })
          : undefined,
      getTraits: () => ({
        shyness: 40,
        warmth: 55,
        discipline: 80,
        spontaneity: 30,
        loyalty: 70,
      }),
      getPlayerRelationship: () => null,
      getNpcBonds: () => [],
      getPromises: () => [],
      getAgenda: () => [],
      getPresence: () => ({ messengerStatus: 'offline', awayMessage: '' }),
      getAppointments: () => [],
      getTriggeredEvents: () => [],
    });

    expect(sources.getTraits('sam').discipline).toBe(80);
    expect('applySocialAction' in (sources as object)).toBe(false);
    expect('adjustNpcBond' in (sources as object)).toBe(false);
  });
});


describe('Sparse canonical NPC bond reads (#175 / #177)', () => {
  const legacy = (social: SocialEngine, actorId: string) =>
    social.getBuddies()
      .filter(other => other.id !== actorId)
      .map(other => ({ targetId: other.id, bond: social.getNpcBond(actorId, other.id) }))
      .filter(({ bond }) => bond.romance !== 'none' || Object.values(bond.dims).some(v => v !== 0))
      .map(({ targetId, bond }) => ({ targetId, ...bond.dims }));

  const make = () => {
    const social = new SocialEngine(new EventBus());
    for (let i = 0; i < 72; i++) {
      social.registerBuddy(buildCharacter({
        id: 'scale_bond_' + i,
        displayName: 'Scale Bond ' + i,
        handle: 'scale_bond_' + i,
        metVia: 'work',
        createdDay: 1,
      }).definition);
    }
    return social;
  };

  it('never enumerates roster or neutral pairs when there are no stored directed edges', () => {
    const social = make();
    const rosterRead = vi.spyOn(social, 'getBuddies');
    const pairRead = vi.spyOn(social, 'getNpcBond');
    for (let i = 0; i < 72; i++) {
      expect(social.getNotableNpcBondsRead('scale_bond_' + i)).toEqual([]);
    }
    expect(rosterRead).not.toHaveBeenCalled();
    expect(pairRead).not.toHaveBeenCalled();
    rosterRead.mockRestore();
    pairRead.mockRestore();
  });

  it('retains old ordering and bond semantics after directed writes, romance, restore and removal', () => {
    const social = make();
    const source = 'scale_bond_10';
    // Reverse insertion order catches accidental Map-order output changes.
    social.adjustNpcBond(source, 'scale_bond_61', { trust: 17, comfort: 3 }, 3);
    social.adjustNpcBond(source, 'scale_bond_40', { attraction: 11 }, 3);
    social.adjustNpcBond('scale_bond_40', source, { respect: 9 }, 3);
    social.setNpcRomance(source, 'scale_bond_2', 'crush', 4);
    social.adjustNpcBond(source, 'scale_bond_4', { trust: 0 }, 4); // explicit neutral
    for (const id of [source, 'scale_bond_40', 'scale_bond_2', 'missing_bond']) {
      expect(social.getNotableNpcBondsRead(id)).toEqual(legacy(social, id));
    }
    const detached = social.getNotableNpcBondsRead(source);
    detached[0]!.trust = 999;
    expect(social.getNotableNpcBondsRead(source)).toEqual(legacy(social, source));

    const restored = new SocialEngine(new EventBus(), social.getState());
    expect(restored.getNotableNpcBondsRead(source)).toEqual(legacy(restored, source));

    social.removeBuddy('scale_bond_40');
    expect(social.getNotableNpcBondsRead(source)).toEqual(legacy(social, source));
    expect(social.getNotableNpcBondsRead('scale_bond_40')).toEqual([]);
    social.setNpcRomance(source, 'scale_bond_2', 'none', 5);
    expect(social.getNotableNpcBondsRead(source)).toEqual(legacy(social, source));
  });

  it('publishes exactly the old notable bond data in pure canonical Life snapshots', () => {
    const engine = new SimulationEngine();
    const actors = engine.social.getBuddies();
    const source = actors[0]!.id;
    const target = actors[1]!.id;
    const revision = engine.getRevision();
    expect(engine.getLifeSnapshot(source)?.notableNpcBonds).toEqual(legacy(engine.social, source));
    expect(engine.getRevision()).toBe(revision);
    engine.social.adjustNpcBond(source, target, { trust: 6 }, 2);
    expect(engine.getLifeSnapshot(source)?.notableNpcBonds).toEqual(legacy(engine.social, source));
  });
});
