// src/engine/innerVoice/InnerVoiceTextService.ts
// Text resolution for the Player Inner Voice (#23).
//
// Every approved ThoughtIntent has a deterministic template fallback, so AI
// outage or a missing key never suppresses player feedback. AI may only
// paraphrase the already-approved semantic meaning; any malformed or unsafe
// model output is rejected and the fallback is used. All provider failures
// are caught — AI trouble never breaks the tick.

import { parseInnerVoiceThought } from '../../ai/schemas';
import {
  completeJson,
  getProviderModel,
  isPlausibleKey,
  resolveApiKey,
} from '../../ai/providers';
import type { AISettings } from '../../ai/types';
import {
  DEFAULT_PLAYER_VOICE_PROFILE,
  renderFallbackText,
  type PlayerVoiceProfile,
} from './PlayerVoiceProfile';
import type { ResolvedThought, ThoughtIntent } from './types';

const INNER_VOICE_REQUEST_TIMEOUT_MS = 15_000;

const INNER_VOICE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thought: { type: 'string' },
  },
  required: ['thought'],
};

/** First-person markers an inner thought must carry. */
const FIRST_PERSON_PATTERN = /\bi\b|\bmy\b|\bme\b|\bi'm\b|\bi've\b|\bi'll\b|\bmine\b/i;
/** URLs are never allowed in inner thoughts (no future design has opted in). */
const URL_PATTERN = /https?:\/\/|www\.|\.local/i;
/** A thought must never encode money amounts or stat/mutation directives. */
const MUTATION_PATTERN =
  /\$\s*\d|\b\d+\s*(dollars|bucks)\b|(trust|cash|energy|comfort|affection)\s*[+-]\s*\d|(socialAction|cashDelta|relationshipDelta|grantItem|giveItem|takeItem)\s*[:=]/i;

export interface ResolveThoughtTextOptions {
  profile?: PlayerVoiceProfile;
  /** Extra seed for the deterministic fallback pick (defaults to the meaning). */
  seedExtra?: string;
  aiSettings?: AISettings;
  /** Opt into AI paraphrase. Default false: deterministic fallback. */
  useAI?: boolean;
  /** Injectable provider call for tests. Defaults to the real shared provider stack. */
  completeJsonFn?: (systemPrompt: string, userPrompt: string) => Promise<unknown>;
}

function buildParaphrasePrompts(intent: ThoughtIntent, profile: PlayerVoiceProfile): {
  system: string;
  user: string;
} {
  return {
    system: [
      'You paraphrase the player\'s private inner thought for a cozy life-sim set around 1998-2006.',
      'Return JSON only and follow the provided schema exactly: one field, "thought".',
      'Write one short first-person thought, 140 characters max, single line.',
      'Paraphrase ONLY the approved meaning given below. Never add new facts, people, items, events, memories, or plans.',
      'No URLs, no .local links, no money amounts, no stat changes, no action directives.',
      `Voice direction (do not quote it): ${profile.description}`,
    ].join(' '),
    // Deliberately narrow: meaning + tone + topic only. Raw knowledge-view
    // values never enter the prompt, so hidden knowledge cannot leak.
    user: [
      `Approved meaning: ${intent.semanticMeaning}`,
      `Tone: ${intent.tone}`,
      `Topic: ${intent.topic}`,
      'Paraphrase it as the player thinking to themselves.',
    ].join('\n'),
  };
}

/**
 * Strict post-schema guards. The Zod shape already rejects extra mutation
 * fields; these reject unsafe text that passed the shape.
 */
export function validateParaphrasedText(candidate: string): string {
  const text = candidate.trim().replace(/\s+/g, ' ');
  if (!text) throw new Error('Inner Voice paraphrase is empty.');
  if (text.length > 140) throw new Error('Inner Voice paraphrase exceeds 140 characters.');
  if (text.includes('\n')) throw new Error('Inner Voice paraphrase must be a single line.');
  if (URL_PATTERN.test(text)) throw new Error('Inner Voice paraphrase must not contain URLs.');
  if (MUTATION_PATTERN.test(text)) {
    throw new Error('Inner Voice paraphrase must not encode state mutations.');
  }
  if (!FIRST_PERSON_PATTERN.test(text)) {
    throw new Error('Inner Voice paraphrase must be a first-person thought.');
  }
  return text;
}

async function invokeParaphraseProvider(
  providerId: AISettings['activeProvider'],
  model: string,
  key: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), INNER_VOICE_REQUEST_TIMEOUT_MS);
  try {
    return await completeJson({
      providerId,
      model,
      apiKey: key,
      systemPrompt,
      userPrompt,
      jsonSchema: INNER_VOICE_JSON_SCHEMA,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Inner Voice request timed out after ${INNER_VOICE_REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Resolve an approved intent to renderer-neutral text + presentation class.
 * Deterministic fallback first; optional AI paraphrase with strict
 * validation; any failure returns the fallback. Never throws for AI reasons.
 */
export async function resolveThoughtText(
  intent: ThoughtIntent,
  options: ResolveThoughtTextOptions = {},
): Promise<ResolvedThought> {
  const profile = options.profile ?? DEFAULT_PLAYER_VOICE_PROFILE;
  const fallbackText = renderFallbackText(intent, profile, options.seedExtra);
  const resolved = (text: string, fallback: boolean, fromAI: boolean): ResolvedThought => ({
    text,
    presentation: intent.presentation,
    tone: intent.tone,
    sourceId: intent.source,
    intentId: intent.id,
    fallback,
    fromAI,
  });

  if (!options.useAI) return resolved(fallbackText, true, false);

  try {
    const settings: AISettings = options.aiSettings ?? { activeProvider: 'gemini', byokKeys: {} };
    const providerId = settings.activeProvider;
    const model = getProviderModel(providerId);

    let raw: unknown;
    if (options.completeJsonFn) {
      raw = await options.completeJsonFn(
        buildParaphrasePrompts(intent, profile).system,
        buildParaphrasePrompts(intent, profile).user,
      );
    } else {
      const { key } = resolveApiKey(providerId, settings);
      if (!key || !isPlausibleKey(providerId, key)) return resolved(fallbackText, true, false);
      const prompts = buildParaphrasePrompts(intent, profile);
      raw = await invokeParaphraseProvider(providerId, model, key, prompts.system, prompts.user);
    }

    const parsed = parseInnerVoiceThought(raw);
    const text = validateParaphrasedText(parsed.thought);
    return resolved(text, false, true);
  } catch {
    return resolved(fallbackText, true, false);
  }
}
