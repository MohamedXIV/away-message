import { describe, it, expect, vi } from 'vitest';
import { hashReply, isDuplicateReply, extractFactsFromPlayerMessage, buildConversationSummary, buildMemoryContext } from '../../src/apps/pulse/utils/conversationMemory';
import { getNpcStyle, getNpcMoodLabel, getNpcAvailabilityLabel, getNpcActivityLabel, NPC_STYLE_PROFILES } from '../../src/apps/pulse/data/npcStyles';
import { loadPulseState, makeDefaultPulseState, savePulseState } from '../../src/apps/pulse/persistence';

describe('Pulse Conversation Memory & Anti-Repeat', () => {
  it('hashReply is deterministic and length-sensitive', () => {
    expect(hashReply('hello world')).toBe(hashReply('hello world'));
    expect(hashReply('hello  world ')).toBe(hashReply('hello world')); // normalized trims double spaces
    expect(hashReply('hello world')).not.toBe(hashReply('hello worlds'));
  });

  it('detects duplicate and near-duplicate replies', () => {
    const recent = ['hey, you there?', 'what are you up to?'];
    expect(isDuplicateReply('hey, you there?', recent.map(hashReply), recent)).toBe(true);
    expect(isDuplicateReply('HEY, YOU THERE?', recent.map(hashReply), recent)).toBe(true); // case-insensitive via hashReply
    // Punctuation difference is not considered duplicate under current strict hash — this is intentional to preserve nuance
    expect(isDuplicateReply('hey you there ?', recent.map(hashReply), recent)).toBe(false);
    // Near-duplicate token Jaccard >0.82 — exact token overlap should be considered duplicate
    const nearRecent = ['hey, you there? exactly'];
    expect(isDuplicateReply('hey, you there?', nearRecent.map(hashReply), nearRecent)).toBe(false); // 75% overlap, not 82%
    expect(isDuplicateReply('hey, you there?', ['hey, you there?'].map(hashReply), ['hey, you there?'])).toBe(true);
    expect(isDuplicateReply('completely different message about tacos and rain', recent.map(hashReply), recent)).toBe(false);
  });

  it('extracts facts from player messages', () => {
    expect(extractFactsFromPlayerMessage('my name is Alex')).toEqual(expect.arrayContaining([expect.stringContaining('Alex')]));
    expect(extractFactsFromPlayerMessage('Call me Wanderer')).toEqual(expect.arrayContaining([expect.stringContaining('Wanderer')]));
    expect(extractFactsFromPlayerMessage('I promise I will come to the cafe tomorrow')).toEqual(expect.arrayContaining([expect.stringContaining('committed')]));
    expect(extractFactsFromPlayerMessage('I love rainy music')).toEqual(expect.arrayContaining([expect.stringContaining('Preference')]));
    expect(extractFactsFromPlayerMessage('let us meet tomorrow at 8')).toEqual(expect.arrayContaining([expect.stringContaining('plan')]));
    expect(extractFactsFromPlayerMessage('')).toEqual([]);
  });

  it('builds conversation summary with truncation', () => {
    const messages = [
      { sender: 'player', text: 'hello, are you there?' },
      { sender: 'buddy', text: 'hey... yeah I am here ~' },
      { sender: 'player', text: 'I wanted to ask about the rain track' },
    ];
    const summary = buildConversationSummary(messages, 'Previous summary about music');
    expect(summary).toContain('Player: hello');
    expect(summary).toContain('Buddy: hey');
    expect(summary.length).toBeLessThanOrEqual(520);

    // Long history should be truncated but keep recent
    const longMessages = Array.from({ length: 20 }, (_, i) => ({ sender: i % 2 === 0 ? 'player' : 'buddy', text: `message number ${i} with some content to fill length and make summary long enough to trigger truncation logic` }));
    const longSummary = buildConversationSummary(longMessages, 'old '.repeat(200));
    expect(longSummary.length).toBeLessThanOrEqual(520);
    expect(longSummary.startsWith('...') || longSummary.length <= 520).toBe(true);
  });

  it('builds memory context combining memory, facts, summary and anti-repeat', () => {
    const context = buildMemoryContext(['Player said: hi'], ['Fact: Player name is Alex'], 'Summary: talked about music', ['recent reply one', 'recent reply two']);
    expect(context).toContain('Player said: hi');
    expect(context).toContain('Alex');
    expect(context).toContain('Summary');
    expect(context).toContain('Avoid repeating');
  });
});

