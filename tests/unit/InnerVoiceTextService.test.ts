import { describe, expect, it } from 'vitest';
import { parseInnerVoiceThought } from '../../src/ai/schemas';
import { resolveThoughtText } from '../../src/engine/innerVoice/InnerVoiceTextService';
import type { ThoughtIntent } from '../../src/engine/innerVoice/types';

function testIntent(overrides: Partial<ThoughtIntent> = {}): ThoughtIntent {
  return {
    id: 'thought:test:1',
    topic: 'rain on the awning',
    semanticMeaning: 'i notice rain has started outside the corner mart awning',
    tone: 'neutral',
    priority: 10,
    source: 'world:weather',
    knowledgeRefs: ['visible:weather:rain'],
    cooldownKey: 'weather:rain',
    presentation: 'ambient',
    ...overrides,
  };
}

const OFFLINE_SETTINGS = { activeProvider: 'gemini' as const, byokKeys: {} };

describe('InnerVoiceTextService (deterministic fallback + strict AI validation)', () => {
  it('5. AI unavailable returns deterministic fallback text', async () => {
    const intent = testIntent();
    const first = await resolveThoughtText(intent, { aiSettings: OFFLINE_SETTINGS });
    const second = await resolveThoughtText(intent, { aiSettings: OFFLINE_SETTINGS });

    expect(first.fallback).toBe(true);
    expect(first.fromAI).toBe(false);
    expect(typeof first.text).toBe('string');
    expect(first.text.length).toBeGreaterThan(0);
    expect(first.text.length).toBeLessThanOrEqual(140);
    // Deterministic: same intent resolves to the same offline line.
    expect(second.text).toBe(first.text);
    // Renderer-neutral presentation only, no typography/animation ownership.
    expect(['ambient', 'inspect', 'urgent']).toContain(first.presentation);
  });

  it('6. malformed AI output is rejected and falls back', async () => {
    const intent = testIntent();
    const malformed = await resolveThoughtText(intent, {
      aiSettings: OFFLINE_SETTINGS,
      useAI: true,
      completeJsonFn: async () => ({ wrongShape: true }),
    });
    expect(malformed.fallback).toBe(true);
    expect(malformed.fromAI).toBe(false);
    expect(malformed.text.length).toBeGreaterThan(0);
  });

  it('6b. unsafe AI output (URL / non-first-person / overlong) falls back', async () => {
    const intent = testIntent();
    for (const badThought of [
      'check out http://nightboard.local/thread/1 for rain details',
      'The weather system has updated precipitation values.',
      'x'.repeat(400),
    ]) {
      const result = await resolveThoughtText(intent, {
        aiSettings: OFFLINE_SETTINGS,
        useAI: true,
        completeJsonFn: async () => ({ thought: badThought }),
      });
      expect(result.fallback).toBe(true);
      expect(result.text).not.toContain('http');
    }
  });

  it('7. generated thought cannot carry social/money/item mutations', () => {
    // Strict schema rejects mutation smuggling at the shape level.
    expect(() =>
      parseInnerVoiceThought({ thought: 'i should rest soon', cashDelta: -50 }),
    ).toThrow();
    expect(() =>
      parseInnerVoiceThought({ thought: 'i miss them', relationshipDelta: { trust: 5 } }),
    ).toThrow();
    expect(() =>
      parseInnerVoiceThought({ thought: 'found it', grantItem: 'noodles' }),
    ).toThrow();

    // The resolved result type carries text + presentation class only.
    return resolveThoughtText(testIntent(), { aiSettings: OFFLINE_SETTINGS }).then((result) => {
      expect(result).not.toHaveProperty('cashDelta');
      expect(result).not.toHaveProperty('relationshipDelta');
      expect(result).not.toHaveProperty('grantItem');
      expect(result).not.toHaveProperty('socialAction');
      expect(Object.keys(result).sort()).toEqual(
        ['fallback', 'fromAI', 'intentId', 'presentation', 'sourceId', 'text', 'tone'].sort(),
      );
    });
  });

  it('accepts a well-formed AI paraphrase that preserves the approved meaning', async () => {
    const intent = testIntent();
    const result = await resolveThoughtText(intent, {
      aiSettings: OFFLINE_SETTINGS,
      useAI: true,
      completeJsonFn: async () => ({ thought: 'i watch the rain pick up over the awning' }),
    });
    expect(result.fallback).toBe(false);
    expect(result.fromAI).toBe(true);
    expect(result.text).toBe('i watch the rain pick up over the awning');
  });
});
