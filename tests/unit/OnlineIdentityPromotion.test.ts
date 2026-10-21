import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { generateNewcomer } from '../../src/engine/CharacterDirector';
import { buildCharacter, validatePersistedBuddy } from '../../src/engine/CharacterEngine';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { EventBus } from '../../src/engine/EventBus';
import { SEED_CHARACTERS } from '../../src/engine/seedCharacters';
import { resolveReachForMetVia } from '../../src/engine/social/ReachPolicy';
import { resolveCharacterPresenceFromSimulation } from '../../src/engine/life';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import type { NpcTripRecord } from '../../src/engine/transit/NpcTrips';
import type { TravelPlan } from '../../src/engine/transit/types';
import type { BuddyCharacter, SurfaceIdentityPromotion } from '../../src/engine/types';

const aiPayload = vi.hoisted(() => ({
  id: 'ai_surface_friend',
  displayName: 'Ari Surface',
  handle: 'ari_surface',
  archetype: 'regular',
  headline: 'online only, for now',
  bio: 'I post from a dim room with a humming CRT and too many browser tabs open.',
  interests: ['forums', 'tapes', 'rain'],
  songTitle: 'Dial Tone',
  introText: 'saw your post — adding you.',
  hair: 'black',
  eyes: 'brown',
  languages: [{ lang: 'en', level: 5 }],
}));

vi.mock('../../src/ai/settings', () => ({
  loadAISettings: () => ({ activeProvider: 'gemini', byokKeys: { gemini: 'test-key' } }),
}));

vi.mock('../../src/ai/providers', () => ({
  getProviderModel: () => 'mock-model',
  resolveApiKey: () => ({ key: 'test-key', source: 'byok' }),
  completeJson: async () => aiPayload,
}));

function promote(
  game: SimulationEngine,
  identity: SurfaceIdentityPromotion,
): { created: boolean; buddy: BuddyCharacter } {
  const result = game.dispatchAction({
    type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
    identity,
    silent: true,
  });
  if (!result.success) throw new Error(result.error ?? 'promotion failed');
  return result.data as { created: boolean; buddy: BuddyCharacter };
}

function activeTripRecord(actorId: string, startMinute: number): NpcTripRecord {
  const plan: TravelPlan = {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute: startMinute,
    arriveAtMinute: startMinute + 30,
    legs: [{ kind: 'walk', fromPlaceId: 'place_a1', toPlaceId: 'place_b1', minutes: 30 }],
    walkMinutes: 30,
    waitMinutes: 0,
    rideMinutes: 0,
    totalMinutes: 30,
    fare: 0,
    transferCount: 0,
    busLineIds: [],
  };
  return {
    trip: commitTravelPlan(actorId, plan, startMinute, 'online-identity-test'),
    intentKind: 'travel_to_place',
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    plannedDepartureMinute: startMinute,
    expectedArrivalMinute: startMinute + 30,
    policy: 'fastest',
    status: 'active',
  };
}

