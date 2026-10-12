import { describe, expect, it } from 'vitest';
import { buildCharacter } from '../../src/engine/CharacterEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { AppointmentCoordination } from '../../src/engine/kernel/AppointmentCoordination';

function fixture() {
  const owners = createCoreDomainOwners();
  const actorId = 'meeting_fixture';
  owners.social.registerBuddy(buildCharacter({
    id: actorId,
    handle: 'meeting_fixture',
    displayName: 'Meeting Fixture',
    archetype: 'student',
    reach: 'local',
    metVia: 'work',
    createdDay: 1,
    status: 'acquaintance',
  }).definition);
  return {
    owners,
    actorId,
    meetings: new AppointmentCoordination(owners),
  };
}

describe('AppointmentCoordination', () => {
  it('schedules and RSVPs a bounded meetup using the canonical world store', () => {
    const { owners, meetings, actorId } = fixture();
    const meeting = meetings.handleMeetupChat(
      actorId, 'meet at the cafe tomorrow', 1,
    );

    expect(meeting).not.toBeNull();
    expect(meeting?.characterId).toBe(actorId);
    expect(meeting?.targetDay).toBe(2);
    expect(meeting?.locationId).toBe('cafe');
    const persisted = owners.world.getAppointments()
      .find((record) => record.id === meeting!.id);
    expect(persisted?.status).toBe('confirmed');
    expect(persisted?.rsvp).toMatch(/yes|maybe/);

    // A second invitation cannot double-book the same active contact.
    expect(meetings.handleMeetupChat(
      actorId, 'meet at the cafe tomorrow', 1,
    )).toBeNull();
    expect(owners.world.getAppointments().filter(
      (record) => record.characterId === actorId && record.status === 'confirmed',
    )).toHaveLength(1);
  });

  it('resolves due appointments once without inventing another appointment store', () => {
    const { owners, meetings, actorId } = fixture();
    const meeting = meetings.handleMeetupChat(
      actorId, 'meet at the cafe tomorrow', 1,
    );
    expect(meeting).not.toBeNull();

    owners.clock.setTotalMinutes(3 * 1440 + 480);
    meetings.processAppointmentsDaily(4);
    const resolved = owners.world.getAppointments()
      .find((record) => record.id === meeting!.id);

    expect(resolved?.status).toBe('missed');
    const previous = owners.world.getAppointments();
    meetings.processAppointmentsDaily(4);
    expect(owners.world.getAppointments()).toEqual(previous);
  });

  it('cancels an existing meeting and stores the social consequence', () => {
    const { owners, meetings, actorId } = fixture();
    const meeting = meetings.handleMeetupChat(
      actorId, 'meet at the cafe tomorrow', 1,
    );
    expect(meeting).not.toBeNull();

    expect(meetings.handleMeetupChat(actorId, 'gotta cancel', 1)).toBeNull();
    expect(owners.world.getAppointments()
      .find((record) => record.id === meeting!.id)?.status).toBe('cancelled');
    expect(owners.social.getCoreMemories(actorId).some(
      (memory) => memory.kind === 'fact' && memory.text.includes('Cancelled'),
    )).toBe(true);
  });
});
