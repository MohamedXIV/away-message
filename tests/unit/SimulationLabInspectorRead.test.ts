import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 paged developer-only AI Lab inspector', () => {
  it('matches old actor diagnostics but bounds every rendered relationship page at 500 actors', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const legacyActors = game.social.getBuddies();
    const originalEvents = {
      pending: game.world.getPendingEvents().length,
      triggered: game.world.getTriggeredEvents().length,
      pendingOs: game.world.getPendingEvents().filter(item => item.category === 'os_release').length,
    };
    const firstActor = legacyActors[0]!;
    const expectedRel = game.social.getRelationships(firstActor.id);
    const expectedMem = game.social.getCoreMemories(firstActor.id);
    const expectedPromises = game.social.getOpenPromises(firstActor.id);
    const allBuddy = vi.spyOn(game.social, 'getBuddies');
    const individualBuddy = vi.spyOn(game.social, 'getBuddy');
    const socialState = vi.spyOn(game.social, 'getState');
    const worldState = vi.spyOn(game.world, 'getState');
    const pending = vi.spyOn(game.world, 'getPendingEvents');
    const triggered = vi.spyOn(game.world, 'getTriggeredEvents');
    const allAppointments = vi.spyOn(game.world, 'getAppointments');
    const fullState = vi.spyOn(game, 'getState');

    const first = game.getLabInspectorRead(0, 0);
    expect(first.roster.total).toBe(legacyActors.length);
    expect(first.roster.procedural).toBe(legacyActors.filter(buddy => buddy.isProcedural).length);
    expect(first.eventCounts).toEqual(originalEvents);
    expect(first.actors).toHaveLength(16);
    expect(first.actors.map(buddy => buddy.id)).toEqual(legacyActors.slice(0, 16).map(buddy => buddy.id));
    expect(first.roster.imageOptions).toHaveLength(500);
    expect(first.actors[0]).toMatchObject({
      id: firstActor.id,
      displayName: firstActor.displayName,
      handle: firstActor.handle,
      stage: game.social.getRelationshipStage(firstActor.id),
      dailyMood: game.social.getDailyMood(firstActor.id, first.day),
      memories: expectedMem,
      promises: expectedPromises,
      ...(expectedRel ? { relationship: expectedRel } : { relationship: null }),
    });
    expect('bio' in first.roster.page[0]!).toBe(false);
    expect('conversations' in first.roster).toBe(false);
    const second = game.getLabInspectorRead(1, 0);
    expect(second.actors).toHaveLength(16);
    expect(second.actors.map(buddy => buddy.id)).toEqual(legacyActors.slice(16, 32).map(buddy => buddy.id));
    expect(game.getLabInspectorRead(999, 0).actors).toEqual([]);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.parse(JSON.stringify(second))).toEqual(second);
    const originalName = first.actors[0]!.displayName;
    first.actors[0]!.displayName = 'UI_EDIT';
    first.roster.imageOptions[0]!.displayName = 'UI_EDIT';
    expect(game.getLabInspectorRead(0, 0).actors[0]!.displayName).toBe(originalName);
    for (const spy of [allBuddy, individualBuddy, socialState, worldState, pending, triggered, allAppointments, fullState]) {
      expect(spy).not.toHaveBeenCalled();
    }
  }, 30_000);

  it('pages appointments, keeps today counts and leaves all canonical appointments detached', () => {
    const game = new SimulationEngine();
    const day = game.clock.getTime().day;
    for (let i = 0; i < 35; i++) {
      game.world.scheduleAppointment({
        id: `lab_meeting_${i}`,
        characterId: 'maya',
        locationId: 'cafe',
        targetDay: i < 20 ? day : day + 1,
        startMinute: 600,
        endMinute: 660,
        description: `meeting ${i}`,
      });
    }
    const legacy = game.world.getAppointments();
    const spy = vi.spyOn(game.world, 'getAppointments');
    const read = game.getLabInspectorRead();
    expect(read.appointments.total).toBe(35);
    expect(read.appointments.todayCount).toBe(20);
    expect(read.appointments.today).toEqual(legacy.slice(0, 8));
    expect(read.appointments.page).toEqual(legacy.slice(0, 16));
    expect(game.getLabInspectorRead(0, 1).appointments.page).toEqual(legacy.slice(16, 32));
    expect(game.getLabInspectorRead(0, 2).appointments.page).toEqual(legacy.slice(32));
    expect(game.getLabInspectorRead(0, 3).appointments.page).toEqual([]);
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    read.appointments.page[0]!.description = 'UI_SHOULD_NOT_MUTATE_OWNER';
    expect(game.getLabInspectorRead().appointments.page[0]!.description).toBe('meeting 0');
    expect(spy).not.toHaveBeenCalled();
  });

  it('tracks world counters and body semantics across one revision without global state publication', () => {
    const game = new SimulationEngine();
    const baseline = game.getLabInspectorRead();
    const change = vi.fn();
    const stop = game.subscribeChanges(change);
    change.mockClear();
    const broad = vi.spyOn(game, 'getState');
    game.world.setFlag('rent_overdue', true);
    game.publishExternalChange(['world']);
    const next = game.getLabInspectorRead();
    expect(next.revision).toBe(baseline.revision + 1);
    expect(next.body.rentOverdue).toBe(true);
    expect(next.body.cash).toBe(game.economy.getCash());
    expect(next.body.maxEnergy).toBe(game.needs.effectiveMaxEnergy());
    expect(next.body.rentDueDay).toBe(game.economy.getRentStatus().rentDueDay);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls[0]![0].changedDomains).toEqual(expect.arrayContaining(['world', 'unknown']));
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
    expect(broad).not.toHaveBeenCalled();
    stop();
  });
});
