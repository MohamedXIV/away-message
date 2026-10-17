import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { ActiveTravelState } from '../../src/engine/transit/types';
import { GENERATED_VENUE_SERVICES } from '../../src/engine/worldContent.generated';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 owner-scoped residence and player-only transit projections', () => {
  it('projects canonical tenancy and the shop-visible offer list without world snapshots', () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const physical = vi.spyOn(game, 'getPhysicalWorldState');
    const read = game.getResidenceRead();
    expect(read.revision).toBe(game.getRevision());
    expect(read.tenancy).toEqual(game.getResidenceState());
    expect(read.offers).toEqual(game.getHousingOffers());
    expect(read.offers.some(offer => offer.current && offer.placeId === read.tenancy.currentResidencePlaceId)).toBe(true);
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(broad).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(physical).not.toHaveBeenCalled();
    read.tenancy.currentRent = -55;
    expect(game.getResidenceState().currentRent).toBeGreaterThanOrEqual(0);
  });

  it('only presents known, physically co-located café guests from the NPC place owner', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies().find(buddy => buddy.reach === 'local')!;
    const cafe = GENERATED_VENUE_SERVICES.find(service => service.tags.includes('cafe'))!;
    const shop = GENERATED_VENUE_SERVICES.find(service => service.tags.includes('shop'))!;
    expect(cafe.placeId).not.toBe(shop.placeId);
    const noSnapshot = vi.spyOn(game, 'getState');
    const noMobilityDump = vi.spyOn(game, 'getNpcMobilityState');
    const noSocialDump = vi.spyOn(game.social, 'getState');

    // A local actor or an explicit guest request is not proof of a meeting.
    expect(game.getCafeGuestRead(cafe.placeId, actor.id).guest).toBeNull();
    expect(game.social.learnHandle(actor.id, actor.handle)).toBe(true);
    expect(game.relocateActorToGeneratedPlaceEntry(actor.id, shop.placeId)).toBe(true);
    expect(game.getNpcPlaceState(actor.id)).toEqual({ status: 'at_place', placeId: shop.placeId });
    expect(game.getCafeGuestRead(cafe.placeId, actor.id).guest).toBeNull();

    expect(game.relocateActorToGeneratedPlaceEntry(actor.id, cafe.placeId)).toBe(true);
    const actual = game.getCafeGuestRead(cafe.placeId, actor.id);
    expect(actual).toEqual({
      revision: game.getRevision(),
      placeId: cafe.placeId,
      guest: { actorId: actor.id, displayName: actor.displayName },
    });
    expect(game.getCafeGuestRead(cafe.placeId).guest).toEqual(actual.guest);
    expect(JSON.parse(JSON.stringify(actual))).toEqual(actual);
    expect(noSnapshot).not.toHaveBeenCalled();
    expect(noMobilityDump).not.toHaveBeenCalled();
    expect(noSocialDump).not.toHaveBeenCalled();
  });

  it('derives known local café candidates without roster copies at 500 actors', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const cafe = GENERATED_VENUE_SERVICES.find(service => service.tags.includes('cafe'))!;
    const locals = game.social.getBuddies().filter(actor => actor.reach === 'local');
    const [first, second] = locals;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // Benchmark seed actors may already have learned handles. Compare only
    // the player-known local identities rather than assuming an empty roster.
    const initiallyKnown = locals
      .filter(actor => game.social.isKnown(actor.id))
      .map(({ id, displayName }) => ({ id, displayName }));
    expect(game.social.getKnownLocalCafeCandidatesRead()).toEqual(initiallyKnown);
    const unknown = locals.find(actor => !game.social.isKnown(actor.id));
    if (unknown) expect(game.social.getKnownLocalCafeCandidatesRead(unknown.id)).toEqual([]);
    expect(game.social.learnHandle(first!.id, first!.handle)).toBe(true);
    expect(game.social.learnHandle(second!.id, second!.handle)).toBe(true);
    expect(game.relocateActorToGeneratedPlaceEntry(first!.id, cafe.placeId)).toBe(true);
    expect(game.relocateActorToGeneratedPlaceEntry(second!.id, cafe.placeId)).toBe(true);
    const reference = [first!, second!].sort((a, b) =>
      (game.social.getRelationships(b.id)?.familiarity ?? 0)
      - (game.social.getRelationships(a.id)?.familiarity ?? 0));
    const roster = vi.spyOn(game.social, 'getBuddies');
    const full = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const mobility = vi.spyOn(game, 'getNpcMobilityState');
    const candidates = game.social.getKnownLocalCafeCandidatesRead();
    expect(candidates).toEqual(expect.arrayContaining([
      { id: first!.id, displayName: first!.displayName },
      { id: second!.id, displayName: second!.displayName },
    ]));
    expect(candidates.length).toBeLessThanOrEqual(500);
    expect(JSON.parse(JSON.stringify(candidates))).toEqual(candidates);
    expect(game.social.getKnownLocalCafeCandidatesRead('nonexistent')).toEqual([]);
    expect(game.social.getKnownLocalCafeCandidatesRead(first!.id)).toEqual([
      { id: first!.id, displayName: first!.displayName },
    ]);
    const guest = game.getCafeGuestRead(cafe.placeId);
    expect(guest.guest).toEqual({
      actorId: reference[0]!.id,
      displayName: reference[0]!.displayName,
    });
    expect(game.getCafeGuestRead(cafe.placeId, second!.id).guest?.actorId).toBe(second!.id);
    expect(JSON.parse(JSON.stringify(guest))).toEqual(guest);
    expect(roster).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(mobility).not.toHaveBeenCalled();
    // The returned names are detached and cannot change the actual actor.
    candidates[0]!.displayName = 'UI_WRITTEN';
    expect(game.getCafeGuestRead(cafe.placeId).guest?.displayName).not.toBe('UI_WRITTEN');
  }, 30_000);

  it('shows one player trip and one leg, never NPC mobility or an entire route graph', () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const npc = vi.spyOn(game, 'getNpcMobilityState');
    expect(game.getTransitRead().active).toBeNull();
    const start = game.clock.getTotalMinutes();
    const trip: ActiveTravelState = {
      actorId: 'player',
      plan: {
        originPlaceId: 'alpha', destinationPlaceId: 'beta',
        departAtMinute: start, arriveAtMinute: start + 15,
        legs: [{ kind: 'walk', fromPlaceId: 'alpha', toPlaceId: 'beta', minutes: 15 }],
        walkMinutes: 15, waitMinutes: 0, rideMinutes: 0, totalMinutes: 15,
        fare: 0, transferCount: 0, busLineIds: [],
      },
      committedAtMinute: start, currentLegIndex: 0, farePaid: 0, status: 'active',
    };
    const changes: string[][] = [];
    const off = game.subscribeChanges(change => changes.push([...change.changedDomains]));
    changes.length = 0;
    game.setActiveTravel(trip);
    game.publishExternalChange(['transit']); // direct setter + explicit hint coalesce
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(expect.arrayContaining(['transit', 'unknown']));
    expect(changes[0]!.filter(domain => domain === 'transit')).toHaveLength(1);
    off();
    const read = game.getTransitRead();
    expect(read.revision).toBe(game.getRevision());
    expect(read.active).toMatchObject({
      status: 'active', originPlaceId: 'alpha', destinationPlaceId: 'beta',
      currentLegIndex: 0, minutesRemaining: 15,
      currentLeg: { kind: 'walk', minutes: 15 },
    });
    expect(JSON.stringify(read)).not.toContain('busLineIds');
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(broad).not.toHaveBeenCalled();
    expect(npc).not.toHaveBeenCalled();
  });

  it('attributes successful housing mutations within one revision without claiming exhaustive domains', () => {
    const game = new SimulationEngine();
    const candidate = game.getHousingOffers().find(offer => !offer.current && offer.available);
    expect(candidate).toBeDefined();
    game.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 100_000, reason: 'tenancy acceptance setup' });
    const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => changes.push(change));
    changes.length = 0;
    const prior = game.getRevision();
    const result = game.moveResidenceToOffer(candidate!.id);
    expect(result.success).toBe(true);
    expect(game.getRevision()).toBe(prior + 1);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changedDomains).toEqual(expect.arrayContaining(['residence', 'unknown']));
    expect(new Set(changes[0]!.changedDomains).size).toBe(changes[0]!.changedDomains.length);
    expect(game.getResidenceRead().tenancy.currentResidencePlaceId).toBe(candidate!.placeId);
    stop();
  });
});
