import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  currentResidenceHasCapability,
  resolvePlaceCapabilityAnchor,
} from '../../src/engine/residence/ResidenceAuthority';
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
    expect(restored.resolveCurrentHomePlaceId()).toBe('place_a1');
    expect((restored.exportSnapshot() as any).residence).toEqual(snapshot.residence);
  });

  it('does not expose home as a permanent authored place alias', () => {
    expect(getSharedPlaceAliases()).not.toHaveProperty('home');
  });

  it('resolves home facilities from authored place capabilities rather than room number', () => {
    const capable = {
      currentResidencePlaceId: 'room_104',
      tenancyId: 'tenancy:capable',
      moveInMinute: 0,
      currentRent: 0,
    };
    const sparse = { ...capable, currentResidencePlaceId: 'place_a1' };

    expect(resolvePlaceCapabilityAnchor('room_104', 'use_computer')).toBe('room104_pc');
    expect(resolvePlaceCapabilityAnchor('room_104', 'inspect_delivery_anchor')).toBe('room104_delivery_anchor');
    expect(currentResidenceHasCapability(capable, 'prepare_drink')).toBe(true);
    expect(currentResidenceHasCapability(sparse, 'use_computer')).toBe(false);
    expect(currentResidenceHasCapability(sparse, 'prepare_drink')).toBe(false);
    expect(currentResidenceHasCapability(sparse, 'inspect_delivery_anchor')).toBe(false);
  });
});
