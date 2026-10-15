import { describe, expect, it } from 'vitest';
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

  it('keeps remote reach as a source of fidelity rather than player rank', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot();
    const owners = createCoreDomainOwners(snapshot);
    const life = new NpcLifeRuntime(owners, () => {}, snapshot.npcLives);

    for (const buddy of owners.social.getBuddies()) {
      expect(life.getFidelityTier(buddy.id)).toBe(
        buddy.reach === 'remote' ? 'background_remote' : 'important_local',
      );
    }
  });
});
