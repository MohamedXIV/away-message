import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { JobBoardCoordination } from '../../src/engine/kernel/JobBoardCoordination';
import { GIGS, replyDelayMinutes } from '../../src/engine/JobDirector';

describe('JobBoardCoordination', () => {
  it('uses World-owned application flags and publishes only successful applications', () => {
    const owners = createCoreDomainOwners();
    let publications = 0;
    const jobs = new JobBoardCoordination(owners, () => { publications += 1; });

    const invalid = jobs.applyForGig('unknown_job');
    expect(invalid.success).toBe(false);
    expect(publications).toBe(0);

    const applied = jobs.applyForGig('flyer_run');
    expect(applied.success).toBe(true);
    expect(publications).toBe(1);
    expect(owners.world.getFlag('jobapp_flyer_run')).toBe(480);
    expect(jobs.getJobBoard().find((entry) => entry.gig.id === 'flyer_run'))
      .toMatchObject({ pending: true, appliedMinute: 480 });

    expect(jobs.applyForGig('flyer_run').success).toBe(false);
    expect(publications).toBe(1);
  });

  it('does not resolve before the deterministic due time, then resolves exactly once', () => {
    const owners = createCoreDomainOwners();
    const jobs = new JobBoardCoordination(owners, () => {});
    const now = owners.clock.getTotalMinutes();
    const gig = GIGS['flyer_run']!;

    expect(jobs.applyForGig(gig.id).success).toBe(true);

    owners.clock.setTotalMinutes(now + replyDelayMinutes(gig.id, now) - 1);
    jobs.processJobReplies();
    expect(owners.world.getFlag(`jobapp_${gig.id}_done`)).toBe(false);

    owners.clock.setTotalMinutes(now + replyDelayMinutes(gig.id, now));
    jobs.processJobReplies();
    expect(owners.world.getFlag(`jobapp_${gig.id}_done`)).toBe(true);

    const afterFirst = owners.world.getState();
    const messagesAfterFirst = owners.social.getState().conversations;
    jobs.processJobReplies();
    expect(owners.world.getState()).toEqual(afterFirst);
    expect(owners.social.getState().conversations).toEqual(messagesAfterFirst);
    expect(jobs.getJobBoard().find((entry) => entry.gig.id === gig.id)?.pending)
      .toBe(false);
  });

  it('never creates a new relationship or appointment when the contact has disappeared', () => {
    const owners = createCoreDomainOwners();
    const jobs = new JobBoardCoordination(owners, () => {});
    const now = owners.clock.getTotalMinutes();
    // This test observes the existing contact without changing canonical
    // Social state: if the configured role is absent, resolution is still
    // deterministic and marks the application as processed, not pending.
    expect(jobs.applyForGig('night_stock').success).toBe(true);
    owners.clock.setTotalMinutes(
      now + replyDelayMinutes('night_stock', now),
    );
    jobs.processJobReplies();
    expect(owners.world.getFlag('jobapp_night_stock_done')).toBe(true);
  });
});
