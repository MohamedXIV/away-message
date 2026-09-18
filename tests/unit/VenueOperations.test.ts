import { describe, expect, it } from 'vitest';
import type { CharacterIntent } from '../../src/engine/life/types';
import type { ContextRequirementResult } from '../../src/engine/physical/PhysicalContextRuntime';
import {
  advanceVenueActivities,
  createEmptyVenueRuntimeState,
  evaluateVenueService,
  resolveIntentToVenueActivity,
  setVenueRoleAssignment,
  startVenueActivity,
  type VenueDefinitionSet,
} from '../../src/engine/venue/VenueOperations';

const definitions: VenueDefinitionSet = {
  roles: [
    {
      id: 'test_barista_role',
      placeId: 'test_cafe',
      name: 'Barista',
      roleKind: 'barista',
      stationIds: ['test_barista_station'],
      tags: [],
    },
    {
      id: 'test_cashier_role',
      placeId: 'test_shop',
      name: 'Cashier',
      roleKind: 'cashier',
      stationIds: ['test_cashier_station'],
      tags: [],
    },
  ],
  stations: [
    {
      id: 'test_barista_station',
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      anchorId: 'test_barista_anchor',
      name: 'Barista Counter',
      capacity: 1,
      roleKinds: ['barista'],
      tags: ['staff'],
    },
    {
      id: 'test_queue_station',
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      anchorId: 'test_queue_anchor',
      name: 'Queue',
      capacity: 1,
      roleKinds: ['customer'],
      tags: ['queue'],
    },
    {
      id: 'test_customer_station',
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      anchorId: 'test_customer_anchor',
      name: 'Customer Counter',
      capacity: 1,
      roleKinds: ['customer'],
      tags: ['customer'],
    },
    {
      id: 'test_cashier_station',
      placeId: 'test_shop',
      spaceId: 'test_shop_space',
      anchorId: 'test_cashier_anchor',
      name: 'Cashier',
      capacity: 1,
      roleKinds: ['cashier'],
      tags: ['staff'],
    },
    {
      id: 'test_shop_customer_station',
      placeId: 'test_shop',
      spaceId: 'test_shop_space',
      anchorId: 'test_shop_customer_anchor',
      name: 'Checkout',
      capacity: 1,
      roleKinds: ['customer'],
      tags: ['customer'],
    },
  ],
  services: [
    {
      id: 'test_coffee_service',
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      name: 'Coffee Service',
      intentKinds: ['shop_for_need'],
      activityTemplateId: 'test_coffee_customer_activity',
      requiredRoleKinds: ['barista'],
      requiredStationIds: ['test_barista_station', 'test_customer_station'],
      contextRequirements: [
        { kind: 'tool', capability: 'brew_coffee' },
        { kind: 'resource', capability: 'water' },
      ],
      tags: ['cafe'],
    },
    {
      id: 'test_cafe_work_service',
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      name: 'Cafe Work',
      intentKinds: ['perform_work'],
      activityTemplateId: 'test_barista_work_activity',
      requiredRoleKinds: ['barista'],
      requiredStationIds: ['test_barista_station'],
      contextRequirements: [
        { kind: 'tool', capability: 'brew_coffee' },
      ],
      tags: ['work'],
    },
    {
      id: 'test_checkout_service',
      placeId: 'test_shop',
      spaceId: 'test_shop_space',
      name: 'Checkout Service',
      intentKinds: ['shop_for_need'],
      activityTemplateId: 'test_shop_activity',
      requiredRoleKinds: ['cashier'],
      requiredStationIds: ['test_cashier_station', 'test_shop_customer_station'],
      contextRequirements: [],
      tags: ['shop'],
    },
  ],
  activityTemplates: [
    {
      id: 'test_coffee_customer_activity',
      placeId: 'test_cafe',
      name: 'Order Coffee',
      purpose: 'shop',
      activityKind: 'ordering_coffee',
      phases: [
        { id: 'queue', durationMinutes: 2, stationId: 'test_queue_station' },
        { id: 'order', durationMinutes: 3, stationId: 'test_customer_station' },
        { id: 'receive', durationMinutes: 2, stationId: 'test_customer_station' },
      ],
      completionOwner: 'shop',
      completionKind: 'order_ready',
      tags: [],
    },
    {
      id: 'test_barista_work_activity',
      placeId: 'test_cafe',
      name: 'Serve Coffee',
      purpose: 'work',
      activityKind: 'serving',
      phases: [
        { id: 'serve', durationMinutes: 5, stationId: 'test_barista_station' },
      ],
      completionOwner: 'job',
      completionKind: 'work_activity_completed',
      tags: [],
    },
    {
      id: 'test_shop_activity',
      placeId: 'test_shop',
      name: 'Shop Checkout',
      purpose: 'shop',
      activityKind: 'checkout',
      phases: [
        { id: 'checkout', durationMinutes: 4, stationId: 'test_shop_customer_station' },
      ],
      completionOwner: 'shop',
      completionKind: 'checkout_ready',
      tags: [],
    },
  ],
};