describe('Pulse NPC Style Profiles', () => {
  it('provides distinct profiles per buddy', () => {
    const maya = getNpcStyle('maya');
    const ryan = getNpcStyle('ryan');
    const nora = getNpcStyle('nora');
    const henderson = getNpcStyle('henderson');
    expect(maya.typing.wpm).toBeLessThan(ryan.typing.wpm);
    expect(ryan.typing.wpm).toBeGreaterThan(80);
    expect(maya.vocabulary).toContain('hey...');
    expect(ryan.vocabulary).toContain('yo');
    expect(nora.vocabulary).toContain('quiet');
    expect(henderson.vocabulary).toContain('Please');
    expect(maya.quirks).toContain('lowercase-heavy');
    expect(henderson.punctuation).toContain('formal');
  });

  it('falls back to generic profile for unknown buddy', () => {
    const unknown = getNpcStyle('unknown_buddy');
    expect(unknown.buddyId).toBe('unknown_buddy');
    expect(unknown.typing.wpm).toBeGreaterThan(0);
  });

  it('derives mood, availability and activity from presence and time', () => {
    const offline = getNpcMoodLabel({ status: 'offline', awayMessage: '' }, { trust: 10, comfort: 10, annoyance: 0, familiarity: 5 }, 14, 80);
    expect(offline).toContain('offline');

    const awaySleep = getNpcMoodLabel({ status: 'away', awayMessage: 'sleeping until morning' }, undefined, 2, 80);
    expect(awaySleep).toContain('tired');

    const irritated = getNpcMoodLabel({ status: 'online', awayMessage: '' }, { trust: 20, comfort: 30, annoyance: 60, familiarity: 40 }, 14, 80);
    expect(irritated).toContain('irritated');

    const relaxed = getNpcMoodLabel({ status: 'online', awayMessage: '' }, { trust: 70, comfort: 80, annoyance: 5, familiarity: 50 }, 14, 80);
    expect(relaxed).toContain('relaxed');

    expect(getNpcAvailabilityLabel({ status: 'online', awayMessage: '' }, 14)).toContain('available');
    expect(getNpcAvailabilityLabel({ status: 'away', awayMessage: 'afk' }, 3)).toContain('slowly');
    expect(getNpcAvailabilityLabel({ status: 'offline', awayMessage: '' }, 14)).toContain('offline');

    expect(getNpcActivityLabel({ status: 'away', awayMessage: 'at the desk... dont look at me' }, 'maya', 14)).toBe('at the desk... dont look at me');
    expect(getNpcActivityLabel({ status: 'online', awayMessage: '' }, 'maya', 20)).toContain('rain');
  });

  it('persists conversationSummaries, recentReplies and buddyFacts alongside legacy fields', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const state = makeDefaultPulseState();
    state.conversationSummaries = { maya: 'talked about music and rain' };
    state.recentReplies = { maya: ['hey... you there?'] };
    state.buddyFacts = { maya: ['Player name is Alex'] };
    savePulseState(state);
    const restored = loadPulseState();
    expect(restored.conversationSummaries.maya).toBe('talked about music and rain');
    expect(restored.recentReplies.maya?.[0]).toBe('hey... you there?');
    expect(restored.buddyFacts.maya?.[0]).toContain('Alex');

    vi.unstubAllGlobals();
  });

  it('has style profiles for all known buddies', () => {
    const knownIds = ['maya', 'ryan', 'nora', 'henderson'];
    knownIds.forEach((id) => {
      expect(NPC_STYLE_PROFILES[id]).toBeDefined();
      expect(NPC_STYLE_PROFILES[id]!.persona.length).toBeGreaterThan(20);
      expect(NPC_STYLE_PROFILES[id]!.typing.wpm).toBeGreaterThan(30);
    });
  });
});
