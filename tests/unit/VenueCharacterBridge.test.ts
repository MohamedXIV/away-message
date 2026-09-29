import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildDmChatContext } from '../../src/apps/pulse/utils/chatContext';
import {
  ensureVenueRoleCharacter,
  resolveInPersonVenueCharacterContext,
} from '../../src/engine/venue/VenueCharacterBridge';

const CASHIER = {
  character: {
    id: 'corner_mart_cashier',
    displayName: 'Casey',
    handle: 'casey_counter',
    archetype: 'regular' as const,
    reach: 'local' as const,
    roles: ['cashier', 'shop-staff'],
    appearance: { hair: 'brown', eyes: 'hazel' },
    languages: [{ lang: 'en', level: 5 }],
    status: 'acquaintance' as const,
    metVia: 'intro' as const,
    createdDay: 1,
  },
  placeId: 'place_b1',
  assignment: {
    id: 'corner_mart_cashier_assignment',
    roleId: 'fixture_cashier_role',
    sourceKind: 'authored_fixture',
    sourceId: 'corner_mart',
    status: 'active' as const,
    stationId: 'fixture_shop_staff_station',
  },
};

describe('VenueCharacterBridge', () => {
  it('registers a normal social character and assigns the authored venue role/station', () => {
    const simulation = new SimulationEngine();

    const buddy = ensureVenueRoleCharacter(simulation, CASHIER);
    const assignment = simulation.getVenueRuntimeState().roleAssignments[
      'corner_mart_cashier_assignment'
    ];

    expect(buddy).toMatchObject({
      id: 'corner_mart_cashier',
      displayName: 'Casey',
      handle: 'casey_counter',
      reach: 'local',
    });
    expect(simulation.social.getBuddy('corner_mart_cashier')).toBeDefined();
    expect(simulation.getNpcPlaceState('corner_mart_cashier')).toEqual({
      status: 'at_place',
      placeId: 'place_b1',
    });
    expect(assignment).toMatchObject({
      actorId: 'corner_mart_cashier',
      roleId: 'fixture_cashier_role',
      stationId: 'fixture_shop_staff_station',
      status: 'active',
    });
  });

  it('projects view-safe in-person context through coherent presence without shop internals', () => {
    const simulation = new SimulationEngine();
    ensureVenueRoleCharacter(simulation, CASHIER);

    const context = resolveInPersonVenueCharacterContext(
      simulation,
      'corner_mart_cashier',
      {
        playerPlaceId: 'place_b1',
        placeName: 'CornerMart',
        viewName: 'CornerMart Hero',
        visibleContext: ['front counter', 'drink fridge', 'shelves', 'rain at the window'],
      },
    );

    expect(context).not.toBeNull();
    expect(context?.actorId).toBe('corner_mart_cashier');
    expect(context?.presence.availability.canInteractInPerson).toBe(true);
    expect(context?.presence.physical).toEqual({ kind: 'at_place', placeId: 'place_b1' });
    expect(context?.sceneContext).toContain('front counter');
    expect(context?.sceneContext).toContain('rain at the window');
    expect(context?.sceneContext).not.toContain('unpaid');
    expect(context?.sceneContext).not.toContain('stock');

    const dmContext = buildDmChatContext({
      engine: simulation,
      buddyId: context!.actorId,
      playerText: 'hello',
      pulse: {
        conversationMemory: {},
        buddyFacts: {},
        conversationSummaries: {},
        recentReplies: {},
      },
      day: 1,
      totalMinutes: 720,
      sceneContext: context!.sceneContext,
      personaSuffix: context!.personaSuffix,
    });
    expect(dmContext.relationshipSummary).toContain('Scene: In-person meeting at CornerMart');
    expect(dmContext.persona).toContain('physically present with the player');

    const remote = resolveInPersonVenueCharacterContext(
      simulation,
      'corner_mart_cashier',
      {
        playerPlaceId: 'place_a1',
        placeName: 'CornerMart',
        viewName: 'CornerMart Hero',
      },
    );
    expect(remote).toBeNull();
  });
});
