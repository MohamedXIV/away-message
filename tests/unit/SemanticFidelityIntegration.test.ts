import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

/** Full headless real-world owner fixture; no hardcoded NPC IDs. */
function registerActor(game: SimulationEngine, id: string, reach: 'local' | 'remote') {
  const template = game.social.getBuddies()[0]!;
  return game.social.registerBuddy({
    ...template, id, handle: id, reach, status: 'stranger',
    initialRelationships: {
      ...template.initialRelationships,
      familiarity: 0, trust: 0, comfort: 0, respect: 0,
    },
  });
}

describe('#187 operational NPC fidelity / remote safety', () => {
  it('distinguishes background local from socially important local and promotes only at a minute boundary', () => {
    const game = new SimulationEngine();
    registerActor(game, 'unfamiliar_local', 'local');
    expect(game.getFidelityTier('unfamiliar_local')).toBe('local_offscreen');
    expect(game.getActorSemanticView('unfamiliar_local')?.fidelity).toBe('background_local');

    game.advanceGameMinutes(60, 'semantic fixture first interval');
    expect(game.getNpcLivesState()['unfamiliar_local']?.pressure.tier).toBe('local_offscreen');

    expect(game.social.learnHandle('unfamiliar_local', 'unfamiliar_local')).toBe(true);
    expect(game.getFidelityTier('unfamiliar_local')).toBe('important_local');
    expect(game.getActorSemanticView('unfamiliar_local', true)?.fidelity).toBe('focused');
    // Reads derive promotion, but do not mutate persisted life-pressure history.
    expect(game.getNpcLivesState()['unfamiliar_local']?.pressure.tier).toBe('local_offscreen');

    game.advanceGameMinutes(60, 'semantic fixture promoted interval');
    expect(game.getNpcLivesState()['unfamiliar_local']?.pressure.tier).toBe('important_local');
    expect(new SimulationEngine(game.exportSnapshot()).getFidelityTier('unfamiliar_local')).toBe('important_local');
  });

  it('prevents remote canon actors from local XYZ and NPC transit while preserving online identity', () => {
    const game = new SimulationEngine();
    registerActor(game, 'distant_online', 'remote');
    expect(game.getFidelityTier('distant_online')).toBe('background_remote');
    expect(game.getActorSemanticView('distant_online', true)?.fidelity).toBe('remote_known');
    expect(game.getActorSemanticView('distant_online')?.canMeetInPerson.reasons).toContain('remote_reach');
    expect(() => game.relocateActorSpatially('distant_online', { x: 20, y: 60, z: 0 }))
      .toThrow('Remote/departed actors cannot acquire local spatial authority.');
    game.advanceGameMinutes(720, 'remote without town');
    expect(game.getNpcTrip('distant_online')).toBeNull();
    expect(game.getActorSpatialProjection('distant_online')).toBeNull();
    expect(game.getNpcLivesState()['distant_online']?.pressure.tier).toBe('background_remote');

    const reloaded = new SimulationEngine(game.exportSnapshot());
    expect(reloaded.social.getBuddy('distant_online')?.reach).toBe('remote');
    expect(reloaded.getNpcTrip('distant_online')).toBeNull();
    expect(reloaded.getActorSpatialProjection('distant_online')).toBeNull();
  });
});