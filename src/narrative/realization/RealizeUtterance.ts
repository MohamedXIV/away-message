import type { RealizedUtterance, UtterancePlan } from './contracts';

export const DEFAULT_REALIZATION_TIMEOUT_MS = 2_500;

export interface RealizeUtteranceOptions {
  /** Optional AI surface realizer. Without it the authored offline text is final. */
  ai?: (plan: UtterancePlan) => Promise<string>;
  timeoutMs?: number;
}

export type RealizedTextValidation =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/** Offline/default realization is always complete and deterministic. */
export function realizeOffline(plan: UtterancePlan): RealizedUtterance {
  return { planId: plan.id, tier: plan.tier, text: plan.offlineText, source: 'offline' };
}

/**
 * Lexical meaning guard for AI wording. It cannot prove semantics, but it
 * rejects omitted authored anchors and high-risk forbidden claims; failures
 * always fall back to the complete authored utterance.
 */
export function validateRealizedText(plan: UtterancePlan, value: unknown): RealizedTextValidation {
  if (typeof value !== 'string') return { ok: false, reason: 'AI realization was not text.' };
  const text = value.trim();
  if (!text) return { ok: false, reason: 'AI realization was empty.' };
  if (text.length > plan.maxChars) {
    return { ok: false, reason: `AI realization exceeded ${plan.maxChars} characters.` };
  }
  if (/[\r\n]/.test(text)) return { ok: false, reason: 'AI realization must be a single utterance line.' };
  if (plan.tier === 'L0') return { ok: false, reason: 'L0 exact authored text cannot be AI-realized.' };

  const normalized = normalizeForMatch(text);
  if (plan.tier !== 'L3') {
    if (plan.requiredFacts.length === 0) {
      return { ok: false, reason: 'L1/L2 realization needs required-fact anchors.' };
    }
    for (const fact of plan.requiredFacts) {
      if (!normalized.includes(normalizeForMatch(fact))) {
        return { ok: false, reason: `AI realization omitted required fact: ${fact}` };
      }
    }
  }
  for (const claim of plan.forbiddenClaims) {
    if (normalized.includes(normalizeForMatch(claim))) {
      return { ok: false, reason: `AI realization introduced forbidden claim: ${claim}` };
    }
  }
  return { ok: true, text };
}

/**
 * Realize a plan. Offline is the baseline; AI is attempted only for L1–L3 with
 * an injected realizer, bounded by a timeout, and accepted only if it preserves
 * the plan's meaning guard. Every failure returns the complete authored text.
 */
export async function realizeUtterance(
  plan: UtterancePlan,
  options: RealizeUtteranceOptions = {},
): Promise<RealizedUtterance> {
  const offline = realizeOffline(plan);
  if (plan.tier === 'L0' || !options.ai) return offline;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.floor(options.timeoutMs as number))
    : DEFAULT_REALIZATION_TIMEOUT_MS;
  try {
    const candidate = await withTimeout(Promise.resolve().then(() => options.ai!(plan)), timeoutMs);
    const validation = validateRealizedText(plan, candidate);
    if (!validation.ok) return { ...offline, fallbackReason: validation.reason };
    return { planId: plan.id, tier: plan.tier, text: validation.text, source: 'ai' };
  } catch (error) {
    return {
      ...offline,
      fallbackReason: error instanceof Error ? error.message : 'AI realization failed.',
    };
  }
}

/** Provider-neutral prompt text for a future AI adapter; includes no effect payloads. */
export function buildRealizationPrompt(plan: UtterancePlan): { system: string; user: string } {
  const system = [
    'You rewrite one authored narrative utterance into surface wording only.',
    'Return plain text on one line. Do not add choices, stats, effects, commands or markup.',
    'Preserve every required fact. Never introduce a forbidden claim.',
    plan.tier === 'L3'
      ? 'This is noncanonical surface fiction: texture and unreliable claims are allowed, but never state canonical gameplay outcomes.'
      : 'Do not add or remove any narrative fact.',
  ].join(' ');
  const user = [
    `Tier: ${plan.tier}`,
    `Speech act: ${plan.speechAct}`,
    `Authored meaning: ${plan.offlineText}`,
    `Required facts: ${plan.requiredFacts.join(' | ') || '(none)'}`,
    `Tone: ${plan.tone.join(', ') || '(neutral)'}`,
    `Allowed uncertainty: ${plan.allowedUncertainty.join(', ') || '(none)'}`,
    `Forbidden claims: ${plan.forbiddenClaims.join(' | ') || '(none)'}`,
    `Maximum characters: ${plan.maxChars}`,
  ].join('\n');
  return { system, user };
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`AI realization timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
