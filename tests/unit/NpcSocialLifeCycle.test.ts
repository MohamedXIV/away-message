import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { NpcSocialLifeCycle } from '../../src/engine/kernel/NpcSocialLifeCycle';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function fixture() {
  const owners = createCoreDomainOwners();
  return { owners, cycle: new NpcSocialLifeCycle(owners) };
}

describe('NpcSocialLifeCycle — one Social and World day-policy authority', () => {
  it('is the actual composed instance reached by the production simulation', () => {
    const engine = new SimulationEngine();
    const internals = engine as unknown as { npcSocialLife: NpcSocialLifeCycle };
    expect(internals.npcSocialLife).toBeInstanceOf(NpcSocialLifeCycle);
    const before = engine.social.getNpcSocialLog(1);
    internals.npcSocialLife.processDay(1);
    expect(engine.social.getNpcSocialLog(1).length).toBeGreaterThanOrEqual(before.length);
    expect(engine.social).toBe(engine.social);
  });

  it('plans an NPC agenda at most once per day, without a parallel roster', () => {
    const { owners, cycle } = fixture();
    cycle.processDay(4);
    const buddies = owners.social.getBuddies();
    const first = Object.fromEntries(buddies.map(b => [b.id, owners.social.getAgenda(b.id, 4)]));
    cycle.processDay(4);
    const second = Object.fromEntries(buddies.map(b => [b.id, owners.social.getAgenda(b.id, 4)]));
    expect(second).toEqual(first);
    expect(owners.social.getBuddies().map(b => b.id)).toEqual(buddies.map(b => b.id));
  });

  it('uses seeded social rules for repeatable NPC actions and avoids repeated run-ins', () => {
    const first = fixture();
    const second = fixture();
    first.cycle.processDay(5);
    second.cycle.processDay(5);

    const firstLog = first.owners.social.getNpcSocialLog(5);
    const secondLog = second.owners.social.getNpcSocialLog(5);
    expect(firstLog).toEqual(secondLog);
    expect(firstLog.length).toBeLessThanOrEqual(3);

    first.cycle.processDay(5);
    expect(first.owners.social.getNpcSocialLog(5)).toEqual(firstLog);
  });
});
