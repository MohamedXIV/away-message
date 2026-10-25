import { createHash } from 'node:crypto';
import type { SimulationEngine, LiveSimulationState } from '../SimulationEngine';
import { canonicalMessageCount, type PopulationScaleFixture } from './PopulationScaleFixture';
export {
  POPULATION_SCALE_SEED, POPULATION_SCALE_TIERS, createPopulationScaleFixture,
  type PopulationScaleFixture, type PopulationScaleFixtureOptions, type PopulationScaleRoute,
} from './PopulationScaleFixture';

/**
 * Node-only benchmark/digest helpers. The pure canonical population fixture
 * lives in PopulationScaleFixture, usable by DEV-only Chromium seed preparation
 * without bundling node:crypto on the game/browser entry.
 */

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = stableValue(source[key]);
    return sorted;
  }
  return value;
}

/**
 * Canonical deterministic digest.
 *
 * Telemetry is observation metadata, not simulation truth: it contains
 * wall-clock timestamps and presentation play-time. Every domain owner state
 * participating in the simulation is included.
 */
export function populationScaleDigest(snapshot: LiveSimulationState): string {
  const canonical = { ...(snapshot as unknown as Record<string, unknown>) };
  delete canonical.telemetry;
  return createHash('sha256').update(JSON.stringify(stableValue(canonical))).digest('hex');
}

export function populationScaleEngineDigest(engine: SimulationEngine): string {
  return populationScaleDigest(engine.exportSnapshot());
}

/**
 * MyPlace profile refresh and procedural narration are explicitly late,
 * fire-and-forget completions. Let already-started async work settle before a
 * cross-run digest comparison. This is never part of a measured tick.
 */
export async function flushPopulationScaleAsyncCompletions(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export interface PopulationScaleMetrics {
  population: number;
  localActors: number;
  remoteActors: number;
  knownContacts: number;
  agendaEntries: number;
  appointments: number;
  appointmentStatuses: Record<string, number>;
  trips: Record<string, number>;
  tripActors: number;
  intents: Record<string, number>;
  blockedIntents: number;
  messageCount: number;
  fidelity: {
    important_local: number;
    local_offscreen: number;
    background_remote: number;
  };
  spatialLocalActors: number;
  remotePhysicalActors: number;
  projections: {
    messengerContacts: number;
    messengerBytes: number;
    pulseContacts: number;
    pulseBytes: number;
    conversationMessages: number;
    conversationBytes: number;
    hudBytes: number;
    worldBytes: number;
    chromeBytes: number;
    presenceBytes: number;
    situationBytes: number;
    websiteBytes: number;
  };
  snapshotBytes: number;
  digest: string;
}

/**
 * Read-only evidence snapshot. Calling this is intentionally expensive because
 * it evaluates every local actor's intent; keep it outside timed regions.
 */
export function collectPopulationScaleMetrics(fixture: PopulationScaleFixture): PopulationScaleMetrics {
  const { engine, actorIds, localActorIds, remoteActorIds, knownActorIds } = fixture;
  const day = engine.clock.getTime().day;
  const appointments = engine.world.getAppointments();
  const appointmentStatuses: Record<string, number> = {};
  for (const appointment of appointments) {
    const status = appointment.status ?? 'scheduled';
    appointmentStatuses[status] = (appointmentStatuses[status] ?? 0) + 1;
  }

  const trips = Object.values(engine.getNpcMobilityState().trips);
  const tripStatuses: Record<string, number> = {};
  for (const trip of trips) {
    tripStatuses[trip.status] = (tripStatuses[trip.status] ?? 0) + 1;
  }

  const intents: Record<string, number> = {};
  let blockedIntents = 0;
  for (const actorId of localActorIds) {
    const intent = engine.getCharacterIntent(actorId);
    const kind = intent?.kind ?? 'none';
    intents[kind] = (intents[kind] ?? 0) + 1;
    if ((intent?.blockers.length ?? 0) > 0) blockedIntents += 1;
  }

  let agendaEntries = 0;
  for (const actorId of actorIds) {
    agendaEntries += engine.social.getAgenda(actorId, day).length;
  }

  const fidelity = { important_local: 0, local_offscreen: 0, background_remote: 0 };
  for (const actorId of actorIds) {
    fidelity[engine.getFidelityTier(actorId)] += 1;
  }

  const positions = engine.getActorSpatialPositions();
  const spatialLocalActors = localActorIds.filter(
    (actorId) => Object.prototype.hasOwnProperty.call(positions, actorId),
  ).length;
  const remotePhysicalActors = remoteActorIds.filter(
    (actorId) => Object.prototype.hasOwnProperty.call(positions, actorId)
      || Object.prototype.hasOwnProperty.call(engine.getNpcMobilityState().trips, actorId),
  ).length;

  const messenger = engine.getMessengerRead(32);
  const pulse = engine.getPulseContactsRead();
  const firstKnown = knownActorIds[0];
  const conversation = firstKnown
    ? engine.getConversationRead(firstKnown, 0, 30)
    : { messages: [], total: 0 };
  const hud = engine.getHudProjection();
  const world = engine.getWorldRead();
  const chrome = engine.getChromeRead();
  const presence = engine.getPresenceRead();
  const situation = engine.getSituationRead();
  const website = engine.getWebsiteRead();
  const messageCount = canonicalMessageCount(engine, knownActorIds);
  const snapshot = engine.exportSnapshot();

  return {
    population: engine.social.getBuddies().length,
    localActors: localActorIds.length,
    remoteActors: remoteActorIds.length,
    knownContacts: knownActorIds.length,
    agendaEntries,
    appointments: appointments.length,
    appointmentStatuses,
    trips: tripStatuses,
    tripActors: trips.length,
    intents,
    blockedIntents,
    messageCount,
    fidelity,
    spatialLocalActors,
    remotePhysicalActors,
    projections: {
      messengerContacts: messenger.contacts.length,
      messengerBytes: jsonBytes(messenger),
      pulseContacts: pulse.contacts.length,
      pulseBytes: jsonBytes(pulse),
      conversationMessages: conversation.messages.length,
      conversationBytes: jsonBytes(conversation),
      hudBytes: jsonBytes(hud),
      worldBytes: jsonBytes(world),
      chromeBytes: jsonBytes(chrome),
      presenceBytes: jsonBytes(presence),
      situationBytes: jsonBytes(situation),
      websiteBytes: jsonBytes(website),
    },
    snapshotBytes: jsonBytes(snapshot),
    digest: populationScaleDigest(snapshot),
  };
}
