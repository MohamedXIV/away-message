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
    expect(currentResidenceHasCapability(capable, 'sleep')).toBe(true);
    expect(currentResidenceHasCapability(capable, 'prepare_drink')).toBe(true);
    expect(currentResidenceHasCapability(sparse, 'use_computer')).toBe(false);
    expect(currentResidenceHasCapability(sparse, 'sleep')).toBe(false);
    expect(currentResidenceHasCapability(sparse, 'prepare_drink')).toBe(false);
    expect(currentResidenceHasCapability(sparse, 'inspect_delivery_anchor')).toBe(false);
  });

  it('allows computer setup only when the current residence authors use_computer', () => {
    const capable = new SimulationEngine({ player: { cash: 500 } } as any);
    expect(capable.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(capable.setupComputerAtHome().success).toBe(true);

    const seed = new SimulationEngine({ player: { cash: 500 } } as any);
    const snapshot = seed.exportSnapshot() as any;
    snapshot.residence = {
      currentResidencePlaceId: 'place_a1',
      tenancyId: 'tenancy:test-a1',
      moveInMinute: snapshot.time.totalMinutes,
      currentRent: 125,
    };
    const sparse = new SimulationEngine(snapshot);
    expect(sparse.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);

    const result = sparse.setupComputerAtHome();
    expect(result.success).toBe(false);
    expect(sparse.getState().computer.assembled).toBe(false);
  });

  it('blocks at-home hardware installation after moving to a residence without use_computer', () => {
    const capable = new SimulationEngine({ player: { cash: 500 } } as any);
    expect(capable.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    expect(capable.setupComputerAtHome().success).toBe(true);
    expect(capable.purchaseStoreItem('silicon_spares', 'part_ram_128mb').success).toBe(true);

    const snapshot = capable.exportSnapshot() as any;
    snapshot.residence = {
      currentResidencePlaceId: 'place_a1',
      tenancyId: 'tenancy:test-a1',
      moveInMinute: snapshot.time.totalMinutes,
      currentRent: 125,
    };
    const sparse = new SimulationEngine(snapshot);
    const ram = sparse.getState().inventory.items.find(
      (item) => item.catalogItemId === 'ram_sdram_128' && item.location === 'room_package',
    );
    expect(ram).toBeDefined();

    const result = sparse.installOwnedHardwareAtHome(ram!.instanceId, 'ram:1');
    expect(result.success).toBe(false);
    expect(sparse.getState().inventory.items.find((item) => item.instanceId === ram!.instanceId)).toMatchObject({
      location: 'room_package',
    });
  });

  it('does not grant sleep or kitchenette actions to a residence that does not author them', () => {
    const seed = new SimulationEngine({ player: { cash: 500 } } as any);
    const snapshot = seed.exportSnapshot() as any;
    snapshot.residence = {
      currentResidencePlaceId: 'place_a1',
      tenancyId: 'tenancy:test-a1',
      moveInMinute: snapshot.time.totalMinutes,
      currentRent: 125,
    };
    const sparse = new SimulationEngine(snapshot);
    const minuteBefore = sparse.clock.getTotalMinutes();

    const drink = sparse.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'tea' } as any);
    expect(drink.success).toBe(false);
    expect(sparse.clock.getTotalMinutes()).toBe(minuteBefore);

    const sleep = sparse.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8, wakeMinute: 0 } as any);
    expect(sleep.success).toBe(false);
    expect(sparse.clock.getTotalMinutes()).toBe(minuteBefore);
  });
});
