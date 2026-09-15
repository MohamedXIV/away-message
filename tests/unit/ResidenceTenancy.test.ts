import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { GENERATED_PLACES } from '../../src/engine/worldContent.generated';

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

  it('does not encode home as a permanent legacy alias for Room 104', () => {
    const room104 = GENERATED_PLACES.find((place) => place.id === 'room_104');
    expect(room104).toBeDefined();
    expect(room104?.legacyIds).not.toContain('home');
  });
});
