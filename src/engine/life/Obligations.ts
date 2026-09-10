import type {
  CharacterObligation,
  LifeAppointmentView,
  LifeMatrixSnapshot,
  ObligationStatus,
} from './types';

function atDayMinute(day: number, minuteOfDay: number): number {
  return (Math.max(1, Math.floor(day)) - 1) * 1440 + minuteOfDay;
}

function appointmentStatus(status: LifeAppointmentView['status']): ObligationStatus {
  if (status === 'happened') return 'satisfied';
  if (status === 'missed') return 'missed';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

function sortKey(obligation: CharacterObligation): number {
  return obligation.earliestAt ?? obligation.preferredAt ?? obligation.latestAt ?? Number.MAX_SAFE_INTEGER;
}

function stableSort(obligations: CharacterObligation[]): CharacterObligation[] {
  return obligations.sort((a, b) => {
    const timeDelta = sortKey(a) - sortKey(b);
    if (timeDelta !== 0) return timeDelta;
    const sourceDelta = a.sourceKind.localeCompare(b.sourceKind);
    return sourceDelta !== 0 ? sourceDelta : a.id.localeCompare(b.id);
  });
}

/**
 * Pure planning projection over a Life Matrix snapshot.
 *
 * It never stores outcomes or mutates the source snapshot. Agenda is the
 * preferred current-day routine planning view; raw schedule windows are only a
 * fallback so the same routine is not emitted twice.
 */
export function buildCharacterObligations(
  snapshot: LifeMatrixSnapshot,
): CharacterObligation[] {
  const obligations: CharacterObligation[] = [];
  const currentAgenda = snapshot.agenda.filter((entry) => entry.day === snapshot.day);

  if (currentAgenda.length > 0) {
    for (const entry of currentAgenda) {
      const earliestAt = atDayMinute(entry.day, entry.startMinute);
      const latestAt = atDayMinute(entry.day, entry.endMinute ?? entry.startMinute);
      obligations.push({
        id: `routine:${snapshot.actorId}:agenda:${entry.id}`,
        actorId: snapshot.actorId,
        sourceKind: 'routine',
        sourceId: entry.id,
        preferredAt: earliestAt,
        earliestAt,
        latestAt,
        priority: 50,
        flexibility: 'fixed',
        status: 'planned',
      });
    }
  } else {
    for (const window of snapshot.routineWindows.filter((entry) => entry.day === snapshot.day)) {
      const earliestAt = atDayMinute(window.day, window.startMinute);
      const latestAt = atDayMinute(window.day, window.endMinute);
      obligations.push({
        id: `routine:${snapshot.actorId}:${window.day}:${window.startMinute}:${window.endMinute}`,
        actorId: snapshot.actorId,
        sourceKind: 'routine',
        preferredAt: earliestAt,
        earliestAt,
        latestAt,
        priority: 40,
        flexibility: 'fixed',
        status: 'planned',
      });
    }
  }

  for (const appointment of snapshot.appointments) {
    if (appointment.characterId !== snapshot.actorId) continue;
    const earliestAt = atDayMinute(appointment.targetDay, appointment.startMinute);
    const latestAt = atDayMinute(
      appointment.targetDay,
      appointment.endMinute ?? appointment.startMinute,
    );
    const isJob = appointment.origin?.kind === 'job';
    obligations.push({
      id: `${isJob ? 'job' : 'appointment'}:${snapshot.actorId}:${appointment.id}`,
      actorId: snapshot.actorId,
      sourceKind: isJob ? 'job' : 'appointment',
      sourceId: isJob ? appointment.origin!.id : appointment.id,
      preferredAt: earliestAt,
      earliestAt,
      latestAt,
      destinationPlaceId: appointment.locationId,
      priority: 80,
      flexibility: 'fixed',
      status: appointmentStatus(appointment.status),
    });
  }

  for (const promise of snapshot.promises) {
    if (promise.fulfilled || promise.dueDay === undefined || !promise.id) continue;
    obligations.push({
      id: `promise:${snapshot.actorId}:${promise.id}`,
      actorId: snapshot.actorId,
      sourceKind: 'promise',
      sourceId: promise.id,
      earliestAt: snapshot.atMinute,
      latestAt: Math.max(1, Math.floor(promise.dueDay)) * 1440 - 1,
      priority: 60,
      flexibility: 'bounded',
      status: 'pending',
    });
  }

  if (snapshot.goals) {
    for (const goal of snapshot.goals) {
      if (goal.status !== 'active') continue;
      obligations.push({
        id: `goal:${snapshot.actorId}:${goal.id}`,
        actorId: snapshot.actorId,
        sourceKind: 'personal_goal',
        sourceId: goal.id,
        priority: goal.priority,
        flexibility: 'flexible',
        status: 'pending',
      });
    }
  }

  return stableSort(obligations);
}
