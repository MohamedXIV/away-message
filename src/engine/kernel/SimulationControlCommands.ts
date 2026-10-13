import type { ActionResult, SimulationAction, SimulationState } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import type { CityActivityCoordination } from './CityActivityCoordination';

/**
 * Basic simulation flow control: time progression, pausing, view switching,
 * and town mobility/outings.
 */
export class SimulationControlCommands {
  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'economy' | 'world'>,
    private readonly cityActivity: CityActivityCoordination,
    private readonly advanceGameMinutes: (minutes: number, reason?: string) => void,
    private readonly setActiveView: (view: SimulationState['activeView']) => void,
    private readonly publishState: () => void,
  ) {}

  public dispatch(action: SimulationAction, _currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'TIME_ADVANCE_MINUTES': {
        this.advanceGameMinutes(action.minutes, action.reason);
        return { success: true };
      }

      case 'TIME_SET_PAUSED': {
        this.owners.clock.setPaused(action.paused);
        this.publishState();
        return { success: true };
      }

      case 'VIEW_SWITCH': {
        // Sitting at PC/room from out in the city walks the player home first
        if (
          (action.view === 'pc' || action.view === 'room') &&
          this.owners.economy.getLocation() !== 'home'
        ) {
          const home = this.cityActivity.travelTo('home', 'walk', { ignoreFatigue: true });
          if (!home.success) return { success: false, error: home.error };
        }
        this.setActiveView(action.view);
        // Visiting cafe/work counts as showing up for that day's meetings there
        if (action.view === 'cafe' || action.view === 'work') {
          try {
            this.owners.world.setFlag(
              `visited_${action.view}_${this.owners.clock.getTime().day}`,
              true,
            );
          } catch {
            // Attendance recording is best-effort
          }
        }
        this.publishState();
        return { success: true };
      }

      case 'PLAYER_CITY_OUTING': {
        return this.cityActivity.doCityOuting(action.outingId);
      }

      case 'TRAVEL_TO': {
        return this.cityActivity.travelTo(
          (action as { to: unknown }).to,
          (action as { mode: unknown }).mode,
        );
      }

      default:
        return null;
    }
  }
}
