import type { SimulationAction, ActionResult, SimulationState } from '../types';
import type { Fulfillment } from '../DeliveryEngine';
import { CityActivityCoordination } from './CityActivityCoordination';
import type { CoreDomainOwners } from './CoreDomainOwners';
import type { DesktopStorageCommands } from './DesktopStorageCommands';
import type { SocialInteractionCommands } from './SocialInteractionCommands';
import type { WorldNarrativeCommands } from './WorldNarrativeCommands';
import type { RentCoordination } from './RentCoordination';
import type { JobBoardCoordination } from './JobBoardCoordination';

/**
 * Coordinates player-facing commands against canonical domain owners.
 * Owns no player, clock, hardware, inventory or world state.
 * Callbacks provide the production dispatch/time/publication boundary so
 * calls from different shells cannot silently bypass derived game effects.
 */
export interface PlayerActionPorts {
  getActiveView(): SimulationState['activeView'];
  setActiveView(view: SimulationState['activeView']): void;
  advanceGameMinutes(minutes: number, reason?: string): void;
  notifySubscribers(): void;
  processDeliveries(): void;
  processJobReplies(): void;
  placeGroceryOrder(items: Array<{ sku: string; qty: number }>, fulfillment: Fulfillment, nowMinute: number): ActionResult;
}

export interface PlayerActionServices {
  desktopCommands: DesktopStorageCommands;
  socialCommands: SocialInteractionCommands;
  worldCommands: WorldNarrativeCommands;
  rentCoordination: RentCoordination;
  jobBoard: JobBoardCoordination;
  cityActivity: CityActivityCoordination;
}

export class PlayerActionRuntime {
  constructor(
    private readonly owners: CoreDomainOwners,
    private readonly services: PlayerActionServices,
    private readonly ports: PlayerActionPorts,
  ) {}

