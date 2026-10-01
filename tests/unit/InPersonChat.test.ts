// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  ensureVenueRoleCharacter,
  resolveInPersonVenueCharacterContext,
} from '../../src/engine/venue/VenueCharacterBridge';
import { sendInPersonChatTurn } from '../../src/world/InPersonChat';

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

describe('InPersonChat', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses the shared chat pipeline and records both sides in SocialEngine history', async () => {
    const simulation = new SimulationEngine();
    ensureVenueRoleCharacter(simulation, CASHIER);
    const context = resolveInPersonVenueCharacterContext(
      simulation,
      'corner_mart_cashier',
      {
        playerPlaceId: 'place_b1',
        placeName: 'CornerMart',
        viewName: 'CornerMart Hero',
        visibleContext: ['front counter', 'drink fridge'],
      },
    );
    expect(context).not.toBeNull();

    let relationshipSummary = '';
    let persona = '';
    const result = await sendInPersonChatTurn(
      {
        engine: simulation,
        actorId: 'corner_mart_cashier',
        playerText: 'long night?',
        totalMinutes: 1320,
        day: 1,
        sceneContext: context!.sceneContext,
        personaSuffix: context!.personaSuffix,
        tags: ['corner-mart'],
      },
      {
        generateChat: async (request) => {
          relationshipSummary = request.relationshipSummary;
          persona = request.persona;
          return {
            data: {
              messages: [{ text: 'Yeah. Quiet shift, though.', tone: 'calm' }],
              socialAction: 'none',
              storyHookId: null,
            },
            meta: {
              providerId: 'gemini',
              model: 'fixture-model',
              keySource: 'none',
              latencyMs: 1,
              fromCache: false,
              fallback: false,
            },
          };
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(result.replies).toEqual(['Yeah. Quiet shift, though.']);
    expect(relationshipSummary).toContain('Scene: In-person meeting at CornerMart');
    expect(persona).toContain('physically present with the player');

    const history = simulation.social.getMessages('corner_mart_cashier');
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      senderId: 'player',
      recipientId: 'corner_mart_cashier',
      text: 'long night?',
    });
    expect(history[1]).toMatchObject({
      senderId: 'corner_mart_cashier',
      recipientId: 'player',
      text: 'Yeah. Quiet shift, though.',
    });
    expect(history[0]?.tags).toContain('physical-chat');
    expect(history[1]?.tags).toContain('physical-chat');
    expect(result.history.map((entry) => entry.text)).toEqual([
      'long night?',
      'Yeah. Quiet shift, though.',
    ]);
  });

  it('still calls generateChat but uses a face-to-face fallback when the provider falls back', async () => {
    const simulation = new SimulationEngine();
    ensureVenueRoleCharacter(simulation, CASHIER);

    const result = await sendInPersonChatTurn(
      {
        engine: simulation,
        actorId: 'corner_mart_cashier',
        playerText: 'hey',
        totalMinutes: 720,
        day: 1,
        sceneContext: 'In-person meeting at CornerMart, CornerMart Hero.',
        personaSuffix: 'You are physically present with the player.',
      },
      {
        generateChat: async () => ({
          data: {
            messages: [{ text: 'connection fallback', tone: 'distracted' }],
            socialAction: 'none',
            storyHookId: null,
          },
          meta: {
            providerId: 'gemini',
            model: 'fixture-model',
            keySource: 'none',
            latencyMs: 1,
            fromCache: false,
            fallback: true,
            error: 'No API key configured.',
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.replies).toEqual([
      'Sorry—lost my train of thought for a second. What were you saying?',
    ]);
    expect(simulation.social.getMessages('corner_mart_cashier')).toHaveLength(2);
  });
});
