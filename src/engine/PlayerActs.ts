// src/engine/PlayerActs.ts
// The introvert protagonist's social economy — tone classification, battery
// prices, boldness gates, reception rolls, apology detection, inner voice.
// Rules only: the AI never prices, judges, or forgives — it paraphrases the
// outcome hint the rules store. Offline-safe (seeded rolls, template pools).

import { pickSeeded, rollSeeded100 } from './characterTemplates';
import type { CharacterTraits, RelationshipDimensions, RelationshipStage } from './types';

export type PlayerTone = 'normal' | 'warm' | 'flirty' | 'hot' | 'cold';
export type Reception = 'warm' | 'lukewarm' | 'reject' | 'offlimits';

export interface PlayerActAssessment {
  tone: PlayerTone;
  /** 0 normal, 1 marked, 2 intense (hotter pink / deeper blue). */
  degree: number;
  /** 0 everyday, 1 flirty, 2 hot — gates + upfront prices scale with this. */
  boldness: number;
  /** Battery due at send time (outcome adjustments apply on top). */
  upfrontCost: number;
  requiresStage: 'any' | 'friend' | 'close';
}

// Battery prices (the visible meter — the player invests deliberately)
export const BATTERY_DM = 1;
export const BATTERY_WARM = 2;
export const BATTERY_COLD = 3;
export const BATTERY_FLIRTY = 30;
export const BATTERY_HOT = 45;
export const BATTERY_CAFE_MEETING = 10;
export const BATTERY_NEW_APPOINTMENT = 5;
/** Lukewarm reception stings extra. Warm acceptance refunds + bonus. */
export const BATTERY_LUKEWARM_EXTRA = 10;
export const BATTERY_WARM_REFUND = 30;
export const BATTERY_WARM_BONUS = 10;
export const BATTERY_APOLOGY_REWARD = 15;
/** Outing price scales with time out: ~1 per 6 minutes. */
export function batteryCostForOuting(minutes: number): number {
  return Math.max(4, Math.round(minutes / 6));
}

// Era keyword lists (lowercase substring match — crude on purpose: rules,
// never the model, decide what counts as bold).
const HOT_HITS = ['kiss', 'make out', 'sexy', 'naked', 'sleep with', 'turns me on', 'turn me on', 'bed with', 'love you', 'marry me', 'babe'];
const FLIRTY_HITS = ['cute', 'beautiful', 'gorgeous', 'handsome', 'dreamy', 'crush on you', 'sweet on you', 'take you out', 'go out with me', 'adore you', 'flirt'];
const COLD_HITS = ['shut up', 'leave me alone', 'buzz off', 'dont care', "don't care", 'boring', 'stupid', 'hate you', 'loser', 'annoying', 'whatever.'];
const WARM_HITS = ['thank you', 'thanks', 'appreciate', 'miss you', 'missed you', 'care about you', 'proud of you', 'means a lot', 'glad to know you', 'you are the best'];

function countHits(text: string, hits: string[]): number {
  let n = 0;
  for (const h of hits) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(h, from);
      if (at === -1) break;
      n++;
      from = at + h.length;
    }
  }
  return n;
}

/** Classify a player line (pure). Hot > flirty > cold > warm > normal. */
export function classifyPlayerTone(rawText: string): PlayerActAssessment {
  const text = (rawText || '').toLowerCase();
  const hot = countHits(text, HOT_HITS);
  if (hot > 0) {
    return { tone: 'hot', degree: Math.min(2, 1 + (hot >= 2 ? 1 : 0)), boldness: 2, upfrontCost: BATTERY_HOT, requiresStage: 'close' };
  }
  const flirty = countHits(text, FLIRTY_HITS);
  if (flirty > 0) {
    return { tone: 'flirty', degree: Math.min(2, 1 + (flirty >= 3 ? 1 : 0)), boldness: 1, upfrontCost: BATTERY_FLIRTY, requiresStage: 'friend' };
  }
  const cold = countHits(text, COLD_HITS);
  if (cold > 0) {
    return { tone: 'cold', degree: Math.min(2, 1 + (cold >= 3 ? 1 : 0)), boldness: 0, upfrontCost: BATTERY_COLD, requiresStage: 'any' };
  }
  if (countHits(text, WARM_HITS) > 0) {
    return { tone: 'warm', degree: 1, boldness: 0, upfrontCost: BATTERY_WARM, requiresStage: 'any' };
  }
  return { tone: 'normal', degree: 0, boldness: 0, upfrontCost: BATTERY_DM, requiresStage: 'any' };
}

