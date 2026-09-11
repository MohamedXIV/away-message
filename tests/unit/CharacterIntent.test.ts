import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { selectCharacterIntent } from '../../src/engine/life/Intent';
import type { LifeMatrixSnapshot } from '../../src/engine/life/types';

function baseSnapshot(overrides: Partial<LifeMatrixSnapshot> = {}): LifeMatrixSnapshot {
  return {
    actorId: 'sam',
    atMinute: 600,
    day: 1,
    minuteOfDay: 600,
    traits: { shyness: 40, warmth: 55, discipline: 80, spontaneity: 30, loyalty: 70 },
    playerRelationship: {
      targetId: 'player', familiarity: 20, trust: 30, comfort: 25, respect: 40,
      annoyance: 2, affection: 5, attraction: 0, suspicion: 1, resentment: 0,
    },
    notableNpcBonds: [],
    promises: [],
    routineWindows: [],
    agenda: [],
    appointments: [],
    worldEvents: [],
    eventEffects: [],
    presence: { messengerStatus: 'away', awayMessage: 'at work' },
    pressure: {},
    goals: [],
    ...overrides,
  };
}

function firstActor(sim: SimulationEngine): string {
  const [actor] = sim.social.getBuddies();
  if (!actor) throw new Error('Expected at least one Away character.');
  return actor.id;
}

