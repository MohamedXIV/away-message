import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 owner-scoped public job-board projection', () => {
  it('delivers capped serializable job offers without copying Social or World state', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const world = vi.spyOn(game.world, 'getState');
    const read = game.getJobBoardRead();
    expect(read.revision).toBe(game.getRevision());
    expect(read.jobs.length).toBeGreaterThan(0);
    expect(read.jobs.length).toBeLessThanOrEqual(32);
    expect(read.jobs.map(job => job.gigId)).toEqual(game.getJobBoard().slice(0, 32).map(entry => entry.gig.id));
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(JSON.stringify(read)).not.toContain('conversations');
    expect(JSON.stringify(read)).not.toContain('relationships');
    expect(full).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(world).not.toHaveBeenCalled();
    const oldTitle = read.jobs[0]!.title;
    read.jobs[0]!.title = 'caller-mutated';
    expect(game.getJobBoardRead().jobs[0]!.title).toBe(oldTitle);
  });

  it('does not reveal private role-holder names before they are learned', () => {
    const game = new SimulationEngine();
    const matching = game.getJobBoard().map(({ gig }) => ({ gig, contact: game.social.getBuddyWithRole(gig.contactRole) }))
      .find(entry => entry.contact && !game.social.isKnown(entry.contact.id));
    expect(matching).toBeDefined();
    const before = game.getJobBoardRead().jobs.find(job => job.gigId === matching!.gig.id)!;
    expect(before.contactName).toBe(matching!.gig.contactRole);
    game.social.learnHandle(matching!.contact!.id, matching!.contact!.handle);
    const after = game.getJobBoardRead().jobs.find(job => job.gigId === matching!.gig.id)!;
    expect(after.contactName).toBe(matching!.contact!.displayName);
    expect(JSON.stringify(after)).not.toContain(matching!.contact!.handle);
  });

  it('matches legacy role selection at 500 actors without cloning full Social rosters', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const roles = [...new Set(game.getJobBoard().map(entry => entry.gig.contactRole))];
    const baseline = new Map(roles.map(role => {
      const winner = game.social.getBuddyWithRole(role);
      return [role, winner && game.social.isKnown(winner.id) ? winner.displayName : role];
    }));
    const roster = vi.spyOn(game.social, 'getBuddies');
    const fullBuddy = vi.spyOn(game.social, 'getBuddy');
    const roleLists = vi.spyOn(game.social, 'getBuddiesWithRole');
    const socialState = vi.spyOn(game.social, 'getState');
    const full = vi.spyOn(game, 'getState');
    for (const role of roles) {
      expect(game.social.getPublicJobContactName(role)).toBe(baseline.get(role));
    }
    expect(game.social.getPublicJobContactName('missing_capability_role')).toBe('missing_capability_role');
    const jobs = game.getJobBoardRead();
    expect(jobs.jobs.map(row => row.contactName)).toEqual(
      game.getJobBoard().slice(0, 32).map(row => baseline.get(row.gig.contactRole)),
    );
    expect(JSON.parse(JSON.stringify(jobs))).toEqual(jobs);
    expect(roster).not.toHaveBeenCalled();
    expect(fullBuddy).not.toHaveBeenCalled();
    expect(roleLists).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
  }, 30_000);

  it('tracks canonical pending applications as revisions without whole-world publication', () => {
    const game = new SimulationEngine();
    const original = game.getJobBoardRead();
    const gig = original.jobs.find(job => job.gigId === 'flyer_run')!;
    expect(gig).toBeDefined();
    const received: number[] = [];
    const off = game.subscribeChanges(change => received.push(change.revision));
    const result = game.dispatchAction({ type: 'JOB_APPLY', gigId: gig.gigId });
    off();
    expect(result.success).toBe(true);
    const updated = game.getJobBoardRead();
    expect(updated.revision).toBeGreaterThan(original.revision);
    expect(updated.jobs.find(job => job.gigId === gig.gigId)?.pending).toBe(true);
    expect(received.at(-1)).toBe(updated.revision);
  });
});
