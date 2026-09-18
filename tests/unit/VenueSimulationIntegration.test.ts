import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { CharacterIntent } from '../../src/engine/life/types';

function cafeIntent(actorId = 'player'): CharacterIntent {
  return {
    actorId,
    kind: 'shop_for_need',
    activity: 'meal',
    priority: 45,
    reasons: ['need:meal'],
    blockers: [],
    reevaluateAtMinute: 999,
  };
}

function assignCafeWorker(sim: SimulationEngine, status: 'active' | 'break' = 'active'): void {
  sim.relocateActorSpatially('fixture_barista_actor', { x: 20, y: 60, z: 0 });
  sim.setVenueRoleAssignment({
    id: 'fixture_barista_assignment',
    actorId: 'fixture_barista_actor',
    roleId: 'fixture_barista_role',
    sourceKind: 'job',
    sourceId: 'fixture_barista_shift',
    status,
    stationId: 'fixture_cafe_staff_station',
  });
}

function assignShopWorker(sim: SimulationEngine, status: 'active' | 'break' = 'active'): void {
  sim.relocateActorSpatially('fixture_cashier_actor', { x: 80, y: 40, z: 0 });
  sim.setVenueRoleAssignment({
    id: 'fixture_cashier_assignment',
    actorId: 'fixture_cashier_actor',
    roleId: 'fixture_cashier_role',
    sourceKind: 'job',
    sourceId: 'fixture_cashier_shift',
    status,
    stationId: 'fixture_shop_staff_station',
  });
}

describe('SimulationEngine venue integration (#94)', () => {
  it('derives cafe availability from staffing + spatial presence + #103 physical context', () => {
    const sim = new SimulationEngine();

    expect(sim.getVenueServiceAvailability('fixture_cafe_service')).toEqual({
      available: false,
      blockers: ['missing_role:barista'],
    });

    assignCafeWorker(sim);

    expect(sim.getVenueServiceAvailability('fixture_cafe_service')).toEqual({
      available: true,
      blockers: [],
    });

    sim.setVenueRoleAssignment({
      ...sim.getVenueRuntimeState().roleAssignments['fixture_barista_assignment']!,
      status: 'break',
    });

    expect(sim.getVenueServiceAvailability('fixture_cafe_service')).toEqual({
      available: false,
      blockers: ['missing_role:barista'],
    });
  });

  it('starts an explicit selected intent without mutating or rescoring it', () => {
    const sim = new SimulationEngine();
    assignCafeWorker(sim);
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });

    const intent = cafeIntent();
    const before = structuredClone(intent);
    const started = sim.startVenueActivityFromIntent(intent);

    expect(started.ok).toBe(true);
    expect(intent).toEqual(before);
    expect(sim.getActiveVenueActivity('player')).toMatchObject({
      actorId: 'player',
      placeId: 'place_a1',
      serviceId: 'fixture_cafe_service',
      activityTemplateId: 'fixture_cafe_customer_activity',
      purpose: 'shop',
      activityKind: 'ordering',
      intentKind: 'shop_for_need',
      intentPriority: 45,
      intentReasons: ['need:meal'],
      status: 'active',
      currentPhaseIndex: 0,
      phaseId: 'order',
      stationId: 'fixture_cafe_customer_station',
    });
  });

  it('renderer/view changes alone do not create or cancel canonical activities', () => {
    const sim = new SimulationEngine();
    assignCafeWorker(sim);
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });

    expect(sim.getActiveVenueActivity('player')).toBeNull();
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'pc' });
    expect(sim.getActiveVenueActivity('player')).toBeNull();

    const started = sim.startVenueActivityFromIntent(cafeIntent());
    expect(started.ok).toBe(true);
    const before = sim.getActiveVenueActivity('player');

    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'city' });

    expect(sim.getActiveVenueActivity('player')).toEqual(before);
  });

  it('persists a mid-activity phase and completes exactly once after reload', () => {
    const sim = new SimulationEngine();
    assignCafeWorker(sim);
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });

    const started = sim.startVenueActivityFromIntent(cafeIntent());
    expect(started.ok).toBe(true);

    sim.advanceGameMinutes(2, 'venue first phase');
    expect(sim.getActiveVenueActivity('player')).toMatchObject({
      currentPhaseIndex: 1,
      phaseId: 'receive',
      status: 'active',
    });

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    const completions: Array<{ kind: string; actorId: string; owner: string }> = [];
    restored.events.on('venue:activity_completed', (command) => {
      completions.push({
        kind: command.kind,
        actorId: command.actorId,
        owner: command.owner,
      });
    });

    restored.advanceGameMinutes(2, 'venue completion');

    expect(restored.getActiveVenueActivity('player')).toBeNull();
    expect(completions).toEqual([
      { kind: 'order_ready', actorId: 'player', owner: 'shop' },
    ]);

    restored.advanceGameMinutes(30, 'no replay');
    expect(completions).toHaveLength(1);
  });

  it('does not mutate wage, cash, inventory, or social owners on venue completion', () => {
    const sim = new SimulationEngine();
    assignCafeWorker(sim);
    sim.relocateActorSpatially('player', { x: 20, y: 60, z: 0 });

    const before = sim.exportSnapshot();
    const started = sim.startVenueActivityFromIntent(cafeIntent());
    expect(started.ok).toBe(true);
    sim.advanceGameMinutes(4, 'venue completion');

    const after = sim.exportSnapshot();
    expect(after.player.cash).toBe(before.player.cash);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.social).toEqual(before.social);
  });

  it('supports the generic shop workflow through the same service/activity runtime', () => {
    const sim = new SimulationEngine();
    assignShopWorker(sim);
    sim.relocateActorSpatially('fixture_shopper', { x: 80, y: 40, z: 0 });

    const intent: CharacterIntent = {
      actorId: 'fixture_shopper',
      kind: 'shop_for_need',
      activity: 'supplies',
      priority: 50,
      reasons: ['need:supplies'],
      blockers: [],
      reevaluateAtMinute: 999,
    };

    expect(sim.getVenueServiceAvailability('fixture_shop_service')).toEqual({
      available: true,
      blockers: [],
    });

    const started = sim.startVenueActivityFromIntent(intent);
    expect(started.ok).toBe(true);
    expect(sim.getActiveVenueActivity('fixture_shopper')).toMatchObject({
      placeId: 'place_b1',
      serviceId: 'fixture_shop_service',
      activityTemplateId: 'fixture_shop_customer_activity',
      activityKind: 'checkout',
    });

    sim.advanceGameMinutes(3, 'shop checkout');
    expect(sim.getActiveVenueActivity('fixture_shopper')).toBeNull();
  });

  it('rejects venue execution when the actor is not physically at the service Place', () => {
    const sim = new SimulationEngine();
    assignCafeWorker(sim);
    sim.relocateActorSpatially('player', { x: 80, y: 40, z: 0 });

    expect(sim.startVenueActivityFromIntent(cafeIntent())).toEqual({
      ok: false,
      reason: 'no_compatible_service',
    });
  });
});
