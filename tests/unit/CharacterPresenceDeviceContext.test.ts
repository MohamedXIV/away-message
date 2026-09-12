import { describe, expect, it } from 'vitest';
import {
  resolveCharacterPresence,
  type CharacterMessagingDeviceContext,
} from '../../src/engine/life';

describe('coherent character presence device context (#45)', () => {
  it('does not claim online_active when authoritative device context says none', () => {
    const noDeviceContext: CharacterMessagingDeviceContext = 'none';
    const result = resolveCharacterPresence({
      actorId: 'no-device-npc',
      place: { status: 'at_place', placeId: 'cafe' },
      legacyPresence: { status: 'online', awayMessage: 'legacy online' },
      reach: 'local',
      messagingDeviceContext: noDeviceContext,
    });

    expect(result.communication.status).toBe('online_idle');
    expect(result.reasonCodes).toContain('no_active_device_context');
  });

  it('keeps legacy online compatibility when device context is not yet supplied', () => {
    const result = resolveCharacterPresence({
      actorId: 'legacy-device-unknown',
      place: { status: 'at_place', placeId: 'home' },
      legacyPresence: { status: 'online', awayMessage: 'online' },
      reach: 'local',
    });

    expect(result.communication.status).toBe('online_active');
    expect(result.reasonCodes).not.toContain('no_active_device_context');
  });
});
