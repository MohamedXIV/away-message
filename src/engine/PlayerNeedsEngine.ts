import type { EventBus } from './EventBus';

export interface PlayerNeedsState {
  energy: number;
  fatigue: number;
  hunger: number;
  health: number;
  sleepDebt: number;
  socialBattery: number;
}

export type EnergyBand = 'rested' | 'fine' | 'tired' | 'exhausted';
export type HungerBand = 'sated' | 'peckish' | 'hungry' | 'starving';

export interface PlayerNeedsSnapshot extends PlayerNeedsState {
  energyBand: EnergyBand;
  hungerBand: HungerBand;
  effectiveMaxEnergy: number;
  isExhausted: boolean;
  isStarving: boolean;
}

export interface WorkNeedResult {
  success: boolean;
  energySpent: number;
  fatigueAdded: number;
  error?: string;
}

export interface NeedsDayTransitionResult {
  emergencyFoodNeeded: boolean;
}

type PlayerNeedsInitialState = Partial<PlayerNeedsState>;

const DEFAULT_NEEDS: PlayerNeedsState = {
  energy: 100,
  fatigue: 0,
  hunger: 30,
  health: 90,
  sleepDebt: 0,
  socialBattery: 100,
};

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function hydrate(initial?: PlayerNeedsInitialState): PlayerNeedsState {
  return {
    energy: clamp(finiteOr(initial?.energy, DEFAULT_NEEDS.energy)),
    fatigue: clamp(finiteOr(initial?.fatigue, DEFAULT_NEEDS.fatigue)),
    hunger: clamp(finiteOr(initial?.hunger, DEFAULT_NEEDS.hunger)),
    health: clamp(finiteOr(initial?.health, DEFAULT_NEEDS.health)),
    sleepDebt: clamp(finiteOr(initial?.sleepDebt, DEFAULT_NEEDS.sleepDebt), 0, 10),
    socialBattery: clamp(finiteOr(initial?.socialBattery, DEFAULT_NEEDS.socialBattery)),
  };
}

function changedKeys(
  previous: PlayerNeedsState,
  current: PlayerNeedsState,
): Array<keyof PlayerNeedsState> {
  return (Object.keys(current) as Array<keyof PlayerNeedsState>)
    .filter((key) => previous[key] !== current[key]);
}

/**
 * Canonical owner for the player's body/social resources.
 *
 * Finance, physical inventory, spatial position and Mood deliberately do not
 * live here. Compatibility projections may read this state, but mutations
 * remain semantic commands on this engine.
 */
export class PlayerNeedsEngine {
  private state: PlayerNeedsState;

  public constructor(
    private readonly eventBus: EventBus,
    initialState?: PlayerNeedsInitialState,
  ) {
    this.state = hydrate(initialState);
  }

  public getState(): Readonly<PlayerNeedsState> {
    return { ...this.state };
  }

  public getSnapshot(): Readonly<PlayerNeedsSnapshot> {
    const state = this.getState();
    const effectiveMaxEnergy = this.effectiveMaxEnergy();
    return {
      ...state,
      energyBand: this.energyBand(state.energy),
      hungerBand: this.hungerBand(state.hunger),
      effectiveMaxEnergy,
      isExhausted: state.energy < 15 || state.fatigue >= 80,
      isStarving: state.hunger >= 90,
    };
  }

  public loadState(state: PlayerNeedsInitialState): void {
    this.state = hydrate(state);
  }

  public effectiveMaxEnergy(): number {
    let max = 100;
    if (this.state.hunger >= 80) max -= 20;
    max -= Math.min(30, Math.floor(this.state.sleepDebt) * 3);
    if (this.state.health < 40) max -= 10;
    return Math.max(40, max);
  }

  public getSocialBattery(): number {
    return this.state.socialBattery;
  }

  public spendSocialBattery(amount: number): boolean {
    const cost = Math.max(0, Math.round(finiteOr(amount, 0)));
    if (cost <= 0) return true;
    if (this.state.socialBattery < cost) return false;
    this.mutate('social-spend', () => {
      this.state.socialBattery = clamp(this.state.socialBattery - cost);
    });
    return true;
  }

  public drainSocialBattery(): void {
    this.mutate('social-drain', () => {
      this.state.socialBattery = 0;
    });
  }

  public rechargeSocialBattery(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.mutate('social-recharge', () => {
      this.state.socialBattery = clamp(Math.round(this.state.socialBattery + amount));
    });
  }

  public consumeEnergy(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.mutate('energy-consume', () => {
      this.state.energy = clamp(this.state.energy - amount);
    });
  }

  public restoreEnergy(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.mutate('energy-restore', () => {
      this.state.energy = Math.min(this.effectiveMaxEnergy(), this.state.energy + amount);
    });
  }

