import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { getSharedPlaceAliases } from '../../src/engine/transit/NpcTrips';

describe('Residence/Tenancy authority', () => {
  it('exposes one persisted current-residence root on a clean new game', () => {
    const engine = new SimulationEngine();
    const state = engine.getState() as any;

    expect(state.residence).toEqual({
      currentResidencePlaceId: 'room_104',
      tenancyId: 'tenancy:starter',
      moveInMinute: 480,
      currentRent: state.player.rentAmount,
    });
  });

  it('hydrates current residence from the canonical snapshot root', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot() as any;
    snapshot.residence = {
      currentResidencePlaceId: 'place_a1',
      tenancyId: 'tenancy:test-a1',
      moveInMinute: 900,
      currentRent: 125,
    };

    const restored = new SimulationEngine(snapshot);
    expect((restored.getState() as any).residence).toEqual(snapshot.residence);
    expect((restored.exportSnapshot() as any).residence).toEqual(snapshot.residence);
  });

  it('does not expose home as a permanent authored place alias', () => {
    expect(getSharedPlaceAliases()).not.toHaveProperty('home');
  });
});
