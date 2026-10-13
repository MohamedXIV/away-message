import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { NpcLifeRuntime } from '../../src/engine/kernel/NpcLifeRuntime';
import { NpcMovementRuntime } from '../../src/engine/kernel/NpcMovementRuntime';
import { EncounterRuntime } from '../../src/engine/kernel/EncounterRuntime';

function fixture() {
  const source = new SimulationEngine();
  const snapshot = source.exportSnapshot();
  const owners = createCoreDomainOwners(snapshot);
  const life = new NpcLifeRuntime(owners, () => {}, snapshot.npcLives);
  const movement = new NpcMovementRuntime(
    owners,
    (id) => life.getCharacterIntent(id),
    () => {},
    snapshot.npcMobility,
    snapshot.actorSpatialPositions,
  );
  const encounter = new EncounterRuntime(
    owners,
    {
      getNpcMobilityState: () => movement.getNpcMobilityState(),
      getNpcPlaceState: (id, atMinute) => movement.getNpcPlaceState(id, atMinute),
      getCharacterIntent: (id) => life.getCharacterIntent(id),
      getCharacterObligations: (id) => life.getCharacterObligations(id),
      getLifeSnapshot: (id) => life.getLifeSnapshot(id),
    },
    () => {},
    snapshot.encounters,
  );
  return { source, owners, life, movement, encounter };
}

describe('EncounterRuntime — one canonical decision-state owner', () => {
  it('rehydrates the existing encounter director without touching movement or Social truth', () => {
    const { source, encounter, movement, owners } = fixture();
    expect(encounter.getEncounterDirectorState()).toEqual(source.getEncounterDirectorState());

    const mobilityBefore = movement.getNpcMobilityState();
    const socialBefore = owners.social.getState();
    const stateBefore = encounter.getEncounterDirectorState();

    const candidates = encounter.collectEncounterCandidates();
    expect(Array.isArray(candidates)).toBe(true);
    expect(encounter.getEncounterDirectorState()).toEqual(stateBefore);
    expect(movement.getNpcMobilityState()).toEqual(mobilityBefore);
    expect(owners.social.getState()).toEqual(socialBefore);
  });

  it('serializes and restores one-shot/cooldown state without a second simulation', () => {
    const { encounter } = fixture();
    const saved = encounter.getEncounterDirectorState();
    encounter.loadState(saved);
    expect(encounter.getEncounterDirectorState()).toEqual(saved);

    const input = encounter.buildEncounterInput();
    expect(input.playerTransit).toBeNull();
    expect(input.actors).toBeInstanceOf(Array);
    expect(input.trips).toBeDefined();
  });
});