describe('#181 source-derived reach policy', () => {
  it('starts online-origin actors remote and offline/local sources local', () => {
    expect(resolveReachForMetVia('nightboard')).toBe('remote');
    expect(resolveReachForMetVia('myplace')).toBe('remote');
    expect(resolveReachForMetVia('pulse-room')).toBe('remote');
    expect(resolveReachForMetVia('work')).toBe('local');
    expect(resolveReachForMetVia('intro')).toBe('local');
    expect(resolveReachForMetVia('seed')).toBe('local');
    expect(resolveReachForMetVia(undefined)).toBe('local');
  });

  it('never lets the character factory silently default an online source to local', () => {
    const online = buildCharacter({
      id: 'online_friend',
      displayName: 'Online Friend',
      handle: 'online_friend',
      metVia: 'myplace',
    });
    expect(online.definition.reach).toBe('remote');

    const local = buildCharacter({
      id: 'coworker_friend',
      displayName: 'Coworker Friend',
      handle: 'coworker_friend',
      metVia: 'work',
    });
    expect(local.definition.reach).toBe('local');

    const authoredEvidence = buildCharacter({
      id: 'known_local_friend',
      displayName: 'Known Local',
      handle: 'known_local',
      metVia: 'myplace',
      reach: 'local',
    });
    expect(authoredEvidence.definition.reach).toBe('local');
  });

  it('backfills legacy online-source definitions as remote on restore/register', () => {
    const built = buildCharacter({
      id: 'legacy_surface_actor',
      displayName: 'Legacy Surface',
      handle: 'legacy_surface',
      metVia: 'pulse-room',
    });
    const legacy = JSON.parse(JSON.stringify(built.definition)) as Partial<BuddyCharacter>;
    delete legacy.reach;

    const validated = validatePersistedBuddy(legacy);
    expect(validated.ok).toBe(true);
    expect(validated.definition?.reach).toBe('remote');

    const social = new SocialEngine(new EventBus());
    social.registerBuddy(legacy as BuddyCharacter);
    expect(social.getBuddy('legacy_surface_actor')?.reach).toBe('remote');
  });

  it('keeps AI and template newcomer paths aligned on reach', async () => {
    const aiOnline = await generateNewcomer(
      { metVia: 'myplace', day: 4, seed: 'ai-online-reach', useAI: true },
      { existingIds: [] },
    );
    const templateOnline = await generateNewcomer(
      { metVia: 'myplace', day: 4, seed: 'template-online-reach', useAI: false },
      { existingIds: [] },
    );
    expect(aiOnline.source).toBe('ai');
    expect(templateOnline.source).toBe('template');
    expect(aiOnline.definition.reach).toBe('remote');
    expect(templateOnline.definition.reach).toBe('remote');
    expect(templateOnline.profilePatch.headline).toContain('Online friend');

    const aiLocal = await generateNewcomer(
      { metVia: 'work', day: 4, seed: 'ai-local-reach', useAI: true },
      { existingIds: [] },
    );
    const templateLocal = await generateNewcomer(
      { metVia: 'work', day: 4, seed: 'template-local-reach', useAI: false },
      { existingIds: [] },
    );
    expect(aiLocal.definition.reach).toBe('local');
    expect(templateLocal.definition.reach).toBe('local');
    expect(templateLocal.profilePatch.headline).toContain('Oakhaven local');
  });
});