  public addFatigue(amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) return;
    this.mutate('fatigue', () => {
      this.state.fatigue = clamp(this.state.fatigue + amount);
    });
  }

  public addHunger(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.mutate('hunger', () => {
      this.state.hunger = clamp(this.state.hunger + delta);
    });
  }

  public addHealth(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.mutate('health', () => {
      this.state.health = clamp(this.state.health + delta);
    });
  }

  public advanceTime(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    this.mutate('time-drift', () => {
      this.state.hunger = clamp(this.state.hunger + minutes * 0.05);
    });
  }

  public restOrSleep(hours: number, bedtimeHour?: number): void {
    if (!Number.isFinite(hours) || hours <= 0) return;
    this.mutate('sleep', () => {
      const lateNight = bedtimeHour !== undefined && bedtimeHour >= 2 && bedtimeHour < 6;
      if (hours >= 6 && !lateNight) {
        this.state.sleepDebt = clamp(this.state.sleepDebt - 3, 0, 10);
        this.state.energy = this.effectiveMaxEnergy();
        this.state.fatigue = 0;
      } else if (hours >= 6) {
        this.state.energy = Math.min(this.effectiveMaxEnergy(), this.state.energy + 50);
        this.state.fatigue = clamp(this.state.fatigue - 40);
        this.state.sleepDebt = clamp(this.state.sleepDebt + 2, 0, 10);
      } else {
        this.state.energy = Math.min(this.effectiveMaxEnergy(), this.state.energy + hours * 15);
        this.state.fatigue = clamp(this.state.fatigue - hours * 20);
        this.state.sleepDebt = clamp(this.state.sleepDebt + 1, 0, 10);
      }
    });
  }

  public applyWorkShift(): WorkNeedResult {
    if (this.state.energy < 15) {
      return {
        success: false,
        energySpent: 0,
        fatigueAdded: 0,
        error: 'Too exhausted to work shift. Need sleep or rest.',
      };
    }
    const energySpent = this.state.energy < 30 ? 45 : 35;
    const fatigueAdded = 25;
    this.mutate('work-shift', () => {
      this.state.energy = clamp(this.state.energy - energySpent);
      this.state.fatigue = clamp(this.state.fatigue + fatigueAdded);
    });
    return { success: true, energySpent, fatigueAdded };
  }

  public applyMealEffects(
    hungerRelief: number,
    energyGain: number,
    healthGain: number,
  ): void {
    this.mutate('meal', () => {
      this.state.hunger = clamp(this.state.hunger - Math.max(0, hungerRelief));
      this.state.health = clamp(this.state.health + healthGain);
      this.state.energy = Math.min(
        this.effectiveMaxEnergy(),
        this.state.energy + Math.max(0, energyGain),
      );
    });
  }

  public showerBoost(): void {
    this.mutate('shower', () => {
      this.state.health = clamp(this.state.health + 2);
      this.state.energy = Math.min(this.effectiveMaxEnergy(), this.state.energy + 3);
    });
  }

  /**
   * Body-only day drift. The returned emergency-food request is deliberately
   * resolved by Simulation because paying for food belongs to Finance.
   */
  public handleDayTransition(): NeedsDayTransitionResult {
    this.mutate('day-transition', () => {
      if (this.state.hunger >= 90) this.state.health = clamp(this.state.health - 3);
      else if (this.state.hunger < 50) this.state.health = clamp(this.state.health + 3);
    });
    return { emergencyFoodNeeded: this.state.hunger >= 85 };
  }

  public applyEmergencyFoodRelief(): void {
    this.mutate('emergency-food', () => {
      this.state.hunger = Math.min(this.state.hunger, 70);
    });
  }

  public applyEmergencyFoodFailure(): void {
    this.addHealth(-5);
  }

  private energyBand(value: number): EnergyBand {
    if (value >= 75) return 'rested';
    if (value >= 45) return 'fine';
    if (value >= 20) return 'tired';
    return 'exhausted';
  }

  private hungerBand(value: number): HungerBand {
    if (value < 35) return 'sated';
    if (value < 60) return 'peckish';
    if (value < 85) return 'hungry';
    return 'starving';
  }

  private mutate(reason: string, change: () => void): void {
    const previous = { ...this.state };
    change();
    const changed = changedKeys(previous, this.state);
    if (changed.length === 0) return;

    const current = { ...this.state };
    this.eventBus.emit('needs:changed', {
      previous,
      current,
      changed,
      reason,
    });

    // Temporary compatibility event for legacy subscribers. PlayerNeedsEngine
    // remains the authority; #132 removes consumers of the economy namespace.
    if (changed.includes('energy')) {
      this.eventBus.emit('economy:energy_changed', {
        previousEnergy: previous.energy,
        newEnergy: current.energy,
        delta: current.energy - previous.energy,
      });
    }
  }
}
