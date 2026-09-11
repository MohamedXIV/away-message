// src/engine/life/Intent.ts
// Deterministic CharacterIntent selection (#44).
//
// Pure orchestration: WHAT the actor currently intends plus WHY, chosen from
// the Life Matrix snapshot (routine pressure, obligations, #43 pressure and
// goals, relationship context, #46 event effects). It never executes routes,
// timing, attendance, wages, or any relationship/economy consequence — those
// owners decide outcomes. No RNG, no wall clock, no AI, no renderer input.
//
// Scoring is a small inspectable policy (named constants below), not GOAP or
// utility AI. Ties resolve by existing obligation order (stable sort).

import { buildCharacterObligations } from './Obligations';
import type {
  CharacterIntent,
  CharacterIntentKind,
  CharacterObligation,
  LifeMatrixSnapshot,
  ObligationSourceKind,
} from './types';

/** Fixed obligation starting within this window (after now) means prepare. */
export const INTENT_PREPARE_WINDOW_MINUTES = 60;
/** Default reevaluation horizon when no future boundary exists. */
export const INTENT_REEVALUATE_HORIZON_MINUTES = 120;
/** Bonus for a fixed obligation overlapping now. */
export const INTENT_DUE_NOW_BONUS = 30;
/** Bonus for a fixed obligation starting inside the prepare window. */
export const INTENT_STARTS_SOON_BONUS = 10;
/** Bonus for a bounded/flexible obligation due within a day. */
export const INTENT_DEADLINE_NEAR_BONUS = 10;
/** Small trait nudges (documented, bounded). */
export const INTENT_TRAIT_NUDGE = 5;
/** Boost for socially-eligible flexible candidates while a life opportunity is active. */
export const INTENT_OPPORTUNITY_BONUS = 10;
/** Synthesized rest intent priority: beats inertia, loses to hard obligations. */
export const INTENT_REST_PRIORITY = 55;
/** Inertia priority when the day has routine structure. */
export const INTENT_ROUTINE_FLOW_PRIORITY = 50;

const DAY_MINUTES = 1440;

/** Goal kinds that a life opportunity may legitimately boost. */
const SOCIAL_GOAL_KINDS = new Set(['spend_time', 'improve_relationship', 'attend_event']);

interface Candidate {
  kind: CharacterIntentKind;
  sourceKind?: ObligationSourceKind;
  sourceId?: string;
  targetPlaceId?: string;
  targetActorId?: string;
  activity?: string;
  score: number;
  reasons: string[];
  earliestAt?: number;
  latestAt?: number;
  blockers: string[];
}

function isTerminal(status: CharacterObligation['status']): boolean {
  return status === 'satisfied' || status === 'missed' || status === 'cancelled';
}

function hasKnownDestination(obligation: CharacterObligation): boolean {
  return typeof obligation.destinationPlaceId === 'string' && obligation.destinationPlaceId.trim() !== '';
}

/** Stay fallback for a blocked fixed obligation: need persists, movement does not. */
function blockedFallback(
  obligation: CharacterObligation,
  score: number,
  reasons: string[],
): Candidate {
  return {
    kind: 'stay_current_activity',
    sourceKind: obligation.sourceKind,
    ...(obligation.sourceId === undefined ? {} : { sourceId: obligation.sourceId }),
    score,
    reasons: [...reasons, 'blocked'],
    ...(obligation.earliestAt === undefined ? {} : { earliestAt: obligation.earliestAt }),
    ...(obligation.latestAt === undefined ? {} : { latestAt: obligation.latestAt }),
    blockers: ['unknown_destination'],
  };
}

