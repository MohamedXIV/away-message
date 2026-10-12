import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { MyPlaceSocialCycle } from '../../src/engine/kernel/MyPlaceSocialCycle';

function fixture() {
  const owners = createCoreDomainOwners();
  return { owners, cycle: new MyPlaceSocialCycle(owners) };
}

describe('MyPlaceSocialCycle', () => {
  it('resolves a public profile only from the existing MyPlace authority', () => {
    const { owners, cycle } = fixture();
    const buddy = owners.social.getBuddies().find((entry) =>
      Boolean(owners.myplace.getNpcProfile(entry.handle)),
    );

    if (buddy) {
      expect(cycle.resolveProfileUsername(buddy)).toBe(buddy.handle);
    }

    expect(cycle.resolveProfileUsername({
      id: 'no-such-actor',
      handle: 'no-such-handle',
    })).toBeNull();
  });

  it('is deterministic from the same authoritative day, roster, relationships and site state', () => {
    const a = fixture();
    const b = fixture();
    const minute = (4 - 1) * 1440 + 480;
    a.owners.clock.setTotalMinutes(minute);
    b.owners.clock.setTotalMinutes(minute);

    a.cycle.processDay(4);
    b.cycle.processDay(4);

    expect(a.owners.myplace.getState()).toEqual(b.owners.myplace.getState());
    expect(a.owners.world.getState()).toEqual(b.owners.world.getState());
    expect(a.owners.social.getState()).toEqual(b.owners.social.getState());
  });
});
