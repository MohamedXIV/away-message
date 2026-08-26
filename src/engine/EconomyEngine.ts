import { PlayerState, EnergyStatus, WorkShiftResult } from './types';
import { EventBus } from './EventBus';

export class EconomyEngine {
  private state: PlayerState;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: Partial<PlayerState>) {
    this.eventBus = eventBus;
    this.state = {
      cash: initialState?.cash ?? 38.0,
      energy: initialState?.energy ?? 100,
      fatigue: initialState?.fatigue ?? 0,
      rentDueDay: initialState?.rentDueDay ?? 7,
      rentAmount: initialState?.rentAmount ?? 140.0,
      rentPaid: initialState?.rentPaid ?? false,
      internetBillDueDay: initialState?.internetBillDueDay ?? 5,
      internetBillAmount: initialState?.internetBillAmount ?? 25.0,
      internetBillPaid: initialState?.internetBillPaid ?? false,
      dailyFoodCost: initialState?.dailyFoodCost ?? 10.0,
    };
  }

  public getState(): Readonly<PlayerState> {
    return { ...this.state };
  }

  public getCash(): number {
    return this.state.cash;
  }

  public canAfford(amount: number): boolean {
    return this.state.cash >= amount;
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
    if (this.state.cash < amount) {
      return false;
    }
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

  public performWorkShift(durationMinutes = 240, baseWage = 62.0): WorkShiftResult {
    if (this.state.energy < 15) {
      return {
        success: false,
        hours: 0,
        earnedWage: 0,
        energySpent: 0,
        fatigueAdded: 0,
        error: 'Too exhausted to work shift. Need sleep or rest.',
      };
    }

    const energyCost = this.state.energy < 30 ? 45 : 35;
    const fatigueAdd = 25;
    const hours = durationMinutes / 60;

    this.consumeEnergy(energyCost);
    this.addFatigue(fatigueAdd);
    this.earnCash(baseWage, `Work shift (${hours} hrs)`);

    this.eventBus.emit('economy:shift_completed', {
      wage: baseWage,
      hours,
      energySpent: energyCost,
    });

    return {
      success: true,
      hours,
      earnedWage: baseWage,
      energySpent: energyCost,
      fatigueAdded: fatigueAdd,
    };
  }

  public payRent(): { success: boolean; error?: string } {
    if (this.state.rentPaid) {
      return { success: false, error: 'Rent is already paid for current period.' };
    }
    if (this.state.cash < this.state.rentAmount) {
      return { success: false, error: `Insufficient funds for rent ($${this.state.rentAmount.toFixed(2)}).` };
    }

    this.spendCash(this.state.rentAmount, `Motel rent payment (Due Day ${this.state.rentDueDay})`);
    this.state.rentPaid = true;

    this.eventBus.emit('economy:rent_paid', {
      day: this.state.rentDueDay,
      amount: this.state.rentAmount,
    });

    return { success: true };
  }

  public payInternetBill(): { success: boolean; error?: string } {
    if (this.state.internetBillPaid) {
      return { success: false, error: 'Internet bill already paid.' };
    }
    if (this.state.cash < this.state.internetBillAmount) {
      return { success: false, error: `Insufficient funds for internet bill ($${this.state.internetBillAmount.toFixed(2)}).` };
    }

    this.spendCash(this.state.internetBillAmount, `DSL internet bill (Due Day ${this.state.internetBillDueDay})`);
    this.state.internetBillPaid = true;
    return { success: true };
  }

  public consumeEnergy(amount: number): void {
    if (amount <= 0) return;
    const prev = this.state.energy;
    this.state.energy = Math.max(0, this.state.energy - amount);
    this.eventBus.emit('economy:energy_changed', {
      previousEnergy: prev,
      newEnergy: this.state.energy,
      delta: -amount,
    });
  }

  public restoreEnergy(amount: number): void {
    if (amount <= 0) return;
    const prev = this.state.energy;
    this.state.energy = Math.min(100, this.state.energy + amount);
    this.eventBus.emit('economy:energy_changed', {
      previousEnergy: prev,
      newEnergy: this.state.energy,
      delta: amount,
    });
  }

  public addFatigue(amount: number): void {
    this.state.fatigue = Math.min(100, Math.max(0, this.state.fatigue + amount));
  }

  public restOrSleep(hours: number): void {
    if (hours >= 6) {
      this.state.energy = 100;
      this.state.fatigue = 0;
    } else {
      this.restoreEnergy(hours * 15);
      this.state.fatigue = Math.max(0, this.state.fatigue - (hours * 20));
    }
  }

  public handleDayTransition(newDay: number): void {
    // Deduct basic food & sundry expense if cash allows
    if (this.state.cash >= this.state.dailyFoodCost) {
      this.spendCash(this.state.dailyFoodCost, `Daily food & sundry expenses (Day ${newDay})`);
    }

    // Check Rent Status
    if (newDay > this.state.rentDueDay && !this.state.rentPaid) {
      // Late rent penalty: $15 late fee
      this.state.rentAmount += 15;
      this.eventBus.emit('economy:rent_due', {
        day: this.state.rentDueDay,
        amount: this.state.rentAmount,
      });
    }

    // Advance rent cycle after Day 7 is resolved
    if (newDay > 7 && this.state.rentDueDay === 7 && this.state.rentPaid) {
      this.state.rentDueDay = 14;
      this.state.rentPaid = false;
      this.state.rentAmount = 140.0;
    }

    // Advance internet bill cycle
    if (newDay > 5 && this.state.internetBillDueDay === 5 && this.state.internetBillPaid) {
      this.state.internetBillDueDay = 12;
      this.state.internetBillPaid = false;
    }
  }

  public getEnergyStatus(): EnergyStatus {
    const e = this.state.energy;
    if (e >= 75) return 'Rested';
    if (e >= 45) return 'Fine';
    if (e >= 20) return 'Tired';
    return 'Exhausted';
  }

  public loadState(state: PlayerState): void {
    this.state = { ...state };
  }
}
