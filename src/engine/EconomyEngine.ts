import { PlayerState, EnergyStatus, WorkShiftResult } from './types';
import { EventBus } from './EventBus';
import { isCityNodeId, type CityNodeId } from './CityMap';
import { PlayerNeedsEngine } from './PlayerNeedsEngine';

type NeedsKey = 'energy' | 'fatigue' | 'hunger' | 'health' | 'sleepDebt' | 'socialBattery';
type EconomyOwnedState = Omit<PlayerState, NeedsKey>;

function readOwnedState(initialState?: Partial<PlayerState>): EconomyOwnedState {
  return {
    cash: initialState?.cash ?? 38.0,
    rentDueDay: initialState?.rentDueDay ?? 7,
    rentAmount: initialState?.rentAmount ?? initialState?.recurringRentAmount ?? 140.0,
    recurringRentAmount: initialState?.recurringRentAmount ?? initialState?.rentAmount ?? 140.0,
    rentPaid: initialState?.rentPaid ?? false,
    internetBillDueDay: initialState?.internetBillDueDay ?? 5,
    internetBillAmount: initialState?.internetBillAmount ?? 25.0,
    internetBillPaid: initialState?.internetBillPaid ?? false,
    dailyFoodCost: initialState?.dailyFoodCost ?? 10.0,
    pantry: {
      noodles: initialState?.pantry?.noodles ?? 2,
      groceries: initialState?.pantry?.groceries ?? 0,
    },
    location: isCityNodeId(initialState?.location) ? initialState.location : 'home',
  };
}

/**
 * Finance authority plus a temporary legacy PlayerState projection.
 *
 * Canonical needs live in PlayerNeedsEngine. Pantry/location stay here only as
 * pre-existing compatibility state until their established physical/spatial
 * owners fully retire these fields; they are not part of Player Needs.
 */
export class EconomyEngine {
  private state: EconomyOwnedState;
  private readonly needs: PlayerNeedsEngine;
  private readonly ownsNeedsFallback: boolean;

  constructor(
    private readonly eventBus: EventBus,
    initialState?: Partial<PlayerState>,
    needs?: PlayerNeedsEngine,
  ) {
    this.state = readOwnedState(initialState);
    this.needs = needs ?? new PlayerNeedsEngine(eventBus, initialState);
    this.ownsNeedsFallback = !needs;
  }

  /** @deprecated Compatibility projection. New body/social reads use PlayerNeedsEngine. */
  public getState(): Readonly<PlayerState> {
    return {
      ...this.state,
      pantry: { ...this.state.pantry },
      ...this.needs.getState(),
    };
  }

  public getCash(): number {
    return this.state.cash;
  }

  public canAfford(amount: number): boolean {
    return this.state.cash >= amount;
  }

