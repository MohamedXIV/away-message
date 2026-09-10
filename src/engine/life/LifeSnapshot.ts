import type { LifeSources } from './LifeSources';
import type {
  LifeMatrixSnapshot,
  LifeRelationshipView,
  LifeRoutineWindow,
} from './types';

interface SourceRoutineBlock {
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  status: string;
  awayMessage: string;
}

function isSourceRoutineBlock(value: unknown): value is SourceRoutineBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<SourceRoutineBlock>;
  return (
    typeof block.startMinuteOfDay === 'number' &&
    Number.isFinite(block.startMinuteOfDay) &&
    typeof block.endMinuteOfDay === 'number' &&
    Number.isFinite(block.endMinuteOfDay) &&
    typeof block.status === 'string' &&
    typeof block.awayMessage === 'string'
  );
}

function cloneRelationship(value: LifeRelationshipView | null): LifeRelationshipView | null {
  return value ? { ...value } : null;
}

function projectRoutineWindows(
  schedule: Record<number, unknown[]>,
  day: number,
): LifeRoutineWindow[] {
  const weeklyDay = ((day - 1) % 7) + 1;
  const blocks = schedule[day] ?? schedule[weeklyDay] ?? schedule[1] ?? [];

  return blocks.filter(isSourceRoutineBlock).map((block) => ({
    day,
    startMinute: block.startMinuteOfDay,
    endMinute: block.endMinuteOfDay,
    status: block.status,
    awayMessage: block.awayMessage,
  }));
}

export function buildLifeMatrixSnapshot(
  sources: LifeSources,
  actorId: string,
  atMinute: number,
): LifeMatrixSnapshot | null {
  const buddy = sources.getBuddy(actorId);
  if (!buddy) return null;

  const day = Math.max(1, Math.floor(atMinute / 1440) + 1);
  const minuteOfDay = ((atMinute % 1440) + 1440) % 1440;

  return {
    actorId,
    atMinute,
    day,
    minuteOfDay,
    traits: { ...sources.getTraits(actorId) },
    playerRelationship: cloneRelationship(sources.getPlayerRelationship(actorId)),
    notableNpcBonds: sources.getNpcBonds(actorId).map((bond) => ({ ...bond })),
    promises: sources.getPromises(actorId).map((promise) => ({ ...promise })),
    routineWindows: projectRoutineWindows(buddy.schedule, day),
    agenda: sources.getAgenda(actorId, day).map((entry) => ({ ...entry })),
    appointments: sources
      .getAppointments()
      .filter((appointment) => appointment.characterId === actorId)
      .map((appointment) => ({ ...appointment })),
    worldEvents: sources.getTriggeredEvents().map((event) => ({ ...event })),
    presence: { ...sources.getPresence(actorId) },
    pressure: sources.getPressure ? { ...sources.getPressure(actorId, atMinute) } : {},
    goals: sources.getGoals ? sources.getGoals(actorId).map((goal) => ({ ...goal })) : [],
    ...(sources.getFidelityTier ? { fidelityTier: sources.getFidelityTier(actorId) } : {}),
  };
}
