import { describe, expect, it } from 'vitest';
import { buildCharacterObligations } from '../../src/engine/life/Obligations';
import type {
  CharacterObligation,
  LifeMatrixSnapshot,
} from '../../src/engine/life/types';

function emptyLifeSnapshot(): LifeMatrixSnapshot {
  return {
    actorId: 'sam',
    atMinute: 600,
    day: 1,
    minuteOfDay: 600,
    traits: {
      shyness: 40,
      warmth: 55,
      discipline: 80,
      spontaneity: 30,
      loyalty: 70,
    },
    playerRelationship: null,
    notableNpcBonds: [],
    promises: [],
    routineWindows: [],
    agenda: [],
    appointments: [],
    worldEvents: [],
    presence: { messengerStatus: 'offline' },
    pressure: {},
  };
}

describe('CharacterObligation semantic contracts', () => {
  it('represents source ownership without copying source-system outcomes', () => {
    const obligation: CharacterObligation = {
      id: 'appointment:sam:appt_1',
      actorId: 'sam',
      sourceKind: 'appointment',
      sourceId: 'appt_1',
      preferredAt: 720,
      earliestAt: 720,
      latestAt: 780,
      destinationPlaceId: 'cafe',
      priority: 80,
      flexibility: 'fixed',
      status: 'pending',
    };

    expect(obligation.sourceKind).toBe('appointment');
    expect('wage' in obligation).toBe(false);
    expect('rsvp' in obligation).toBe(false);
  });

  it('is deterministic and duplicate-free for an empty source snapshot', () => {
    const snapshot = emptyLifeSnapshot();

    const first = buildCharacterObligations(snapshot);
    const second = buildCharacterObligations(snapshot);

    expect(first).toEqual([]);
    expect(second).toEqual(first);
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
  });

  it('uses current agenda as the routine planning view instead of duplicating raw routine windows', () => {
    const snapshot = emptyLifeSnapshot();
    snapshot.agenda = [
      {
        id: 'agenda_1',
        kind: 'work',
        label: 'Morning shift',
        day: 1,
        startMinute: 600,
        endMinute: 660,
      },
    ];
    snapshot.routineWindows = [
      {
        day: 1,
        startMinute: 540,
        endMinute: 1020,
        status: 'away',
        awayMessage: 'at work',
      },
    ];

    expect(buildCharacterObligations(snapshot)).toEqual([
      {
        id: 'routine:sam:agenda:agenda_1',
        actorId: 'sam',
        sourceKind: 'routine',
        sourceId: 'agenda_1',
        preferredAt: 600,
        earliestAt: 600,
        latestAt: 660,
        priority: 50,
        flexibility: 'fixed',
        status: 'planned',
      },
    ]);
  });

  it('falls back to schedule windows when no current agenda exists', () => {
    const snapshot = emptyLifeSnapshot();
    snapshot.routineWindows = [
      {
        day: 1,
        startMinute: 540,
        endMinute: 1020,
        status: 'away',
        awayMessage: 'at work',
      },
    ];

    expect(buildCharacterObligations(snapshot)).toEqual([
      {
        id: 'routine:sam:1:540:1020',
        actorId: 'sam',
        sourceKind: 'routine',
        preferredAt: 540,
        earliestAt: 540,
        latestAt: 1020,
        priority: 40,
        flexibility: 'fixed',
        status: 'planned',
      },
    ]);
  });

  it('projects one appointment exactly once and reflects owner status changes without stale state', () => {
    const snapshot = emptyLifeSnapshot();
    snapshot.appointments = [
      {
        id: 'appt_1',
        characterId: 'sam',
        locationId: 'cafe',
        targetDay: 1,
        startMinute: 720,
        endMinute: 780,
        status: 'confirmed',
        rsvp: 'yes',
      },
    ];

    const pending = buildCharacterObligations(snapshot);
    expect(pending).toEqual([
      {
        id: 'appointment:sam:appt_1',
        actorId: 'sam',
        sourceKind: 'appointment',
        sourceId: 'appt_1',
        preferredAt: 720,
        earliestAt: 720,
        latestAt: 780,
        destinationPlaceId: 'cafe',
        priority: 80,
        flexibility: 'fixed',
        status: 'pending',
      },
    ]);
    expect(new Set(pending.map((item) => item.id)).size).toBe(1);

    snapshot.appointments[0] = { ...snapshot.appointments[0]!, status: 'cancelled' };
    const cancelled = buildCharacterObligations(snapshot);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]?.id).toBe('appointment:sam:appt_1');
    expect(cancelled[0]?.status).toBe('cancelled');
  });

  it('turns only dated open promises into bounded obligations', () => {
    const snapshot = emptyLifeSnapshot();
    snapshot.promises = [
      { id: 'promise_dated', text: 'Bring the old magazine', dueDay: 2, fulfilled: false },
      { id: 'promise_memory', text: 'I will remember that story', fulfilled: false },
    ];

    expect(buildCharacterObligations(snapshot)).toEqual([
      {
        id: 'promise:sam:promise_dated',
        actorId: 'sam',
        sourceKind: 'promise',
        sourceId: 'promise_dated',
        earliestAt: 600,
        latestAt: 2879,
        priority: 60,
        flexibility: 'bounded',
        status: 'pending',
      },
    ]);
  });

  it('returns a stable chronological order regardless of source array order', () => {
    const snapshot = emptyLifeSnapshot();
    snapshot.promises = [
      { id: 'later_promise', text: 'Do it tomorrow', dueDay: 2, fulfilled: false },
    ];
    snapshot.appointments = [
      {
        id: 'appt_early',
        characterId: 'sam',
        locationId: 'cafe',
        targetDay: 1,
        startMinute: 700,
        endMinute: 760,
        status: 'scheduled',
      },
    ];
    snapshot.agenda = [
      {
        id: 'agenda_mid',
        kind: 'errand',
        label: 'Pick something up',
        day: 1,
        startMinute: 800,
        endMinute: 850,
      },
    ];

    const ids = buildCharacterObligations(snapshot).map((item) => item.id);
    expect(ids).toEqual([
      'promise:sam:later_promise',
      'appointment:sam:appt_early',
      'routine:sam:agenda:agenda_mid',
    ]);
    expect(buildCharacterObligations(snapshot).map((item) => item.id)).toEqual(ids);
  });
});
