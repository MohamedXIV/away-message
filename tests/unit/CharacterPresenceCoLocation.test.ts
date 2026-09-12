import { describe, expect, it } from 'vitest';
import { resolveCharacterPresence } from '../../src/engine/life';

describe('coherent character presence co-location (#45)', () => {
  it('does not claim in-person interaction when the player place is unknown', () => {
    const result = resolveCharacterPresence({
      actorId: 'local-npc',
      place: { status: 'at_place', placeId: 'cafe' },
      legacyPresence: { status: 'away', awayMessage: 'out' },
      reach: 'local',
    });

    expect(result.availability.canInteractInPerson).toBe(false);
    expect(result.reasonCodes).toContain('player_place_unknown');
  });
});
