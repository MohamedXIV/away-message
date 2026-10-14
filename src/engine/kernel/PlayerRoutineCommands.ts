import type { ActionResult, SimulationAction } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import { CityActivityCoordination } from './CityActivityCoordination';
import type { TimeAdvancement } from './TimeAdvancement';

/**
 * Player routine actions: rest/sleep and room interactions.
 *
 * Sleep transition executes authoritatively through TimeAdvancement without
 * double-advancing Needs, Downloads, Social presence, World events, or deliveries.
 */
export class PlayerRoutineCommands {
  constructor(
    private readonly owners: Pick<
      CoreDomainOwners,
      | 'clock'
      | 'needs'
      | 'economy'
      | 'telemetry'
      | 'world'
    >,
    private readonly advanceGameMinutes: (
      minutes: number,
      reason: string,
      options?: { skipPublish?: boolean },
    ) => void,
    private readonly timeAdvancement: TimeAdvancement,
    private readonly publishState: () => void,
  ) {}

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'PLAYER_REST_OR_SLEEP': {
        const wakeHour = action.wakeHour ?? 8;
        const bedtimeHour = this.owners.clock.getTime().hour; // Sleep quality needs bedtime
        const jump = this.owners.clock.jumpToNextMorning(wakeHour, action.wakeMinute ?? 0);
        const hoursSlept = jump.elapsedMinutes / 60;
        this.owners.needs.restOrSleep(hoursSlept, bedtimeHour);
        // Social battery: a full night restores the introvert (+30, capped).
        this.owners.needs.rechargeSocialBattery(30);

        // Authoritatively advance all time-dependent and daily subsystems
        this.timeAdvancement.applyTimeJump(jump, 'Sleep', { skipPublish: true });

        this.owners.telemetry.logEvent('room', 'sleep', currentMinutes, {
          hoursSlept,
          wakeDay: jump.newTime.day,
        });
        this.publishState();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        // Room comforts require the player's current home
        const roomErr = CityActivityCoordination.requireLocation(this.owners.economy.getLocation(), 'home');
        if (roomErr) return { success: false, error: roomErr };
        const durations: Record<string, number> = {
          tea: 6,
          coffee: 5,
          meal: 15,
          groceries: 30,
          shower: 12,
          window: 4,
        };
        const dur = durations[action.activity] ?? 10;
        // Noodles and groceries consume pantry inventory
        if (action.activity === 'meal') {
          const res = this.owners.economy.eatMeal('noodles');
          if (!res.success) return { success: false, error: res.error };
        }
        if (action.activity === 'groceries') {
          const res = this.owners.economy.eatMeal('groceries');
          if (!res.success) return { success: false, error: res.error };
        }
        this.advanceGameMinutes(dur, `Room interaction: ${action.activity}`, { skipPublish: true });
        if (action.activity === 'tea' || action.activity === 'coffee') {
          this.owners.needs.restoreEnergy(5);
          // Quiet rituals repay the introvert
          this.owners.needs.rechargeSocialBattery(3);
        } else if (action.activity === 'meal' || action.activity === 'groceries') {
          // Energy already handled inside eatMeal; time passed above
        } else if (action.activity === 'shower') {
          this.owners.needs.showerBoost();
        } else if (action.activity === 'window') {
          this.owners.telemetry.recordWindowObservation();
          this.owners.world.addWindowObservation(
            `window_day${this.owners.clock.getTime().day}_${this.owners.clock.getTotalMinutes()}`,
          );
          this.owners.needs.rechargeSocialBattery(2);
        }
        this.owners.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        this.publishState();
        return { success: true };
      }

      default:
        return null;
    }
  }
}
