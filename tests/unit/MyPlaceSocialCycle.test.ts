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

  it('creates one canonical MyPlace profile for newly registered actors', () => {
    const { owners, cycle } = fixture();
    const actor = {
      id: 'site_newcomer',
      handle: 'newcomer42',
      displayName: 'Newcomer 42',
    };
    cycle.ensureMyPlaceStub(actor);
    const first = owners.myplace.getNpcProfile(actor.handle);
    expect(first?.displayName).toBe(actor.displayName);
    expect(owners.myplace.getNpcProfile(actor.id)?.displayName).toBe(actor.displayName);
    cycle.ensureMyPlaceStub(actor);
    expect(owners.myplace.getNpcProfile(actor.handle)).toEqual(first);
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

    // #174 owns deterministic message IDs. Compare canonical social outcomes,
    // conversation ordering and content, but not wall-clock/random message IDs.
    const aSocial = a.owners.social.getState();
    const bSocial = b.owners.social.getState();
    const normalizeConversations = (conversations: typeof aSocial.conversations) =>
      Object.fromEntries(
        Object.entries(conversations).map(([contactId, messages]) => [
          contactId,
          messages.map(({ id: _runtimeId, ...message }) => message),
        ]),
      );

    expect(aSocial.relationships).toEqual(bSocial.relationships);
    expect(aSocial.buddies).toEqual(bSocial.buddies);
    expect(normalizeConversations(aSocial.conversations))
      .toEqual(normalizeConversations(bSocial.conversations));
  });
});
