import type {
  FidelityTier,
  GoalKind,
  LifeMatrixSnapshot,
  LifeRelationshipView,
  LifeWorldEventView,
  PersonalGoal,
} from './types';
import type { LifeSources } from './LifeSources';

export const MAX_ACTIVE_GOALS_PER_ACTOR = 3;

export interface GoalTemplate {
  id: string;
  kind: GoalKind;
  description: string;
  basePriority: number;
  archetypeId?: string;
}

export const ARCHETYPE_GOAL_TEMPLATES: Record<string, GoalTemplate[]> = {
  coworker: [
    {
      id: 'coworker_bench_work',
      kind: 'find_work',
      description: 'Pick up extra testing and maintenance shifts',
      basePriority: 65,
      archetypeId: 'coworker',
    },
    {
      id: 'coworker_upgrade_soldering',
      kind: 'upgrade_gear',
      description: 'Upgrade soldering station and diagnostic tools',
      basePriority: 60,
      archetypeId: 'coworker',
    },
    {
      id: 'coworker_hangout',
      kind: 'spend_time',
      description: 'Grab food and decompress after work',
      basePriority: 50,
      archetypeId: 'coworker',
    },
  ],
  artist: [
    {
      id: 'artist_showcase',
      kind: 'attend_event',
      description: 'Perform or share work at an upcoming showcase',
      basePriority: 70,
      archetypeId: 'artist',
    },
    {
      id: 'artist_multitrack',
      kind: 'upgrade_gear',
      description: 'Save up for a reliable multitrack recorder',
      basePriority: 60,
      archetypeId: 'artist',
    },
    {
      id: 'artist_demo_share',
      kind: 'spend_time',
      description: 'Share listening demo tracks with close friends',
      basePriority: 55,
      archetypeId: 'artist',
    },
  ],
  nightowl: [
    {
      id: 'nightowl_radio_log',
      kind: 'practical_task',
      description: 'Catalog quiet-hour transmission logs',
      basePriority: 65,
      archetypeId: 'nightowl',
    },
    {
      id: 'nightowl_receiver_tune',
      kind: 'upgrade_gear',
      description: 'Tune antenna receiver for clearer reception',
      basePriority: 55,
      archetypeId: 'nightowl',
    },
    {
      id: 'nightowl_archive_space',
      kind: 'change_circumstance',
      description: 'Organize personal archival setup',
      basePriority: 50,
      archetypeId: 'nightowl',
    },
  ],
  regular: [
    {
      id: 'regular_books_ledger',
      kind: 'practical_task',
      description: 'Review bookkeeping and monthly accounts',
      basePriority: 65,
      archetypeId: 'regular',
    },
    {
      id: 'regular_equipment_savings',
      kind: 'save_purchase',
      description: 'Save funds for essential equipment servicing',
      basePriority: 60,
      archetypeId: 'regular',
    },
    {
      id: 'regular_neighborhood_ties',
      kind: 'improve_relationship',
      description: 'Strengthen ties with local district acquaintances',
      basePriority: 50,
      archetypeId: 'regular',
    },
  ],
  student: [
    {
      id: 'student_exam_prep',
      kind: 'practical_task',
      description: 'Prepare notes and review course material',
      basePriority: 70,
      archetypeId: 'student',
    },
    {
      id: 'student_textbook_fund',
      kind: 'save_purchase',
      description: 'Save up for reference texts and calculator',
      basePriority: 60,
      archetypeId: 'student',
    },
    {
      id: 'student_study_group',
      kind: 'spend_time',
      description: 'Meet up for late-night study sessions',
      basePriority: 55,
      archetypeId: 'student',
    },
  ],
  trader: [
    {
      id: 'trader_bulk_capital',
      kind: 'save_purchase',
      description: 'Build reserve capital for seasonal bulk orders',
      basePriority: 70,
      archetypeId: 'trader',
    },
    {
      id: 'trader_supplier_terms',
      kind: 'find_work',
      description: 'Establish better terms with wholesale suppliers',
      basePriority: 65,
      archetypeId: 'trader',
    },
    {
      id: 'trader_ticker_display',
      kind: 'upgrade_gear',
      description: 'Install secondary price monitor display',
      basePriority: 55,
      archetypeId: 'trader',
    },
  ],
};

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function initializeActorGoals(
  actorId: string,
  archetypeId: string,
  seed: string | number,
  traits: LifeMatrixSnapshot['traits'],
  existingBonds?: LifeRelationshipView[],
  events?: LifeWorldEventView[],
  tier: FidelityTier = 'important_local',
): PersonalGoal[] {
  if (tier === 'background_remote') {
    // Remote background actors hold minimal goals (at most 1)
    const templates = ARCHETYPE_GOAL_TEMPLATES[archetypeId] ?? ARCHETYPE_GOAL_TEMPLATES['regular']!;
    const t = templates[0];
    if (!t) return [];
    return [
      {
        id: `goal:${actorId}:${t.id}`,
        actorId,
        kind: t.kind,
        description: t.description,
        priority: t.basePriority,
        status: 'active',
        progress: 0,
        createdDay: 1,
      },
    ];
  }

  const templates = ARCHETYPE_GOAL_TEMPLATES[archetypeId] ?? ARCHETYPE_GOAL_TEMPLATES['regular']!;
  const seedNum = simpleHash(`${actorId}:${archetypeId}:${String(seed)}`);

  const goals: PersonalGoal[] = [];
  const count = Math.min(MAX_ACTIVE_GOALS_PER_ACTOR, Math.max(2, (seedNum % 2) + 2));

  for (let i = 0; i < count && i < templates.length; i++) {
    const template = templates[i]!;
    let priority = template.basePriority;

    // Traits deterministically modulate priority
    if (template.kind === 'practical_task' && traits.discipline >= 70) {
      priority += 5;
    }
    if ((template.kind === 'spend_time' || template.kind === 'improve_relationship') && traits.warmth >= 60) {
      priority += 5;
    }
    if (template.kind === 'upgrade_gear' && traits.spontaneity >= 60) {
      priority += 5;
    }

    let targetId: string | undefined;
    if ((template.kind === 'improve_relationship' || template.kind === 'spend_time') && existingBonds && existingBonds.length > 0) {
      targetId = existingBonds[0]?.targetId;
    } else if (template.kind === 'attend_event' && events && events.length > 0) {
      targetId = events[0]?.id;
    }

    goals.push({
      id: `goal:${actorId}:${template.id}`,
      actorId,
      kind: template.kind,
      description: template.description,
      ...(targetId ? { targetId } : {}),
      priority: Math.min(100, Math.max(1, priority)),
      status: 'active',
      progress: 0,
      createdDay: 1,
    });
  }

  return goals.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function evaluateGoalProgress(
  goal: PersonalGoal,
  sources: LifeSources,
  _atMinute: number,
): PersonalGoal {
  const updated = { ...goal };

  if (goal.targetId && (goal.kind === 'improve_relationship' || goal.kind === 'spend_time')) {
    // Read without copying authority: inspect trust/familiarity to assess progress
    const rel = sources.getPlayerRelationship(goal.actorId);
    if (goal.targetId === 'player' && rel) {
      if (rel.trust >= 50 || rel.familiarity >= 50) {
        updated.progress = Math.min(1, Math.max(updated.progress, 0.75));
      }
    } else {
      const bond = sources.getNpcBonds(goal.actorId).find((b) => b.targetId === goal.targetId);
      if (bond && (bond.trust >= 50 || bond.familiarity >= 50)) {
        updated.progress = Math.min(1, Math.max(updated.progress, 0.75));
      }
    }
  } else if (goal.targetId && goal.kind === 'attend_event') {
    const triggered = sources.getTriggeredEvents();
    if (triggered.some((e) => e.id === goal.targetId)) {
      updated.progress = 1.0;
      updated.status = 'completed';
    }
  }

  return updated;
}
