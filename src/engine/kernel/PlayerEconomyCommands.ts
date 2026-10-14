import type { ActionResult, SimulationAction } from '../types';
import type { Fulfillment } from '../DeliveryEngine';
import type { CoreDomainOwners } from './CoreDomainOwners';
import { CityActivityCoordination } from './CityActivityCoordination';
import type { RentCoordination } from './RentCoordination';
import type { JobBoardCoordination } from './JobBoardCoordination';

/**
 * Player cash, work shift, and billing commands executed over canonical
 * Economy, Needs, Clock, and Telemetry authorities. No duplicate cash store.
 */
export class PlayerEconomyCommands {
  constructor(
    private readonly owners: Pick<
      CoreDomainOwners,
      'economy' | 'needs' | 'telemetry' | 'events' | 'clock'
    >,
    private readonly rentCoordination: RentCoordination,
    private readonly jobBoard: JobBoardCoordination,
    private readonly placeGroceryOrderHandler: (
      items: Array<{ sku: string; qty: number }>,
      fulfillment: Fulfillment,
      currentMinutes: number,
    ) => ActionResult,
    private readonly advanceGameMinutes: (minutes: number, reason: string, options?: { skipPublish?: boolean }) => void,
    private readonly publishState: () => void,
  ) {}

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'PLAYER_EARN_CASH': {
        this.owners.economy.earnCash(action.amount, action.reason);
        this.owners.telemetry.logEvent('economy', 'cash_earned', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.publishState();
        return { success: true };
      }

      case 'PLAYER_SPEND_CASH': {
        const ok = this.owners.economy.spendCash(action.amount, action.reason);
        if (!ok) return { success: false, error: 'Insufficient funds.' };
        this.owners.telemetry.logEvent('economy', 'cash_spent', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.publishState();
        return { success: true };
      }

      case 'PLAYER_WORK_SHIFT': {
        // Shifts are worked at the food cart
        const cartErr = CityActivityCoordination.requireLocation(this.owners.economy.getLocation(), 'cart');
        if (cartErr) return { success: false, error: cartErr };
        const durationMinutes = action.durationMinutes ?? 240;
        const wage = action.wage ?? 62.0;
        const needResult = this.owners.needs.applyWorkShift();
        if (!needResult.success) return { success: false, error: needResult.error };
        const hours = durationMinutes / 60;
        this.owners.economy.earnCash(wage, `Work shift (${hours} hrs)`);
        this.owners.events.emit('economy:shift_completed', {
          wage,
          hours,
          energySpent: needResult.energySpent,
        });
        const shiftRes = {
          success: true,
          hours,
          earnedWage: wage,
          energySpent: needResult.energySpent,
          fatigueAdded: needResult.fatigueAdded,
        };
        this.advanceGameMinutes(durationMinutes, 'Work Shift', { skipPublish: true });
        this.owners.telemetry.logEvent('economy', 'shift_worked', currentMinutes, {
          wage: shiftRes.earnedWage,
          hours: shiftRes.hours,
        });
        this.publishState();
        return { success: true, data: shiftRes };
      }

      case 'PLAYER_PAY_RENT': {
        return this.rentCoordination.payRent();
      }

      case 'PLAYER_PAY_INTERNET': {
        const netRes = this.owners.economy.payInternetBill();
        if (!netRes.success) return { success: false, error: netRes.error };
        this.owners.telemetry.logEvent('economy', 'internet_bill_paid', currentMinutes);
        this.publishState();
        return { success: true };
      }

      case 'JOB_APPLY': {
        return this.jobBoard.applyForGig(action.gigId);
      }

      case 'PLAYER_PLACE_ORDER': {
        return this.placeGroceryOrderHandler(action.items, action.fulfillment, currentMinutes);
      }

      default:
        return null;
    }
  }
}
