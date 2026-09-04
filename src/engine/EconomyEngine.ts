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
      // P6.1 body (old saves backfill to a fresh, healthy start)
      hunger: initialState?.hunger ?? 30,
      health: initialState?.health ?? 90,
      sleepDebt: initialState?.sleepDebt ?? 0,
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
    this.state.energy = Math.min(this.effectiveMaxEnergy(), this.state.energy + amount);
    this.eventBus.emit('economy:energy_changed', {
      previousEnergy: prev,
      newEnergy: this.state.energy,
      delta: amount,
    });
  }

  public addFatigue(amount: number): void {
    this.state.fatigue = Math.min(100, Math.max(0, this.state.fatigue + amount));
  }

  public restOrSleep(hours: number, bedtimeHour?: number): void {
    // P6.1 sleep quality: crashing after 2am halves recovery and adds debt;
    // short nights repay proportionally; good nights clear debt.
    const lateNight = bedtimeHour !== undefined && bedtimeHour >= 2 && bedtimeHour < 6;
    if (hours >= 6 && !lateNight) {
      // Good nights repay debt first, then restore to the (improved) ceiling —
      // heavy debt takes several good nights to fully clear.
      this.state.sleepDebt = Math.max(0, this.state.sleepDebt - 3);
      this.state.energy = this.effectiveMaxEnergy();
      this.state.fatigue = 0;
    } else if (hours >= 6) {
      this.restoreEnergy(50);
      this.state.fatigue = Math.max(0, this.state.fatigue - 40);
      this.state.sleepDebt = Math.min(10, this.state.sleepDebt + 2);
    } else {
      this.restoreEnergy(hours * 15);
      this.state.fatigue = Math.max(0, this.state.fatigue - (hours * 20));
      this.state.sleepDebt = Math.min(10, this.state.sleepDebt + 1);
    }
  }

  // ==========================================
  // P6.1 — BODY (hunger / health / sleep debt)
  // Lenient by design: penalties cap energy and nudge, never trap or kill.
  // ==========================================

  /** Time passes: hunger rises ~3/hour. Called from every simulation time path. */
  public advanceTime(minutes: number): void {
    if (minutes <= 0) return;
    this.state.hunger = Math.min(100, this.state.hunger + minutes * 0.05);
  }

  /**
   * Energy ceiling from body state: starving -20, each sleep debt -3 (max -30),
   * poor health -10. Floor 40 — the day is always playable.
   */
  public effectiveMaxEnergy(): number {
    let max = 100;
    if (this.state.hunger >= 80) max -= 20;
    max -= Math.min(30, Math.floor(this.state.sleepDebt) * 3);
    if (this.state.health < 40) max -= 10;
    return Math.max(40, max);
  }

  /** Eat a meal. Returns false when broke (no debt, no shame — just hunger). */
  public eatMeal(kind: 'noodles' | 'groceries' | 'snack'): { success: boolean; error?: string } {
    const specs: Record<string, { cost: number; hungerRelief: number; energyGain: number; healthGain: number }> = {
      noodles: { cost: 3, hungerRelief: 35, energyGain: 10, healthGain: 0 },
      groceries: { cost: 8, hungerRelief: 70, energyGain: 12, healthGain: 3 },
      snack: { cost: 2, hungerRelief: 15, energyGain: 5, healthGain: -1 },
    };
    const spec = specs[kind];
    if (!spec) return { success: false, error: `Unknown meal: ${kind}` };
    if (!this.spendCash(spec.cost, `Meal (${kind})`)) {
      return { success: false, error: `Cannot afford ${kind} ($${spec.cost.toFixed(2)}).` };
    }
    this.state.hunger = Math.max(0, this.state.hunger - spec.hungerRelief);
    this.state.health = Math.min(100, Math.max(0, this.state.health + spec.healthGain));
    this.restoreEnergy(spec.energyGain);
    return { success: true };
  }

  /** Hot shower: small health bump + a little energy. Kindness, not strategy. */
  public showerBoost(): void {
    this.state.health = Math.min(100, this.state.health + 2);
    this.restoreEnergy(3);
  }

  public handleDayTransition(newDay: number): void {
    // Deduct basic food & sundry expense if cash allows
    if (this.state.cash >= this.state.dailyFoodCost) {
      this.spendCash(this.state.dailyFoodCost, `Daily food & sundry expenses (Day ${newDay})`);
    }

    // P6.1 body drift (lenient, self-correcting):
    // - starving all day costs health; eating well restores it
    // - utterly starving forces a sad $4 chips run (or more health loss when broke)
    if (this.state.hunger >= 90) this.state.health = Math.max(0, this.state.health - 3);
    else if (this.state.hunger < 50) this.state.health = Math.min(100, this.state.health + 3);
    if (this.state.hunger >= 85) {
      if (this.spendCash(4, `Late-night chips (too hungry to sleep, Day ${newDay})`)) {
        this.state.hunger = Math.min(this.state.hunger, 70);
      } else {
        this.state.health = Math.max(0, this.state.health - 5);
      }
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
