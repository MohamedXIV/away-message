import type {
  LifeAgendaEntry,
  LifeAppointmentView,
  LifeMatrixSnapshot,
  LifePresenceView,
  LifePromiseView,
  LifeRelationshipView,
  LifeWorldEventView,
} from './types';

export interface LifeSourceActor {
  id: string;
  schedule: Record<number, unknown[]>;
}

export interface LifeSourceAdapterInput {
  getBuddy(actorId: string): LifeSourceActor | undefined;
  getTraits(actorId: string): LifeMatrixSnapshot['traits'];
  getPlayerRelationship(actorId: string): LifeRelationshipView | null;
  getNpcBonds(actorId: string): LifeRelationshipView[];
  getPromises(actorId: string): LifePromiseView[];
  getAgenda(actorId: string, day: number): LifeAgendaEntry[];
  getPresence(actorId: string): LifePresenceView;
  getAppointments(): LifeAppointmentView[];
  getTriggeredEvents(): LifeWorldEventView[];
}

export type LifeSources = Readonly<LifeSourceAdapterInput>;

export function createLifeSources(input: LifeSourceAdapterInput): LifeSources {
  return Object.freeze({ ...input });
}
