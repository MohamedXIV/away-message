import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { ActiveTravelState } from '../../src/engine/transit/types';

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
