import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function firstActor(sim: SimulationEngine): string {
  const [actor] = sim.social.getBuddies();
  if (!actor) throw new Error('Expected at least one Away character.');
  return actor.id;
}

function npcLivesOf(snapshot: unknown): Record<string, unknown> {
  const slice = (snapshot as { npcLives?: unknown }).npcLives;
  expect(slice).toBeDefined();
  return slice as Record<string, unknown>;
}

describe('NPC life persistence (#43)', () => {
  it('1. canonical personal goals survive export -> reload exactly', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    const goals = first.getPersonalGoals(actor);
    expect(goals.length).toBeGreaterThan(0);

    const snapshot = first.exportSnapshot();
    const second = new SimulationEngine(snapshot as never);
    expect(second.getPersonalGoals(actor)).toEqual(goals);
  });

  it('1b. loaded goals win over recomputation (tampered snapshot survives)', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot())) as {
      npcLives: Record<string, { goals: Array<{ description: string }> }>;
    };
    snapshot.npcLives[actor]!.goals[0]!.description = 'tampered canonical goal';
    const second = new SimulationEngine(snapshot as never);
    expect(second.getPersonalGoals(actor)[0]?.description).toBe('tampered canonical goal');
  });

  it('2. irreducible pressure survives export -> reload exactly', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.advanceGameMinutes(120, 'settle pressure');
    const view = first.getNpcPressure(actor);
    expect(view).not.toBeNull();

    const snapshot = first.exportSnapshot();
    const before = npcLivesOf(snapshot);
    const second = new SimulationEngine(snapshot as never);
    expect(second.getNpcPressure(actor)).toEqual(view);
    expect(npcLivesOf(second.exportSnapshot())).toEqual(before);
  });

  it('3. old snapshots without #43 state receive deterministic valid defaults', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot())) as Record<string, unknown>;
    delete snapshot.npcLives;

    const a = new SimulationEngine(snapshot as never);
    const b = new SimulationEngine(snapshot as never);
    for (const sim of [a, b]) {
      const goals = sim.getPersonalGoals(actor);
      expect(goals.length).toBeGreaterThanOrEqual(1);
      expect(goals.length).toBeLessThanOrEqual(3);
      for (const goal of goals) {
        expect(goal.actorId).toBe(actor);
        expect(goal.status).toBe('active');
        expect(goal.priority).toBeGreaterThan(0);
      }
      const pressure = sim.getNpcPressure(actor);
      expect(pressure).not.toBeNull();
      expect(['rested', 'normal', 'tired', 'exhausted']).toContain(
        (pressure as { fatigueBand: string }).fatigueBand,
      );
    }
    expect(a.getPersonalGoals(actor)).toEqual(b.getPersonalGoals(actor));
    expect(a.getNpcPressure(actor)).toEqual(b.getNpcPressure(actor));
  });

  it('4. repeated migration/load produces equivalent results', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    first.advanceGameMinutes(60, 'settle');
    const snapshot = first.exportSnapshot();

    const reloaded = new SimulationEngine(snapshot as never);
    reloaded.loadSnapshot(JSON.parse(JSON.stringify(snapshot)) as never);
    reloaded.loadSnapshot(JSON.parse(JSON.stringify(snapshot)) as never);
    expect(reloaded.getPersonalGoals(actor)).toEqual(first.getPersonalGoals(actor));
    expect(reloaded.exportSnapshot().npcLives).toEqual(snapshot.npcLives);
  });

  it('5. save -> reload -> save is stable for #43 state', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    first.getNpcPressure(actor);
    const snap1 = first.exportSnapshot();

    const second = new SimulationEngine(snap1 as never);
    second.getPersonalGoals(actor);
    second.getNpcPressure(actor);
    const snap2 = second.exportSnapshot();

    expect(snap2.npcLives).toEqual(snap1.npcLives);
  });

  it('6. goals remain bounded after load/migration', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot())) as {
      npcLives: Record<string, { goals: unknown[] }>;
    };
    const extra = Array.from({ length: 5 }, (_, i) => ({
      id: `goal:${actor}:injected_${i}`,
      actorId: actor,
      kind: 'practical_task',
      description: `injected ${i}`,
      priority: 10 + i,
      status: 'active',
      progress: 0,
      createdDay: 1,
    }));
    snapshot.npcLives[actor]!.goals = [...snapshot.npcLives[actor]!.goals, ...extra];
    const second = new SimulationEngine(snapshot as never);
    expect(second.getPersonalGoals(actor).length).toBeLessThanOrEqual(3);
  });

  it('7. malformed persisted goal data is normalized by current policy', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot())) as {
      npcLives: Record<string, { goals: unknown[]; pressure: unknown }>;
    };
    snapshot.npcLives = {
      [actor]: {
        goals: [
          { id: 'bad-kind', actorId: actor, kind: 'mind_control', description: 'x', priority: 99, status: 'active', progress: 0 },
          { id: 'bad-status', actorId: actor, kind: 'practical_task', description: 'x', priority: 99, status: 'ascended', progress: 0 },
          { id: 'over-progress', actorId: actor, kind: 'practical_task', description: 'x', priority: 99, status: 'active', progress: 42 },
          'not-an-object',
        ],
        pressure: { nonsense: true },
      },
    };
    const second = new SimulationEngine(snapshot as never);
    const goals = second.getPersonalGoals(actor);
    expect(goals).toHaveLength(1);
    expect(goals[0]?.id).toBe('over-progress');
    expect(goals[0]?.progress).toBe(1);
    // Invalid pressure falls back to a valid default view, never null-shape garbage.
    expect(second.getNpcPressure(actor)).not.toBeNull();
  });

  it('8. recomputable Life Matrix projections are NOT persisted as second truth', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    first.getLifeSnapshot(actor);
    first.getCharacterObligations(actor);
    const json = JSON.stringify(first.exportSnapshot());
    expect(json).not.toContain('"obligations"');
    expect(json).not.toContain('"eventEffects"');
    const lives = npcLivesOf(first.exportSnapshot());
    for (const entry of Object.values(lives) as Array<{ goals: object[]; pressure: object }>) {
      expect(Object.keys(entry).sort()).toEqual(['goals', 'pressure']);
    }
  });

  it('9. relationship/economy/transit/event authorities are not copied into the slice', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    first.getNpcPressure(actor);
    const json = JSON.stringify(npcLivesOf(first.exportSnapshot()));
    for (const forbidden of [
      'familiarity', 'relationshipTrust', 'comfort', 'cash', 'cashBalance',
      'currentBusTrip', 'activeTravel', 'appointmentCompleted', 'wage', 'rsvp',
      'knowledgePrompt', 'personalTake', 'attitude',
    ]) {
      expect(json).not.toContain(`"${forbidden}"`);
    }
  });

  it('10. AI/provider availability cannot change loaded canonical state', () => {
    const first = new SimulationEngine();
    const actor = firstActor(first);
    first.getPersonalGoals(actor);
    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot()));

    // Offline-safe by construction: repeated loads with no provider agree exactly.
    const a = new SimulationEngine(snapshot as never);
    const b = new SimulationEngine(snapshot as never);
    expect(a.getPersonalGoals(actor)).toEqual(b.getPersonalGoals(actor));
    expect(a.getNpcPressure(actor)).toEqual(b.getNpcPressure(actor));
    expect(a.exportSnapshot().npcLives).toEqual(b.exportSnapshot().npcLives);
  });
});