  private get activeView() { return this.ports.getActiveView(); }
  private set activeView(view: SimulationState['activeView']) { this.ports.setActiveView(view); }
  private get clock() { return this.owners.clock; }
  private get economy() { return this.owners.economy; }
  private get needs() { return this.owners.needs; }
  private get hardware() { return this.owners.hardware; }
  private get os() { return this.owners.os; }
  private get world() { return this.owners.world; }
  private get telemetry() { return this.owners.telemetry; }
  private get events() { return this.owners.events; }
  private get downloads() { return this.owners.downloads; }
  private get social() { return this.owners.social; }
  private get desktopCommands() { return this.services.desktopCommands; }
  private get socialCommands() { return this.services.socialCommands; }
  private get worldCommands() { return this.services.worldCommands; }
  private get rentCoordination() { return this.services.rentCoordination; }
  private notifySubscribers() { this.ports.notifySubscribers(); }
  private processDeliveries() { this.ports.processDeliveries(); }
  private processJobReplies() { this.ports.processJobReplies(); }
  private advanceGameMinutes(minutes: number, reason?: string) { this.ports.advanceGameMinutes(minutes, reason); }
  private applyForGig(gigId: string) { return this.services.jobBoard.applyForGig(gigId); }
  private travelTo(to: unknown, mode: unknown, options?: { ignoreFatigue?: boolean }) {
    return this.services.cityActivity.travelTo(to, mode, options);
  }
  private doCityOuting(outingId: string) { return this.services.cityActivity.doCityOuting(outingId); }
  private placeGroceryOrder(items: Array<{ sku: string; qty: number }>, fulfillment: Fulfillment, nowMinute: number) {
    return this.ports.placeGroceryOrder(items, fulfillment, nowMinute);
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    const currentMinutes = this.clock.getTotalMinutes();
    const desktopResult = this.desktopCommands.dispatch(action, currentMinutes);
    if (desktopResult !== null) return desktopResult;
    const socialResult = this.socialCommands.dispatch(action, currentMinutes);
    if (socialResult !== null) return socialResult;
    const worldResult = this.worldCommands.dispatch(action, currentMinutes);
    if (worldResult !== null) return worldResult;

    switch (action.type) {
      case 'TIME_ADVANCE_MINUTES': {
        this.advanceGameMinutes(action.minutes, action.reason);
        return { success: true };
      }

      case 'TIME_SET_PAUSED': {
        if (this.clock.isPaused() === action.paused) return { success: true };
        this.clock.setPaused(action.paused);
        this.notifySubscribers();
        return { success: true };
      }

      case 'VIEW_SWITCH': {
        // P7: sitting at the PC/room from out in the city walks you home first (time charged)
        if ((action.view === 'pc' || action.view === 'room') && this.economy.getLocation() !== 'home') {
          const home = this.travelTo('home', 'walk', { ignoreFatigue: true });
          if (!home.success) return { success: false, error: home.error };
        }
        this.activeView = action.view;
        // P5: visiting cafe/work counts as showing up for that day's meetings there
        if (action.view === 'cafe' || action.view === 'work') {
          try { this.world.setFlag(`visited_${action.view}_${this.clock.getTime().day}`, true); } catch { /* attendance is best-effort */ }
        }
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_EARN_CASH': {
        this.economy.earnCash(action.amount, action.reason);
        this.telemetry.logEvent('economy', 'cash_earned', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_SPEND_CASH': {
        const ok = this.economy.spendCash(action.amount, action.reason);
        if (!ok) return { success: false, error: 'Insufficient funds.' };
        this.telemetry.logEvent('economy', 'cash_spent', currentMinutes, {
          amount: action.amount,
          reason: action.reason,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_WORK_SHIFT': {
        // P7 gating: shifts are worked at the food cart
        const cartErr = CityActivityCoordination.requireLocation(this.economy.getLocation(), 'cart');
        if (cartErr) return { success: false, error: cartErr };
        const durationMinutes = action.durationMinutes ?? 240;
        const wage = action.wage ?? 62.0;
        const needResult = this.needs.applyWorkShift();
        if (!needResult.success) return { success: false, error: needResult.error };
        const hours = durationMinutes / 60;
        this.economy.earnCash(wage, `Work shift (${hours} hrs)`);
        this.events.emit('economy:shift_completed', {
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
        this.advanceGameMinutes(durationMinutes, 'Work Shift');
        this.telemetry.logEvent('economy', 'shift_worked', currentMinutes, {
          wage: shiftRes.earnedWage,
          hours: shiftRes.hours,
        });
        return { success: true, data: shiftRes };
      }

      case 'PLAYER_PAY_RENT': {
        return this.rentCoordination.payRent();
      }

      case 'PLAYER_PAY_INTERNET': {
        const netRes = this.economy.payInternetBill();
        if (!netRes.success) return { success: false, error: netRes.error };
        this.telemetry.logEvent('economy', 'internet_bill_paid', currentMinutes);
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_REST_OR_SLEEP': {
        const wakeHour = action.wakeHour ?? 8;
        const bedtimeHour = this.clock.getTime().hour; // P6.1 sleep quality needs bedtime
        const jump = this.clock.jumpToNextMorning(wakeHour, action.wakeMinute ?? 0);
        const hoursSlept = jump.elapsedMinutes / 60;
        this.needs.restOrSleep(hoursSlept, bedtimeHour);
        this.needs.advanceTime(jump.elapsedMinutes); // P6.1 you still get hungry overnight (slowly)
        this.processDeliveries(); // P6 couriers arrive while you sleep
        this.processJobReplies(); // P6 replies wait in the morning
        const newTotalMinutes = this.clock.getTotalMinutes();
        this.downloads.advanceTime(jump.elapsedMinutes, newTotalMinutes);
        this.social.updatePresence(newTotalMinutes);
        this.world.checkAndTriggerEvents(newTotalMinutes, jump.newTime.day);

        if (jump.dayChanged) {
          this.events.emit('time:day_changed', {
            newDay: jump.newTime.day,
            previousDay: jump.previousTime.day,
            time: jump.newTime,
          });
        }

        this.telemetry.logEvent('room', 'sleep', currentMinutes, {
          hoursSlept,
          wakeDay: jump.newTime.day,
        });
        // Social battery: a full night restores the introvert (+30, capped).
        this.needs.rechargeSocialBattery(30);
        this.notifySubscribers();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        // P7 gating: room comforts require the player's current home
        const roomErr = CityActivityCoordination.requireLocation(this.economy.getLocation(), 'home');
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
        // P6.1 noodles cost pantry money now (broke → honest failure, not free food)
        if (action.activity === 'meal') {
          const res = this.economy.eatMeal('noodles');
          if (!res.success) return { success: false, error: res.error };
        }
        if (action.activity === 'groceries') {
          const res = this.economy.eatMeal('groceries');
          if (!res.success) return { success: false, error: res.error };
        }
        this.advanceGameMinutes(dur, `Room interaction: ${action.activity}`);
        if (action.activity === 'tea' || action.activity === 'coffee') {
          this.needs.restoreEnergy(5);
          // Quiet rituals repay the introvert a little (+3 tea/coffee, +2 window below)
          this.needs.rechargeSocialBattery(3);
        } else if (action.activity === 'meal' || action.activity === 'groceries') {
          // Energy already handled inside eatMeal; time still passes above
        } else if (action.activity === 'shower') {
          this.needs.showerBoost();
        } else if (action.activity === 'window') {
          this.telemetry.recordWindowObservation();
          this.world.addWindowObservation(`window_day${this.clock.getTime().day}_${this.clock.getTotalMinutes()}`);
          this.needs.rechargeSocialBattery(2);
        }
        this.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        // Room mutations land after advanceGameMinutes() already notified once
        // (rebuilding the getState cache mid-handler). Notify again so reads
        // and subscribers observe the final tea/meal/shower/window state.
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_CITY_OUTING': {
        return this.doCityOuting(action.outingId);
      }

      case 'TRAVEL_TO': {
        return this.travelTo((action as { to: unknown }).to, (action as { mode: unknown }).mode);
      }

      case 'JOB_APPLY': {
        return this.applyForGig(action.gigId);
      }

      case 'PLAYER_PLACE_ORDER': {
        return this.placeGroceryOrder(action.items, action.fulfillment, currentMinutes);
      }

      case 'HARDWARE_UPGRADE_RAM': {
        if (!this.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford RAM upgrade ($${action.cost.toFixed(2)}).` };
        }
        this.economy.spendCash(action.cost, 'RAM Upgrade');
        const upgraded = this.hardware.upgradeRam(action.ramMB);
        if (!upgraded) return { success: false, error: 'Failed to upgrade RAM.' };
        this.telemetry.logEvent('hardware', 'ram_upgraded', currentMinutes, {
          ramMB: action.ramMB,
          cost: action.cost,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_CONNECTION': {
        if (!this.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford Internet upgrade ($${action.cost.toFixed(2)}).`,
          };
        }
        this.economy.spendCash(action.cost, 'Internet Plan Upgrade');
        this.hardware.upgradeConnection(action.connectionType);
        this.telemetry.logEvent('hardware', 'connection_upgraded', currentMinutes, {
          connection: action.connectionType,
        });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_OS': {
        if (!this.economy.canAfford(action.cost)) {
          return {
            success: false,
            error: `Cannot afford OS upgrade package ($${action.cost.toFixed(2)}).`,
          };
        }
        // Core OS engine handles all lineage, RAM/disk/stability, and multi-reboot realism
        const hwState = this.hardware.getState();
        const can = this.os.canInstall(action.targetOs as any, hwState as any, this.clock.getTime().day);
        if (!can.ok) return { success: false, error: can.reasons.join(' ') };
        const targetRel = can.release!;
        // Allocate disk upfront (heavy OS simulation)
        if (!this.hardware.allocateDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024)) {
          return { success: false, error: `Not enough disk for ${targetRel.displayName} (${targetRel.installSizeGB}GB required). Free some space.` };
        }
        this.economy.spendCash(action.cost, `OS Upgrade (${targetRel.displayName})`);
        const res = this.os.beginInstall(action.targetOs as any, hwState as any, this.clock.getTime().day, currentMinutes);
        if (!res.success) {
          // refund disk on failure
          this.hardware.freeDiskSpaceBytes(targetRel.installSizeGB * 1024 * 1024 * 1024);
          return { success: false, error: res.error };
        }
        // Realistic time: copying + reboots + finalizing (OsEngine logs minutes in install, we simulate)
        const ramFactor = hwState.ramMB < 768 ? 1.6 : hwState.ramMB < 1024 ? 1.2 : 1.0;
        const installMinutes = Math.round((22 + targetRel.installSizeGB * 14) * ramFactor) + (res.rebootCount ?? 2) * 3;
        this.advanceGameMinutes(installMinutes, `OS Install: ${targetRel.displayName} + ${res.rebootCount ?? 2} reboots`);
        // OS overhead already modeled via OsEngine.getRamOverheadMB() — HardwareEngine.calculateRamPressure reads it via sync? Keep hardware ramOverhead minimal here
        this.telemetry.logEvent('hardware', 'os_upgraded', currentMinutes, {
          targetOs: action.targetOs,
          displayName: targetRel.displayName,
          installMinutes,
          reboots: res.rebootCount,
          log: this.os.getInstallLog().slice(-3).join(' | '),
        });
        this.notifySubscribers();
        return { success: true, data: { ...res, release: targetRel, installMinutes } };
      }

      default:
        return { success: false, error: `Unhandled action: ${(action as any).type}` };
    }
  }
}
