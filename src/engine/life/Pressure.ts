import type {
  FatigueBand,
  FidelityTier,
  InterruptionTolerance,
  LifeMatrixSnapshot,
  LifePressureView,
  LifeRoutineWindow,
  NeedPressureKind,
  NpcPressureState,
  StressBand,
} from './types';

export interface NpcPressureAdvanceContext {
  day?: number;
  routineWindows?: LifeRoutineWindow[];
  isAtWork?: boolean;
  inAppointment?: boolean;
  hasRecentConflict?: boolean;
}

const FATIGUE_NUMERIC: Record<FatigueBand, number> = {
  rested: 10,
  normal: 35,
  tired: 65,
  exhausted: 90,
};

const STRESS_NUMERIC: Record<StressBand, number> = {
  calm: 10,
  normal: 30,
  stressed: 70,
  overwhelmed: 95,
};

export function deriveDefaultNpcPressure(
  actorId: string,
  traits?: Partial<LifeMatrixSnapshot['traits']>,
  _routine?: LifeRoutineWindow[],
  tier: FidelityTier = 'important_local',
): NpcPressureState {
  const warmth = traits?.warmth ?? 50;
  const discipline = traits?.discipline ?? 50;
  const spontaneity = traits?.spontaneity ?? 50;

  const fatigueBand: FatigueBand = 'rested';
  const stressBand: StressBand = 'calm';
  const mood = spontaneity >= 70 ? 'cheerful' : warmth >= 60 ? 'content' : 'neutral';
  const interruptionTolerance: InterruptionTolerance =
    tier === 'background_remote' ? 'flexible' : discipline >= 70 ? 'flexible' : 'open';

  return {
    actorId,
    fatigueBand,
    stressBand,
    mood,
    interruptionTolerance,
    moneyBand: 'stable',
    activeNeeds: [],
    lastUpdatedMinute: 0,
    tier,
  };
}

export function advanceNpcPressure(
  state: NpcPressureState,
  fromMinute: number,
  toMinute: number,
  context: NpcPressureAdvanceContext,
): NpcPressureState {
  const elapsed = Math.max(0, toMinute - fromMinute);
  if (elapsed <= 0) {
    return {
      ...state,
      activeNeeds: [...state.activeNeeds],
    };
  }

  // Background / remote actors receive only abstract, cheap updates.
  if (state.tier === 'background_remote') {
    return {
      ...state,
      lastUpdatedMinute: toMinute,
      interruptionTolerance: 'flexible',
      activeNeeds: [...state.activeNeeds],
    };
  }

  // Evaluate fatigue deterministically based on activity and duration.
  const cumulativeWorkMinutes = context.isAtWork
    ? (state.cumulativeWorkMinutes ?? 0) + elapsed
    : 0;

  let fatigueBand: FatigueBand = state.fatigueBand;
  if (context.isAtWork) {
    if (cumulativeWorkMinutes >= 480) {
      fatigueBand = 'tired';
    } else if (cumulativeWorkMinutes >= 240) {
      fatigueBand = 'normal';
    }
  }

  // Evaluate stress deterministically.
  let stressBand: StressBand = state.stressBand;
  if (context.hasRecentConflict) {
    stressBand = 'stressed';
  } else if (context.isAtWork && cumulativeWorkMinutes >= 480) {
    stressBand = 'normal';
  }

  // Interruption tolerance
  let interruptionTolerance: InterruptionTolerance = 'open';
  if (state.tier === 'important_local') {
    if (context.inAppointment) {
      interruptionTolerance = 'do_not_disturb';
    } else if (context.isAtWork) {
      interruptionTolerance = cumulativeWorkMinutes >= 360 ? 'do_not_disturb' : 'busy';
    } else if (fatigueBand === 'exhausted') {
      interruptionTolerance = 'busy';
    } else {
      interruptionTolerance = 'open';
    }
  } else {
    // local_offscreen
    interruptionTolerance = context.isAtWork ? 'busy' : 'open';
  }

  // Broad mood
  let mood = state.mood;
  if (stressBand === 'stressed' || fatigueBand === 'exhausted') {
    mood = 'irritable';
  } else if (context.isAtWork) {
    mood = 'focused';
  } else {
    mood = 'content';
  }

  // Active needs
  const activeNeeds: NeedPressureKind[] = [];
  if (fatigueBand === 'tired' || fatigueBand === 'exhausted') {
    activeNeeds.push('rest');
  }
  if (context.isAtWork && cumulativeWorkMinutes >= 240) {
    activeNeeds.push('meal');
  }

  return {
    ...state,
    fatigueBand,
    stressBand,
    mood,
    interruptionTolerance,
    activeNeeds,
    lastUpdatedMinute: toMinute,
    cumulativeWorkMinutes,
  };
}

export function projectLifePressureView(
  state: NpcPressureState,
  _atMinute: number,
): LifePressureView {
  return {
    fatigueBand: state.fatigueBand,
    stressBand: state.stressBand,
    mood: state.mood,
    interruptionTolerance: state.interruptionTolerance,
    moneyBand: state.moneyBand,
    activeNeeds: [...state.activeNeeds],
    fatigue: FATIGUE_NUMERIC[state.fatigueBand],
    stress: STRESS_NUMERIC[state.stressBand],
    departure: 0,
  };
}
