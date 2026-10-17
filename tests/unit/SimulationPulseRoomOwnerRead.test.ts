import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';
import { PULSE_ROOMS, resolvePulseRoomParticipantIds } from '../../src/apps/pulse/data/pulseRooms';
import { collectMissedPresenceActivities } from '../../src/apps/pulse/PulseMessengerApp';

describe('#172 source-owned Pulse room membership and login roster', () => {
  it('preserves every room resolver result at 500 actors without any full roster getter', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const selected = game.social.getBuddies().slice(0, 3);
    expect(selected).toHaveLength(3);
    const custom = {
      participantIds: [selected[0]!.id, 'unknown_actor', selected[0]!.id],
      participantRoles: [...(selected[1]!.roles ?? []), 'not-a-role'],
    };
    const rooms = [...PULSE_ROOMS, custom];
    const expected = rooms.map(room => resolvePulseRoomParticipantIds(room as typeof PULSE_ROOMS[number], game.social.getBuddies()));
    const roster = vi.spyOn(game.social, 'getBuddies');
    const buddy = vi.spyOn(game.social, 'getBuddy');
    const social = vi.spyOn(game.social, 'getState');
    const full = vi.spyOn(game, 'getState');
    const actual = rooms.map(room => game.social.getPulseRoomParticipantIdsRead(room));
    expect(actual).toEqual(expected);
    expect(actual.every(ids => ids.every(id => typeof id === 'string'))).toBe(true);
    expect(JSON.parse(JSON.stringify(actual))).toEqual(actual);
    actual[0]!.push('forged_ui_member');
    expect(game.social.getPulseRoomParticipantIdsRead(PULSE_ROOMS[0]!)).toEqual(expected[0]);
    expect(roster).not.toHaveBeenCalled();
    expect(buddy).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
  }, 30_000);

  it('matches legacy explicit members, roles and gone/blocked exclusions', () => {
    const game = new SimulationEngine();
    const actors = game.social.getBuddies().slice(0, 3);
    const room = {
      participantIds: [actors[0]!.id, actors[1]!.id, actors[0]!.id, 'missing_actor'],
      participantRoles: actors[2]!.roles ?? [],
    };
    const verify = () => expect(game.social.getPulseRoomParticipantIdsRead(room))
      .toEqual(resolvePulseRoomParticipantIds(room as typeof PULSE_ROOMS[number], game.social.getBuddies()));
    verify();
    game.social.setActorCondition(actors[0]!.id, { lifecycle: 'departed', contact: 'open' });
    game.social.setActorCondition(actors[1]!.id, { lifecycle: 'active', contact: 'blocked' });
    verify();
    game.social.setActorCondition(actors[0]!.id, { lifecycle: 'active', contact: 'distant' });
    verify();
    const empty = game.social.getPulseRoomParticipantIdsRead({ participantIds: ['missing_actor'], participantRoles: [] });
    expect(empty).toEqual([]);
  });

  it('one detached login roster resolves missed presence exactly like repeated per-ID buddy reads', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const roster = game.social.getBuddies();
    const blocked = new Set([roster[2]!.id, roster[10]!.id]);
    const available = roster.filter(buddy => !blocked.has(buddy.id));
    const ids = available.map(buddy => buddy.id);
    const byId = new Map(available.map(buddy => [buddy.id, buddy] as const));
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      const lastSeen = 100;
      const current = 3200;
      const reference = collectMissedPresenceActivities(lastSeen, current, id => game.social.getBuddy(id) as any, ids);
      const read = vi.spyOn(game.social, 'getBuddy');
      const actual = collectMissedPresenceActivities(lastSeen, current, id => byId.get(id), ids);
      expect(actual).toEqual(reference);
      expect(actual).toHaveLength(reference.length);
      expect(read).not.toHaveBeenCalled();
      const referenceWarmth = [...available]
        .sort((a, b) => game.social.getTraits(b.id).warmth - game.social.getTraits(a.id).warmth)
        .slice(0, 2).map(buddy => buddy.id);
      const optimizedWarmth = new Set([...available]
        .sort((a, b) => game.social.getTraits(b.id).warmth - game.social.getTraits(a.id).warmth)
        .slice(0, 2).map(buddy => buddy.id));
      expect([...optimizedWarmth]).toEqual(referenceWarmth);
      expect(JSON.parse(JSON.stringify(actual))).toEqual(actual);
    } finally {
      now.mockRestore();
    }
  }, 30_000);
});
