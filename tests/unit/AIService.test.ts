// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { readAICache, writeAICache, AI_CACHE_TTL_MS } from '../../src/ai/cache';
import { parseGeneratedChat, parseGeneratedSite } from '../../src/ai/schemas';
import { AIGenerationService, normalizeGeneratedSitePayload } from '../../src/ai/service';
import type { AISettings } from '../../src/ai/types';

describe('AI schemas and cache', () => {
  it('accepts the constrained generated site shape', () => {
    const site = parseGeneratedSite({
      siteName: 'test.local',
      title: 'Test Portal',
      tagline: 'best viewed in 800x600',
      eraStyle: '2001 personal homepage',
      sections: [{ heading: 'Welcome', body: 'Hello from the web.', items: ['guestbook'] }],
      links: [{ label: 'home', href: '/' }],
      quirks: [],
      searchKeywords: ['test'],
      storyHooks: [],
    });
    expect(site.sections).toHaveLength(1);
    expect(() => parseGeneratedSite({ html: '<script>alert(1)</script>' })).toThrow();
  });

  it('normalizes Gemini site text and absolute fictional links before validation', () => {
    const normalized = parseGeneratedSite(normalizeGeneratedSitePayload({
      siteName: 'midnight-board.local',
      title: 'Midnight Board',
      tagline: 'a quiet place online',
      eraStyle: 'A very long era description that is intentionally longer than the renderer needs and should be safely clipped before it reaches the strict schema validator',
      sections: [{ heading: 'Links', body: 'Visit the board.', items: [] }],
      links: [
        { label: 'about', href: 'https://midnight-board.local/about' },
        { label: 'guestbook', href: 'http://midnight-board.local/guestbook' },
      ],
      quirks: [],
      searchKeywords: ['midnight'],
      storyHooks: [],
    }));

    expect(normalized.eraStyle.length).toBeLessThanOrEqual(80);
    expect(normalized.links.map((link) => link.href)).toEqual(['/about', '/guestbook']);
  });

  it('accepts only allowed social actions in chat output', () => {
    const chat = parseGeneratedChat({
      messages: [{ text: 'hey, you there?', tone: 'casual' }],
      socialAction: 'tease_playful',
      storyHookId: null,
    });
    expect(chat.socialAction).toBe('tease_playful');
    expect(() => parseGeneratedChat({
      messages: [{ text: 'hello', tone: 'neutral' }],
      socialAction: 'modify_money',
      storyHookId: null,
    })).toThrow();
  });

  it('expires cache records and removes them from IndexedDB', async () => {
    await writeAICache({
      key: 'test-expired',
      kind: 'site',
      providerId: 'gemini',
      model: 'test',
      payload: { ok: true },
      createdAt: Date.now() - AI_CACHE_TTL_MS - 1000,
      expiresAt: Date.now() - 1000,
    });
    expect(await readAICache('test-expired')).toBeNull();
    expect(await db.ai_cache.get('test-expired')).toBeUndefined();
  });
});

describe('AI generation fallback', () => {
  it('returns a usable site and chat fallback when no key is configured', async () => {
    const service = new AIGenerationService();
    const settings: AISettings = { activeProvider: 'gemini', byokKeys: {} };
    const site = await service.generateSite({ host: 'example.local', pathname: '/' }, settings);
    const chat = await service.generateChat({
      buddyId: 'maya',
      displayName: 'Maya',
      handle: 'starlight_maya',
      persona: 'quiet and creative',
      relationshipSummary: 'trust 20',
      recentMessages: [],
      playerMessage: 'hello',
    }, settings);

    expect(site.meta.fallback).toBe(true);
    expect(site.data.sections.length).toBeGreaterThan(0);
    expect(chat.meta.fallback).toBe(true);
    expect(chat.data.messages[0]?.text).toContain('Maya');
  });
});