describe('#181 governed surface promotion', () => {
  it('promotes an unpromoted MyPlace profile exactly once and starts remote', () => {
    const game = new SimulationEngine();
    const before = game.social.getBuddies().length;

    const first = promote(game, {
      source: 'myplace',
      username: 'diner_ghost',
      displayName: 'Diner Ghost',
      archetype: 'nightowl',
    });
    expect(first.created).toBe(true);
    expect(first.buddy.id).toBe('diner_ghost');
    expect(first.buddy.reach).toBe('remote');
    expect(first.buddy.metVia).toBe('myplace');
    expect(game.social.getBuddies().length).toBe(before + 1);
    expect(game.social.isKnown('diner_ghost')).toBe(true);
    expect(game.social.getKnownHandles('diner_ghost')).toEqual(['diner_ghost']);
    expect(game.getMyPlacePageRead('diner_ghost').profile?.displayName).toBe('Diner Ghost');
    expect(game.getMyPlacePageRead('diner_ghost').profile?.headline).toContain('Online friend');

    const second = promote(game, {
      source: 'myplace',
      username: 'diner_ghost',
      displayName: 'Diner Ghost',
    });
    expect(second.created).toBe(false);
    expect(second.buddy.id).toBe('diner_ghost');
    expect(game.social.getBuddies().length).toBe(before + 1);
  });

  it('resolves an authored MyPlace alias instead of creating a second actor', () => {
    const game = new SimulationEngine();
    const authored = SEED_CHARACTERS.find(seed => seed.myplace);
    if (!authored) throw new Error('Expected an authored MyPlace profile fixture.');
    const canonical = game.social.getBuddy(authored.id);
    if (!canonical) throw new Error('Expected the authored actor to be on the roster.');
    const before = game.social.getBuddies().length;

    const result = promote(game, {
      source: 'myplace',
      username: authored.myplace,
      displayName: authored.displayName,
    });

    expect(result.created).toBe(false);
    expect(result.buddy.id).toBe(authored.id);
    expect(game.social.getBuddy(authored.myplace)).toBeUndefined();
    expect(game.social.getBuddies().length).toBe(before);
    expect(game.social.isKnown(authored.id)).toBe(true);
    expect(game.social.getKnownHandles(authored.id)).toContain(authored.handle);
  });

  it('binds alternate handles to the existing canonical identity', () => {
    const game = new SimulationEngine();
    const actor = promote(game, {
      source: 'pulse-room',
      username: 'room_handle',
      displayName: 'Room Handle',
    }).buddy;
    const before = game.social.getBuddies().length;

    const bound = promote(game, {
      source: 'nightboard',
      username: 'thread_alias',
      knownAliases: [actor.handle.toUpperCase()],
    });

    expect(bound.created).toBe(false);
    expect(bound.buddy.id).toBe(actor.id);
    expect(game.social.getBuddies().length).toBe(before);

    const explicit = promote(game, {
      source: 'myplace',
      username: 'profile_page_three',
      canonicalActorId: actor.id,
    });
    expect(explicit.created).toBe(false);
    expect(explicit.buddy.id).toBe(actor.id);
    expect(game.social.getBuddies().length).toBe(before);
  });

  it('rejects a missing explicit canonical binding instead of forking identity', () => {
    const game = new SimulationEngine();
    const before = game.social.getBuddies().length;
    const result = game.dispatchAction({
      type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
      identity: {
        source: 'myplace',
        username: 'orphaned_profile',
        canonicalActorId: 'missing_canonical_actor',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing_canonical_actor');
    expect(game.social.getBuddies().length).toBe(before);
  });

  it('leaves unpromoted surface content outside the canonical roster', () => {
    const game = new SimulationEngine();
    const before = game.social.getBuddies().length;
    game.getNightBoardRead();
    game.getMyPlacePageRead('anonymous_guestbook_voice');
    expect(game.social.getBuddies().length).toBe(before);
  });
});

describe('#181 Pulse and NightBoard discovery', () => {
  it('Pulse resolves a canonical actor by handle without creating identities', () => {
    const game = new SimulationEngine();
    const authored = game.social.getBuddies().find(buddy => buddy.status === 'friend')
      ?? game.social.getBuddies()[0]!;
    const before = game.social.getBuddies().length;

    game.social.learnHandle(authored.id, authored.handle);
    const hit = game.dispatchAction({ type: 'ADD_CONTACT', handle: authored.handle });
    expect(hit.success).toBe(true);
    expect((hit.data as { buddyId?: string }).buddyId).toBe(authored.id);
    expect(game.social.getBuddies().length).toBe(before);

    const miss = game.dispatchAction({ type: 'ADD_CONTACT', handle: 'forum_ghost_no_binding' });
    expect(miss.success).toBe(false);
    expect(game.social.getBuddies().length).toBe(before);
  });

  it('NightBoard meet births a remote actor even when local rotation sources exist', async () => {
    const game = new SimulationEngine();
    const existingIds = new Set(game.social.getBuddies().map(buddy => buddy.id));

    expect(game.dispatchAction({ type: 'NIGHTBOARD_MEET' }).success).toBe(true);
    const added = await vi.waitFor(() => {
      const actor = game.social.getBuddies().find(buddy => !existingIds.has(buddy.id));
      expect(actor).toBeDefined();
      return actor!;
    }, { timeout: 5000 });

    expect(added.metVia).toBe('nightboard');
    expect(added.reach).toBe('remote');
    expect(game.getNpcPlaceState(added.id)).toEqual({ status: 'unknown' });
    expect(game.getActorSpatialProjection(added.id)).toBeNull();
  });
});

describe('#181 remote physical exclusion and reach continuity', () => {
  it('remote actors cannot acquire local spatial, transit or in-person state', () => {
    const game = new SimulationEngine();
    const actor = promote(game, {
      source: 'myplace',
      username: 'far_away_friend',
      displayName: 'Far Away Friend',
    }).buddy;

    expect(game.getNpcPlaceState(actor.id)).toEqual({ status: 'unknown' });
    expect(game.getActorSpatialProjection(actor.id)).toBeNull();
    expect(() => game.relocateActorSpatially(actor.id, { x: 80, y: 40, z: 0 }))
      .toThrow(/Remote\/departed actors cannot acquire local spatial authority/);

    const semantic = game.getPlayerActorRead(actor.id);
    expect(semantic?.actor.reach).toBe('remote');
    expect(semantic?.actor.canMeetInPerson.allowed).toBe(false);
    expect(game.getCafeGuestRead('place_b1', actor.id).guest).toBeNull();
  });

  it('remote → local → remote preserves identity, relationships, memories, handles and messages', () => {
    const game = new SimulationEngine();
    const actor = promote(game, {
      source: 'pulse-room',
      username: 'travelling_friend',
      displayName: 'Travelling Friend',
    }).buddy;
    game.social.addCoreMemory(actor.id, {
      text: 'Told the player about the canal hum.',
      kind: 'shared_moment',
      day: 2,
    });
    const sent = game.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE',
      buddyId: actor.id,
      text: 'still around?',
    });
    expect(sent.success).toBe(true);

    const relationships = game.social.getRelationships(actor.id);
    const memories = game.social.getCoreMemories(actor.id);
    const messages = game.social.getMessages(actor.id);
    const handles = game.social.getKnownHandles(actor.id);

    const local = game.setActorReach(actor.id, 'local');
    expect(local.success).toBe(true);
    expect(local.data?.id).toBe(actor.id);
    expect(game.social.getBuddy(actor.id)?.reach).toBe('local');
    expect(game.relocateActorSpatially(actor.id, { x: 80, y: 40, z: 0 }).membership.placeId)
      .toBe('place_b1');
    expect(game.getNpcPlaceState(actor.id)).toEqual({ status: 'at_place', placeId: 'place_b1' });
    expect(resolveCharacterPresenceFromSimulation(game, actor.id, { playerPlaceId: 'place_b1' }))
      .toMatchObject({
        physical: { kind: 'at_place', placeId: 'place_b1' },
        availability: { canInteractInPerson: true },
      });

    const remote = game.setActorReach(actor.id, 'remote');
    expect(remote.success).toBe(true);
    expect(game.social.getBuddy(actor.id)?.id).toBe(actor.id);
    expect(game.getNpcPlaceState(actor.id)).toEqual({ status: 'unknown' });
    expect(game.getNpcTrip(actor.id)).toBeNull();
    expect(game.getActorSpatialProjection(actor.id)).toBeNull();
    expect(resolveCharacterPresenceFromSimulation(game, actor.id, { playerPlaceId: 'place_b1' }))
      .toMatchObject({
        physical: { kind: 'remote' },
        availability: { canInteractInPerson: false },
      });

    expect(game.social.getRelationships(actor.id)).toEqual(relationships);
    expect(game.social.getCoreMemories(actor.id)).toEqual(memories);
    expect(game.social.getMessages(actor.id)).toEqual(messages);
    expect(game.social.getKnownHandles(actor.id)).toEqual(handles);
  });

  it('evicts an active local trip when reach becomes remote', () => {
    const game = new SimulationEngine();
    const actor = promote(game, {
      source: 'myplace',
      username: 'trip_friend',
      displayName: 'Trip Friend',
    }).buddy;
    expect(game.setActorReach(actor.id, 'local').success).toBe(true);
    game.relocateActorSpatially(actor.id, { x: 80, y: 40, z: 0 });

    const snapshot = game.exportSnapshot();
    snapshot.npcMobility = {
      trips: { [actor.id]: activeTripRecord(actor.id, game.clock.getTotalMinutes()) },
      places: { [actor.id]: 'place_a1' },
    };
    const travelling = new SimulationEngine(snapshot);
    expect(travelling.getNpcTrip(actor.id)?.status).toBe('active');
    expect(travelling.getNpcPlaceState(actor.id).status).toBe('in_transit');

    expect(travelling.setActorReach(actor.id, 'remote').success).toBe(true);
    expect(travelling.getNpcTrip(actor.id)).toBeNull();
    expect(travelling.getNpcPlaceState(actor.id)).toEqual({ status: 'unknown' });
    expect(travelling.getActorSpatialProjection(actor.id)).toBeNull();
    expect(travelling.getState().npcMobility?.places[actor.id]).toBeUndefined();
  });

  it('round-trips reach and social history through save/load', () => {
    const game = new SimulationEngine();
    const actor = promote(game, {
      source: 'myplace',
      username: 'persisted_friend',
      displayName: 'Persisted Friend',
    }).buddy;
    game.social.addCoreMemory(actor.id, {
      text: 'Saved a mixtape for the player.',
      kind: 'shared_moment',
      day: 3,
    });
    game.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE',
      buddyId: actor.id,
      text: 'mailing you a tape',
    });
    expect(game.setActorReach(actor.id, 'local').success).toBe(true);
    expect(game.setActorReach(actor.id, 'remote').success).toBe(true);

    const relationships = game.social.getRelationships(actor.id);
    const memories = game.social.getCoreMemories(actor.id);
    const messages = game.social.getMessages(actor.id);
    const restored = new SimulationEngine(game.exportSnapshot());

    expect(restored.social.getBuddy(actor.id)?.reach).toBe('remote');
    expect(restored.social.getBuddy(actor.id)?.handle).toBe(actor.handle);
    expect(restored.social.getRelationships(actor.id)).toEqual(relationships);
    expect(restored.social.getCoreMemories(actor.id)).toEqual(memories);
    expect(restored.social.getMessages(actor.id)).toEqual(messages);
    expect(restored.getActorSpatialProjection(actor.id)).toBeNull();
    expect(restored.getNpcPlaceState(actor.id)).toEqual({ status: 'unknown' });

    expect(restored.setActorReach(actor.id, 'local').success).toBe(true);
    expect(restored.social.getBuddy(actor.id)?.id).toBe(actor.id);
    expect(restored.social.getMessages(actor.id)).toEqual(messages);
  });
});
