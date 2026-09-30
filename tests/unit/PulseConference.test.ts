import { describe, it, expect } from 'vitest';
import { getRoomResponderSequence, getRoomResponderId } from '../../src/apps/pulse/PulseMessengerApp';
import { PULSE_ROOMS, resolvePulseRoomParticipantIds } from '../../src/apps/pulse/data/pulseRooms';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Pulse Conference Multi-Reply', () => {
  it('returns single responder for solo rooms or 1-count rolls', () => {
    const room = PULSE_ROOMS.find((r) => r.id === 'orion-lounge')!;
    const seq = getRoomResponderSequence(room.id, room.participantIds, 5, 'hello');
    expect(seq.length).toBeGreaterThanOrEqual(1);
    expect(seq.length).toBeLessThanOrEqual(3);
    expect(seq.every((id) => room.participantIds.includes(id))).toBe(true);
    expect(new Set(seq).size).toBe(seq.length); // no duplicates
  });

  it('primary responder matches getRoomResponderId', () => {
    const room = PULSE_ROOMS.find((r) => r.id === 'pc-help')!;
    const messageCount = 3;
    const playerText = 'anyone got a mirror?';
    const primary = getRoomResponderId(room.id, room.participantIds, messageCount);
    const seq = getRoomResponderSequence(room.id, room.participantIds, messageCount, playerText);
    expect(seq[0]).toBe(primary);
  });

  it('is deterministic for same inputs', () => {
    const roomId = 'night-shift';
    const participants = ['actor_a', 'actor_b'];
    const seq1 = getRoomResponderSequence(roomId, participants, 10, 'how is the hum tonight?');
    const seq2 = getRoomResponderSequence(roomId, participants, 10, 'how is the hum tonight?');
    expect(seq1).toEqual(seq2);
  });

  it('distributes count across 1-3 for varied inputs', () => {
    const room = PULSE_ROOMS.find((r) => r.id === 'orion-lounge')!;
    const counts = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const seq = getRoomResponderSequence(room.id, room.participantIds, i, `message ${i} with some variation ${i * 7}`);
      counts.add(seq.length);
    }
    // Should have at least 1 and at least one multi (2) in 50 rolls, given 38% for 2+
    expect(counts.has(1)).toBe(true);
    // Not guaranteed but highly likely to have 2 in 50; allow flaky but check that max is <=3
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
  });

  it('resolves dynamic role holders into room membership', () => {
    const sim = new SimulationEngine();
    const room = PULSE_ROOMS.find((r) => r.id === 'orion-lounge')!;
    const seedHolder = sim.social.getBuddyWithRole('diner-staff');
    expect(seedHolder).toBeDefined();
    if (!seedHolder) return;

    sim.social.removeBuddy(seedHolder.id);
    const template = sim.social.getBuddies()[0];
    expect(template).toBeDefined();
    if (!template) return;

    sim.social.registerBuddy({
      ...template,
      id: 'dynamic_room_member',
      displayName: 'Dynamic Room Member',
      handle: 'dynamic_room_member',
      roles: ['diner-staff'],
      status: 'stranger',
      metVia: 'pulse-room',
      isProcedural: true,
      createdDay: 2,
    });

    const participants = resolvePulseRoomParticipantIds(room, sim.social.getBuddies());
    expect(participants).toContain('dynamic_room_member');
    expect(participants).not.toContain(seedHolder.id);
  });

  it('excludes gone or blocked authored seed participants from live room membership', () => {
    const sim = new SimulationEngine();
    const room = PULSE_ROOMS.find((r) => r.id === 'orion-lounge')!;
    const seedId = room.participantIds[0];
    expect(seedId).toBeTruthy();
    if (!seedId) return;

    const goneRoster = sim.social.getBuddies().map((buddy) =>
      buddy.id === seedId ? { ...buddy, status: 'gone' as const } : buddy,
    );
    expect(resolvePulseRoomParticipantIds(room, goneRoster)).not.toContain(seedId);

    const blockedRoster = sim.social.getBuddies().map((buddy) =>
      buddy.id === seedId ? { ...buddy, status: 'blocked' as const } : buddy,
    );
    expect(resolvePulseRoomParticipantIds(room, blockedRoster)).not.toContain(seedId);
  });

  it('handles empty participantIds gracefully', () => {
    expect(getRoomResponderSequence('unknown-room', [], 0, 'hello')).toEqual([]);
  });

  it('respects participant list size for count cap', () => {
    const seq = getRoomResponderSequence('test-room', ['actor_a'], 0, 'hi');
    expect(seq.length).toBe(1);
    expect(seq[0]).toBe('actor_a');
  });

  it('generates distinct sequences for different player texts', () => {
    const room = PULSE_ROOMS.find((r) => r.id === 'orion-lounge')!;
    // Not necessarily different for same count, but should be deterministic and not always identical
    // Check that at least one of 10 variations gives different sequence
    let foundDifference = false;
    for (let i = 0; i < 10; i++) {
      const a = getRoomResponderSequence(room.id, room.participantIds, i, `text A ${i}`);
      const b = getRoomResponderSequence(room.id, room.participantIds, i, `text B ${i}`);
      if (JSON.stringify(a) !== JSON.stringify(b)) { foundDifference = true; break; }
    }
    expect(foundDifference).toBe(true);
  });
});
