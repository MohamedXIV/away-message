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

export interface LifePresenceView {
  messengerStatus: string;
  awayMessage?: string;
}

export interface LifePressureView {
  departure?: number;
  fatigue?: number;
  stress?: number;
}

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
  presence: LifePresenceView;
  pressure: LifePressureView;
}
