import { describe, expect, it } from 'vitest';
import type { LifeMatrixSnapshot } from '../../src/engine/life/types';

describe('Life Matrix semantic contracts', () => {
  it('can represent an actor without owning source-system state', () => {
    const snapshot: LifeMatrixSnapshot = {
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

    expect(snapshot.actorId).toBe('sam');
    expect(snapshot.appointments).toEqual([]);
  });
});
