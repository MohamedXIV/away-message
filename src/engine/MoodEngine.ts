import type { EventBus } from './EventBus';
import type { EnvironmentSnapshot } from './EnvironmentEngine';
import type { PlayerNeedsSnapshot } from './PlayerNeedsEngine';

export type MoodBand = 'miserable' | 'low' | 'neutral' | 'good' | 'great';

export type MoodEffectKind =
  | 'pleasant_social_interaction'
  | 'argument'
  | 'rejection'
  | 'kept_promise'
  | 'broken_promise'
  | 'satisfying_activity'
  | 'stressful_failure'
  | 'meaningful_achievement';

export interface MoodEffect {
  id: string;
  kind: MoodEffectKind;
  sourceRef: string;
  startedAtMinute: number;
  expiresAtMinute: number;
}

export interface MoodPreferences {
  /**
   * Explicit player-specific environment preference. Missing entries are
   * neutral: rain/clear/storm never imply a universal mood response.
   */
  environmentAffinity: Partial<Record<EnvironmentSnapshot['weather']['condition'], -1 | 0 | 1>>;
}

export interface MoodState {
  baseline: number;
  effects: MoodEffect[];
  preferences: MoodPreferences;
  lastUpdatedMinute: number;
}

export interface MoodFinanceContext {
  cash: number;
  rentDueDay: number;
  rentAmount: number;
  rentPaid: boolean;
  currentDay: number;
}

export interface MoodContext {
  atMinute: number;
  needs: Readonly<PlayerNeedsSnapshot>;
  environment: Readonly<EnvironmentSnapshot>;
  finance?: Readonly<MoodFinanceContext>;
}

export interface MoodInfluence {
  id: string;
  kind: 'contextual' | 'transient';
  sourceRef: string;
  label: string;
  delta: number;
  expiresAtMinute?: number;
}

export interface MoodSnapshot {
  atMinute: number;
  value: number;
  band: MoodBand;
  baseline: number;
  influences: MoodInfluence[];
}

export interface ApplyMoodEffectInput {
  kind: MoodEffectKind;
  sourceRef: string;
  atMinute?: number;
}

interface MoodRule {
  magnitude: number;
  durationMinutes: number;
  label: string;
}

const EFFECT_RULES: Record<MoodEffectKind, MoodRule> = {
  pleasant_social_interaction: { magnitude: 8, durationMinutes: 240, label: 'Pleasant social interaction' },
  argument: { magnitude: -9, durationMinutes: 360, label: 'Argument' },
  rejection: { magnitude: -12, durationMinutes: 480, label: 'Rejection' },
  kept_promise: { magnitude: 6, durationMinutes: 360, label: 'Kept promise' },
  broken_promise: { magnitude: -10, durationMinutes: 480, label: 'Broken promise' },
  satisfying_activity: { magnitude: 5, durationMinutes: 180, label: 'Satisfying activity' },
  stressful_failure: { magnitude: -6, durationMinutes: 240, label: 'Stressful failure' },
  meaningful_achievement: { magnitude: 10, durationMinutes: 720, label: 'Meaningful achievement' },
};