  public setRecurringRentAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Recurring rent must be a non-negative finite number.');
    }
    this.state.recurringRentAmount = amount;
    if (!this.state.rentPaid) this.state.rentAmount = amount;
  }

  /** @deprecated use SimulationEngine.needs. */
  public getSocialBattery(): number {
    return this.needs.getSocialBattery();
  }

  /** @deprecated use SimulationEngine.needs. */
  public spendSocialBattery(amount: number): boolean {
    return this.needs.spendSocialBattery(amount);
  }

  /** @deprecated use SimulationEngine.needs. */
  public drainSocialBattery(): void {
    this.needs.drainSocialBattery();
  }

  /** @deprecated use SimulationEngine.needs. */
  public rechargeSocialBattery(amount: number): void {
    this.needs.rechargeSocialBattery(amount);
  }

  public earnCash(amount: number, reason: string): void {
    if (amount <= 0) return;
    const previousCash = this.state.cash;
    this.state.cash = Number((this.state.cash + amount).toFixed(2));
    this.eventBus.emit('economy:cash_changed', {
      previousCash,
      newCash: this.state.cash,
      delta: amount,
      reason,
    });
  }

  public spendCash(amount: number, reason: string): boolean {
    if (amount <= 0) return true;
    if (this.state.cash < amount) return false;
    const previousCash = this.state.cash;
    this.state.cash = Number((this.state.cash - amount).toFixed(2));
    this.eventBus.emit('economy:cash_changed', {
      previousCash,
      newCash: this.state.cash,
      delta: -amount,
      reason,
    });
    return true;
  }

  /**
   * @deprecated Compatibility orchestration for direct legacy callers.
   * Runtime work shifts are coordinated by SimulationEngine.
   */
  public performWorkShift(durationMinutes = 240, baseWage = 62.0): WorkShiftResult {
    const needResult = this.needs.applyWorkShift();
    if (!needResult.success) {
      return {
        success: false,
        hours: 0,
        earnedWage: 0,
        energySpent: 0,
        fatigueAdded: 0,
        error: needResult.error,
      };
    }
    const hours = durationMinutes / 60;
    this.earnCash(baseWage, `Work shift (${hours} hrs)`);
    this.eventBus.emit('economy:shift_completed', {
      wage: baseWage,
      hours,
      energySpent: needResult.energySpent,
    });
    return {
      success: true,
      hours,
      earnedWage: baseWage,
      energySpent: needResult.energySpent,
      fatigueAdded: needResult.fatigueAdded,
    };
  }

  public payRent(): { success: boolean; error?: string } {
    if (this.state.rentPaid) return { success: false, error: 'Rent is already paid for current period.' };
    if (this.state.cash < this.state.rentAmount) {
      return { success: false, error: `Insufficient funds for rent ($${this.state.rentAmount.toFixed(2)}).` };
    }
    this.spendCash(this.state.rentAmount, `Rent payment (Due Day ${this.state.rentDueDay})`);
    this.state.rentPaid = true;
    this.eventBus.emit('economy:rent_paid', {
      day: this.state.rentDueDay,
      amount: this.state.rentAmount,
    });
    return { success: true };
  }

  public payInternetBill(): { success: boolean; error?: string } {
    if (this.state.internetBillPaid) return { success: false, error: 'Internet bill already paid.' };
    if (this.state.cash < this.state.internetBillAmount) {
      return { success: false, error: `Insufficient funds for internet bill ($${this.state.internetBillAmount.toFixed(2)}).` };
    }
    this.spendCash(this.state.internetBillAmount, `DSL internet bill (Due Day ${this.state.internetBillDueDay})`);
    this.state.internetBillPaid = true;
    return { success: true };
  }

  /** @deprecated use PlayerNeedsEngine. */
  public consumeEnergy(amount: number): void { this.needs.consumeEnergy(amount); }
  /** @deprecated use PlayerNeedsEngine. */
  public restoreEnergy(amount: number): void { this.needs.restoreEnergy(amount); }
  /** @deprecated use PlayerNeedsEngine. */
  public addFatigue(amount: number): void { this.needs.addFatigue(amount); }
  /** @deprecated use PlayerNeedsEngine. */
  public restOrSleep(hours: number, bedtimeHour?: number): void { this.needs.restOrSleep(hours, bedtimeHour); }
  /** @deprecated use PlayerNeedsEngine. */
  public advanceTime(minutes: number): void { this.needs.advanceTime(minutes); }
  /** @deprecated use PlayerNeedsEngine. */
  public effectiveMaxEnergy(): number { return this.needs.effectiveMaxEnergy(); }

  /**
   * @deprecated Legacy meal transaction. Pantry/cash remain outside Needs;
   * only the nutritional effect is delegated to the canonical Needs owner.
   */
  public eatMeal(kind: 'noodles' | 'groceries' | 'snack'): { success: boolean; error?: string } {
    const specs: Record<string, {
      cost: number;
      hungerRelief: number;
      energyGain: number;
      healthGain: number;
      pantry?: 'noodles' | 'groceries';
    }> = {
      noodles: { cost: 3, hungerRelief: 35, energyGain: 10, healthGain: 0, pantry: 'noodles' },
      groceries: { cost: 8, hungerRelief: 70, energyGain: 12, healthGain: 3, pantry: 'groceries' },
      snack: { cost: 2, hungerRelief: 15, energyGain: 5, healthGain: -1 },
    };
    const spec = specs[kind];
    if (!spec) return { success: false, error: `Unknown meal: ${kind}` };
    if (spec.pantry && (this.state.pantry[spec.pantry] ?? 0) < 1) {
      return { success: false, error: `No ${spec.pantry} left in the pantry — order more first.` };
    }
    if (!this.spendCash(spec.cost, `Meal (${kind})`)) {
      return { success: false, error: `Cannot afford ${kind} ($${spec.cost.toFixed(2)}).` };
    }
    if (spec.pantry) this.state.pantry[spec.pantry] -= 1;
    this.needs.applyMealEffects(spec.hungerRelief, spec.energyGain, spec.healthGain);
    return { success: true };
  }

  public addPantry(kind: 'noodles' | 'groceries', qty: number): void {
    if ((kind !== 'noodles' && kind !== 'groceries') || !Number.isFinite(qty) || qty <= 0) return;
    this.state.pantry[kind] = Math.min(99, (this.state.pantry[kind] ?? 0) + Math.floor(qty));
  }

  /** Legacy spatial compatibility only; Player Needs has no location API. */
  public getLocation(): CityNodeId {
    return this.state.location;
  }

  /** Legacy spatial compatibility only; Player Needs has no location API. */
  public setLocation(next: CityNodeId): void {
    if (!isCityNodeId(next)) return;
    this.state.location = next;
  }

  /** @deprecated use PlayerNeedsEngine. */
  public showerBoost(): void { this.needs.showerBoost(); }
  /** @deprecated use PlayerNeedsEngine. */
  public addHunger(delta: number): void { this.needs.addHunger(delta); }
  /** @deprecated use PlayerNeedsEngine. */
  public addHealth(delta: number): void { this.needs.addHealth(delta); }

  /** Finance-only daily transition. Body drift is orchestrated by SimulationEngine. */
  public handleDayTransition(newDay: number): void {
    if (this.state.cash >= this.state.dailyFoodCost) {
      this.spendCash(this.state.dailyFoodCost, `Daily food & sundry expenses (Day ${newDay})`);
    }

    if (newDay > this.state.rentDueDay && !this.state.rentPaid) {
      this.state.rentAmount += 15;
      this.eventBus.emit('economy:rent_due', {
        day: this.state.rentDueDay,
        amount: this.state.rentAmount,
      });
    }

    if (newDay > 7 && this.state.rentDueDay === 7 && this.state.rentPaid) {
      this.state.rentDueDay = 14;
      this.state.rentPaid = false;
      this.state.rentAmount = this.state.recurringRentAmount ?? this.state.rentAmount;
    }

    if (newDay > 5 && this.state.internetBillDueDay === 5 && this.state.internetBillPaid) {
      this.state.internetBillDueDay = 12;
      this.state.internetBillPaid = false;
    }
  }

  /** @deprecated use PlayerNeedsEngine.getSnapshot().energyBand. */
  public getEnergyStatus(): EnergyStatus {
    const band = this.needs.getSnapshot().energyBand;
    if (band === 'rested') return 'Rested';
    if (band === 'fine') return 'Fine';
    if (band === 'tired') return 'Tired';
    return 'Exhausted';
  }

  public loadState(state: PlayerState): void {
    this.state = readOwnedState(state);
    if (this.ownsNeedsFallback) this.needs.loadState(state);
  }
}
