import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { NpcLifeRuntime } from '../../src/engine/kernel/NpcLifeRuntime';
import { NpcMovementRuntime } from '../../src/engine/kernel/NpcMovementRuntime';

function fixture() {
  const source = new SimulationEngine();
  const snapshot = source.exportSnapshot();
  const owners = createCoreDomainOwners(snapshot);
  const life = new NpcLifeRuntime(owners, () => {}, snapshot.npcLives);
  let invalidations = 0;
  const movement = new NpcMovementRuntime(
    owners,
    (actorId) => life.getCharacterIntent(actorId),
    () => { invalidations += 1; },
    snapshot.npcMobility,
    snapshot.actorSpatialPositions,
  );
  return { source, owners, life, movement, invalidations: () => invalidations };
}

describe('NpcMovementRuntime — one canonical trip and XYZ owner', () => {
  it('rehydrates current NPC mobility and spatial slices without an independent world', () => {
    const { source, movement } = fixture();
    expect(movement.getNpcMobilityState()).toEqual(source.getNpcMobilityState());
    expect(movement.getActorSpatialPositions()).toEqual(source.getActorSpatialPositions());
    const actorId = source.social.getBuddies()[0]!.id;
    expect(movement.getNpcTrip(actorId)).toEqual(source.getNpcTrip(actorId));
    expect(movement.getNpcPlaceState(actorId)).toEqual(source.getNpcPlaceState(actorId));
  });

  it('commits explicit XYZ relocation through one spatial owner and returns defensive copies', () => {
    const { movement, invalidations } = fixture();
    const actorId = 'npc_movement_test_actor';
    const position = { x: -10000, y: -10000, z: 0 };
    const projection = movement.relocateActorSpatially(actorId, position);

    expect(projection.position).toEqual(position);
    expect(movement.getActorSpatialPositions()[actorId]).toEqual(position);
    const external = movement.getActorSpatialPositions();
    external[actorId]!.x = 17;
    expect(movement.getActorSpatialPositions()[actorId]!.x).toBe(position.x);

    movement.clearActorSpatialForTravel(actorId);
    expect(movement.getActorSpatialPositions()[actorId]).toBeUndefined();
    expect(invalidations()).toBeGreaterThan(0);
  });

  it('round-trips normalized mobility/XYZ state without creating second trip authority', () => {
    const { movement } = fixture();
    movement.relocateActorSpatially('npc_persist_test', { x: -10000, y: -9999, z: 0 });
    const trips = movement.getNpcMobilityState();
    const spatial = movement.getActorSpatialPositions();

    movement.loadState(trips, spatial);
    expect(movement.getNpcMobilityState()).toEqual(trips);
    expect(movement.getActorSpatialPositions()).toEqual(spatial);
  });
});
