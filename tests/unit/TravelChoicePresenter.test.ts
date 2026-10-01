import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import {
  formatItinerarySteps,
  formatTransferSummary,
  presentTravelChoices,
} from '../../src/engine/transit/TravelChoicePresenter';
import type { TransitServiceState } from '../../src/engine/transit/types';
import { twoLineFixture } from './transitFixtures';

describe('TravelChoicePresenter (#36 slice 2)', () => {
  it('formats local walk choice with minutes and free label', () => {
    // Add place_a2 sharing stop_a with place_a1 (walkable in 10 min)
    const fixture = twoLineFixture();
    fixture.places.push({
      id: 'place_a2',
      districtId: 'district_a',
      name: 'Place A2',
      transitAccess: [{ stopId: 'stop_a', walkMinutes: 6 }],
    });
    const network = buildTransitNetwork(fixture);

    const choices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a2',
      departAtMinute: 600,
    });

    expect(choices.walk.available).toBe(true);
    expect(choices.walk.minutes).toBe(10);
    expect(choices.walk.fare).toBe(0);
    expect(choices.walk.summary).toBe('Walk — 10 min — free');
  });

  it('formats direct bus choice with wait, ride, and fare', () => {
    const network = buildTransitNetwork(twoLineFixture());

    // place_a1 to place_b1:
    // walk to stop_a (4 min) -> arrive at 604
    // line_ab departs at 360 + 20*13 = 620 -> wait is 16 min, ride is 12 min
    const choices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
    });

    expect(choices.bus.available).toBe(true);
    expect(choices.bus.fare).toBe(2);
    expect(choices.bus.transferCount).toBe(0);
    expect(choices.bus.summary).toMatch(/Bus — \d+ min wait \+ \d+ min ride — \$2/);
    expect(choices.bus.itinerarySteps.length).toBeGreaterThanOrEqual(2);
    expect(choices.bus.itinerarySteps[0]).toContain('Walk to Stop A');
    expect(choices.bus.itinerarySteps.some((step) => step.includes('Line AB to Stop B'))).toBe(true);
  });

  it('formats multi-leg transfer itinerary with human-readable transfer summary', () => {
    const network = buildTransitNetwork(twoLineFixture());

    // place_a1 -> place_c1 requires Line AB then transfer to Line BC at stop_b
    const choices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_c1',
      departAtMinute: 600,
    });

    expect(choices.bus.available).toBe(true);
    expect(choices.bus.transferCount).toBe(1);
    expect(choices.bus.fare).toBe(2);

    const transferSummary = choices.bus.transferSummary;
    expect(transferSummary).toContain('Line AB');
    expect(transferSummary).toContain('Stop B');
    expect(transferSummary).toContain('transfer to Line BC');
    expect(transferSummary).toContain('Stop C');

    // The detailed steps should include the transfer wait
    expect(choices.bus.itinerarySteps.some((step) => step.includes('Transfer to Line BC') || step.includes('Wait for Line BC'))).toBe(true);

    if (choices.bus.plan) {
      const steps = formatItinerarySteps(network, choices.bus.plan);
      expect(steps.length).toBeGreaterThan(0);
      const summary = formatTransferSummary(network, choices.bus.plan);
      expect(summary).toBe(choices.bus.transferSummary);
    }
  });

  it('faithfully presents authoritative conditions like service closed, delays, and last bus', () => {
    const network = buildTransitNetwork(twoLineFixture());

    // 1. Service ended (late night departure after line service window 1380)
    const lateChoices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 1390,
    });
    expect(lateChoices.bus.available).toBe(false);
    expect(lateChoices.bus.reason).toBe('service_ended');
    expect(lateChoices.bus.summary).toContain('Service ended');

    // 2. Closed stop / line
    const closedService: TransitServiceState = {
      closedStopIds: ['stop_a'],
      closedLineIds: [],
      lineDelayMinutes: {},
      headwayMultiplier: {},
    };
    const closedChoices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      service: closedService,
    });
    expect(closedChoices.bus.available).toBe(false);
    expect(closedChoices.bus.summary).toContain('closed');

    // 3. Line delay
    const delayedService: TransitServiceState = {
      closedStopIds: [],
      closedLineIds: [],
      lineDelayMinutes: { line_ab: 10 },
      headwayMultiplier: {},
    };
    const delayedChoices = presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      service: delayedService,
    });
    expect(delayedChoices.bus.available).toBe(true);
    expect(delayedChoices.bus.conditions.serviceDisrupted).toBe(true);
    expect(delayedChoices.bus.conditions.delayMinutes).toBe(10);
  });

  it('does not mutate TransitNetwork or planner truth', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const stopBefore = network.stops.get('stop_a');

    presentTravelChoices(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
    });

    expect(network.stops.get('stop_a')).toEqual(stopBefore);
  });
});
