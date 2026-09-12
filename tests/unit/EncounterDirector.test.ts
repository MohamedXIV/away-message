// tests/unit/EncounterDirector.test.ts
// #47 — Encounter Director surfaces truthful co-location only. It never
// manufactures reality: no teleports, spawns, or source mutations.
// Dynamic/local actors throughout; no character-specific paths.

import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { activeTravelLegWindows } from '../../src/engine/transit/ActiveTravel';
import { planNpcTrip } from '../../src/engine/transit/NpcTrips';
import type { NpcTripRecord } from '../../src/engine/transit/NpcTrips';
import type { CharacterIntent, CharacterObligation } from '../../src/engine/life/types';
import type { RelationshipDimensions } from '../../src/engine/types';
import type { WorldModifier } from '../../src/engine/WorldModifiers';
import {
  collectEncounterCandidates,
  decideEncounter,
  emptyEncounterDirectorState,
  ENCOUNTER_COOLDOWN_MINUTES,
  MAX_CANDIDATES_PER_CYCLE,
} from '../../src/engine/encounters';
import type {
  EncounterActorRead,
  EncounterCandidate,
  EncounterDecisionInput,
} from '../../src/engine/encounters';
import { twoLineFixture } from './transitFixtures';

const network = buildTransitNetwork(twoLineFixture());

function rel(overrides: Partial<RelationshipDimensions> = {}): RelationshipDimensions {
  return {
    familiarity: 0,
    trust: 0,
    comfort: 0,
    respect: 0,
    affection: 0,
    attraction: 0,
    suspicion: 0,
    resentment: 0,
    annoyance: 0,
    ...overrides,
  };
}

function actor(overrides: Partial<EncounterActorRead> = {}): EncounterActorRead {
  return {
    actorId: 'sam',
    place: { status: 'at_place', placeId: 'place_b1' },
    intent: null,
    obligations: [],
    relationship: null,
    knownToPlayer: true,
    eventEffects: [],
    ...overrides,
  };
}

function input(overrides: Partial<EncounterDecisionInput> = {}): EncounterDecisionInput {
  return {
    nowMinute: 1000,
    playerPlaceId: 'place_b1',
    playerTransit: null,
    actors: [],
    trips: {},
    network,
    activeModifiers: [],
    ...overrides,
  };
}

function intent(overrides: Partial<CharacterIntent> = {}): CharacterIntent {
  return {
    actorId: 'sam',
    kind: 'attend_appointment',
    priority: 80,
    reasons: ['due_now'],
    blockers: [],
    reevaluateAtMinute: 1080,
    earliestAt: 1080,
    latestAt: 1140,
    ...overrides,
  };
}

function obligation(overrides: Partial<CharacterObligation> = {}): CharacterObligation {
  return {
    id: 'appointment:sam:appt_1',
    actorId: 'sam',
    sourceKind: 'appointment',
    sourceId: 'appt_1',
    destinationPlaceId: 'place_b1',
    priority: 80,
    flexibility: 'fixed',
    status: 'pending',
    ...overrides,
  };
}

function modifier(overrides: Partial<WorldModifier> = {}): WorldModifier {
  return {
    id: 'mod_festival_1',
    sourceEventId: 'evt_festival_1',
    domain: 'life',
    kind: 'festival_opportunity',
    startsAtMinute: 900,
    endsAtMinute: 1200,
    targetIds: ['place_b1'],
    value: 10,
    ...overrides,
  };
}

/** Plan sam place_a1 -> place_b1 and return the committed record. */
function planSamTrip(nowMinute = 960): NpcTripRecord {
  const planned = planNpcTrip({
    actorId: 'sam',
    intent: intent({ targetPlaceId: 'place_b1' }),
    originPlaceId: 'place_a1',
    nowMinute,
    network,
    aliases: {},
  });
  expect(planned.ok).toBe(true);
  if (!planned.ok) throw new Error('Expected a planned trip.');
  return planned.record;
}

function waitLegWindow(record: NpcTripRecord): { startMinute: number; endMinute: number; stopId: string } {
  const windows = activeTravelLegWindows(record.trip);
  const idx = record.trip.plan.legs.findIndex((leg) => leg.kind === 'wait');
  expect(idx).toBeGreaterThanOrEqual(0);
  const leg = record.trip.plan.legs[idx]!;
  if (leg.kind !== 'wait') throw new Error('Expected a wait leg.');
  const window = windows[idx]!;
  return { startMinute: window.startMinute, endMinute: window.endMinute, stopId: leg.stopId };
}

