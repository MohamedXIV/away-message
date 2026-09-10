import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildLifeMatrixSnapshot } from '../../src/engine/life/LifeSnapshot';
import { createSimulationLifeSources } from '../../src/engine/life/LifeSources';

describe('Life Matrix compatibility with existing Away authorities', () => {
  it('projects social, routine, appointment and world truth without mutating it', () => {
    const sim = new SimulationEngine();
    const [actor, peer] = sim.social.getBuddies();
    expect(actor).toBeDefined();
    expect(peer).toBeDefined();
    if (!actor || !peer) throw new Error('Expected at least two existing Away characters.');

    const day = sim.clock.getTime().day;
    const atMinute = sim.clock.getTotalMinutes();

    const promise = sim.social.addPromise(
      actor.id,
      'Meet me after work and bring the old magazine.',
      day,
      day + 2,
    );
    expect(promise).not.toBeNull();

    const sourceBond = sim.social.applyNpcSocialAction(actor.id, peer.id, 'warm_chat', day);
    expect(sourceBond).not.toBeNull();

    const appointment = sim.world.scheduleAppointment({
      id: 'life_matrix_compat_appt',
      characterId: actor.id,
      locationId: 'cafe',
      targetDay: day,
      startMinute: 10 * 60,
      endMinute: 11 * 60,
      description: 'Compatibility fixture coffee',
      status: 'confirmed',
      rsvp: 'yes',
    });

    const worldEvent = sim.world.triggerEventById('myplace_v2_launch', atMinute);
    expect(worldEvent).not.toBeNull();

    const before = sim.exportSnapshot();
    const sources = createSimulationLifeSources(sim);
    const life = buildLifeMatrixSnapshot(sources, actor.id, atMinute);
    const again = buildLifeMatrixSnapshot(sources, actor.id, atMinute);

    expect(life).not.toBeNull();
    expect(life).toEqual(again);
    expect(life).not.toBe(again);
    expect(life?.actorId).toBe(actor.id);
    expect(life?.traits).toEqual(sim.social.getTraits(actor.id));

    const relationship = sim.social.getRelationships(actor.id);
    expect(relationship).toBeDefined();
    expect(life?.playerRelationship).toEqual({
      targetId: 'player',
      ...relationship,
    });

    expect(life?.notableNpcBonds).toContainEqual({
      targetId: peer.id,
      ...sourceBond?.dims,
    });

    expect(life?.promises).toContainEqual({
      id: promise?.id,
      text: promise?.text,
      dueDay: promise?.dueDay,
      fulfilled: false,
    });

    const expectedAgenda = sim.social.getAgenda(actor.id, day).map((entry) => ({ ...entry }));
    expect(life?.agenda).toEqual(expectedAgenda);

    const weeklyDay = ((day - 1) % 7) + 1;
    const expectedRoutine = actor.schedule[day] ?? actor.schedule[weeklyDay] ?? actor.schedule[1] ?? [];
    expect(life?.routineWindows).toEqual(
      expectedRoutine.map((block) => ({
        day,
        startMinute: block.startMinuteOfDay,
        endMinute: block.endMinuteOfDay,
        status: block.status,
        awayMessage: block.awayMessage,
      })),
    );

    expect(life?.appointments).toContainEqual({
      id: appointment.id,
      characterId: appointment.characterId,
      locationId: appointment.locationId,
      targetDay: appointment.targetDay,
      startMinute: appointment.startMinute,
      endMinute: appointment.endMinute,
      rsvp: appointment.rsvp,
      status: appointment.status,
    });

    expect(life?.worldEvents).toContainEqual({
      id: worldEvent?.id,
      title: worldEvent?.title,
      category: worldEvent?.category,
      triggerDay: worldEvent?.triggerDay,
      triggeredAtMinute: worldEvent?.triggeredAtMinute,
    });

    const presence = sim.social.getPresence(actor.id);
    expect(presence).toBeDefined();
    expect(life?.presence).toEqual({
      messengerStatus: presence?.status,
      awayMessage: presence?.awayMessage,
    });

    expect(sim.exportSnapshot()).toEqual(before);
  });

  it('exposes a read-only life snapshot at the authoritative clock minute', () => {
    const sim = new SimulationEngine();
    const buddy = sim.social.getBuddies()[0];
    expect(buddy).toBeDefined();
    if (!buddy) throw new Error('Expected an existing Away character.');

    const before = sim.exportSnapshot();
    const life = sim.getLifeSnapshot(buddy.id);

    expect(life?.actorId).toBe(buddy.id);
    expect(life?.atMinute).toBe(sim.clock.getTotalMinutes());
    expect(sim.exportSnapshot()).toEqual(before);
  });
});
