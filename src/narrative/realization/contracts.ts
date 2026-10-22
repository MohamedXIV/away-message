/** Surface wording tiers. Higher tiers grant wording freedom, never canonical authority. */
export const REALIZATION_TIERS = ['L0', 'L1', 'L2', 'L3'] as const;
export type RealizationTier = (typeof REALIZATION_TIERS)[number];

export const SPEAKER_KINDS = ['canonical_local', 'canonical_remote', 'surface_only', 'system'] as const;
export type SpeakerKind = (typeof SPEAKER_KINDS)[number];

/**
 * Semantic plan produced by authored Ink / NarrativeCoordinator.
 *
 * Everything required for a complete offline utterance is present before any
 * AI call. AI may only produce surface text; it never receives or returns
 * effect payloads, choices or canonical state.
 */
export interface UtterancePlan {
  id: string;
  tier: RealizationTier;
  speakerId: string | null;
  speakerKind: SpeakerKind;
  speechAct: string;
  /** Complete authored realization used offline and whenever AI is unavailable. */
  offlineText: string;
  /** Literal anchor phrases the surface realization must preserve (L1/L2). */
  requiredFacts: readonly string[];
  tone: readonly string[];
  allowedUncertainty: readonly string[];
  /** High-risk claims the surface wording must not introduce (L1/L2). */
  forbiddenClaims: readonly string[];
  maxChars: number;
}

export interface RealizedUtterance {
  planId: string;
  tier: RealizationTier;
  text: string;
  source: 'offline' | 'ai';
  fallbackReason?: string;
}

/** Injected AI surface realizer. Implementations may use a provider, a cache or a test double. */
export type AiUtteranceRealizer = (plan: UtterancePlan) => Promise<string>;
