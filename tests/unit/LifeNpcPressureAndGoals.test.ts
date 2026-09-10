import { describe, expect, it } from 'vitest';
import type {
  LifeMatrixSnapshot,
  LifePressureView,
  PersonalGoal,
} from '../../src/engine/life/types';
import {
  deriveDefaultNpcPressure,
  advanceNpcPressure,
  projectLifePressureView,
} from '../../src/engine/life/Pressure';
import {
  MAX_ACTIVE_GOALS_PER_ACTOR,
  initializeActorGoals,
  evaluateGoalProgress,
} from '../../src/engine/life/Goals';
import {
  serializePersonalGoals,
  hydratePersonalGoals,
  serializeNpcPressure,
  hydrateNpcPressure,
} from '../../src/engine/life/Persistence';
import { buildCharacterObligations } from '../../src/engine/life/Obligations';
import { createLifeSources } from '../../src/engine/life/LifeSources';

function sampleTraits(): LifeMatrixSnapshot['traits'] {
  return {
    shyness: 40,
    warmth: 60,
    discipline: 75,
    spontaneity: 30,
    loyalty: 70,
  };
}

describe('NPC Life Pressure and Bounded Personal Goals Contracts', () => {
  it('defines bounded semantic pressure without player-meter duplication', () => {
    const pressure: LifePressureView = {
      fatigueBand: 'normal',
      stressBand: 'calm',
      mood: 'content',
      interruptionTolerance: 'open',
      moneyBand: 'stable',
      activeNeeds: ['social'],
      departure: 0,
      fatigue: 25,
      stress: 10,
    };

    expect(pressure.fatigueBand).toBe('normal');
    expect(pressure.stressBand).toBe('calm');
    expect(pressure.mood).toBe('content');
    expect(pressure.interruptionTolerance).toBe('open');
    expect(pressure.moneyBand).toBe('stable');
    expect(pressure.activeNeeds).toEqual(['social']);

    // Negative law: must not duplicate player meters (Sims-style maintenance)
    expect('hungerMeter' in pressure).toBe(false);
    expect('funMeter' in pressure).toBe(false);
    expect('bladderMeter' in pressure).toBe(false);
    expect('hygieneMeter' in pressure).toBe(false);
    expect('cashBalance' in pressure).toBe(false);
  });

  it('represents personal goals as semantic medium-term intentions rather than daily scripts', () => {
    const goal: PersonalGoal = {
      id: 'goal:sam:save_gear',
      actorId: 'sam',
      kind: 'save_purchase',
      description: 'Save up for a high-speed dial-up modem',
      priority: 65,
      status: 'active',
      progress: 0.2,
      createdDay: 1,
      targetDay: 14,
    };

    expect(goal.kind).toBe('save_purchase');
    expect(goal.status).toBe('active');
    expect(goal.progress).toBe(0.2);

    // Negative law: goals must not be minute-by-minute scripts or path choreography
    expect('steps' in goal).toBe(false);
    expect('waypoints' in goal).toBe(false);
    expect('scriptTree' in goal).toBe(false);
  });
});