function busLeg(record: NpcTripRecord): { lineId: string; fromStopId: string; toStopId: string; boardMinute: number; windowStart: number; windowEnd: number } {
  const windows = activeTravelLegWindows(record.trip);
  const idx = record.trip.plan.legs.findIndex((leg) => leg.kind === 'bus');
  expect(idx).toBeGreaterThanOrEqual(0);
  const leg = record.trip.plan.legs[idx]!;
  if (leg.kind !== 'bus') throw new Error('Expected a bus leg.');
  const window = windows[idx]!;
  return {
    lineId: leg.lineId,
    fromStopId: leg.fromStopId,
    toStopId: leg.toStopId,
    boardMinute: window.startMinute,
    windowStart: window.startMinute,
    windowEnd: window.endMinute,
  };
}

describe('EncounterDirector — surfacing truthful reality (#47)', () => {
  it('1. no candidates yields none and touches no director state', () => {
    const state = emptyEncounterDirectorState();
    const before = JSON.parse(JSON.stringify(state));
    const { decision, nextState } = decideEncounter(input(), state);
    expect(decision.kind).toBe('none');
    expect(nextState).toEqual(before);
  });

  it('2. a non-co-located actor is never surfaced', () => {
    const far = actor({
      actorId: 'robin',
      place: { status: 'at_place', placeId: 'place_c1' },
      obligations: [obligation({ id: 'job:robin:job_9', actorId: 'robin', destinationPlaceId: 'place_c1' })],
    });
    const travelling = actor({
      actorId: 'sam',
      place: { status: 'in_transit', originPlaceId: 'place_a1', destinationPlaceId: 'place_b1', legIndex: 0, legKind: 'bus' },
    });
    const found = collectEncounterCandidates(input({ actors: [far, travelling] }));
    expect(found).toEqual([]);
    const { decision } = decideEncounter(input({ actors: [far, travelling] }), emptyEncounterDirectorState());
    expect(decision.kind).toBe('none');
  });

  it('3. same-place overlap surfaces without moving either participant', () => {
    const trips = {};
    const before = JSON.stringify(trips);
    const inInput = input({ actors: [actor()] });
    const found = collectEncounterCandidates(inInput);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: 'place_overlap',
      participantIds: ['sam'],
      placeId: 'place_b1',
    });
    expect(found[0]!.sourceIds.length).toBeGreaterThan(0);
    const { decision } = decideEncounter(inInput, emptyEncounterDirectorState());
    expect(decision.kind).toBe('encounter');
    expect(JSON.stringify(trips)).toBe(before);
  });

  it('4a. shared stop wait surfaces from committed trip facts without spawning', () => {
    const record = planSamTrip();
    const wait = waitLegWindow(record);
    const now = wait.startMinute + 1;
    const trips = { sam: record };
    const before = JSON.stringify(trips);
    const inInput = input({
      nowMinute: now,
      playerPlaceId: null,
      playerTransit: {
        kind: 'wait',
        stopId: wait.stopId,
        windowStart: now - 5,
        windowEnd: now + 10,
      },
      actors: [actor({ place: { status: 'unknown' } })],
      trips,
    });
    const found = collectEncounterCandidates(inInput);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'transit_stop_wait', participantIds: ['sam'] });
    const { decision } = decideEncounter(inInput, emptyEncounterDirectorState());
    expect(decision.kind).toBe('encounter');
    // Planning/progress records are byte-identical: nobody was moved.
    expect(JSON.stringify(trips)).toBe(before);
  });

  it('4b. shared bus run surfaces; a different run on the same line does not', () => {
    const record = planSamTrip();
    const bus = busLeg(record);
    const now = Math.min(bus.windowStart + 1, bus.windowEnd - 1);
    const trips = { sam: record };
    const sameRun = input({
      nowMinute: now,
      playerPlaceId: null,
      playerTransit: {
        kind: 'bus',
        lineId: bus.lineId,
        fromStopId: bus.fromStopId,
        toStopId: bus.toStopId,
        boardMinute: bus.boardMinute,
        windowStart: bus.windowStart,
        windowEnd: bus.windowEnd,
      },
      actors: [actor({ place: { status: 'unknown' } })],
      trips,
    });
    const found = collectEncounterCandidates(sameRun);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'transit_bus_ride', participantIds: ['sam'] });

    const otherRun = input({
      ...sameRun,
      playerTransit: {
        kind: 'bus',
        lineId: bus.lineId,
        fromStopId: bus.fromStopId,
        toStopId: bus.toStopId,
        boardMinute: bus.boardMinute + 20, // next headway: a different run
        windowStart: bus.windowStart + 20,
        windowEnd: bus.windowEnd + 20,
      },
    });
    expect(collectEncounterCandidates(otherRun)).toEqual([]);
  });

  it('5. identical candidate sets select deterministically regardless of order', () => {
    const low = actor({ actorId: 'ash', relationship: rel({ familiarity: 10 }) });
    const high = actor({ actorId: 'sam', relationship: rel({ familiarity: 90 }) });
    const first = decideEncounter(input({ actors: [low, high] }), emptyEncounterDirectorState());
    const second = decideEncounter(input({ actors: [high, low] }), emptyEncounterDirectorState());
    expect(first.decision.kind).toBe('encounter');
    expect(second.decision.kind).toBe('encounter');
    if (first.decision.kind !== 'encounter' || second.decision.kind !== 'encounter') return;
    expect(second.decision.candidate.id).toBe(first.decision.candidate.id);
    // Rebuilt-from-JSON inputs decide identically.
    const rebuilt = decideEncounter(
      JSON.parse(JSON.stringify(input({ actors: [low, high] }))) as EncounterDecisionInput,
      emptyEncounterDirectorState(),
    );
    if (rebuilt.decision.kind !== 'encounter') throw new Error('Expected an encounter.');
    expect(rebuilt.decision.candidate.id).toBe(first.decision.candidate.id);
  });

  it('6. cooldown suppresses immediate repeat without mutating world state', () => {
    const inInput = input({ actors: [actor()] });
    const worldBefore = JSON.stringify({ actors: inInput.actors, trips: inInput.trips, modifiers: inInput.activeModifiers });
    const first = decideEncounter(inInput, emptyEncounterDirectorState());
    expect(first.decision.kind).toBe('encounter');
    const second = decideEncounter(inInput, first.nextState);
    expect(second.decision.kind).toBe('none');
    expect(JSON.stringify({ actors: inInput.actors, trips: inInput.trips, modifiers: inInput.activeModifiers })).toBe(worldBefore);
    // After the cooldown window the same moment is eligible again.
    const later = decideEncounter({ ...inInput, nowMinute: inInput.nowMinute + ENCOUNTER_COOLDOWN_MINUTES }, first.nextState);
    expect(later.decision.kind).toBe('encounter');
  });

  it('7. relationship context weights selection but never mutates social state', () => {
    const stranger = actor({ actorId: 'ash', relationship: rel({ familiarity: 0, affection: 0 }) });
    const friend = actor({ actorId: 'sam', relationship: rel({ familiarity: 80, affection: 60 }) });
    const relBefore = JSON.stringify([stranger.relationship, friend.relationship]);
    const { decision } = decideEncounter(input({ actors: [stranger, friend] }), emptyEncounterDirectorState());
    expect(decision.kind).toBe('encounter');
    if (decision.kind !== 'encounter') throw new Error('Expected an encounter.');
    expect(decision.candidate.participantIds).toEqual(['sam']);
    expect(JSON.stringify([stranger.relationship, friend.relationship])).toBe(relBefore);
  });

  it('8. unknown actors are presentation-suppressed while the fact persists', () => {
    const inInput = input({ actors: [actor({ knownToPlayer: false })] });
    const collected = collectEncounterCandidates(inInput);
    expect(collected).toHaveLength(1);
    expect(collected[0]!.participantIds).toEqual(['sam']);
    const { decision } = decideEncounter(inInput, emptyEncounterDirectorState());
    expect(decision.kind).toBe('none');
    if (decision.kind !== 'none') throw new Error('Expected none.');
    expect(decision.reason).toMatch(/unknown/i);
  });

  it('10. large time jumps neither resurrect expired candidates nor duplicate surfaced one-shots', () => {
    const oneShot = input({
      nowMinute: 1000,
      actors: [actor({ obligations: [obligation({ earliestAt: 990, latestAt: 1010 })] })],
    });
    const first = decideEncounter(oneShot, emptyEncounterDirectorState());
    expect(first.decision.kind).toBe('encounter');
    if (first.decision.kind !== 'encounter') throw new Error('Expected an encounter.');
    const surfacedId = first.decision.candidate.id;
    // Far future: the obligation window expired, so its candidate is gone even
    // though the same place fact still exists for other candidate kinds.
    const jumpedInput = { ...oneShot, nowMinute: 1000 + 10000 };
    const recollected = collectEncounterCandidates(jumpedInput);
    expect(recollected.find((c) => c.id === surfacedId)).toBeUndefined();
    const jumped = decideEncounter(jumpedInput, first.nextState);
    if (jumped.decision.kind === 'encounter') {
      expect(jumped.decision.candidate.id).not.toBe(surfacedId);
    }
    expect(jumped.nextState.surfacedOneShots).toEqual(first.nextState.surfacedOneShots);
  });

  it('11. collecting candidates never marks cooldowns or one-shots', () => {
    const state = emptyEncounterDirectorState();
    const inInput = input({ actors: [actor()] });
    collectEncounterCandidates(inInput);
    collectEncounterCandidates(inInput);
    expect(state).toEqual(emptyEncounterDirectorState());
  });

  it('cap. at most 8 candidates are evaluated per cycle after stable prioritization', () => {
    expect(MAX_CANDIDATES_PER_CYCLE).toBe(8);
    const actors = Array.from({ length: 10 }, (_, i) =>
      actor({ actorId: `actor_${i}`, relationship: rel({ familiarity: i * 10 }) }),
    );
    const inInput = input({ actors });
    expect(collectEncounterCandidates(inInput)).toHaveLength(10);
    // Suppress the top-ranked candidate: selection must fall to rank 2,
    // never to the truncated-away rank 9.
    const ranked = [...collectEncounterCandidates(inInput)].sort((a, b) =>
      b.priority !== a.priority ? b.priority - a.priority : a.id.localeCompare(b.id),
    );
    const topKey = ranked[0]!.cooldownKey;
    const suppressed = decideEncounter(inInput, {
      ...emptyEncounterDirectorState(),
      cooldowns: { [topKey]: inInput.nowMinute },
    });
    expect(suppressed.decision.kind).toBe('encounter');
    if (suppressed.decision.kind !== 'encounter') throw new Error('Expected an encounter.');
    expect(suppressed.decision.candidate.id).toBe(ranked[1]!.id);
    expect(suppressed.decision.candidate.id).not.toBe(ranked[8]!.id);
  });

  it('13. obligation anchors reference sources without copying outcomes', () => {
    const ob = obligation();
    const obBefore = JSON.stringify(ob);
    const inInput = input({ actors: [actor({ obligations: [ob] })] });
    const found = collectEncounterCandidates(inInput);
    const anchored = found.find((c) => c.kind === 'obligation_anchor');
    expect(anchored).toBeDefined();
    expect(anchored!.sourceIds).toContain('appt_1');
    expect(anchored!.participantIds).toEqual(['sam']);
    const first = decideEncounter(inInput, emptyEncounterDirectorState());
    expect(first.decision.kind).toBe('encounter');
    // One-shot: same obligation never resurfaces, and the obligation is untouched.
    const second = decideEncounter(inInput, first.nextState);
    const ids = (c: EncounterCandidate) => c.id;
    if (second.decision.kind === 'encounter') {
      expect(ids(second.decision.candidate)).not.toBe(anchored!.id);
    }
    expect(JSON.stringify(ob)).toBe(obBefore);
  });

  it('14. event opportunities boost real overlaps but invent nothing', () => {
    const withActor = input({
      actors: [actor()],
      activeModifiers: [modifier()],
    });
    const boosted = collectEncounterCandidates(withActor);
    const opportunity = boosted.find((c) => c.kind === 'event_opportunity');
    expect(opportunity).toBeDefined();
    expect(opportunity!.sourceIds).toContain('evt_festival_1');
    const lonely = collectEncounterCandidates(input({ actors: [], activeModifiers: [modifier()] }));
    expect(lonely.find((c) => c.kind === 'event_opportunity')).toBeUndefined();
  });

  it('15. in-transit actors are not place candidates, even toward the player place', () => {
    const enRoute = actor({
      place: { status: 'in_transit', originPlaceId: 'place_a1', destinationPlaceId: 'place_b1', legIndex: 2, legKind: 'bus' },
      obligations: [obligation()],
    });
    const found = collectEncounterCandidates(input({ actors: [enRoute] }));
    expect(found.find((c) => c.kind === 'place_overlap')).toBeUndefined();
    expect(found.find((c) => c.kind === 'obligation_anchor')).toBeUndefined();
  });
});
