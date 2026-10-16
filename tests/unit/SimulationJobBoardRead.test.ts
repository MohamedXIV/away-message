import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

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