describe('Deterministic Goal Initialization and Policy', () => {
  it('generates identical stable goals for the same actor, archetype, and seed', () => {
    const traits = sampleTraits();
    const goalsA = initializeActorGoals('maya', 'artist', 'world_seed_42', traits);
    const goalsB = initializeActorGoals('maya', 'artist', 'world_seed_42', traits);

    expect(goalsA).toEqual(goalsB);
    expect(goalsA).not.toBe(goalsB);
    expect(goalsA.length).toBeGreaterThan(0);
    expect(goalsA.length).toBeLessThanOrEqual(MAX_ACTIVE_GOALS_PER_ACTOR);
  });

  it('differentiates goals across different archetypes deterministically', () => {
    const traits = sampleTraits();
    const artistGoals = initializeActorGoals('maya', 'artist', 'seed_1', traits);
    const coworkerGoals = initializeActorGoals('ryan', 'coworker', 'seed_1', traits);

    expect(artistGoals.map((g) => g.kind)).not.toEqual(coworkerGoals.map((g) => g.kind));
  });

  it('enforces strict bounds on active goal count', () => {
    const traits = sampleTraits();
    const goals = initializeActorGoals('sam', 'regular', 'seed_test', traits);

    expect(goals.length).toBeLessThanOrEqual(MAX_ACTIVE_GOALS_PER_ACTOR);
    expect(MAX_ACTIVE_GOALS_PER_ACTOR).toBe(3);
  });

  it('generates zero or minimal goals for background/remote actors', () => {
    const traits = sampleTraits();
    const remoteGoals = initializeActorGoals('stranger_web', 'student', 'seed_test', traits, undefined, undefined, 'background_remote');

    expect(remoteGoals.length).toBeLessThanOrEqual(1);
  });

  it('references social relationships without copying their numeric values', () => {
    const traits = sampleTraits();
    const peerBond = {
      targetId: 'maya',
      familiarity: 50,
      trust: 60,
      comfort: 45,
      respect: 70,
      annoyance: 0,
      affection: 20,
      attraction: 0,
      suspicion: 0,
      resentment: 0,
    };

    const goals = initializeActorGoals('ryan', 'coworker', 'seed_bond', traits, [peerBond]);
    const relationshipGoal = goals.find((g) => g.kind === 'improve_relationship' || g.kind === 'spend_time');

    if (relationshipGoal) {
      expect(relationshipGoal.targetId).toBe('maya');
      // Must not clone the raw numbers inside the goal
      expect('trust' in relationshipGoal).toBe(false);
      expect('familiarity' in relationshipGoal).toBe(false);
    }
  });

  it('operates with complete independence from AI/provider availability', () => {
    const traits = sampleTraits();
    // No mock LLM or provider is passed or required; must be 100% pure deterministic code
    const goals = initializeActorGoals('nora', 'nightowl', 'offline_seed', traits);
    expect(goals).toBeDefined();
    expect(goals.every((g) => g.description && g.priority > 0)).toBe(true);
  });

  it('evaluates goal progress safely from source authorities without mutating them', () => {
    const goal: PersonalGoal = {
      id: 'g_event',
      actorId: 'maya',
      kind: 'attend_event',
      description: 'Showcase event',
      targetId: 'event_showcase',
      priority: 60,
      status: 'active',
      progress: 0,
      createdDay: 1,
    };

    const sources = createLifeSources({
      getBuddy: () => undefined,
      getTraits: () => sampleTraits(),
      getPlayerRelationship: () => null,
      getNpcBonds: () => [],
      getPromises: () => [],
      getAgenda: () => [],
      getPresence: () => ({ messengerStatus: 'online' }),
      getAppointments: () => [],
      getTriggeredEvents: () => [{ id: 'event_showcase', title: 'Showcase', category: 'local', triggerDay: 1 }],
    });

    const evaluated = evaluateGoalProgress(goal, sources, 600);
    expect(evaluated.progress).toBe(1.0);
    expect(evaluated.status).toBe('completed');
    expect(goal.status).toBe('active');
    expect(goal.progress).toBe(0);
  });
});

describe('Lightweight NPC Life Pressure & Fidelity Tiers', () => {
  it('derives baseline pressure deterministically from traits and routine', () => {
    const traits = sampleTraits();
    const pressure = deriveDefaultNpcPressure('sam', traits, [
      { day: 1, startMinute: 480, endMinute: 1020, status: 'away', awayMessage: 'at work' },
    ]);

    expect(pressure.actorId).toBe('sam');
    expect(pressure.fatigueBand).toBe('rested');
    expect(pressure.stressBand).toBe('calm');
    expect(pressure.mood).toBeDefined();
    expect(pressure.interruptionTolerance).toBeDefined();
  });

  it('produces equivalent deterministic outcomes for off-screen time jumps vs interval stepping', () => {
    const traits = sampleTraits();
    const initial = deriveDefaultNpcPressure('sam', traits, [
      { day: 1, startMinute: 480, endMinute: 1020, status: 'away', awayMessage: 'at work' },
    ]);

    const context = {
      day: 1,
      routineWindows: [
        { day: 1, startMinute: 480, endMinute: 1020, status: 'away', awayMessage: 'at work' },
      ],
      isAtWork: true,
      hasRecentConflict: false,
    };

    // Step A: one big jump 480 -> 960 (480 minutes into work shift)
    const jumped = advanceNpcPressure(initial, 480, 960, context);

    // Step B: four 120-minute steps
    let stepped = advanceNpcPressure(initial, 480, 600, context);
    stepped = advanceNpcPressure(stepped, 600, 720, context);
    stepped = advanceNpcPressure(stepped, 720, 840, context);
    stepped = advanceNpcPressure(stepped, 840, 960, context);

    expect(jumped.fatigueBand).toBe(stepped.fatigueBand);
    expect(jumped.stressBand).toBe(stepped.stressBand);
    expect(jumped.mood).toBe(stepped.mood);
    expect(jumped.interruptionTolerance).toBe(stepped.interruptionTolerance);
  });

  it('keeps background/remote NPCs cheap with coarse abstract updates only', () => {
    const traits = sampleTraits();
    const remoteState = deriveDefaultNpcPressure('remote_npc', traits, [], 'background_remote');

    const context = {
      day: 1,
      routineWindows: [],
      isAtWork: false,
      hasRecentConflict: false,
    };

    const advanced = advanceNpcPressure(remoteState, 0, 720, context);
    expect(advanced.tier).toBe('background_remote');
    // Remote NPCs stay coarse without minute-by-minute activity shifts
    expect(advanced.interruptionTolerance).toBe('flexible');
  });

  it('reflects high-interruption pressure when important NPC is engaged in work/appointment', () => {
    const traits = sampleTraits();
    const state = deriveDefaultNpcPressure('maya', traits, [], 'important_local');

    const busyContext = {
      day: 1,
      routineWindows: [],
      isAtWork: true,
      inAppointment: true,
      hasRecentConflict: false,
    };

    const updated = advanceNpcPressure(state, 600, 660, busyContext);
    expect(updated.interruptionTolerance).toBe('do_not_disturb');
  });

  it('projects NpcPressureState into defensive LifePressureView', () => {
    const traits = sampleTraits();
    const state = deriveDefaultNpcPressure('maya', traits, [], 'important_local');
    const view1 = projectLifePressureView(state, 600);
    const view2 = projectLifePressureView(state, 600);

    expect(view1).toEqual(view2);
    expect(view1).not.toBe(view2);
    expect(view1.activeNeeds).not.toBe(view2.activeNeeds);
  });
});

