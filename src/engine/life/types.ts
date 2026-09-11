export interface LifeRoutineWindow {
  day: number;
  startMinute: number;
  endMinute: number;
  status: string;
  awayMessage: string;
}

export interface LifeAgendaEntry {
  id: string;
  kind: string;
  label: string;
  day: number;
  startMinute: number;
  endMinute?: number;
}

export interface LifeRelationshipView {
  targetId: string;
  familiarity: number;
  trust: number;
  comfort: number;
  respect: number;
  annoyance: number;
  affection: number;
  attraction: number;
  suspicion: number;
  resentment: number;
}

export interface LifePromiseView {
  id?: string;
  text: string;
  dueDay?: number;
  fulfilled?: boolean;
}

export interface LifeAppointmentView {
  id: string;
  characterId: string;
  locationId: string;
  targetDay: number;
  startMinute: number;
  endMinute?: number;
  rsvp?: string;
  status?: string;
  origin?: { kind: 'job'; id: string };
}

export interface LifeWorldEventView {
  id: string;
  title: string;
  category: string;
  triggerDay: number;
  triggeredAtMinute?: number;
}

/**
 * Read-only active-effect view (#46). Provenance only: it references the
 * source event and the authored modifier, never event mutable status,
 * attitudes, takes, or consumer outcomes. Recomputed on demand, never
 * persisted.
 */
export interface LifeWorldModifierView {
  modifierId: string;
  sourceEventId: string;
  domain: string;
  kind: string;
  startsAtMinute: number;
  endsAtMinute?: number;
  value?: number | string | boolean;
}

export interface LifePresenceView {
  messengerStatus: string;
  awayMessage?: string;
}

export type FatigueBand = 'rested' | 'normal' | 'tired' | 'exhausted';
export type StressBand = 'calm' | 'normal' | 'stressed' | 'overwhelmed';
export type BroadMood =
  | 'content'
  | 'cheerful'
  | 'melancholy'
  | 'anxious'
  | 'irritable'
  | 'focused'
  | 'neutral';
export type InterruptionTolerance = 'open' | 'flexible' | 'busy' | 'do_not_disturb';
export type MoneyBand = 'tight' | 'stable' | 'flush';
export type NeedPressureKind = 'rest' | 'social' | 'quiet' | 'errand' | 'meal';
export type FidelityTier = 'important_local' | 'local_offscreen' | 'background_remote';

export interface LifePressureView {
  departure?: number;
  fatigue?: number;
  stress?: number;
  fatigueBand?: FatigueBand;
  stressBand?: StressBand;
  mood?: BroadMood;
  interruptionTolerance?: InterruptionTolerance;
  moneyBand?: MoneyBand;
  activeNeeds?: NeedPressureKind[];
}

export type GoalKind =
  | 'save_purchase'
  | 'find_work'
  | 'improve_relationship'
  | 'distance_relationship'
  | 'spend_time'
  | 'attend_event'
  | 'practical_task'
  | 'upgrade_gear'
  | 'change_circumstance';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface PersonalGoal {
  id: string;
  actorId: string;
  kind: GoalKind;
  description: string;
  targetId?: string;
  priority: number;
  status: GoalStatus;
  progress: number;
  createdDay: number;
  targetDay?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface NpcPressureState {
  actorId: string;
  fatigueBand: FatigueBand;
  stressBand: StressBand;
  mood: BroadMood;
  interruptionTolerance: InterruptionTolerance;
  moneyBand?: MoneyBand;
  activeNeeds: NeedPressureKind[];
  lastUpdatedMinute: number;
  tier: FidelityTier;
  cumulativeWorkMinutes?: number;
}

/**
 * Canonical per-actor #43 slice: goals + irreducible pressure only.
 * No relationship/economy/transit/event copies — those authorities stay
 * external and are read, never stored here.
 */
export interface NpcLifeEntry {
  goals: PersonalGoal[];
  pressure: NpcPressureState;
}

/** Persisted #43 state: actor id → canonical entry. Additive and optional. */
export type NpcLifePersistedState = Record<string, NpcLifeEntry>;


export type ObligationSourceKind =
  | 'routine'
  | 'appointment'
  | 'job'
  | 'promise'
  | 'world_event'
  | 'commerce'
  | 'personal_goal';

export type ObligationFlexibility = 'fixed' | 'bounded' | 'flexible';
export type ObligationStatus =
  | 'pending'
  | 'planned'
  | 'in_progress'
  | 'satisfied'
  | 'missed'
  | 'cancelled';

export interface CharacterObligation {
  id: string;
  actorId: string;
  sourceKind: ObligationSourceKind;
  sourceId?: string;
  preferredAt?: number;
  earliestAt?: number;
  latestAt?: number;
  destinationPlaceId?: string;
  priority: number;
  flexibility: ObligationFlexibility;
  status: ObligationStatus;
}

/**
 * Bounded intent vocabulary (#44). Only the subset supportable by current
 * snapshot data is ever emitted (stay/prepare/attend/perform/call/rest/
 * pursue/shop); travel_to_place, visit_person, return_home, and use_computer
 * are reserved for when presence/place/target projections exist (#45 and
 * later) and must never be emitted with unknown targets.
 */
export type CharacterIntentKind =
  | 'stay_current_activity'
  | 'prepare_to_leave'
  | 'travel_to_place'
  | 'perform_work'
  | 'attend_appointment'
  | 'shop_for_need'
  | 'visit_person'
  | 'return_home'
  | 'use_computer'
  | 'call_or_message'
  | 'rest_or_sleep'
  | 'pursue_personal_goal';

/**
 * Selected next intent: WHAT the actor intends plus WHY. Pure orchestration
 * output — it never executes routes, timing, attendance, wages, or any
 * relationship/economy consequence (those owners decide outcomes).
 */
export interface CharacterIntent {
  actorId: string;
  kind: CharacterIntentKind;
  sourceKind?: ObligationSourceKind;
  sourceId?: string;
  targetPlaceId?: string;
  targetActorId?: string;
  activity?: string;
  priority: number;
  /** Deterministic reason codes (e.g. 'due_now', 'needs_rest', 'loyal'). */
  reasons: string[];
  earliestAt?: number;
  latestAt?: number;
  /** Explainable blockers (e.g. 'unknown_destination') — never silent success. */
  blockers: string[];
  reevaluateAtMinute: number;
}

export interface LifeMatrixSnapshot {
  actorId: string;
  atMinute: number;
  day: number;
  minuteOfDay: number;
  traits: {
    shyness: number;
    warmth: number;
    discipline: number;
    spontaneity: number;
    loyalty: number;
  };
  playerRelationship: LifeRelationshipView | null;
  notableNpcBonds: LifeRelationshipView[];
  promises: LifePromiseView[];
  routineWindows: LifeRoutineWindow[];
  agenda: LifeAgendaEntry[];
  appointments: LifeAppointmentView[];
  worldEvents: LifeWorldEventView[];
  /**
   * Active event effects at atMinute (#46). Optional so older hand-built
   * snapshots keep compiling; buildLifeMatrixSnapshot always sets it.
   */
  eventEffects?: LifeWorldModifierView[];
  presence: LifePresenceView;
  pressure: LifePressureView;
  goals?: PersonalGoal[];
  fidelityTier?: FidelityTier;
}

