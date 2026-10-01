// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  buildDmChatContext,
  runChatLedger,
  honorSocialAction,
  computeExchangeUpdate,
  readMemorySlices,
  writeMemorySlices,
  type PulseMemorySlices,
} from '../../src/apps/pulse/utils/chatContext';
import { parseSuggestedReplies } from '../../src/ai/schemas';
import { aiService } from '../../src/ai/service';

const EMPTY_SLICES: PulseMemorySlices = {
  conversationMemory: {},
  buddyFacts: {},
  conversationSummaries: {},
  recentReplies: {},
};

function stubStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => (key in store ? store[key]! : null),
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    },
  });
}

describe('P8 shared chat context (headless engine)', () => {
  let sim: SimulationEngine;
  let actorId: string;
  let actorName: string;

  beforeEach(() => {
    sim = new SimulationEngine();
    const actor = sim.social.getBuddies()[0];
    if (!actor) throw new Error('Expected at least one authored fixture actor for chat tests.');
    actorId = actor.id;
    actorName = actor.displayName;
  });

  it('builds identical DM-grade context for any surface', () => {
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: actorId, text: 'hey, rain today huh' });
    const ctx = buildDmChatContext({
      engine: sim as any,
      buddyId: actorId,
      playerText: 'hey, rain today huh',
      pulse: EMPTY_SLICES,
      day: 1,
      totalMinutes: 600,
    });
    expect(ctx.displayName).toBe(actorName);
    expect(ctx.relationshipSummary).toContain('Stage:');
    expect(ctx.relationshipSummary).toContain('DailyMood:');
    expect(ctx.relationshipSummary).toContain('Memory:');
    expect(ctx.recentMessages.length).toBeGreaterThan(0);
    expect(ctx.preSendPatch.conversationMemory[actorId]?.length).toBe(1);
    expect(ctx.preSendPatch.buddyFacts[actorId]).toBeDefined();
  });

  it('appends generic scene context and persona suffix for in-person meetings', () => {
    const ctx = buildDmChatContext({
      engine: sim as any,
      buddyId: actorId,
      playerText: 'hi',
      pulse: EMPTY_SLICES,
      day: 2,
      totalMinutes: 1500,
      sceneContext: 'In-person meeting at a local café.',
      personaSuffix: 'You are sitting across from the player in person over coffee.',
    });
    expect(ctx.relationshipSummary).toContain('Scene: In-person meeting at a local café');
    expect(ctx.persona).toContain('sitting across from the player');
  });

  it('ledger records promises and resolves follow-through (rules only)', () => {
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: actorId, text: "i promise i'll call tomorrow" });
    runChatLedger(sim as any, actorId, "i promise i'll call tomorrow", 600);
    expect(sim.social.getOpenPromises(actorId).length).toBe(1);
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: actorId, text: 'did it, called!' });
    runChatLedger(sim as any, actorId, 'did it, called!', 601);
    expect(sim.social.getOpenPromises(actorId).length).toBe(0);
  });

  it('honours governed social actions, ignores invalid/untrusted ones', () => {
    const before = sim.social.getRelationships(actorId)!;
    honorSocialAction(sim as any, actorId, 'empathy', true);
    expect(sim.social.getRelationships(actorId)!.trust).toBeGreaterThan(before.trust);
    const mid = sim.social.getRelationships(actorId)!;
    honorSocialAction(sim as any, actorId, 'none', true);
    honorSocialAction(sim as any, actorId, 'modify_money', true);
    honorSocialAction(sim as any, actorId, 'empathy', false);
    expect(sim.social.getRelationships(actorId)).toEqual(mid);
  });

  it('computes post-reply updates and captures links once', () => {
    const first = computeExchangeUpdate({
      npcTexts: ['check this http://rain-archive.local/ cool huh'],
      existingReplies: [],
      previousSummary: 'No summary.',
      recentMessages: [{ sender: 'player', text: 'hey' }],
      detectedLinks: [{ url: 'http://rain-archive.local/', host: 'rain-archive.local', href: '/', raw: 'http://rain-archive.local/' }],
      displayName: actorName,
      buddyId: actorId,
      totalMinutes: 600,
      existingSharedLinks: [],
      existingDiscoveredHosts: [],
    });
    expect(first.mergedReplies.length).toBe(1);
    expect(first.mergedSharedLinks.length).toBe(1);
    expect(first.mergedDiscoveredHosts).toContain('rain-archive.local');

    const second = computeExchangeUpdate({
      npcTexts: ['again http://rain-archive.local/'],
      existingReplies: first.mergedReplies,
      previousSummary: first.postReplySummary,
      recentMessages: [{ sender: 'player', text: 'hey' }],
      detectedLinks: [{ url: 'http://rain-archive.local/', host: 'rain-archive.local', href: '/', raw: 'http://rain-archive.local/' }],
      displayName: actorName,
      buddyId: actorId,
      totalMinutes: 601,
      existingSharedLinks: first.mergedSharedLinks,
      existingDiscoveredHosts: first.mergedDiscoveredHosts,
    });
    expect(second.mergedSharedLinks.length).toBe(1);
  });
});

describe('P8 reply suggestions', () => {
  it('validates exactly 3 distinct replies', () => {
    expect(parseSuggestedReplies({ replies: ['a', 'b', 'c'] }).replies).toEqual(['a', 'b', 'c']);
    expect(() => parseSuggestedReplies({ replies: ['a', 'b'] })).toThrow();
    expect(() => parseSuggestedReplies({ replies: ['same', 'same', 'same'] })).toThrow();
    expect(() => parseSuggestedReplies({ replies: ['x'.repeat(121), 'b', 'c'] })).toThrow();
  });

  it('falls back offline without a key (3 generic player-voiced lines)', async () => {
    const result = await aiService.suggestReplies({
      buddyId: 'fixture_actor',
      displayName: 'Fixture Actor',
      relationshipSummary: 'new friendship',
      recentMessages: [{ sender: 'buddy', text: 'hey' }],
    });
    expect(result.meta.fallback).toBe(true);
    expect(result.data.replies.length).toBe(3);
    expect(result.data.replies.every((reply) => reply.length > 0 && reply.length <= 120)).toBe(true);
  });
});

describe('P8 memory bridge (persisted slices)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips actor-keyed slices through storage', () => {
    expect(readMemorySlices().conversationMemory).toEqual({});
    writeMemorySlices({
      conversationMemory: { fixture_actor: ['Player said: hi'] },
      conversationSummaries: { fixture_actor: 'Hi exchanged.' },
    });
    const back = readMemorySlices();
    expect(back.conversationMemory.fixture_actor).toEqual(['Player said: hi']);
    expect(back.conversationSummaries.fixture_actor).toBe('Hi exchanged.');
    expect(back.buddyFacts).toEqual({});
  });
});