type MoodInitialState = Partial<Omit<MoodState, 'effects' | 'preferences'>> & {
  effects?: MoodEffect[];
  preferences?: Partial<MoodPreferences>;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeMinute(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneEffect(effect: MoodEffect): MoodEffect {
  return { ...effect };
}

function clonePreferences(preferences: MoodPreferences): MoodPreferences {
  return { environmentAffinity: { ...preferences.environmentAffinity } };
}

function cloneSnapshot(snapshot: MoodSnapshot): MoodSnapshot {
  return {
    ...snapshot,
    influences: snapshot.influences.map((influence) => ({ ...influence })),
  };
}

function moodBand(value: number): MoodBand {
  if (value < 20) return 'miserable';
  if (value < 40) return 'low';
  if (value <= 60) return 'neutral';
  if (value <= 80) return 'good';
  return 'great';
}

function hydratePreferences(input?: Partial<MoodPreferences>): MoodPreferences {
  const environmentAffinity: MoodPreferences['environmentAffinity'] = {};
  for (const [condition, raw] of Object.entries(input?.environmentAffinity ?? {})) {
    if (raw !== -1 && raw !== 0 && raw !== 1) continue;
    environmentAffinity[condition as EnvironmentSnapshot['weather']['condition']] = raw;
  }
  return { environmentAffinity };
}

function hydrateEffect(input: MoodEffect): MoodEffect | null {
  if (!input || !(input.kind in EFFECT_RULES)) return null;
  const sourceRef = String(input.sourceRef ?? '').trim();
  if (!sourceRef) return null;
  const startedAtMinute = normalizeMinute(input.startedAtMinute);
  const expiresAtMinute = normalizeMinute(input.expiresAtMinute);
  if (expiresAtMinute <= startedAtMinute) return null;
  return {
    id: String(input.id || `${input.kind}:${sourceRef}`).slice(0, 220),
    kind: input.kind,
    sourceRef: sourceRef.slice(0, 160),
    startedAtMinute,
    expiresAtMinute,
  };
}

function hydrateState(initial?: MoodInitialState): MoodState {
  const effects = (initial?.effects ?? [])
    .map(hydrateEffect)
    .filter((effect): effect is MoodEffect => effect !== null)
    .sort((a, b) => a.startedAtMinute - b.startedAtMinute || a.id.localeCompare(b.id));
  return {
    baseline: clamp(finiteOr(initial?.baseline, 50)),
    effects,
    preferences: hydratePreferences(initial?.preferences),
    lastUpdatedMinute: normalizeMinute(finiteOr(initial?.lastUpdatedMinute, 0)),
  };
}

function snapshotSignature(snapshot: MoodSnapshot): string {
  return JSON.stringify({
    value: snapshot.value,
    band: snapshot.band,
    influences: snapshot.influences.map((influence) => ({
      id: influence.id,
      delta: influence.delta,
      sourceRef: influence.sourceRef,
    })),
  });
}

/**
 * Canonical player affect authority.
 *
 * Contextual influences are recomputed from canonical read snapshots and are
 * never appended to persisted state. Discrete callers submit semantic kinds
 * plus provenance; magnitude, duration, decay and duplicate behavior live here.
 */
export class MoodEngine {
  private state: MoodState;
  private lastPublished: MoodSnapshot | null = null;
  private lastPublishedSignature: string | null = null;

  public constructor(
    private readonly eventBus: EventBus,
    initialState?: MoodInitialState,
    private readonly contextProvider?: () => MoodContext,
  ) {
    this.state = hydrateState(initialState);
  }

  public getState(): Readonly<MoodState> {
    return {
      ...this.state,
      effects: this.state.effects.map(cloneEffect),
      preferences: clonePreferences(this.state.preferences),
    };
  }

  public loadState(state?: MoodInitialState): void {
    this.state = hydrateState(state);
    this.lastPublished = null;
    this.lastPublishedSignature = null;
  }

  public getCurrentSnapshot(): MoodSnapshot {
    return this.getSnapshot(this.requireCurrentContext());
  }

  public getSnapshot(rawContext: MoodContext): MoodSnapshot {
    const context: MoodContext = {
      ...rawContext,
      atMinute: normalizeMinute(rawContext.atMinute),
    };
    const influences = [
      ...this.contextualInfluences(context),
      ...this.transientInfluences(context.atMinute),
    ].sort((a, b) => a.id.localeCompare(b.id));
    const value = Math.round(clamp(
      this.state.baseline + influences.reduce((sum, influence) => sum + influence.delta, 0),
    ));

    return {
      atMinute: context.atMinute,
      value,
      band: moodBand(value),
      baseline: this.state.baseline,
      influences,
    };
  }

  /**
   * Apply a semantic experience. Duplicate kind+source while the effect is
   * still active is idempotent and never stacks every caller/tick.
   */
  public applyEffect(input: ApplyMoodEffectInput): boolean {
    const sourceRef = String(input.sourceRef ?? '').trim().slice(0, 160);
    if (!sourceRef) return false;
    const currentContext = this.contextProvider?.();
    const atMinute = normalizeMinute(
      input.atMinute ?? currentContext?.atMinute ?? this.state.lastUpdatedMinute,
    );
    this.pruneExpired(atMinute);

    const id = `${input.kind}:${sourceRef}`.slice(0, 220);
    if (this.state.effects.some((effect) => effect.id === id)) return false;

    const rule = EFFECT_RULES[input.kind];
    if (!rule) return false;
    this.state.effects.push({
      id,
      kind: input.kind,
      sourceRef,
      startedAtMinute: atMinute,
      expiresAtMinute: atMinute + rule.durationMinutes,
    });
    this.state.effects.sort((a, b) => a.startedAtMinute - b.startedAtMinute || a.id.localeCompare(b.id));
    this.state.lastUpdatedMinute = Math.max(this.state.lastUpdatedMinute, atMinute);
    if (this.contextProvider) this.publishIfChanged();
    return true;
  }

  public setEnvironmentAffinity(
    condition: EnvironmentSnapshot['weather']['condition'],
    affinity: -1 | 0 | 1,
  ): void {
    if (this.state.preferences.environmentAffinity[condition] === affinity) return;
    this.state.preferences.environmentAffinity[condition] = affinity;
    if (this.contextProvider) this.publishIfChanged();
  }

  /**
   * Reconcile expiry + effective value and emit only when the semantic mood
   * projection meaningfully changes. lastUpdatedMinute alone is not an event.
   */
  public publishIfChanged(context?: MoodContext): MoodSnapshot {
    const resolved = context ?? this.requireCurrentContext();
    const atMinute = normalizeMinute(resolved.atMinute);
    this.pruneExpired(atMinute);
    this.state.lastUpdatedMinute = Math.max(this.state.lastUpdatedMinute, atMinute);

    const current = this.getSnapshot({ ...resolved, atMinute });
    const signature = snapshotSignature(current);
    if (signature === this.lastPublishedSignature) return current;

    const previous = this.lastPublished ? cloneSnapshot(this.lastPublished) : null;
    this.lastPublished = cloneSnapshot(current);
    this.lastPublishedSignature = signature;
    this.eventBus.emit('mood:changed', {
      previous,
      current: cloneSnapshot(current),
    });
    return current;
  }

  private contextualInfluences(context: MoodContext): MoodInfluence[] {
    const out: MoodInfluence[] = [];
    const needs = context.needs;

    if (needs.isStarving) {
      out.push({
        id: 'context:needs:starving',
        kind: 'contextual',
        sourceRef: 'needs:hunger',
        label: 'Severe hunger',
        delta: -10,
      });
    } else if (needs.hungerBand === 'hungry') {
      out.push({
        id: 'context:needs:hungry',
        kind: 'contextual',
        sourceRef: 'needs:hunger',
        label: 'Hunger',
        delta: -4,
      });
    }

    if (needs.isExhausted) {
      out.push({
        id: 'context:needs:exhausted',
        kind: 'contextual',
        sourceRef: 'needs:energy-fatigue',
        label: 'Exhaustion',
        delta: -8,
      });
    } else if (needs.energyBand === 'tired') {
      out.push({
        id: 'context:needs:tired',
        kind: 'contextual',
        sourceRef: 'needs:energy',
        label: 'Tiredness',
        delta: -3,
      });
    }

    if (needs.health < 40) {
      out.push({
        id: 'context:needs:poor-health',
        kind: 'contextual',
        sourceRef: 'needs:health',
        label: 'Poor health',
        delta: -7,
      });
    }
    if (needs.sleepDebt >= 5) {
      out.push({
        id: 'context:needs:sleep-debt',
        kind: 'contextual',
        sourceRef: 'needs:sleep-debt',
        label: 'Sleep debt',
        delta: -4,
      });
    }

    const condition = context.environment.weather.condition;
    const environmentAffinity = this.state.preferences.environmentAffinity[condition] ?? 0;
    if (environmentAffinity !== 0) {
      out.push({
        id: 'context:environment:preference',
        kind: 'contextual',
        sourceRef: [
          `environment:${condition}`,
          ...context.environment.sourceEventIds.map((id) => `event:${id}`),
        ].join('|'),
        label: environmentAffinity > 0
          ? `Enjoying ${condition} weather`
          : `Discomfort with ${condition} weather`,
        delta: environmentAffinity * 4,
      });
    }

    const finance = context.finance;
    if (finance && !finance.rentPaid) {
      const daysUntilRent = finance.rentDueDay - finance.currentDay;
      const shortfall = finance.cash < finance.rentAmount;
      if (daysUntilRent < 0) {
        out.push({
          id: 'context:finance:rent-overdue',
          kind: 'contextual',
          sourceRef: `finance:rent:${finance.rentDueDay}`,
          label: 'Rent overdue',
          delta: -9,
        });
      } else if (shortfall && daysUntilRent <= 2) {
        out.push({
          id: 'context:finance:rent-pressure',
          kind: 'contextual',
          sourceRef: `finance:rent:${finance.rentDueDay}`,
          label: 'Rent pressure',
          delta: daysUntilRent <= 1 ? -6 : -4,
        });
      }
    }

    return out;
  }

  private transientInfluences(atMinute: number): MoodInfluence[] {
    const out: MoodInfluence[] = [];
    for (const effect of this.state.effects) {
      if (effect.startedAtMinute > atMinute || effect.expiresAtMinute <= atMinute) continue;
      const rule = EFFECT_RULES[effect.kind];
      const duration = effect.expiresAtMinute - effect.startedAtMinute;
      const remaining = effect.expiresAtMinute - atMinute;
      const ratio = duration > 0 ? clamp(remaining / duration, 0, 1) : 0;
      const delta = Math.round(rule.magnitude * ratio);
      if (delta === 0) continue;
      out.push({
        id: `transient:${effect.id}`,
        kind: 'transient',
        sourceRef: effect.sourceRef,
        label: rule.label,
        delta,
        expiresAtMinute: effect.expiresAtMinute,
      });
    }
    return out;
  }

  private pruneExpired(atMinute: number): void {
    this.state.effects = this.state.effects.filter(
      (effect) => effect.expiresAtMinute > atMinute,
    );
  }

  private requireCurrentContext(): MoodContext {
    if (!this.contextProvider) {
      throw new Error('MoodEngine current-context operation requires a context provider.');
    }
    return this.contextProvider();
  }
}