function candidateForObligation(
  snapshot: LifeMatrixSnapshot,
  obligation: CharacterObligation,
  opportunitySourceId: string | null,
): Candidate | null {
  if (obligation.actorId !== snapshot.actorId) return null;
  if (isTerminal(obligation.status)) return null;
  const now = snapshot.atMinute;
  const traits = snapshot.traits;

  switch (obligation.sourceKind) {
    case 'routine':
      // Routines justify inertia (handled once by the caller), never a
      // specific candidate of their own.
      return null;

    case 'appointment':
    case 'job': {
      const kind: CharacterIntentKind = obligation.sourceKind === 'job' ? 'perform_work' : 'attend_appointment';
      const reason = obligation.sourceKind === 'job' ? 'job_due' : 'appointment_due';
      const startsAt = obligation.earliestAt;
      const endsAt = obligation.latestAt;
      const dueNow =
        startsAt !== undefined && endsAt !== undefined && startsAt <= now && now <= endsAt;
      if (dueNow) {
        if (!hasKnownDestination(obligation)) {
          return blockedFallback(obligation, obligation.priority + INTENT_DUE_NOW_BONUS, [reason, 'due_now']);
        }
        return {
          kind,
          sourceKind: obligation.sourceKind,
          ...(obligation.sourceId === undefined ? {} : { sourceId: obligation.sourceId }),
          targetPlaceId: obligation.destinationPlaceId,
          score: obligation.priority + INTENT_DUE_NOW_BONUS,
          reasons: [reason, 'due_now'],
          ...(startsAt === undefined ? {} : { earliestAt: startsAt }),
          ...(endsAt === undefined ? {} : { latestAt: endsAt }),
          blockers: [],
        };
      }
      if (startsAt !== undefined && startsAt > now && startsAt <= now + INTENT_PREPARE_WINDOW_MINUTES) {
        if (!hasKnownDestination(obligation)) {
          return blockedFallback(obligation, obligation.priority + INTENT_STARTS_SOON_BONUS, [reason, 'starts_soon']);
        }
        return {
          kind: 'prepare_to_leave',
          sourceKind: obligation.sourceKind,
          ...(obligation.sourceId === undefined ? {} : { sourceId: obligation.sourceId }),
          targetPlaceId: obligation.destinationPlaceId,
          score: obligation.priority + INTENT_STARTS_SOON_BONUS,
          reasons: [reason, 'starts_soon'],
          earliestAt: startsAt,
          ...(endsAt === undefined ? {} : { latestAt: endsAt }),
          blockers: [],
        };
      }
      // Far-future fixed destination (#37 handoff): expose WHERE/WHY/window
      // early enough for mobility planning. No urgency bonus, no departure
      // claim (that is #37's job with #35 route truth), no route math here.
      if (startsAt !== undefined && startsAt > now + INTENT_PREPARE_WINDOW_MINUTES) {
        if (!hasKnownDestination(obligation)) {
          return blockedFallback(obligation, obligation.priority, [reason, 'upcoming']);
        }
        return {
          kind,
          sourceKind: obligation.sourceKind,
          ...(obligation.sourceId === undefined ? {} : { sourceId: obligation.sourceId }),
          targetPlaceId: obligation.destinationPlaceId,
          score: obligation.priority,
          reasons: [reason, 'upcoming'],
          earliestAt: startsAt,
          ...(endsAt === undefined ? {} : { latestAt: endsAt }),
          blockers: [],
        };
      }
      return null;
    }

    case 'promise': {
      let score = obligation.priority;
      const reasons = ['promise_open'];
      if (obligation.latestAt !== undefined && obligation.latestAt - now < DAY_MINUTES) {
        score += INTENT_DEADLINE_NEAR_BONUS;
        reasons.push('deadline_near');
      }
      if (traits.loyalty >= 70) {
        score += INTENT_TRAIT_NUDGE;
        reasons.push('loyal');
      }
      if ((snapshot.playerRelationship?.trust ?? 0) >= 50) {
        score += INTENT_TRAIT_NUDGE;
        reasons.push('strong_bond');
      }
      if (opportunitySourceId) {
        score += INTENT_OPPORTUNITY_BONUS;
        reasons.push(`opportunity:${opportunitySourceId}`);
      }
      return {
        kind: 'call_or_message',
        sourceKind: 'promise',
        ...(obligation.sourceId === undefined ? {} : { sourceId: obligation.sourceId }),
        score,
        reasons,
        ...(obligation.earliestAt === undefined ? {} : { earliestAt: obligation.earliestAt }),
        ...(obligation.latestAt === undefined ? {} : { latestAt: obligation.latestAt }),
        blockers: [],
      };
    }

    case 'personal_goal': {
      const goal = (snapshot.goals ?? []).find((g) => g.id === obligation.sourceId);
      let score = obligation.priority;
      const reasons = ['goal_active'];
      if (traits.spontaneity >= 70) {
        score += INTENT_TRAIT_NUDGE;
        reasons.push('spontaneous');
      }
      if (opportunitySourceId && goal && SOCIAL_GOAL_KINDS.has(goal.kind)) {
        score += INTENT_OPPORTUNITY_BONUS;
        reasons.push(`opportunity:${opportunitySourceId}`);
      }
      return {
        kind: 'pursue_personal_goal',
        sourceKind: 'personal_goal',
        ...(obligation.sourceId === undefined ? {} : { sourceId: obligation.sourceId }),
        score,
        reasons,
        blockers: [],
      };
    }

    case 'world_event':
    case 'commerce':
    default:
      // World-event opportunities influence scoring through the boost above;
      // they never become direct intents (no destination to execute). Commerce
      // is reserved and currently unemitted.
      return null;
  }
}

