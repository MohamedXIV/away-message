import type { CoreDomainOwners } from './CoreDomainOwners';
import { classifyScheduleBlock, pickLeaveLine } from '../characterTemplates';

type PresenceOwners = Pick<
  CoreDomainOwners,
  'clock' | 'world' | 'social' | 'needs' | 'telemetry'
>;

/**
 * Presence-triggered conversation continuity and the player's social recharge.
 * The one canonical SocialEngine owns the messages/presence, and Needs owns
 * socialBattery. This coordinator stores no parallel state or timers.
 */
export class SocialPresenceCycle {
  constructor(private readonly owners: PresenceOwners) {}

  /**
   * After the canonical presence update, an actor moving offline can send one
   * polite leave line when a recent real interaction justifies it.
   */
  public sweepBusyLeaveLines(currentMinutes: number): void {
    const { social, world } = this.owners;
    const day = Math.floor(currentMinutes / 1440) + 1;
    for (const buddy of social.getBuddies()) {
      if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
      if (world.getFlag(`leave_${buddy.id}_${day}`)) continue;
      const presence = social.getPresence(buddy.id);
      if (!presence || presence.status !== 'offline') continue;
      const kind = classifyScheduleBlock(presence.awayMessage);
      if (!kind) continue;
      const last = social.getLastActivityMinute(buddy.id);
      if (last <= 0 || currentMinutes - last > 90) continue;
      const traits = social.getTraits(buddy.id);
      const text = pickLeaveLine(kind, traits.shyness, `${buddy.id}:${day}`);
      social.sendMessage(
        buddy.id, buddy.id, 'player', text, currentMinutes, false, ['leave', kind],
      );
      world.setFlag(`leave_${buddy.id}_${day}`, true);
    }
  }

  /**
   * A quiet yesterday restores the introvert's social battery once per day.
   * No extra owner of need state or duplicated recharge timer.
   */
  public processPlayerBatteryDaily(newDay: number): void {
    try {
      const { world, social, needs, telemetry, clock } = this.owners;
      if (world.getFlag(`quietrecharge_${newDay}`)) return;
      if (!social.didPlayerWriteOnDay(newDay - 1)) {
        needs.rechargeSocialBattery(10);
        telemetry.logEvent('social', 'battery_solitude', clock.getTotalMinutes(), {
          day: newDay,
        });
      }
      world.setFlag(`quietrecharge_${newDay}`, true);
    } catch {
      // The recharge policy must not block the canonical day transition.
    }
  }
}
