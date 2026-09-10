import { describe, expect, it } from 'vitest';
import { createLifeSources } from '../../src/engine/life/LifeSources';
import { buildLifeMatrixSnapshot } from '../../src/engine/life/LifeSnapshot';

function makeSources() {
  const relationship = {
    targetId: 'player',
    familiarity: 20,
    trust: 30,
    comfort: 25,
    respect: 40,
    annoyance: 2,
    affection: 5,
    attraction: 0,
    suspicion: 1,
    resentment: 0,
  };
  const bond = { ...relationship, targetId: 'lee' };
  const promises = [{ id: 'promise_1', text: 'Bring the CD', dueDay: 2, fulfilled: false }];
  const agenda = [{ id: 'agenda_1', kind: 'errand', label: 'Buy groceries', day: 1, startMinute: 600, endMinute: 660 }];
  const appointments = [
    { id: 'appt_1', characterId: 'sam', locationId: 'cafe', targetDay: 1, startMinute: 720 },
    { id: 'appt_other', characterId: 'lee', locationId: 'diner', targetDay: 1, startMinute: 900 },
  ];
  const events = [{ id: 'event_1', title: 'Canal market', category: 'local', triggerDay: 1, triggeredAtMinute: 500 }];
  const actor = {
    id: 'sam',
    schedule: {
      1: [
        {
          startMinuteOfDay: 540,
          endMinuteOfDay: 1020,
          status: 'away',
          awayMessage: 'at work',
        },
      ],
    },
  };

  const sources = createLifeSources({
    getBuddy: (id) => (id === 'sam' ? actor : undefined),
    getTraits: () => ({ shyness: 40, warmth: 55, discipline: 80, spontaneity: 30, loyalty: 70 }),
    getPlayerRelationship: () => relationship,
    getNpcBonds: () => [bond],
    getPromises: () => promises,
    getAgenda: () => agenda,
    getPresence: () => ({ messengerStatus: 'away', awayMessage: 'at work' }),
    getAppointments: () => appointments,
    getTriggeredEvents: () => events,
  });

  return { sources, relationship, bond, promises, agenda, appointments, events, actor };
}

describe('Life Matrix snapshot projection', () => {
  it('projects deterministic source-backed values for one actor and time', () => {
    const { sources } = makeSources();

    const a = buildLifeMatrixSnapshot(sources, 'sam', 600);
    const b = buildLifeMatrixSnapshot(sources, 'sam', 600);

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a?.day).toBe(1);
    expect(a?.minuteOfDay).toBe(600);
    expect(a?.appointments.map((item) => item.id)).toEqual(['appt_1']);
    expect(a?.agenda.map((item) => item.id)).toEqual(['agenda_1']);
    expect(a?.routineWindows).toEqual([
      { day: 1, startMinute: 540, endMinute: 1020, status: 'away', awayMessage: 'at work' },
    ]);
  });

  it('returns null for an actor that does not exist', () => {
    const { sources } = makeSources();
    expect(buildLifeMatrixSnapshot(sources, 'ghost', 600)).toBeNull();
  });

  it('returns defensive copies instead of source-owned nested references', () => {
    const { sources, relationship, promises, agenda, appointments, events } = makeSources();
    const first = buildLifeMatrixSnapshot(sources, 'sam', 600);
    expect(first).not.toBeNull();

    (first!.playerRelationship as { trust: number }).trust = 99;
    (first!.promises as Array<{ text: string }>)[0]!.text = 'changed';
    (first!.agenda as Array<{ label: string }>)[0]!.label = 'changed';
    (first!.appointments as Array<{ locationId: string }>)[0]!.locationId = 'changed';
    (first!.worldEvents as Array<{ title: string }>)[0]!.title = 'changed';

    const rebuilt = buildLifeMatrixSnapshot(sources, 'sam', 600);
    expect(relationship.trust).toBe(30);
    expect(promises[0]!.text).toBe('Bring the CD');
    expect(agenda[0]!.label).toBe('Buy groceries');
    expect(appointments[0]!.locationId).toBe('cafe');
    expect(events[0]!.title).toBe('Canal market');
    expect(rebuilt?.playerRelationship?.trust).toBe(30);
  });

  it('uses the existing exact-day then weekly-day then day-one schedule fallback', () => {
    const { sources } = makeSources();

    const dayEight = buildLifeMatrixSnapshot(sources, 'sam', 7 * 1440 + 600);

    expect(dayEight?.day).toBe(8);
    expect(dayEight?.routineWindows).toEqual([
      { day: 8, startMinute: 540, endMinute: 1020, status: 'away', awayMessage: 'at work' },
    ]);
  });
});