function restCandidate(snapshot: LifeMatrixSnapshot): Candidate | null {
  const bands = snapshot.pressure;
  const needs = bands.activeNeeds ?? [];
  const reasons: string[] = [];
  if (bands.fatigueBand === 'exhausted') reasons.push('needs_rest');
  else if (bands.fatigueBand === 'tired') reasons.push('fatigued');
  if (bands.stressBand === 'overwhelmed') reasons.push('overwhelmed');
  if (needs.includes('rest')) reasons.push('needs_rest');
  if (reasons.length === 0) return null;
  return {
    kind: 'rest_or_sleep',
    score: INTENT_REST_PRIORITY,
    reasons,
    earliestAt: snapshot.atMinute,
    blockers: [],
  };
}

function shopCandidate(snapshot: LifeMatrixSnapshot): Candidate | null {
  const needs = snapshot.pressure.activeNeeds ?? [];
  const need = needs.find((n) => n === 'meal' || n === 'errand');
  if (!need) return null;
  return {
    kind: 'shop_for_need',
    activity: need,
    score: 45,
    reasons: [`need:${need}`],
    blockers: [],
  };
}

function stayCandidate(snapshot: LifeMatrixSnapshot, obligations: CharacterObligation[]): Candidate {
  const routineExists = obligations.some((o) => o.sourceKind === 'routine');
  const currentLabel = snapshot.agenda.find(
    (entry) =>
      entry.day === snapshot.day &&
      entry.startMinute <= snapshot.minuteOfDay &&
      snapshot.minuteOfDay < (entry.endMinute ?? entry.startMinute),
  )?.label;
  if (!routineExists) {
    return {
      kind: 'stay_current_activity',
      score: 5,
      reasons: ['nothing_scheduled'],
      blockers: [],
    };
  }
  return {
    kind: 'stay_current_activity',
    ...(currentLabel === undefined ? {} : { activity: currentLabel }),
    score: INTENT_ROUTINE_FLOW_PRIORITY,
    reasons: [currentLabel === undefined ? 'routine_flow' : 'routine_current'],
    blockers: [],
  };
}

/**
 * Select the actor's current intent from a Life Matrix snapshot. Pure:
 * same snapshot in, same intent out; nothing outside this return value is
 * touched. Returns null only when the snapshot itself is missing (the
 * caller mirrors buildLifeMatrixSnapshot's null contract).
 */
export function selectCharacterIntent(snapshot: LifeMatrixSnapshot): CharacterIntent | null {
  const obligations = buildCharacterObligations(snapshot);
  const opportunity = (snapshot.eventEffects ?? []).find(
    (effect) => effect.domain === 'life' && effect.kind.endsWith('_opportunity'),
  );
  const opportunitySourceId = opportunity ? opportunity.sourceEventId : null;

  const candidates: Candidate[] = [];
  for (const obligation of obligations) {
    const candidate = candidateForObligation(snapshot, obligation, opportunitySourceId);
    if (candidate) candidates.push(candidate);
  }
  const rest = restCandidate(snapshot);
  if (rest) candidates.push(rest);
  const shop = shopCandidate(snapshot);
  if (shop) candidates.push(shop);
  candidates.push(stayCandidate(snapshot, obligations));

  // Stable descending pick: ties keep obligation order, inertia comes last.
  const ranked = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => b.candidate.score - a.candidate.score || a.index - b.index);
  const winner = ranked[0]?.candidate;
  if (!winner) return null;

  let reevaluateAtMinute = snapshot.atMinute + INTENT_REEVALUATE_HORIZON_MINUTES;
  for (const obligation of obligations) {
    if (obligation.earliestAt !== undefined && obligation.earliestAt > snapshot.atMinute) {
      reevaluateAtMinute = Math.min(reevaluateAtMinute, obligation.earliestAt);
    }
  }

  return {
    actorId: snapshot.actorId,
    kind: winner.kind,
    ...(winner.sourceKind === undefined ? {} : { sourceKind: winner.sourceKind }),
    ...(winner.sourceId === undefined ? {} : { sourceId: winner.sourceId }),
    ...(winner.targetPlaceId === undefined ? {} : { targetPlaceId: winner.targetPlaceId }),
    ...(winner.targetActorId === undefined ? {} : { targetActorId: winner.targetActorId }),
    ...(winner.activity === undefined ? {} : { activity: winner.activity }),
    priority: winner.score,
    reasons: [...winner.reasons],
    ...(winner.earliestAt === undefined ? {} : { earliestAt: winner.earliestAt }),
    ...(winner.latestAt === undefined ? {} : { latestAt: winner.latestAt }),
    blockers: [...winner.blockers],
    reevaluateAtMinute,
  };
}
