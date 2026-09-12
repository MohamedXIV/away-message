import { describe, expect, it } from 'vitest';
import { resolveCharacterPresence } from '../../src/engine/life';

describe('coherent character presence remote reach (#45)', () => {
  it('never projects a remote buddy into a stale local place', () => {
    const result = resolveCharacterPresence({
      actorId: 'remote-npc',
      place: { status: 'at_place', placeId: 'cafe' },
      legacyPresence: { status: 'online', awayMessage: '' },
      reach: 'remote',
      playerPlaceId: 'cafe',
    });

    expect(result.physical).toEqual({ kind: 'remote' });
    expect(result.availability.canInteractInPerson).toBe(false);
    expect(result.reasonCodes).toContain('remote_reach');
  });
});