const contextOk: ContextRequirementResult = {
  ok: true,
  bindings: [
    {
      kind: 'tool',
      capability: 'brew_coffee',
      objectInstanceId: 'test_machine_instance',
    },
    {
      kind: 'resource',
      capability: 'water',
      objectInstanceId: 'test_sink_instance',
    },
  ],
};

function shopIntent(actorId = 'test_customer'): CharacterIntent {
  return {
    actorId,
    kind: 'shop_for_need',
    activity: 'meal',
    priority: 45,
    reasons: ['need:meal'],
    blockers: [],
    reevaluateAtMinute: 200,
  };
}

function workIntent(actorId = 'test_worker'): CharacterIntent {
  return {
    actorId,
    kind: 'perform_work',
    sourceKind: 'job',
    sourceId: 'test_job_shift',
    targetPlaceId: 'test_cafe',
    priority: 130,
    reasons: ['job_due', 'due_now'],
    blockers: [],
    earliestAt: 100,
    latestAt: 200,
    reevaluateAtMinute: 200,
  };
}

function staffedCafe() {
  let state = createEmptyVenueRuntimeState();
  state = setVenueRoleAssignment(
    state,
    {
      id: 'test_barista_assignment',
      actorId: 'test_worker',
      roleId: 'test_barista_role',
      sourceKind: 'job',
      sourceId: 'test_job_shift',
      status: 'active',
      stationId: 'test_barista_station',
    },
    definitions,
  );
  return state;
}

