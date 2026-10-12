import type { ActionResult } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import { GIGS, jobRoll, replyDelayMinutes, decideApplication } from '../JobDirector';
import { pickJobAcceptLine, pickJobRejectLine } from '../characterTemplates';

type JobOwners = Pick<
  CoreDomainOwners,
  'clock' | 'world' | 'needs' | 'social' | 'telemetry'
>;

/**
 * Job-board orchestration over existing canonical owners.
 *
 * World owns application flags and appointments; Social owns contacts and
 * messages; Needs owns eligibility; Telemetry records outcomes. This class
 * owns no persisted state, clock or independent callback loop.
 */
export class JobBoardCoordination {
  constructor(
    private readonly owners: JobOwners,
    private readonly publishState: () => void,
  ) {}

  public getJobBoard(): Array<{
    gig: (typeof GIGS)[string];
    pending: boolean;
    appliedMinute: number;
  }> {
    try {
      const { world } = this.owners;
      return Object.values(GIGS).map((gig) => {
        const applied = world.getFlag(`jobapp_${gig.id}`);
        const done = world.getFlag(`jobapp_${gig.id}_done`);
        const pending = typeof applied === 'number' && applied > 0 && !done;
        return { gig, pending, appliedMinute: pending ? applied : 0 };
      });
    } catch {
      return [];
    }
  }

  public applyForGig(gigId: string): ActionResult {
    try {
      const { world, needs, clock, telemetry } = this.owners;
      const gig = GIGS[gigId];
      if (!gig) return { success: false, error: `Unknown gig: ${gigId}` };
      const applied = world.getFlag(`jobapp_${gigId}`);
      const done = world.getFlag(`jobapp_${gigId}_done`);
      if (typeof applied === 'number' && applied > 0 && !done) {
        return { success: false, error: 'Already applied — waiting to hear back.' };
      }
      if (needs.getState().energy < gig.minEnergy) {
        return {
          success: false,
          error: `Too tired to take ${gig.title} (need ${gig.minEnergy}% energy to apply).`,
        };
      }
      const now = clock.getTotalMinutes();
      world.setFlag(`jobapp_${gigId}`, now);
      world.setFlag(`jobapp_${gigId}_done`, false);
      telemetry.logEvent('economy', 'job_applied', now, { gigId });
      this.publishState();
      return { success: true };
    } catch {
      return { success: false, error: 'Application failed.' };
    }
  }

  /** Resolve due applications without introducing a second appointment owner. */
  public processJobReplies(): void {
    try {
      const { clock, world, social, telemetry } = this.owners;
      const now = clock.getTotalMinutes();
      const day = clock.getTime().day;
      for (const gig of Object.values(GIGS)) {
        const applied = world.getFlag(`jobapp_${gig.id}`);
        const done = world.getFlag(`jobapp_${gig.id}_done`);
        if (typeof applied !== 'number' || applied <= 0 || done) continue;
        if (now < applied + replyDelayMinutes(gig.id, applied)) continue;
        const contact = social.getBuddyWithRole(gig.contactRole);
        const gone = !contact || contact.status === 'distant'
          || contact.status === 'gone' || contact.status === 'blocked';
        const stage = contact ? social.getRelationshipStage(contact.id) : 'stranger';
        const { accepted, odds } = decideApplication({
          baseOdds: gig.baseOdds,
          contactStage: stage,
          contactGone: gone,
          roll: jobRoll(`job:${gig.id}:${applied}`),
        });
        world.setFlag(`jobapp_${gig.id}_done`, true);
        if (accepted && contact) {
          const targetDay = day + 1;
          world.scheduleAppointment({
            id: `gig_${gig.id}_${targetDay}_${applied % 1000}`.slice(0, 60),
            characterId: contact.id,
            locationId: 'work',
            targetDay,
            startMinute: 9 * 60,
            endMinute: Math.min(9 * 60 + gig.durationMin, 12 * 60),
            description: `${gig.title} (job board, $${gig.pay})`,
            status: 'confirmed',
            rsvp: 'yes',
            wageOverride: gig.pay,
            origin: { kind: 'job', id: gig.id },
          });
          social.sendMessage(
            contact.id, contact.id, 'player',
            pickJobAcceptLine(`${gig.id}:${day}`, gig.title, 'tomorrow'),
            now, false, ['job', 'accepted'],
          );
          telemetry.logEvent('economy', 'job_accepted', now, { gigId: gig.id, odds });
        } else if (contact) {
          social.sendMessage(
            contact.id, contact.id, 'player',
            pickJobRejectLine(`${gig.id}:${day}`, gig.title),
            now, false, ['job', 'rejected'],
          );
          telemetry.logEvent('economy', 'job_rejected', now, { gigId: gig.id, odds });
        }
      }
    } catch {
      // Preserve current rule: job reply generation never breaks the tick.
    }
  }
}
