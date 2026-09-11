import type {
  FatigueBand,
  FidelityTier,
  GoalKind,
  GoalStatus,
  MoneyBand,
  NpcLifeEntry,
  NpcLifePersistedState,
  NpcPressureState,
  PersonalGoal,
  StressBand,
} from './types';
import { MAX_ACTIVE_GOALS_PER_ACTOR } from './Goals';

const VALID_GOAL_KINDS = new Set<GoalKind>([
  'save_purchase',
  'find_work',
  'improve_relationship',
  'distance_relationship',
  'spend_time',
  'attend_event',
  'practical_task',
  'upgrade_gear',
  'change_circumstance',
]);

const VALID_GOAL_STATUSES = new Set<GoalStatus>(['active', 'completed', 'paused', 'abandoned']);

const VALID_FATIGUE_BANDS = new Set<FatigueBand>(['rested', 'normal', 'tired', 'exhausted']);
const VALID_STRESS_BANDS = new Set<StressBand>(['calm', 'normal', 'stressed', 'overwhelmed']);

export function serializePersonalGoals(goals: PersonalGoal[]): string {
  return JSON.stringify(goals);
}

export function hydratePersonalGoals(data: unknown): PersonalGoal[] {
  if (!data) return [];

  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const validGoals: PersonalGoal[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Partial<PersonalGoal>;

    if (
      typeof g.id === 'string' &&
      typeof g.actorId === 'string' &&
      typeof g.kind === 'string' &&
      VALID_GOAL_KINDS.has(g.kind as GoalKind) &&
      typeof g.description === 'string' &&
      typeof g.priority === 'number' &&
      typeof g.status === 'string' &&
      VALID_GOAL_STATUSES.has(g.status as GoalStatus) &&
      typeof g.progress === 'number'
    ) {
      validGoals.push({
        id: g.id,
        actorId: g.actorId,
        kind: g.kind as GoalKind,
        description: g.description,
        ...(g.targetId ? { targetId: g.targetId } : {}),
        priority: g.priority,
        status: g.status as GoalStatus,
        progress: Math.max(0, Math.min(1, g.progress)),
        createdDay: typeof g.createdDay === 'number' ? g.createdDay : 1,
        ...(typeof g.targetDay === 'number' ? { targetDay: g.targetDay } : {}),
        ...(g.metadata ? { metadata: { ...g.metadata } } : {}),
      });
    }
  }

  return validGoals;
}

export function serializeNpcPressure(pressure: NpcPressureState): string {
  return JSON.stringify(pressure);
}

export function hydrateNpcPressure(
  data: unknown,
  fallbackActorId?: string,
): NpcPressureState | null {
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Partial<NpcPressureState>;
    if (
      typeof p.actorId === 'string' &&
      typeof p.fatigueBand === 'string' &&
      VALID_FATIGUE_BANDS.has(p.fatigueBand as FatigueBand) &&
      typeof p.stressBand === 'string' &&
      VALID_STRESS_BANDS.has(p.stressBand as StressBand)
    ) {
      return {
        actorId: p.actorId,
        fatigueBand: p.fatigueBand as FatigueBand,
        stressBand: p.stressBand as StressBand,
        mood: p.mood ?? 'neutral',
        interruptionTolerance: p.interruptionTolerance ?? 'open',
        ...(p.moneyBand ? { moneyBand: p.moneyBand as MoneyBand } : {}),
        activeNeeds: Array.isArray(p.activeNeeds) ? [...p.activeNeeds] : [],
        lastUpdatedMinute: typeof p.lastUpdatedMinute === 'number' ? p.lastUpdatedMinute : 0,
        tier: (p.tier as FidelityTier) ?? 'important_local',
        ...(typeof p.cumulativeWorkMinutes === 'number'
          ? { cumulativeWorkMinutes: p.cumulativeWorkMinutes }
          : {}),
      };
    }
  }

  if (fallbackActorId) {
    return {
      actorId: fallbackActorId,
      fatigueBand: 'normal',
      stressBand: 'normal',
      mood: 'neutral',
      interruptionTolerance: 'open',
      activeNeeds: [],
      lastUpdatedMinute: 0,
      tier: 'important_local',
    };
  }

  return null;
}

/** Empty canonical slice for fresh saves (old saves hydrate to this shape). */
export function emptyNpcLives(): NpcLifePersistedState {
  return {};
}

export function serializeNpcLives(state: NpcLifePersistedState): string {
  return JSON.stringify(state);
}

/**
 * Hydrate the canonical #43 slice. Accepts a parsed object or JSON string;
 * entries survive only with valid pressure or at least one valid goal, and
 * goals stay bounded. Malformed rows are dropped per project policy —
 * callers fall back to deterministic defaults for missing actors.
 */
export function hydrateNpcLives(data: unknown): NpcLifePersistedState {
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const out: NpcLifePersistedState = {};
  for (const [actorId, rawEntry] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof actorId !== 'string' || actorId === '') continue;
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Partial<NpcLifeEntry>;
    const goals = hydratePersonalGoals(entry.goals).slice(0, MAX_ACTIVE_GOALS_PER_ACTOR);
    const pressure = hydrateNpcPressure(entry.pressure);
    if (!pressure && goals.length === 0) continue;
    out[actorId] = {
      goals,
      pressure: pressure ?? {
        actorId,
        fatigueBand: 'normal',
        stressBand: 'normal',
        mood: 'neutral',
        interruptionTolerance: 'open',
        activeNeeds: [],
        lastUpdatedMinute: 0,
        tier: 'important_local',
      },
    };
  }
  return out;
}
