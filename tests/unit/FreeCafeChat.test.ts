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

  beforeEach(() => {
    sim = new SimulationEngine();
  });

  it('builds identical DM-grade context for any surface', () => {
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'maya', text: 'hey, rain today huh' });
    const ctx = buildDmChatContext({
      engine: sim as any,
      buddyId: 'maya',
      playerText: 'hey, rain today huh',
      pulse: EMPTY_SLICES,
      day: 1,
      totalMinutes: 600,
    });
    expect(ctx.displayName).toBe('Maya');
    expect(ctx.persona.toLowerCase()).toContain('quiet, observant');
    expect(ctx.relationshipSummary).toContain('Stage:');
    expect(ctx.relationshipSummary).toContain('DailyMood:');
    expect(ctx.relationshipSummary).toContain('Memory:');
    expect(ctx.recentMessages.length).toBeGreaterThan(0);
    expect(ctx.preSendPatch.conversationMemory.maya?.length).toBe(1);
    expect(ctx.preSendPatch.buddyFacts.maya).toBeDefined();
  });

  it('appends scene context and persona suffix for in-person meetings', () => {
    const ctx = buildDmChatContext({
      engine: sim as any,
      buddyId: 'maya',
      playerText: 'hi',
      pulse: EMPTY_SLICES,
      day: 2,
      totalMinutes: 1500,
      sceneContext: 'In-person meeting at Starlight Café, booth 4, Day 2.',
      personaSuffix: 'You are sitting across from the player at Starlight Café.',
    });
    expect(ctx.relationshipSummary).toContain('Scene: In-person meeting at Starlight Café');
    expect(ctx.persona).toContain('sitting across from the player');
  });

  it('ledger records promises and resolves follow-through (rules only)', () => {
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'ryan', text: "i promise i'll call tomorrow" });
    runChatLedger(sim as any, 'ryan', "i promise i'll call tomorrow", 600);
    expect(sim.social.getOpenPromises('ryan').length).toBe(1);
    sim.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId: 'ryan', text: 'did it, called!' });
    runChatLedger(sim as any, 'ryan', 'did it, called!', 601);
    expect(sim.social.getOpenPromises('ryan').length).toBe(0);
  });

  it('honours governed social actions, ignores the rest', () => {
    const before = sim.social.getRelationships('maya')!;
    honorSocialAction(sim as any, 'maya', 'empathy', true);
    expect(sim.social.getRelationships('maya')!.trust).toBeGreaterThan(before.trust);
    const mid = sim.social.getRelationships('maya')!;
    honorSocialAction(sim as any, 'maya', 'none', true);
    honorSocialAction(sim as any, 'maya', 'modify_money', true);
    honorSocialAction(sim as any, 'maya', 'empathy', false);
    expect(sim.social.getRelationships('maya')).toEqual(mid);
  });

  it('computes post-reply updates and captures links once', () => {
    const first = computeExchangeUpdate({
      npcTexts: ['check this http://rain-archive.local/ cool huh'],
      existingReplies: [],
      previousSummary: 'No summary.',
      recentMessages: [{ sender: 'player', text: 'hey' }],
      detectedLinks: [{ url: 'http://rain-archive.local/', host: 'rain-archive.local', href: '/', raw: 'http://rain-archive.local/' }],
      displayName: 'Maya',
      buddyId: 'maya',
      totalMinutes: 600,
      existingSharedLinks: [],
      existingDiscoveredHosts: [],
    });
    expect(first.mergedReplies.length).toBe(1);
    expect(first.mergedSharedLinks.length).toBe(1);
    expect(first.mergedDiscoveredHosts).toContain('rain-archive.local');
    // Same link again → deduped against the now-existing list
    const second = computeExchangeUpdate({
      npcTexts: ['again http://rain-archive.local/'],
      existingReplies: first.mergedReplies,
      previousSummary: first.postReplySummary,
      recentMessages: [{ sender: 'player', text: 'hey' }],
      detectedLinks: [{ url: 'http://rain-archive.local/', host: 'rain-archive.local', href: '/', raw: 'http://rain-archive.local/' }],
      displayName: 'Maya',
      buddyId: 'maya',
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
      buddyId: 'maya',
      displayName: 'Maya',
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

  it('round-trips slices through storage', () => {
    expect(readMemorySlices().conversationMemory).toEqual({});
    writeMemorySlices({
      conversationMemory: { maya: ['Player said: hi'] },
      conversationSummaries: { maya: 'Hi exchanged.' },
    });
    const back = readMemorySlices();
    expect(back.conversationMemory.maya).toEqual(['Player said: hi']);
    expect(back.conversationSummaries.maya).toBe('Hi exchanged.');
    expect(back.buddyFacts).toEqual({});
  });
});
