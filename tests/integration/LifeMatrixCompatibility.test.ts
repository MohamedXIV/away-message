import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildLifeMatrixSnapshot } from '../../src/engine/life/LifeSnapshot';
import { createSimulationLifeSources } from '../../src/engine/life/LifeSources';
import { GIGS, decideApplication, jobRoll, replyDelayMinutes } from '../../src/engine/JobDirector';

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

  it('exposes deterministic on-demand character obligations without mutating sources', () => {
    const sim = new SimulationEngine();
    const buddy = sim.social.getBuddies()[0];
    expect(buddy).toBeDefined();
    if (!buddy) throw new Error('Expected an existing Away character.');

    const before = sim.exportSnapshot();
    const first = sim.getCharacterObligations(buddy.id);
    const again = sim.getCharacterObligations(buddy.id);

    expect(first).toEqual(again);
    expect(first).not.toBe(again);
    expect(sim.getCharacterObligations('__missing_actor__')).toEqual([]);
    expect(sim.exportSnapshot()).toEqual(before);
  });

  it('reconstructs equivalent obligations across save/reload without a persisted ledger', () => {
    const sim = new SimulationEngine();
    const buddy = sim.social.getBuddies()[0];
    expect(buddy).toBeDefined();
    if (!buddy) throw new Error('Expected an existing Away character.');
    const day = sim.clock.getTime().day;

    sim.world.scheduleAppointment({
      id: 'life_task5_appt',
      characterId: buddy.id,
      locationId: 'cafe',
      targetDay: day,
      startMinute: 18 * 60,
      endMinute: 19 * 60,
      description: 'Task-5 fixture dinner',
      status: 'confirmed',
      rsvp: 'yes',
    });

    const promise = sim.social.addPromise(
      buddy.id,
      'Return the borrowed cookbook before the weekend.',
      day,
      day + 2,
    );
    if (!promise) throw new Error('Expected the owner to record the promise.');

    // Job-origin appointment built through the owning appointment authority,
    // using the exact record shape job acceptance writes (no id parsing).
    sim.world.scheduleAppointment({
      id: 'life_task5_gig',
      characterId: buddy.id,
      locationId: 'work',
      targetDay: day,
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      description: 'Task-5 fixture gig',
      status: 'confirmed',
      rsvp: 'yes',
      origin: { kind: 'job', id: 'flyer_run' },
    });

    const before = sim.getCharacterObligations(buddy.id);

    expect(before).toContainEqual(
      expect.objectContaining({
        id: `appointment:${buddy.id}:life_task5_appt`,
        sourceKind: 'appointment',
        sourceId: 'life_task5_appt',
        status: 'pending',
      }),
    );
    expect(before).toContainEqual(
      expect.objectContaining({
        id: `promise:${buddy.id}:${promise.id}`,
        sourceKind: 'promise',
        sourceId: promise.id,
      }),
    );

    // Exactly ONE obligation for the job-origin record: no appointment dup,
    // no wage/payment leakage into the projection.
    const gigRefs = before.filter(
      (obligation) => obligation.sourceId === 'flyer_run' || obligation.id.endsWith(':life_task5_gig'),
    );
    expect(gigRefs).toHaveLength(1);
    expect(gigRefs[0]).toMatchObject({
      id: `job:${buddy.id}:life_task5_gig`,
      actorId: buddy.id,
      sourceKind: 'job',
      sourceId: 'flyer_run',
      destinationPlaceId: 'work',
    });
    expect(gigRefs[0]).not.toHaveProperty('wage');
    expect(gigRefs[0]).not.toHaveProperty('wageOverride');
    expect(gigRefs[0]).not.toHaveProperty('pay');

    const snapshot = sim.exportSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain('"obligations"');

    const fresh = new SimulationEngine();
    fresh.loadSnapshot(snapshot);
    expect(fresh.getCharacterObligations(buddy.id)).toEqual(before);
  });

  it('reflects source changes without stale duplicates and never mutates on read', () => {
    const sim = new SimulationEngine();
    const buddy = sim.social.getBuddies()[0];
    expect(buddy).toBeDefined();
    if (!buddy) throw new Error('Expected an existing Away character.');
    const day = sim.clock.getTime().day;

    sim.world.scheduleAppointment({
      id: 'life_task5_cancel',
      characterId: buddy.id,
      locationId: 'cafe',
      targetDay: day,
      startMinute: 18 * 60,
      endMinute: 19 * 60,
      description: 'Task-5 cancellable coffee',
      status: 'confirmed',
      rsvp: 'yes',
    });
    sim.world.scheduleAppointment({
      id: 'life_task5_done',
      characterId: buddy.id,
      locationId: 'diner',
      targetDay: day,
      startMinute: 12 * 60,
      endMinute: 13 * 60,
      description: 'Task-5 completable lunch',
      status: 'confirmed',
      rsvp: 'yes',
    });
    const promise = sim.social.addPromise(
      buddy.id,
      'Water the upstairs plant while away.',
      day,
      day + 2,
    );
    if (!promise) throw new Error('Expected the owner to record the promise.');

    // Repeated reads: equivalent values, fresh results, no mutation.
    const pristine = sim.exportSnapshot();
    const first = sim.getCharacterObligations(buddy.id);
    const second = sim.getCharacterObligations(buddy.id);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(sim.exportSnapshot()).toEqual(pristine);

    // Cancel through the appointment owner: status follows, still one entry.
    expect(sim.world.updateAppointment('life_task5_cancel', { status: 'cancelled' })).not.toBeNull();
    const afterCancel = sim.getCharacterObligations(buddy.id);
    const cancelled = afterCancel.filter((obligation) => obligation.sourceId === 'life_task5_cancel');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({ status: 'cancelled' });

    // Completion through the appointment owner maps to satisfied.
    expect(sim.world.updateAppointment('life_task5_done', { status: 'happened' })).not.toBeNull();
    const afterDone = sim.getCharacterObligations(buddy.id);
    expect(
      afterDone.find((obligation) => obligation.sourceId === 'life_task5_done'),
    ).toMatchObject({ status: 'satisfied' });

    // Fulfilling through the promise owner removes the stale obligation.
    expect(sim.social.resolvePromise(buddy.id, promise.id, true, day)).not.toBeNull();
    const afterResolve = sim.getCharacterObligations(buddy.id);
    expect(afterResolve.some((obligation) => obligation.sourceId === promise.id)).toBe(false);

    // Owner state confirms the projection; reads changed nothing else.
    expect(sim.world.getAppointments().find((a) => a.id === 'life_task5_cancel')?.status).toBe('cancelled');
    expect(sim.social.getPromises(buddy.id).find((p) => p.id === promise.id)?.status).toBe('kept');
    const reread = sim.getCharacterObligations(buddy.id);
    expect(reread).toEqual(afterResolve);
    expect(reread).not.toBe(afterResolve);
  });

  it('projects a live accepted gig as exactly one job obligation', () => {
    const sim = new SimulationEngine();
    expect(sim.dispatchAction({ type: 'JOB_APPLY', gigId: 'flyer_run' }).success).toBe(true);

    const applied = sim.world.getFlag('jobapp_flyer_run') as number;
    expect(applied).toBeGreaterThan(0);
    sim.advanceGameMinutes(60, 'one hour');
    sim.advanceGameMinutes(replyDelayMinutes('flyer_run', applied), 'waiting for reply');

    const expected = decideApplication({
      baseOdds: GIGS.flyer_run!.baseOdds,
      contactStage: sim.social.getRelationshipStage('henderson'),
      contactGone: false,
      roll: jobRoll(`job:flyer_run:${applied}`),
    });

    const actors = sim.social.getBuddies().map((buddy) => buddy.id);
    const all = actors.flatMap((actorId) => sim.getCharacterObligations(actorId));
    if (expected.accepted) {
      const appt = sim.world.getAppointments().find((a) => a.id.startsWith('gig_flyer_run_'));
      expect(appt).toBeDefined();
      if (!appt) throw new Error('Expected the accepted gig appointment.');
      expect(appt.origin).toEqual({ kind: 'job', id: 'flyer_run' });

      const gigRefs = all.filter(
        (obligation) => obligation.sourceId === 'flyer_run' || obligation.id.endsWith(`:${appt.id}`),
      );
      expect(gigRefs).toHaveLength(1);
      expect(gigRefs[0]).toMatchObject({
        id: `job:${appt.characterId}:${appt.id}`,
        sourceKind: 'job',
        sourceId: 'flyer_run',
      });
      expect(gigRefs[0]).not.toHaveProperty('wageOverride');
    } else {
      expect(all.some((obligation) => obligation.sourceId === 'flyer_run')).toBe(false);
    }
  });

  it('does not change simulation outcomes when snapshots are observed around time advances', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_789_000_000_000);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.3141592653);

    try {
      const observed = new SimulationEngine();
      const control = new SimulationEngine();
      const actorId = observed.social.getBuddies()[0]?.id;
      expect(actorId).toBeDefined();
      if (!actorId) throw new Error('Expected an existing Away character.');

      for (const minutes of [30, 90, 240, 1440]) {
        observed.getLifeSnapshot(actorId);
        observed.advanceGameMinutes(minutes, 'life compatibility test');
        observed.getLifeSnapshot(actorId);

        control.advanceGameMinutes(minutes, 'life compatibility test');
      }

      expect(observed.exportSnapshot()).toEqual(control.exportSnapshot());
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });
});