export interface ReceptionInput {
  buddyId: string;
  stage: RelationshipStage;
  dims: RelationshipDimensions;
  traits: CharacterTraits;
  day: number;
  /** Deterministic per message (length + head of text). */
  seed: string;
}

/**
 * Judge a bold act (flirty/hot only — everyday lines need no judgment).
 * Stage-strangers get 'offlimits' without a roll; otherwise a seeded roll
 * against a reception score built from comfort/trust/warmth/closeness.
 */
export function receptionForBoldAct(input: ReceptionInput, boldness: number): Reception {
  if (boldness <= 0) return 'warm';
  const needClose = boldness >= 2;
  const okStage = needClose ? input.stage === 'close' : input.stage === 'friend' || input.stage === 'close';
  if (!okStage) return 'offlimits';
  const score = input.dims.comfort * 0.4
    + input.dims.trust * 0.3
    + input.traits.warmth * 0.2
    + (input.stage === 'close' ? 15 : 0)
    - input.traits.shyness * 0.1;
  const roll = rollSeeded100(`${input.buddyId}:${input.day}:${input.seed}`);
  if (needClose) {
    if (roll < score - 10) return 'warm';
    if (roll < score + 10) return 'lukewarm';
    return 'reject';
  }
  if (roll < score) return 'warm';
  if (roll < score + 20) return 'lukewarm';
  return 'reject';
}

/** Prompt-hygiene-safe direction line for the NPC reply (never quoted literally). */
export function receptionHintFor(outcome: Reception, displayName: string): string {
  switch (outcome) {
    case 'warm':
      return `${displayName} received the player's bold line warmly — answer with genuine warmth and a little returned courage.`;
    case 'lukewarm':
      return `${displayName} received the player's bold line awkwardly — stay polite but deflect gently, and drift toward a safer topic soon.`;
    case 'reject':
    case 'offlimits':
      return `${displayName} received the player's bold line badly — stay cool and distant with short replies, and do not reward it.`;
  }
}

export interface SuggestionTone {
  tone: PlayerTone;
  degree: number;
  /** Upfront battery price preview (reception outcomes are unknown until sent). */
  cost: number;
}

/** Tone + price preview for a reply suggestion (pure — shared by Pulse and Café). */
export function toneSuggestion(text: string): SuggestionTone {
  const assessed = classifyPlayerTone(text);
  return { tone: assessed.tone, degree: assessed.degree, cost: assessed.upfrontCost };
}

/** Forgiveness keywords (rules decide what counts as an apology). */
export function isApology(text: string): boolean {  return /sorry|apolog|forgive|my bad|my fault|pardon me|didn'?t mean|won'?t happen again/i.test(text || '');
}

// Inner voice (the protagonist thinking to himself — shown on refuses).
const INNER_VOICE_BLOCKED = [
  'do i really have to do this...',
  'no. not now. i got nothing left.',
  'maybe tomorrow. probably not.',
  'empty. completely empty. later.',
];
const INNER_VOICE_MUST_APOLOGIZE = [
  'they wont even read this until i say sorry. ugh.',
  'apologize first. then talk. ...fine.',
];
const INNER_VOICE_WIPED = [
  'that was stupid. that was so stupid.',
  'never again. going quiet for a while.',
];
const INNER_VOICE_OUTING = [
  'going out? really? ...fine. fine!',
  'do i have to? ...yeah. i have to.',
];

export type InnerVoiceKind = 'blocked' | 'must_apologize' | 'wiped' | 'outing';

export function pickInnerVoice(kind: InnerVoiceKind, seed: string): string {
  const pool = kind === 'blocked' ? INNER_VOICE_BLOCKED
    : kind === 'must_apologize' ? INNER_VOICE_MUST_APOLOGIZE
    : kind === 'wiped' ? INNER_VOICE_WIPED : INNER_VOICE_OUTING;
  return pickSeeded(pool, `${seed}:inner:${kind}`);
}
