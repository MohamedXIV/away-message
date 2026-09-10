import type { SocialEngine } from '../SocialEngine';
import type { WorldEventsEngine } from '../WorldEventsEngine';
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

type SocialLifeReads = Pick<
  SocialEngine,
  | 'getBuddy'
  | 'getBuddies'
  | 'getTraits'
  | 'getRelationships'
  | 'getNpcBond'
  | 'getOpenPromises'
  | 'getAgenda'
  | 'getPresence'
>;

type WorldLifeReads = Pick<WorldEventsEngine, 'getAppointments' | 'getTriggeredEvents'>;

export interface SimulationLifeSourceHost {
  readonly social: SocialLifeReads;
  readonly world: WorldLifeReads;
}

function hasNotableBond(bond: ReturnType<SocialEngine['getNpcBond']>): boolean {
  return bond.romance !== 'none' || Object.values(bond.dims).some((value) => value !== 0);
}

export function createSimulationLifeSources(sim: SimulationLifeSourceHost): LifeSources {
  return createLifeSources({
    getBuddy: (actorId) => {
      const buddy = sim.social.getBuddy(actorId);
      if (!buddy) return undefined;

      const schedule: Record<number, unknown[]> = {};
      for (const [day, blocks] of Object.entries(buddy.schedule)) {
        schedule[Number(day)] = blocks.map((block) => ({ ...block }));
      }

      return { id: buddy.id, schedule };
    },

    getTraits: (actorId) => ({ ...sim.social.getTraits(actorId) }),

    getPlayerRelationship: (actorId) => {
      const relationship = sim.social.getRelationships(actorId);
      return relationship ? { targetId: 'player', ...relationship } : null;
    },

    getNpcBonds: (actorId) => {
      const actor = sim.social.getBuddy(actorId);
      if (!actor) return [];

      return sim.social
        .getBuddies()
        .filter((target) => target.id !== actor.id)
        .map((target) => ({ targetId: target.id, bond: sim.social.getNpcBond(actor.id, target.id) }))
        .filter(({ bond }) => hasNotableBond(bond))
        .map(({ targetId, bond }) => ({ targetId, ...bond.dims }));
    },

    getPromises: (actorId) =>
      sim.social.getOpenPromises(actorId).map((promise) => ({
        id: promise.id,
        text: promise.text,
        ...(promise.dueDay === undefined ? {} : { dueDay: promise.dueDay }),
        fulfilled: false,
      })),

    getAgenda: (actorId, day) =>
      sim.social.getAgenda(actorId, day).map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        label: entry.label,
        day: entry.day,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
      })),

    getPresence: (actorId) => {
      const presence = sim.social.getPresence(actorId);
      return {
        messengerStatus: presence?.status ?? 'offline',
        ...(presence?.awayMessage === undefined ? {} : { awayMessage: presence.awayMessage }),
      };
    },

    getAppointments: () =>
      sim.world.getAppointments().map((appointment) => ({
        id: appointment.id,
        characterId: appointment.characterId,
        locationId: appointment.locationId,
        targetDay: appointment.targetDay,
        startMinute: appointment.startMinute,
        endMinute: appointment.endMinute,
        ...(appointment.rsvp === undefined ? {} : { rsvp: appointment.rsvp }),
        ...(appointment.status === undefined ? {} : { status: appointment.status }),
        ...(appointment.origin === undefined ? {} : { origin: { ...appointment.origin } }),
      })),

    getTriggeredEvents: () =>
      sim.world.getTriggeredEvents().map((event) => ({
        id: event.id,
        title: event.title,
        category: event.category,
        triggerDay: event.triggerDay,
        ...(event.triggeredAtMinute === undefined
          ? {}
          : { triggeredAtMinute: event.triggeredAtMinute }),
      })),
  });
}
