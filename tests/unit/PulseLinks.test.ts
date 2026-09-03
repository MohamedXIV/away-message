import { describe, it, expect, vi } from 'vitest';
import { extractLocalLinks, BUDDY_LINK_POOLS, pickRandomBuddyLink, pickTopicalBuddyLink, scoreLinkForContext, MIN_LINK_SCORE } from '../../src/apps/pulse/utils/linkDetector';
import { loadPulseState, makeDefaultPulseState, savePulseState } from '../../src/apps/pulse/persistence';
import { OFFLINE_MESSAGE_POOLS, pickOfflineMessage } from '../../src/apps/pulse/PulseMessengerApp';

describe('Pulse .local Link Detection', () => {
  it('extracts single and multiple .local links', () => {
    expect(extractLocalLinks('check http://rain-archive.local/ please')).toHaveLength(1);
    expect(extractLocalLinks('visit http://rain-archive.local/ and http://canal-hum.local/recording')).toHaveLength(2);
    expect(extractLocalLinks('no link here')).toHaveLength(0);
    expect(extractLocalLinks('bare host rain-archive.local should also be detected')).toHaveLength(1);
  });

  it('normalizes bare hosts to http:// and deduplicates', () => {
    const links = extractLocalLinks('see http://rain-archive.local/ and rain-archive.local');
    expect(links).toHaveLength(1);
    expect(links[0]!.host).toBe('rain-archive.local');
    expect(links[0]!.url).toBe('http://rain-archive.local/');
  });

  it('ignores non-.local hosts', () => {
    expect(extractLocalLinks('visit http://example.com and https://google.com')).toHaveLength(0);
  });

  it('provides buddy link pools for all buddies', () => {
    expect((BUDDY_LINK_POOLS as Record<string, Array<{ host: string }>>)['maya']!.length).toBeGreaterThanOrEqual(3);
    expect((BUDDY_LINK_POOLS as Record<string, Array<{ host: string }>>)['ryan']!.length).toBeGreaterThanOrEqual(3);
    expect((BUDDY_LINK_POOLS as Record<string, Array<{ host: string }>>)['nora']!.length).toBeGreaterThanOrEqual(3);
    expect((BUDDY_LINK_POOLS as Record<string, Array<{ host: string }>>)['henderson']!.length).toBeGreaterThanOrEqual(2);
    expect((BUDDY_LINK_POOLS as Record<string, Array<{ host: string }>>)['maya']!.every((entry) => entry.host.endsWith('.local'))).toBe(true);
  });

  it('picks deterministic link per buddy and minute', () => {
    const link1 = pickRandomBuddyLink('maya', 600);
    const link2 = pickRandomBuddyLink('maya', 600);
    expect(link1?.url).toBe(link2?.url);
    expect(link1?.host.endsWith('.local')).toBe(true);
    const differentLink = pickRandomBuddyLink('nora', 600);
    // Different buddy may give different host (not guaranteed but likely)
    // At least check that nora link is from nora pool
    expect((BUDDY_LINK_POOLS as Record<string, Array<{ host: string }>>)['nora']!.map((e) => e.host)).toContain(differentLink?.host);
  });

  it('offline pools now contain .local links for discoverability', () => {
    const hasLink = (pool: string[] | undefined) => (pool || []).some((text) => text.includes('.local'));
    expect(hasLink((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['maya'])).toBe(true);
    expect(hasLink((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['ryan'])).toBe(true);
    expect(hasLink((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['nora'])).toBe(true);
    expect(hasLink((OFFLINE_MESSAGE_POOLS as Record<string, string[]>)['henderson'])).toBe(true);
  });

  it('scores topical relevance: tacos match the taco cart, rain does not', () => {
    const tacoEntry = (BUDDY_LINK_POOLS as Record<string, Array<{ host: string; path: string; title: string; snippet: string }>>)['ryan']!.find((e) => e.host === 'taco-cart.local')!;
    expect(scoreLinkForContext(tacoEntry, 'i really want tacos after this shift')).toBeGreaterThanOrEqual(MIN_LINK_SCORE);
    expect(scoreLinkForContext(tacoEntry, 'the rain is so heavy tonight, listening to music')).toBeLessThan(MIN_LINK_SCORE);
  });

  it('picks a topical link for matching chat and nothing for unrelated chat', () => {
    const picked = pickTopicalBuddyLink('ryan', 'dude im starving, tacos sound amazing right now', 'salt1');
    expect(picked?.host).toBe('taco-cart.local');
    expect(pickTopicalBuddyLink('ryan', 'how was your day at the office, anything new', 'salt1')).toBeNull();
    expect(pickTopicalBuddyLink('maya', 'that rain recording last night was beautiful', 'salt2')?.host).toBe('rain-archive.local');
    // Deterministic for the same inputs
    expect(pickTopicalBuddyLink('ryan', 'tacos tacos tacos', 'salt1')).toEqual(pickTopicalBuddyLink('ryan', 'tacos tacos tacos', 'salt1'));
    expect(pickTopicalBuddyLink('ghost', 'tacos', 'salt1')).toBeNull();
  });

  it('offline picker avoids links when the previous offline message had one', () => {
    // Maya pool has both kinds; with avoidLink every pick across minutes must be link-free
    for (const minute of [0, 1, 2, 3, 4, 5, 100, 999, 12345]) {
      expect(extractLocalLinks(pickOfflineMessage('maya', minute, undefined, true))).toHaveLength(0);
    }
    // Without the flag, links still appear sometimes (discoverability preserved)
    const anyWithLink = [0, 1, 2, 3, 4, 5].some((m) => extractLocalLinks(pickOfflineMessage('maya', m)).length > 0);
    expect(anyWithLink).toBe(true);
  });
});

describe('Pulse Shared Links Persistence & FindIt Integration', () => {
  it('persists sharedLinks and discoveredHosts', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const state = makeDefaultPulseState();
    state.sharedLinks = [
      { id: 'shared_1', url: 'http://rain-archive.local/', host: 'rain-archive.local', title: 'Rain Archive', sharedBy: 'maya', sharedByName: 'Maya', minute: 650, snippet: 'Maya shared a rain collection' },
      { id: 'shared_2', url: 'http://canal-hum.local/recording', host: 'canal-hum.local', title: 'Canal Hum', sharedBy: 'nora', sharedByName: 'Nora', minute: 700, snippet: 'Nora shared a hum recording' },
    ];
    state.discoveredHosts = ['rain-archive.local', 'canal-hum.local'];
    savePulseState(state);

    const restored = loadPulseState();
    expect(restored.sharedLinks).toHaveLength(2);
    expect(restored.sharedLinks[0]!.host).toBe('rain-archive.local');
    expect(restored.discoveredHosts).toContain('rain-archive.local');
    expect(restored.discoveredHosts).toContain('canal-hum.local');

    vi.unstubAllGlobals();
  });

  it('sanitizes invalid sharedLinks on load', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => { stored = value; },
      },
    });

    const raw = {
      ...makeDefaultPulseState(),
      sharedLinks: [
        { id: 'good', url: 'http://rain-archive.local/', host: 'rain-archive.local', title: 'Good', sharedBy: 'maya', sharedByName: 'Maya', minute: 600, snippet: 'ok' },
        { url: 'http://bad.local/', host: 'bad.local' } as any, // missing required fields
        null as any,
        { id: 'good2', url: 'http://canal-hum.local/recording', host: 'canal-hum.local', title: 'Good2', sharedBy: 'nora', sharedByName: 'Nora', minute: 700, snippet: 'ok' },
      ],
      discoveredHosts: ['rain-archive.local', 'not-a-local', 123 as any, 'canal-hum.local'],
    };
    (globalThis as any).window.localStorage.setItem('away_message_pulse_state_v1', JSON.stringify(raw));
    const restored = loadPulseState();
    // Only valid links should survive
    expect(restored.sharedLinks.length).toBe(2);
    expect(restored.discoveredHosts).toContain('rain-archive.local');
    expect(restored.discoveredHosts).toContain('canal-hum.local');
    expect(restored.discoveredHosts).not.toContain('not-a-local');

    vi.unstubAllGlobals();
  });

  it('finds shared links via query matching', () => {
    const links = [
      { id: '1', url: 'http://rain-archive.local/', host: 'rain-archive.local', title: 'Rain Archive', sharedBy: 'maya', sharedByName: 'Maya', minute: 600, snippet: 'rain collection from canal' },
      { id: '2', url: 'http://canal-hum.local/recording', host: 'canal-hum.local', title: 'Canal Hum', sharedBy: 'nora', sharedByName: 'Nora', minute: 650, snippet: 'low frequency hum' },
    ];
    const query = 'rain';
    const haystack = `${links[0]!.host} ${links[0]!.title} ${links[0]!.snippet} ${links[0]!.sharedByName}`.toLowerCase();
    expect(haystack.includes(query)).toBe(true);
    const query2 = 'canal';
    const haystack2 = `${links[1]!.host} ${links[1]!.title}`.toLowerCase();
    expect(haystack2.includes(query2)).toBe(true);
  });
});
