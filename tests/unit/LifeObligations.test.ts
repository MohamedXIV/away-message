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
});
