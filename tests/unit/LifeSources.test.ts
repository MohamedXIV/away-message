import { describe, expect, it } from 'vitest';
import { createLifeSources } from '../../src/engine/life/LifeSources';

describe('Life Matrix source boundary', () => {
  it('exposes reads without exposing source mutation', () => {
    const sources = createLifeSources({
      getBuddy: (id) =>
        id === 'sam'
          ? ({ id: 'sam', schedule: {} } as { id: string; schedule: Record<number, unknown[]> })
          : undefined,
      getTraits: () => ({
        shyness: 40,
        warmth: 55,
        discipline: 80,
        spontaneity: 30,
        loyalty: 70,
      }),
      getPlayerRelationship: () => null,
      getNpcBonds: () => [],
      getPromises: () => [],
      getAgenda: () => [],
      getPresence: () => ({ messengerStatus: 'offline', awayMessage: '' }),
      getAppointments: () => [],
      getTriggeredEvents: () => [],
    });

    expect(sources.getTraits('sam').discipline).toBe(80);
    expect('applySocialAction' in (sources as object)).toBe(false);
    expect('adjustNpcBond' in (sources as object)).toBe(false);
  });
});