describe('Personal Goal Obligation Projection', () => {
  it('projects active goals into CharacterObligations with sourceKind personal_goal', () => {
    const traits = sampleTraits();
    const snapshot: LifeMatrixSnapshot = {
      actorId: 'sam',
      atMinute: 600,
      day: 1,
      minuteOfDay: 600,
      traits,
      playerRelationship: null,
      notableNpcBonds: [],
      promises: [],
      routineWindows: [],
      agenda: [],
      appointments: [],
      worldEvents: [],
      presence: { messengerStatus: 'online' },
      pressure: { fatigueBand: 'normal' },
      goals: [
        {
          id: 'goal_repair_shelf',
          actorId: 'sam',
          kind: 'practical_task',
          description: 'Repair the cafe bookshelf',
          priority: 55,
          status: 'active',
          progress: 0,
          createdDay: 1,
        },
        {
          id: 'goal_past',
          actorId: 'sam',
          kind: 'save_purchase',
          description: 'Old completed goal',
          priority: 40,
          status: 'completed',
          progress: 1.0,
          createdDay: 1,
        },
      ],
    };

    const obligations = buildCharacterObligations(snapshot);
    const goalObligations = obligations.filter((o) => o.sourceKind === 'personal_goal');

    expect(goalObligations.length).toBe(1);
    expect(goalObligations[0]?.id).toBe('goal:sam:goal_repair_shelf');
    expect(goalObligations[0]?.sourceKind).toBe('personal_goal');
    expect(goalObligations[0]?.sourceId).toBe('goal_repair_shelf');
    expect(goalObligations[0]?.priority).toBe(55);
    expect(goalObligations[0]?.flexibility).toBe('flexible');
    expect(goalObligations[0]?.status).toBe('pending');
  });
});

describe('Isolated Serialization and Neutral Migration Helpers', () => {
  it('performs pure round-trip serialization and hydration of personal goals', () => {
    const original: PersonalGoal[] = [
      {
        id: 'g1',
        actorId: 'maya',
        kind: 'find_work',
        description: 'Look for an audio engineering gig',
        priority: 70,
        status: 'active',
        progress: 0.5,
        createdDay: 2,
        targetDay: 10,
        metadata: { field: 'music' },
      },
    ];

    const serialized = serializePersonalGoals(original);
    const hydrated = hydratePersonalGoals(serialized);

    expect(hydrated).toEqual(original);
    expect(hydrated).not.toBe(original);
  });

  it('hydrates corrupt or legacy missing data into safe empty/neutral goal sets', () => {
    expect(hydratePersonalGoals(null)).toEqual([]);
    expect(hydratePersonalGoals(undefined)).toEqual([]);
    expect(hydratePersonalGoals('invalid json')).toEqual([]);
    expect(hydratePersonalGoals({})).toEqual([]);
    expect(hydratePersonalGoals([{ badField: 123 }])).toEqual([]);
  });

  it('performs pure round-trip serialization and hydration of NPC pressure', () => {
    const traits = sampleTraits();
    const pressure = deriveDefaultNpcPressure('maya', traits, []);
    pressure.fatigueBand = 'tired';
    pressure.stressBand = 'stressed';

    const serialized = serializeNpcPressure(pressure);
    const hydrated = hydrateNpcPressure(serialized);

    expect(hydrated).toEqual(pressure);
  });

  it('migrates legacy or missing pressure data to neutral baseline defaults', () => {
    const fallback = hydrateNpcPressure(null, 'default_actor');
    expect(fallback).not.toBeNull();
    expect(fallback?.actorId).toBe('default_actor');
    expect(fallback?.fatigueBand).toBe('normal');
    expect(fallback?.stressBand).toBe('normal');
    expect(fallback?.mood).toBe('neutral');
  });
});
