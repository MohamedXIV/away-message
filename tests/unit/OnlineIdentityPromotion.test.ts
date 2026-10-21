import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { generateNewcomer } from '../../src/engine/CharacterDirector';
import { buildCharacter, validatePersistedBuddy } from '../../src/engine/CharacterEngine';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { EventBus } from '../../src/engine/EventBus';
import type { MyPlaceProfile } from '../../src/engine/MyPlaceEngine';
import { SEED_CHARACTERS } from '../../src/engine/seedCharacters';
import { resolveReachForMetVia } from '../../src/engine/social/ReachPolicy';
import { resolveCharacterPresenceFromSimulation } from '../../src/engine/life';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import type { NpcTripRecord } from '../../src/engine/transit/NpcTrips';
import type { TravelPlan } from '../../src/engine/transit/types';
import type {
  BuddyCharacter,
  SurfaceIdentityPromotion,
  SurfacePromotionResult,
} from '../../src/engine/types';

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
): SurfacePromotionResult {
  const result = game.dispatchAction({
    type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
    identity,
    silent: true,
  });
  if (!result.success) throw new Error(result.error ?? 'promotion failed');
  return result.data as SurfacePromotionResult;
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
    const actor = game.social.getBuddy(first.actorId);
    expect(first.created).toBe(true);
    expect(actor?.id).toBe('diner_ghost');
    expect(actor?.reach).toBe('remote');
    expect(actor?.metVia).toBe('myplace');
    expect(game.social.getBuddies().length).toBe(before + 1);
    expect(game.social.isKnown('diner_ghost')).toBe(true);
    expect(game.social.getKnownHandles('diner_ghost')).toEqual(['diner_ghost']);
    const page = game.getMyPlacePageRead('diner_ghost').profile;
    expect(page?.displayName).toBe('Diner Ghost');
    expect(page?.headline).toContain('Online friend');
    expect(page).not.toHaveProperty('actorId');
    expect(game.myplace.getNpcProfile('diner_ghost')).not.toHaveProperty('actorId');

    const second = promote(game, {
      source: 'myplace',
      username: 'diner_ghost',
      displayName: 'Diner Ghost',
    });
    expect(second.created).toBe(false);
    expect(second.actorId).toBe('diner_ghost');
    expect(second.alreadyKnown).toBe(true);
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
    expect(result.actorId).toBe(authored.id);
    expect(Object.keys(result).sort()).toEqual(['actorId', 'alreadyKnown', 'created']);
    expect(JSON.stringify(result)).not.toContain(authored.handle);
    expect(game.social.getBuddy(authored.myplace)).toBeUndefined();
    expect(game.social.getBuddies().length).toBe(before);
    expect(game.social.isKnown(authored.id)).toBe(true);
    expect(game.social.getKnownHandles(authored.id)).toContain(authored.handle);
  });

  it('binds a legitimately learned alternate handle without forking identity', () => {
    const game = new SimulationEngine();
    const actor = promote(game, {
      source: 'pulse-room',
      username: 'room_handle',
      displayName: 'Room Handle',
    });
    expect(game.social.learnHandle(actor.actorId, 'old_room_handle')).toBe(true);
    const before = game.social.getBuddies().length;

    const bound = promote(game, {
      source: 'nightboard',
      username: 'old_room_handle',
    });

    expect(bound.created).toBe(false);
    expect(bound.actorId).toBe(actor.actorId);
    expect(game.social.getBuddies().length).toBe(before);
    expect(game.social.getKnownHandles(actor.actorId)).toContain('old_room_handle');
  });

  it('ignores a forged canonicalActorId and does not reveal the hidden actor', () => {
    const game = new SimulationEngine();
    const hidden = game.social.getBuddies().find(buddy => !game.social.isKnown(buddy.id));
    if (!hidden) throw new Error('Expected an undiscovered actor fixture.');
    const before = game.social.getBuddies().length;
    expect(game.social.isKnown(hidden.id)).toBe(false);

    const result = game.dispatchAction({
      type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
      identity: {
        source: 'myplace',
        username: 'totally_unrelated_page',
        displayName: 'Unrelated Page',
        canonicalActorId: hidden.id,
      } as unknown as SurfaceIdentityPromotion,
      silent: true,
    });

    expect(result.success).toBe(true);
    const data = result.data as SurfacePromotionResult;
    expect(data.actorId).not.toBe(hidden.id);
    expect(data.created).toBe(true);
    expect(Object.keys(data).sort()).toEqual(['actorId', 'alreadyKnown', 'created']);
    expect(game.social.isKnown(hidden.id)).toBe(false);
    expect(game.social.getKnownHandles(hidden.id)).toEqual([]);
    expect(game.social.findKnownActorByHandle(hidden.handle)).toBeUndefined();
    expect(game.social.getBuddy(data.actorId)?.reach).toBe('remote');
    expect(JSON.stringify(data)).not.toContain(hidden.handle);
    expect(JSON.stringify(data)).not.toContain(hidden.displayName);
    expect(game.social.getBuddies().length).toBe(before + 1);
  });

  it('ignores forged knownAliases and does not reveal the hidden actor', () => {
    const game = new SimulationEngine();
    const hidden = game.social.getBuddies().find(buddy => !game.social.isKnown(buddy.id));
    if (!hidden) throw new Error('Expected an undiscovered actor fixture.');
    const before = game.social.getBuddies().length;

    const result = game.dispatchAction({
      type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
      identity: {
        source: 'nightboard',
        username: 'another_unrelated_page',
        displayName: 'Another Unrelated Page',
        knownAliases: [hidden.handle.toUpperCase()],
      } as unknown as SurfaceIdentityPromotion,
      silent: true,
    });

    expect(result.success).toBe(true);
    const data = result.data as SurfacePromotionResult;
    expect(data.actorId).not.toBe(hidden.id);
    expect(Object.keys(data).sort()).toEqual(['actorId', 'alreadyKnown', 'created']);
    expect(game.social.isKnown(hidden.id)).toBe(false);
    expect(game.social.findKnownActorByHandle(hidden.handle)).toBeUndefined();
    expect(game.social.getBuddy(data.actorId)?.reach).toBe('remote');
    expect(JSON.stringify(data)).not.toContain(hidden.handle);
    expect(JSON.stringify(data)).not.toContain(hidden.displayName);
    expect(game.social.getBuddies().length).toBe(before + 1);
  });

  it('does not let ordinary profile edits rebind owner provenance', () => {
    const game = new SimulationEngine();
    const hidden = game.social.getBuddies().find(buddy => !game.social.isKnown(buddy.id));
    if (!hidden) throw new Error('Expected an undiscovered actor fixture.');
    const promoted = promote(game, {
      source: 'myplace',
      username: 'editable_page',
      displayName: 'Editable Page',
    });

    game.myplace.updateNpcProfile('editable_page', {
      actorId: hidden.id,
    } as unknown as Partial<MyPlaceProfile>);

    expect(game.myplace.getBoundActorIdForProfile('editable_page')).toBe(promoted.actorId);
    expect(game.social.isKnown(hidden.id)).toBe(false);
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
    const actorId = promote(game, {
      source: 'myplace',
      username: 'far_away_friend',
      displayName: 'Far Away Friend',
    }).actorId;

    expect(game.getNpcPlaceState(actorId)).toEqual({ status: 'unknown' });
    expect(game.getActorSpatialProjection(actorId)).toBeNull();
    expect(() => game.relocateActorSpatially(actorId, { x: 80, y: 40, z: 0 }))
      .toThrow(/Remote\/departed actors cannot acquire local spatial authority/);

    const semantic = game.getPlayerActorRead(actorId);
    expect(semantic?.actor.reach).toBe('remote');
    expect(semantic?.actor.canMeetInPerson.allowed).toBe(false);
    expect(game.getCafeGuestRead('place_b1', actorId).guest).toBeNull();
  });

  it('remote → local → remote preserves identity, relationships, memories, handles and messages', () => {
    const game = new SimulationEngine();
    const actorId = promote(game, {
      source: 'pulse-room',
      username: 'travelling_friend',
      displayName: 'Travelling Friend',
    }).actorId;
    game.social.addCoreMemory(actorId, {
      text: 'Told the player about the canal hum.',
      kind: 'shared_moment',
      day: 2,
    });
    const sent = game.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE',
      buddyId: actorId,
      text: 'still around?',
    });
    expect(sent.success).toBe(true);

    const relationships = game.social.getRelationships(actorId);
    const memories = game.social.getCoreMemories(actorId);
    const messages = game.social.getMessages(actorId);
    const handles = game.social.getKnownHandles(actorId);

    const local = game.setActorReach(actorId, 'local');
    expect(local.success).toBe(true);
    expect(local.data?.id).toBe(actorId);
    expect(game.social.getBuddy(actorId)?.reach).toBe('local');
    expect(game.relocateActorSpatially(actorId, { x: 80, y: 40, z: 0 }).membership.placeId)
      .toBe('place_b1');
    expect(game.getNpcPlaceState(actorId)).toEqual({ status: 'at_place', placeId: 'place_b1' });
    expect(resolveCharacterPresenceFromSimulation(game, actorId, { playerPlaceId: 'place_b1' }))
      .toMatchObject({
        physical: { kind: 'at_place', placeId: 'place_b1' },
        availability: { canInteractInPerson: true },
      });

    const remote = game.setActorReach(actorId, 'remote');
    expect(remote.success).toBe(true);
    expect(game.social.getBuddy(actorId)?.id).toBe(actorId);
    expect(game.getNpcPlaceState(actorId)).toEqual({ status: 'unknown' });
    expect(game.getNpcTrip(actorId)).toBeNull();
    expect(game.getActorSpatialProjection(actorId)).toBeNull();
    expect(resolveCharacterPresenceFromSimulation(game, actorId, { playerPlaceId: 'place_b1' }))
      .toMatchObject({
        physical: { kind: 'remote' },
        availability: { canInteractInPerson: false },
      });

    expect(game.social.getRelationships(actorId)).toEqual(relationships);
    expect(game.social.getCoreMemories(actorId)).toEqual(memories);
    expect(game.social.getMessages(actorId)).toEqual(messages);
    expect(game.social.getKnownHandles(actorId)).toEqual(handles);
  });

  it('evicts an active local trip when reach becomes remote', () => {
    const game = new SimulationEngine();
    const actorId = promote(game, {
      source: 'myplace',
      username: 'trip_friend',
      displayName: 'Trip Friend',
    }).actorId;
    expect(game.setActorReach(actorId, 'local').success).toBe(true);
    game.relocateActorSpatially(actorId, { x: 80, y: 40, z: 0 });

    const snapshot = game.exportSnapshot();
    snapshot.npcMobility = {
      trips: { [actorId]: activeTripRecord(actorId, game.clock.getTotalMinutes()) },
      places: { [actorId]: 'place_a1' },
    };
    const travelling = new SimulationEngine(snapshot);
    expect(travelling.getNpcTrip(actorId)?.status).toBe('active');
    expect(travelling.getNpcPlaceState(actorId).status).toBe('in_transit');

    expect(travelling.setActorReach(actorId, 'remote').success).toBe(true);
    expect(travelling.getNpcTrip(actorId)).toBeNull();
    expect(travelling.getNpcPlaceState(actorId)).toEqual({ status: 'unknown' });
    expect(travelling.getActorSpatialProjection(actorId)).toBeNull();
    expect(travelling.getState().npcMobility?.places[actorId]).toBeUndefined();
  });

  it('round-trips reach and social history through save/load', () => {
    const game = new SimulationEngine();
    const actorId = promote(game, {
      source: 'myplace',
      username: 'persisted_friend',
      displayName: 'Persisted Friend',
    }).actorId;
    const handle = game.social.getBuddy(actorId)!.handle;
    game.social.addCoreMemory(actorId, {
      text: 'Saved a mixtape for the player.',
      kind: 'shared_moment',
      day: 3,
    });
    game.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE',
      buddyId: actorId,
      text: 'mailing you a tape',
    });
    expect(game.setActorReach(actorId, 'local').success).toBe(true);
    expect(game.setActorReach(actorId, 'remote').success).toBe(true);

    const relationships = game.social.getRelationships(actorId);
    const memories = game.social.getCoreMemories(actorId);
    const messages = game.social.getMessages(actorId);
    const restored = new SimulationEngine(game.exportSnapshot());

    expect(restored.social.getBuddy(actorId)?.reach).toBe('remote');
    expect(restored.social.getBuddy(actorId)?.handle).toBe(handle);
    expect(restored.social.getRelationships(actorId)).toEqual(relationships);
    expect(restored.social.getCoreMemories(actorId)).toEqual(memories);
    expect(restored.social.getMessages(actorId)).toEqual(messages);
    expect(restored.getActorSpatialProjection(actorId)).toBeNull();
    expect(restored.getNpcPlaceState(actorId)).toEqual({ status: 'unknown' });

    expect(restored.setActorReach(actorId, 'local').success).toBe(true);
    expect(restored.social.getBuddy(actorId)?.id).toBe(actorId);
    expect(restored.social.getMessages(actorId)).toEqual(messages);
  });
});