describe('CharacterIntent selector (#44)', () => {
  it('1. identical state produces identical intent + explanation', () => {
    const snapshot = baseSnapshot({
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
      appointments: [{
        id: 'appt_1', characterId: 'sam', locationId: 'cafe',
        targetDay: 1, startMinute: 600, endMinute: 660, status: 'confirmed',
      }],
    });
    const first = selectCharacterIntent(snapshot);
    const second = selectCharacterIntent(snapshot);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(first?.actorId).toBe('sam');
    expect(first?.reasons.length).toBeGreaterThan(0);
    expect(Number.isFinite(first?.reevaluateAtMinute)).toBe(true);
  });

  it('2. urgent fixed appointment outranks optional leisure/personal goal', () => {
    const intent = selectCharacterIntent(baseSnapshot({
      agenda: [{ id: 'a1', kind: 'errand', label: 'Browse zines', day: 1, startMinute: 900, endMinute: 960 }],
      appointments: [{
        id: 'appt_urgent', characterId: 'sam', locationId: 'cafe',
        targetDay: 1, startMinute: 600, endMinute: 660, status: 'confirmed',
      }],
      goals: [{
        id: 'goal:sam:leisure', actorId: 'sam', kind: 'spend_time',
        description: 'Hang out somewhere fun', priority: 70, status: 'active',
        progress: 0, createdDay: 1,
      }],
    }));
    expect(intent?.kind).toBe('attend_appointment');
    expect(intent?.sourceId).toBe('appt_urgent');
    expect(intent?.targetPlaceId).toBe('cafe');
  });

  it('3. promise/social obligation influences selection without relationship mutation', () => {
    const sim = new SimulationEngine();
    const actor = firstActor(sim);
    const day = sim.clock.getTime().day;

    const plain = sim.getCharacterIntent(actor);
    expect(plain).not.toBeNull();

    const promise = sim.social.addPromise(actor, 'Call back about the weekend plan.', day, day);
    expect(promise).not.toBeNull();

    const before = sim.exportSnapshot();
    const influenced = sim.getCharacterIntent(actor);
    expect(influenced?.sourceKind).toBe('promise');
    expect(influenced?.kind).toBe('call_or_message');
    expect(influenced?.sourceId).toBe(promise?.id);
    expect(sim.exportSnapshot()).toEqual(before);
  });

  it('4. exhausted actor rests when no hard obligation overrides it', () => {
    const routine = {
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
    };
    const tired = selectCharacterIntent(baseSnapshot({
      ...routine,
      pressure: { fatigueBand: 'exhausted', stressBand: 'stressed' },
    }));
    expect(tired?.kind).toBe('rest_or_sleep');

    const overridden = selectCharacterIntent(baseSnapshot({
      ...routine,
      pressure: { fatigueBand: 'exhausted', stressBand: 'overwhelmed' },
      appointments: [{
        id: 'appt_hard', characterId: 'sam', locationId: 'cafe',
        targetDay: 1, startMinute: 600, endMinute: 660, status: 'confirmed',
      }],
    }));
    expect(overridden?.kind).toBe('attend_appointment');
  });

  it('5. cancelled/missed/invalid source obligation is never selected', () => {
    for (const status of ['cancelled', 'missed'] as const) {
      const intent = selectCharacterIntent(baseSnapshot({
        agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
        appointments: [{
          id: `appt_${status}`, characterId: 'sam', locationId: 'cafe',
          targetDay: 1, startMinute: 600, endMinute: 660, status,
        }],
      }));
      expect(intent?.sourceId).not.toBe(`appt_${status}`);
      expect(intent?.kind).not.toBe('attend_appointment');
    }
    // Another actor's appointment is not even a candidate.
    const other = selectCharacterIntent(baseSnapshot({
      appointments: [{
        id: 'appt_lee', characterId: 'lee', locationId: 'cafe',
        targetDay: 1, startMinute: 600, endMinute: 660, status: 'confirmed',
      }],
    }));
    expect(other?.sourceId).not.toBe('appt_lee');
  });

  it('6. blocked destination produces an explainable fallback, never teleport', () => {
    const intent = selectCharacterIntent(baseSnapshot({
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
      appointments: [{
        id: 'appt_nowhere', characterId: 'sam', locationId: '',
        targetDay: 1, startMinute: 600, endMinute: 660, status: 'confirmed',
      }],
    }));
    expect(intent?.kind).toBe('stay_current_activity');
    expect(intent?.blockers).toContain('unknown_destination');
    expect(intent?.targetPlaceId).toBeUndefined();
  });

  it('7. irrelevant relationship dimensions do not reshuffle decisions', () => {
    const snapshot = baseSnapshot({
      promises: [{ id: 'p1', text: 'Call back soon', dueDay: 1, fulfilled: false }],
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
    });
    const before = selectCharacterIntent(snapshot);
    const reshuffled = selectCharacterIntent(baseSnapshot({
      promises: [{ id: 'p1', text: 'Call back soon', dueDay: 1, fulfilled: false }],
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
      playerRelationship: {
        targetId: 'player', familiarity: 20, trust: 30, comfort: 25, respect: 40,
        annoyance: 2, affection: 5, attraction: 90, suspicion: 80, resentment: 70,
      },
    }));
    expect(before?.kind).toBe('call_or_message');
    expect(reshuffled).toEqual(before);
  });

  it('8. planner invocation performs zero source-system mutation', () => {
    const sim = new SimulationEngine();
    const actor = firstActor(sim);
    const snapshot = sim.getLifeSnapshot(actor);
    if (!snapshot) throw new Error('Expected a life snapshot.');

    const before = sim.exportSnapshot();
    selectCharacterIntent(snapshot);
    selectCharacterIntent(snapshot);
    sim.getCharacterIntent(actor);
    sim.getCharacterIntent('ghost_actor');
    expect(sim.exportSnapshot()).toEqual(before);
  });

  it('9. provider/AI availability has zero influence', () => {
    const sim = new SimulationEngine();
    const actor = firstActor(sim);
    const first = sim.getCharacterIntent(actor);
    const second = sim.getCharacterIntent(actor);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    // Keyless offline environment by construction; selection is pure rules.
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('10. #43 goal bounds and pressure projection stay read-only', () => {
    const sim = new SimulationEngine();
    const actor = firstActor(sim);
    const goalsBefore = sim.getPersonalGoals(actor);
    expect(goalsBefore.length).toBeLessThanOrEqual(3);
    const pressureBefore = sim.getNpcPressure(actor);

    sim.getCharacterIntent(actor);
    const snapshot = sim.getLifeSnapshot(actor);
    if (snapshot) selectCharacterIntent(snapshot);

    expect(sim.getPersonalGoals(actor)).toEqual(goalsBefore);
    expect(sim.getNpcPressure(actor)).toEqual(pressureBefore);
    expect(sim.exportSnapshot().npcLives?.[actor]?.goals).toHaveLength(goalsBefore.length);
  });

  it('11. world-event context affects scoring through projection only, without copying event truth', () => {
    const without = selectCharacterIntent(baseSnapshot({
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
      goals: [{
        id: 'goal:sam:festival', actorId: 'sam', kind: 'spend_time',
        description: 'Spend time with friends', priority: 45, status: 'active',
        progress: 0, createdDay: 1,
      }],
    }));
    expect(without?.kind).toBe('stay_current_activity');

    const effect = {
      modifierId: 'festival_night_opportunity',
      sourceEventId: 'city_canal_festival',
      domain: 'life',
      kind: 'festival_opportunity',
      startsAtMinute: 500,
      endsAtMinute: 3380,
      value: 60,
    };
    const influenced = selectCharacterIntent(baseSnapshot({
      agenda: [{ id: 'a1', kind: 'errand', label: 'Buy milk', day: 1, startMinute: 900, endMinute: 960 }],
      goals: [{
        id: 'goal:sam:festival', actorId: 'sam', kind: 'spend_time',
        description: 'Spend time with friends', priority: 45, status: 'active',
        progress: 0, createdDay: 1,
      }],
      eventEffects: [effect],
    }));
    expect(influenced?.kind).toBe('pursue_personal_goal');
    expect(influenced?.sourceId).toBe('goal:sam:festival');
    const json = JSON.stringify(influenced);
    expect(json).not.toContain('knowledgePrompt');
    expect(json).not.toContain('personalTake');
    expect(json).not.toContain('attitude');
  });
});
