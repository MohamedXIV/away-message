import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { NpcLifeRuntime } from '../../src/engine/kernel/NpcLifeRuntime';

describe('NpcLifeRuntime — one canonical pressure and goals owner', () => {
  it('reconstructs the existing NPC life slice and selectors from one owner graph', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot();
    const owners = createCoreDomainOwners(snapshot);
    const life = new NpcLifeRuntime(owners, () => {}, snapshot.npcLives);
    const actorId = source.social.getBuddies()[0]!.id;

    expect(life.getNpcLivesState()).toEqual(source.getNpcLivesState());
    expect(life.getPersonalGoals(actorId)).toEqual(source.getPersonalGoals(actorId));
    expect(life.getNpcPressure(actorId)).toEqual(source.getNpcPressure(actorId));
    expect(life.getCharacterIntent(actorId)).toEqual(source.getCharacterIntent(actorId));
    expect(life.getCharacterObligations(actorId))
      .toEqual(source.getCharacterObligations(actorId));
  });

  it('does not invent actors and keeps same-minute reads stable after one explicit advance', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot();
    const owners = createCoreDomainOwners(snapshot);
    let invalidations = 0;
    const life = new NpcLifeRuntime(owners, () => { invalidations += 1; }, snapshot.npcLives);

    expect(life.getLifeSnapshot('nonexistent-npc')).toBeNull();
    expect(life.getCharacterIntent('nonexistent-npc')).toBeNull();
    expect(life.getPersonalGoals('nonexistent-npc')).toEqual([]);

    owners.clock.advanceMinutes(60);
    life.advanceAllNpcPressuresToNow();
    const evolved = life.getNpcLivesState();
    life.advanceAllNpcPressuresToNow();
    expect(life.getNpcLivesState()).toEqual(evolved);

    life.loadState(evolved);
    expect(life.getNpcLivesState()).toEqual(evolved);
    expect(invalidations).toBeGreaterThan(0);
  });

  it('late-joined NPC Life reads remain pure until canonical clock progression materializes the actor', () => {
    const game = new SimulationEngine();
    const template = game.social.getBuddies().find(actor => actor.reach === 'local')!;
    const actorId = 'late_life_reader';
    game.social.registerBuddy({
      ...template, id: actorId, handle: actorId, displayName: 'Late Life Reader',
      status: 'stranger', reach: 'local',
    });
    const currentLives = game.getNpcLivesState();
    expect(currentLives[actorId]).toBeUndefined();

    const revisionBefore = game.getRevision();
    const broad = vi.spyOn(game, 'getState');
    const changes: number[] = [];
    const stop = game.subscribeChanges(change => changes.push(change.revision));
    changes.length = 0;

    const projectedPressure = game.getNpcPressure(actorId);
    const projectedGoals = game.getPersonalGoals(actorId);
    expect(projectedPressure).toEqual(game.getNpcPressure(actorId));
    expect(projectedPressure).not.toBeNull();
    expect(projectedGoals.length).toBeGreaterThan(0);
    expect(game.getLifeSnapshot(actorId)).not.toBeNull();
    expect(game.getCharacterObligations(actorId)).toBeDefined();
    expect(game.getCharacterIntent(actorId)).toEqual(game.getCharacterIntent(actorId));

    // A new actor cannot change the canonical save, revision, or subscriber
    // notifications merely because a user opens an inspector or a scene.
    expect(game.getNpcLivesState()).toEqual(currentLives);
    expect(game.getRevision()).toBe(revisionBefore);
    expect(changes).toHaveLength(0);
    expect(broad).not.toHaveBeenCalled();

    const goalsForUi = game.getPersonalGoals(actorId);
    const meta = goalsForUi.find(goal => goal.metadata)?.metadata;
    if (meta) (meta as Record<string, unknown>).viewerOverride = true;
    expect(game.getPersonalGoals(actorId)).toEqual(projectedGoals);

    game.advanceGameMinutes(60, 'materialize late NPC on canonical tick');
    expect(game.getNpcLivesState()[actorId]).toBeDefined();
    expect(game.getPersonalGoals(actorId)).toEqual(projectedGoals);
    expect(changes.at(-1)).toBe(game.getRevision());
    stop();
  });

  it('keeps remote reach as a source of fidelity rather than player rank', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot();
    const owners = createCoreDomainOwners(snapshot);
    const life = new NpcLifeRuntime(owners, () => {}, snapshot.npcLives);

    for (const buddy of owners.social.getBuddies()) {
      const rel = owners.social.getRelationships(buddy.id);
      const important = owners.social.isKnown(buddy.id) || (rel?.familiarity ?? 0) >= 35;
      expect(life.getFidelityTier(buddy.id)).toBe(
        buddy.reach === 'remote' ? 'background_remote'
          : important ? 'important_local' : 'local_offscreen',
      );
    }
  });
});
