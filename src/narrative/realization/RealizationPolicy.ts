import type { NarrativeContextProjection, NarrativeFrame } from '../contracts';
import type { NarrativeSessionRef } from '../NarrativeCoordinator';
import {
  REALIZATION_TIERS,
  type RealizationTier,
  type SpeakerKind,
  type UtterancePlan,
} from './contracts';

const DEFAULT_MAX_CHARS = 400;
const MAX_FACTS = 12;
const MAX_ANNOTATIONS = 8;

export interface TierResolutionInput {
  speakerKind: SpeakerKind;
  requestedTier?: RealizationTier;
  /** Explicit authored/high-risk text may force exact L0. */
  exactAuthored?: boolean;
}

export function isRealizationTier(value: unknown): value is RealizationTier {
  return typeof value === 'string' && (REALIZATION_TIERS as readonly string[]).includes(value);
}

/**
 * Canonical local/remote buddies never exceed L2. L3 exists only for explicitly
 * noncanonical surface identities. System/legal/high-risk text stays exact.
 */
export function resolveRealizationTier(input: TierResolutionInput): RealizationTier {
  if (input.exactAuthored || input.speakerKind === 'system') return 'L0';
  const requested = input.requestedTier ?? (input.speakerKind === 'surface_only' ? 'L3' : 'L0');
  if (input.speakerKind === 'surface_only') return requested;
  return requested === 'L3' ? 'L2' : requested;
}

export interface BuildUtterancePlanInput {
  frame: NarrativeFrame;
  session?: NarrativeSessionRef | null;
  context?: NarrativeContextProjection | null;
  speakerKind?: SpeakerKind;
  requestedTier?: RealizationTier;
  exactAuthored?: boolean;
  maxChars?: number;
}

/**
 * Build a bounded utterance plan from an Ink frame. Authoring tags use:
 * `# tier:l2`, `# speech:reassure`, `# fact:...`, `# tone:...`,
 * `# uncertainty:...`, `# forbid:...`, `# maxchars:320`.
 */
export function buildUtterancePlan(input: BuildUtterancePlanInput): UtterancePlan | null {
  const offlineText = input.frame.text.trim();
  if (!offlineText) return null;

  const speakerKind = input.speakerKind ?? inferSpeakerKind(input.session, input.context);
  const tagTier = readTags(input.frame.tags, 'tier:')[0]?.toUpperCase();
  const requested = input.requestedTier ?? (isRealizationTier(tagTier) ? tagTier : undefined);
  const tier = resolveRealizationTier({
    speakerKind,
    ...(requested ? { requestedTier: requested } : {}),
    ...(input.exactAuthored ? { exactAuthored: true } : {}),
  });
  const tagMax = Number(readTags(input.frame.tags, 'maxchars:')[0]);
  const maxChars = clampChars(input.maxChars ?? (Number.isFinite(tagMax) ? tagMax : DEFAULT_MAX_CHARS));

  return {
    id: planId(input.session?.flowId ?? 'narrative', offlineText),
    tier,
    speakerId: input.session?.actorId ?? null,
    speakerKind,
    speechAct: readTags(input.frame.tags, 'speech:')[0] ?? 'inform',
    offlineText,
    requiredFacts: boundedTags(input.frame.tags, 'fact:'),
    tone: boundedTags(input.frame.tags, 'tone:'),
    allowedUncertainty: boundedTags(input.frame.tags, 'uncertainty:'),
    forbiddenClaims: boundedTags(input.frame.tags, 'forbid:'),
    maxChars,
  };
}

function inferSpeakerKind(
  session: NarrativeSessionRef | null | undefined,
  context: NarrativeContextProjection | null | undefined,
): SpeakerKind {
  // Unknown bindings and narration stay exact; only a player-safe actor
  // projection can authorize canonical surface wording.
  if (!session?.actorId || !context?.actor) return 'system';
  return context.actor.reach === 'remote' ? 'canonical_remote' : 'canonical_local';
}

function readTags(tags: readonly string[], prefix: string): string[] {
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.toLowerCase().startsWith(prefix))
    .map((tag) => tag.slice(prefix.length).trim())
    .filter(Boolean);
}

function boundedTags(tags: readonly string[], prefix: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of readTags(tags, prefix)) {
    const bounded = value.replace(/\s+/g, ' ').slice(0, 120);
    const key = bounded.toLowerCase();
    if (!bounded || seen.has(key)) continue;
    seen.add(key);
    out.push(bounded);
    if (out.length >= (prefix === 'fact:' ? MAX_FACTS : MAX_ANNOTATIONS)) break;
  }
  return out;
}

function clampChars(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_CHARS;
  return Math.max(40, Math.min(800, Math.floor(value)));
}

function planId(flowId: string, text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${flowId}:${(hash >>> 0).toString(36)}`;
}
