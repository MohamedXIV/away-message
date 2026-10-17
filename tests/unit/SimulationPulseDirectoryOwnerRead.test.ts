import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 Social-owned Pulse directory read', () => {
  it('preserves player-known contacts and public room members without cloning the roster', () => {
    const game = new SimulationEngine();
    const roster = game.social.getBuddies();
    const known = roster[0]!;
    // Seed actors can be authored as already known; create an explicitly
    // undiscovered attendee instead of assuming roster index 1 is private.
    const publicOnly = game.social.registerBuddy({
      ...roster[1]!,
      id: 'pulse_public_unknown_172',
      handle: 'pulse_public_unknown_172',
      displayName: 'Undiscovered Public Attendee',
      status: 'stranger',
      backstory: undefined,
      roles: [],
    });
    expect(game.social.learnHandle(known.id, known.handle)).toBe(true);
    expect(game.social.isKnown(publicOnly.id)).toBe(false);
    const rooms = [
      { id: 'invited', participantIds: [publicOnly.id], participantRoles: [] },
      { id: 'friends', participantIds: [known.id], participantRoles: [] },
      { id: 'empty', participantIds: [], participantRoles: [] },
    ];
    const full = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const rosterRead = vi.spyOn(game.social, 'getBuddies');
    const singleBuddy = vi.spyOn(game.social, 'getBuddy');
    const revision = game.getRevision();
    const view = game.getPulseContactsRead(rooms);

    expect(view.revision).toBe(revision);
    expect(view.contacts.some(buddy => buddy.id === known.id)).toBe(true);
    expect(view.contacts.some(buddy => buddy.id === publicOnly.id)).toBe(false);
    expect(view.roomParticipantNames).toEqual({
      [publicOnly.id]: publicOnly.displayName,
      [known.id]: known.displayName,
    });
    expect(view.roomParticipantCounts).toEqual({ invited: 1, friends: 1, empty: 0 });
    expect(view.contacts.every(buddy => Object.keys(buddy).every(key =>
      ['id', 'displayName', 'handle', 'archetype', 'roles'].includes(key)))).toBe(true);
    expect(view.contacts.length).toBeLessThanOrEqual(500);
    expect(view.suggestions.length).toBeLessThanOrEqual(500);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(full).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(rosterRead).not.toHaveBeenCalled();
    expect(singleBuddy).not.toHaveBeenCalled();

    // UI mutations must not write back to source-owned identities or roles.
    const contact = view.contacts.find(buddy => buddy.id === known.id)!;
    contact.displayName = 'IMPOSTOR';
    contact.roles?.push('invented');
    const next = game.getPulseContactsRead(rooms);
    expect(next.contacts.find(buddy => buddy.id === known.id)?.displayName).toBe(known.displayName);
    expect(next.contacts.find(buddy => buddy.id === known.id)?.roles).not.toContain('invented');
    expect(game.getRevision()).toBe(revision);
    expect(full).not.toHaveBeenCalled();
    expect(rosterRead).not.toHaveBeenCalled();
  });

  it('scales the directory projection to 500 actors without a Social roster snapshot', () => {
    const fixture = createSimulationBenchmarkFixture(500);
    const game = fixture.engine;
    const all = vi.spyOn(game.social, 'getBuddies');
    const whole = vi.spyOn(game, 'getState');
    const source = vi.spyOn(game.social, 'getState');
    const stage = vi.spyOn(game.social, 'getRelationshipStage');
    const rooms = [
      { id: 'public-room', participantIds: [], participantRoles: ['landlord'] },
      { id: 'empty-room', participantIds: [], participantRoles: [] },
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `fixture-room-${i}`,
        participantIds: [] as string[],
        participantRoles: ['benchmark_actor'],
      })),
    ];
    const projection = game.getPulseContactsRead(rooms);
    // 32 rooms must not recalculate the same 500 actors' derived status 32 times.
    expect(stage.mock.calls.length).toBeLessThanOrEqual(500);
    expect(projection.contacts.length).toBeLessThanOrEqual(500);
    expect(projection.suggestions.length).toBeLessThanOrEqual(500);
    expect(Object.keys(projection.roomParticipantNames).length).toBeLessThanOrEqual(500);
    expect(projection.roomParticipantCounts['empty-room']).toBe(0);
    expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
    expect(all).not.toHaveBeenCalled();
    expect(whole).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
  });
});
