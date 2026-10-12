import type { ActionResult } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  pickRentReminderLine,
  pickRentSternLine,
  pickRentNudgeLine,
  pickRentThanksLine,
} from '../characterTemplates';

type RentOwners = Pick<
  CoreDomainOwners, 'clock' | 'economy' | 'world' | 'social' | 'telemetry'
>;

/**
 * Owns rent communications and the World-owned reminder paper trail.
 *
 * This coordinator does not own money, tenancy, clock, contacts or messages.
 * Finance keeps authoritative rent liability/payment; Social owns delivered
 * dialogue. The landlord role resolves against the current Social roster.
 */
export class RentCoordination {
  constructor(
    private readonly owners: RentOwners,
    private readonly publishState: () => void,
  ) {}

  private sendRentNote(
    text: string,
    tags: string[],
    atMinute: number,
    event: string,
    extra?: Record<string, unknown>,
  ): void {
    const { social, telemetry } = this.owners;
    const landlord = social.getBuddyWithRole('landlord');
    if (!landlord || landlord.status === 'distant'
      || landlord.status === 'gone' || landlord.status === 'blocked') return;
    social.sendMessage(
      landlord.id, landlord.id, 'player', text, atMinute, false, ['rent', ...tags],
    );
    telemetry.logEvent('economy', event, atMinute, {
      buddyId: landlord.id, ...(extra ?? {}),
    });
  }

  /** Resolve the existing day-scoped reminder/warning/overdue ladder. */
  public processRentDaily(newDay: number): void {
    try {
      const { clock, economy, world } = this.owners;
      const minutes = clock.getTotalMinutes();
      const { rentDueDay: dueDay, rentPaid: paid, rentAmount: amount } = economy.getState();
      if (paid) {
        if (world.getFlag('rent_overdue')) world.setFlag('rent_overdue', false);
        return;
      }
      if (newDay === dueDay - 2 && !world.getFlag(`rent_reminded_${dueDay}`)) {
        world.setFlag(`rent_reminded_${dueDay}`, true);
        world.setFlag(`rentmail_due_${dueDay}`, Math.round(amount * 100));
        this.sendRentNote(
          pickRentReminderLine(`${dueDay}`, amount, dueDay),
          ['reminder'], minutes, 'rent_reminded', { dueDay },
        );
      } else if (newDay === dueDay && !world.getFlag(`rent_warned_${dueDay}`)) {
        world.setFlag(`rent_warned_${dueDay}`, true);
        this.sendRentNote(
          pickRentSternLine(`${dueDay}`, amount, dueDay),
          ['warning'], minutes, 'rent_warned', { dueDay },
        );
      } else if (newDay > dueDay) {
        // Catch-up for multi-day jumps: preserve a single current-day nudge
        // rather than manufacturing a backlog of past chat messages.
        if (!world.getFlag(`rent_reminded_${dueDay}`)) {
          world.setFlag(`rent_reminded_${dueDay}`, true);
        }
        if (!world.getFlag(`rentmail_due_${dueDay}`)) {
          world.setFlag(`rentmail_due_${dueDay}`, Math.round(amount * 100));
        }
        if (!world.getFlag('rent_overdue')) {
          world.setFlag('rent_overdue', true);
          world.setFlag(`rentmail_overdue_${dueDay}`, Math.round(amount * 100));
        }
        if (!world.getFlag(`rent_nudge_${newDay}`)) {
          world.setFlag(`rent_nudge_${newDay}`, true);
          this.sendRentNote(
            pickRentNudgeLine(`${newDay}`, amount),
            ['nudge'], minutes, 'rent_nudged', { dueDay },
          );
        }
      }
    } catch {
      // A missing contact or broken authored line never breaks daily finance.
    }
  }

  public payRent(): ActionResult {
    const { economy, world, clock, telemetry } = this.owners;
    const payment = economy.payRent();
    if (!payment.success) return { success: false, error: payment.error };
    if (world.getFlag('rent_overdue')) world.setFlag('rent_overdue', false);
    const atMinute = clock.getTotalMinutes();
    try {
      this.sendRentNote(
        pickRentThanksLine(`paid${clock.getTime().day}`),
        ['thanks'], atMinute, 'rent_thanked',
      );
    } catch {
      // Rent is already paid; a missing NPC voice cannot roll it back.
    }
    telemetry.logEvent('economy', 'rent_paid', atMinute, {
      day: clock.getTime().day,
    });
    this.publishState();
    return { success: true };
  }
}