describe('venue operations (#94)', () => {
  it('requires authored staffing, real presence, stations, and physical context for CoffeeService', () => {
    const state = staffedCafe();
    const places = { test_worker: 'test_cafe' };

    expect(
      evaluateVenueService({
        serviceId: 'test_coffee_service',
        definitions,
        state,
        actorPlaceIds: places,
        contextResult: contextOk,
      }),
    ).toEqual({ available: true, blockers: [] });

    expect(
      evaluateVenueService({
        serviceId: 'test_coffee_service',
        definitions,
        state,
        actorPlaceIds: { test_worker: 'elsewhere' },
        contextResult: contextOk,
      }),
    ).toEqual({
      available: false,
      blockers: ['missing_role:barista'],
    });

    expect(
      evaluateVenueService({
        serviceId: 'test_coffee_service',
        definitions,
        state,
        actorPlaceIds: places,
        contextResult: {
          ok: false,
          missing: [{ kind: 'resource', capability: 'water' }],
        },
      }),
    ).toEqual({
      available: false,
      blockers: ['missing_context:resource:water'],
    });
  });

  it('a worker on break disables the service deterministically', () => {
    const active = staffedCafe();
    const onBreak = setVenueRoleAssignment(
      active,
      {
        ...active.roleAssignments['test_barista_assignment']!,
        status: 'break',
      },
      definitions,
    );

    expect(
      evaluateVenueService({
        serviceId: 'test_coffee_service',
        definitions,
        state: onBreak,
        actorPlaceIds: { test_worker: 'test_cafe' },
        contextResult: contextOk,
      }),
    ).toEqual({
      available: false,
      blockers: ['missing_role:barista'],
    });
  });

  it('resolves an already-selected CharacterIntent without re-scoring or changing its provenance', () => {
    const state = staffedCafe();
    const intent = shopIntent();

    const result = resolveIntentToVenueActivity({
      intent,
      actorPlaceId: 'test_cafe',
      definitions,
      state,
      actorPlaceIds: {
        test_worker: 'test_cafe',
        test_customer: 'test_cafe',
      },
      resolveContext: () => contextOk,
    });

    expect(result).toEqual({
      ok: true,
      proposal: {
        actorId: 'test_customer',
        placeId: 'test_cafe',
        serviceId: 'test_coffee_service',
        activityTemplateId: 'test_coffee_customer_activity',
        purpose: 'shop',
        activityKind: 'ordering_coffee',
        sourceKind: undefined,
        sourceId: undefined,
        targetActorId: undefined,
        intentKind: 'shop_for_need',
        intentPriority: 45,
        intentReasons: ['need:meal'],
      },
    });
    expect(intent).toEqual(shopIntent());
  });

  it('keeps activity/purpose separate from spatial membership', () => {
    const state = staffedCafe();
    const actorPlaces = {
      test_worker: 'test_cafe',
      test_customer: 'test_cafe',
    };

    const customer = resolveIntentToVenueActivity({
      intent: shopIntent(),
      actorPlaceId: actorPlaces.test_customer,
      definitions,
      state,
      actorPlaceIds: actorPlaces,
      resolveContext: () => contextOk,
    });
    const worker = resolveIntentToVenueActivity({
      intent: workIntent(),
      actorPlaceId: actorPlaces.test_worker,
      definitions,
      state,
      actorPlaceIds: actorPlaces,
      resolveContext: () => contextOk,
    });

    expect(customer.ok && customer.proposal.activityKind).toBe('ordering_coffee');
    expect(worker.ok && worker.proposal.activityKind).toBe('serving');
    expect(actorPlaces).toEqual({
      test_worker: 'test_cafe',
      test_customer: 'test_cafe',
    });
  });

  it('progresses bounded phases identically for one jump or incremental time', () => {
    const base = staffedCafe();
    const resolved = resolveIntentToVenueActivity({
      intent: shopIntent(),
      actorPlaceId: 'test_cafe',
      definitions,
      state: base,
      actorPlaceIds: {
        test_worker: 'test_cafe',
        test_customer: 'test_cafe',
      },
      resolveContext: () => contextOk,
    });
    if (!resolved.ok) throw new Error('Expected venue activity proposal.');

    const started = startVenueActivity(base, resolved.proposal, definitions, 100);
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error('Expected activity to start.');

    const direct = advanceVenueActivities(started.state, 107, definitions);

    const at102 = advanceVenueActivities(started.state, 102, definitions);
    const at105 = advanceVenueActivities(at102.state, 105, definitions);
    const incremental = advanceVenueActivities(at105.state, 107, definitions);

    expect(incremental.state).toEqual(direct.state);
    expect(incremental.completed).toEqual(direct.completed);
    expect(direct.completed).toEqual([
      {
        activityInstanceId: 'activity:test_customer:test_coffee_service:intent:100',
        actorId: 'test_customer',
        placeId: 'test_cafe',
        serviceId: 'test_coffee_service',
        owner: 'shop',
        kind: 'order_ready',
        sourceKind: undefined,
        sourceId: undefined,
        completedAtMinute: 107,
      },
    ]);
  });

  it('prevents impossible double occupancy at a capacity-one activity station', () => {
    const base = staffedCafe();
    const resolve = (actorId: string) =>
      resolveIntentToVenueActivity({
        intent: shopIntent(actorId),
        actorPlaceId: 'test_cafe',
        definitions,
        state: base,
        actorPlaceIds: {
          test_worker: 'test_cafe',
          [actorId]: 'test_cafe',
        },
        resolveContext: () => contextOk,
      });

    const first = resolve('test_customer_a');
    if (!first.ok) throw new Error('Expected first proposal.');
    const firstStart = startVenueActivity(base, first.proposal, definitions, 100);
    if (!firstStart.ok) throw new Error('Expected first activity.');

    const second = resolve('test_customer_b');
    if (!second.ok) throw new Error('Expected second proposal.');
    expect(startVenueActivity(firstStart.state, second.proposal, definitions, 100)).toEqual({
      ok: false,
      reason: 'station_full:test_queue_station',
    });
  });

  it('completion delegates a semantic command and does not contain wage, relationship, or item mutations', () => {
    const base = staffedCafe();
    const resolved = resolveIntentToVenueActivity({
      intent: workIntent(),
      actorPlaceId: 'test_cafe',
      definitions,
      state: base,
      actorPlaceIds: { test_worker: 'test_cafe' },
      resolveContext: () => ({
        ok: true,
        bindings: [
          {
            kind: 'tool',
            capability: 'brew_coffee',
            objectInstanceId: 'test_machine_instance',
          },
        ],
      }),
    });
    if (!resolved.ok) throw new Error('Expected work activity proposal.');

    const started = startVenueActivity(base, resolved.proposal, definitions, 100);
    if (!started.ok) throw new Error('Expected work activity to start.');
    const done = advanceVenueActivities(started.state, 105, definitions);

    expect(done.completed).toEqual([
      {
        activityInstanceId: 'activity:test_worker:test_cafe_work_service:test_job_shift:100',
        actorId: 'test_worker',
        placeId: 'test_cafe',
        serviceId: 'test_cafe_work_service',
        owner: 'job',
        kind: 'work_activity_completed',
        sourceKind: 'job',
        sourceId: 'test_job_shift',
        completedAtMinute: 105,
      },
    ]);
    expect(JSON.stringify(done.completed)).not.toMatch(/wage|cash|relationship|itemInstanceIds/);
  });

  it('uses the same service/activity contract for player and NPC actors', () => {
    const state = staffedCafe();
    for (const actorId of ['player', 'test_npc']) {
      const result = resolveIntentToVenueActivity({
        intent: shopIntent(actorId),
        actorPlaceId: 'test_cafe',
        definitions,
        state,
        actorPlaceIds: {
          test_worker: 'test_cafe',
          [actorId]: 'test_cafe',
        },
        resolveContext: () => contextOk,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.proposal.actorId).toBe(actorId);
        expect(result.proposal.serviceId).toBe('test_coffee_service');
      }
    }
  });

  it('supports a separate shop workflow through the same generic definitions', () => {
    let state = createEmptyVenueRuntimeState();
    state = setVenueRoleAssignment(
      state,
      {
        id: 'test_cashier_assignment',
        actorId: 'test_cashier',
        roleId: 'test_cashier_role',
        sourceKind: 'job',
        sourceId: 'test_shop_shift',
        status: 'active',
        stationId: 'test_cashier_station',
      },
      definitions,
    );

    const result = resolveIntentToVenueActivity({
      intent: shopIntent('test_shopper'),
      actorPlaceId: 'test_shop',
      definitions,
      state,
      actorPlaceIds: {
        test_cashier: 'test_shop',
        test_shopper: 'test_shop',
      },
      resolveContext: () => ({ ok: true, bindings: [] }),
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        serviceId: 'test_checkout_service',
        activityTemplateId: 'test_shop_activity',
        activityKind: 'checkout',
      },
    });
  });
});
