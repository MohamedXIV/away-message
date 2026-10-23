import type { SimulationEngine } from '../SimulationEngine';
import { getSharedTransitNetwork } from '../transit/NpcTrips';
import { planTravel } from '../transit/TravelPlanner';
import { getGeneratedPlaceEntryPosition } from '../spatial/GeneratedSpatialWorld';
import type { AgendaItem } from '../types';
import {
  BENCHMARK_POPULATIONS,
  createSimulationBenchmarkFixture,
  type SimulationBenchmarkFixture,
  type SimulationBenchmarkFixtureOptions,
} from './SimulationBenchmarkFixture';

export const POPULATION_SCALE_SEED = 'away-177-population-v1';
export const POPULATION_SCALE_TIERS = BENCHMARK_POPULATIONS;

const AGENDA_LABELS = [
  'coffee with a friend',
  'study group',
  'running errands',
  'record shopping',
  'walk by the canal',
] as const;

export interface PopulationScaleRoute {
  originPlaceId: string;
  destinationPlaceId: string;
  totalMinutes: number;
}

export interface PopulationScaleFixtureOptions extends SimulationBenchmarkFixtureOptions {
  knownLocalContacts?: number;
  knownRemoteContacts?: number;
  messagesPerContact?: number;
  appointmentInterval?: number;
}

export interface PopulationScaleFixture {
  population: number;
  seed: string;
  engine: SimulationEngine;
  base: SimulationBenchmarkFixture;
  actorIds: string[];
  localActorIds: string[];
  remoteActorIds: string[];
  knownActorIds: string[];
  agendaActorIds: string[];
  appointmentActorIds: string[];
  routes: PopulationScaleRoute[];
  seededMessageCount: number;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function findRoutePairs(nowMinute: number): PopulationScaleRoute[] {
  const network = getSharedTransitNetwork();
  if (!network) {
    throw new Error('The generated transit network is unavailable for population stress fixtures.');
  }
  const placeIds = [...network.places.keys()].sort();
  const origins = placeIds.filter((placeId) => getGeneratedPlaceEntryPosition(placeId));
  const routes: PopulationScaleRoute[] = [];
  for (const originPlaceId of origins) {
    for (const destinationPlaceId of placeIds) {
      if (originPlaceId === destinationPlaceId) continue;
      const planned = planTravel(network, {
        originPlaceId,
        destinationPlaceId,
        departAtMinute: nowMinute,
        policy: 'fastest',
      });
      if (planned.ok) {
        routes.push({
          originPlaceId,
          destinationPlaceId,
          totalMinutes: planned.plan.totalMinutes,
        });
      }
    }
  }
  if (routes.length === 0) {
    throw new Error('No authored route with entry positions is available for population stress fixtures.');
  }
  return routes;
}

export function canonicalMessageCount(engine: SimulationEngine, actorIds: readonly string[]): number {
  let count = 0;
  for (const actorId of actorIds) {
    count += engine.social.getConversationPage(actorId, 0, 1).total;
  }
  return count;
}

/**
 * Deterministic, reusable population fixture for #177.
 *
 * The roster comes from the canonical benchmark factory (authored seed actors
 * plus generated `BuddyCharacter` definitions). The fixture then uses public
 * simulation APIs to create realistic starting state: canonical place
 * membership, a same-day agenda, route-backed appointments for a bounded
 * share of local actors, learned contacts and bounded chat history.
 *
 * It never writes trips, pressure, relationships or message records directly;
 * all of that is normal owner state produced by supported commands.
 */
export function createPopulationScaleFixture(
  population: number,
  options: PopulationScaleFixtureOptions = {},
): PopulationScaleFixture {
  assertPositiveInteger(population, 'population');
  const seed = options.seed ?? POPULATION_SCALE_SEED;
  const base = createSimulationBenchmarkFixture(population, { seed });
  const { engine, actorIds, localActorIds, remoteActorIds } = base;
  const day = engine.clock.getTime().day;
  const minuteOfDay = engine.clock.getTotalMinutes() % 1440;
  const routes = findRoutePairs(engine.clock.getTotalMinutes());

  // Canonical spatial origins come from the authored transit graph, not from
  // an extra mobility cache. Every local actor starts somewhere reachable.
  for (let index = 0; index < localActorIds.length; index += 1) {
    const route = routes[index % routes.length]!;
    if (!engine.relocateActorToGeneratedPlaceEntry(localActorIds[index]!, route.originPlaceId)) {
      throw new Error(`Unable to seed a canonical place origin for ${localActorIds[index]}.`);
    }
  }

  // Same-day agenda blocks exercise the real Life Matrix routine projection.
  const agendaActorIds: string[] = [];
  for (let index = 0; index < localActorIds.length; index += 1) {
    const actorId = localActorIds[index]!;
    const startMinute = Math.min(1439, minuteOfDay + 2 + (index % 8));
    const item: AgendaItem = {
      id: `bench_agenda_${day}_${index}`,
      kind: 'social',
      label: AGENDA_LABELS[index % AGENDA_LABELS.length]!,
      day,
      startMinute,
      endMinute: Math.min(1440, startMinute + 30),
    };
    engine.social.setAgenda(actorId, [item]);
    agendaActorIds.push(actorId);
  }

  // A bounded share receives route-backed appointments, so world ticks plan
  // and progress genuine NPC trips through the same transit owner as play.
  const appointmentInterval = Math.max(1, Math.floor(options.appointmentInterval ?? 10));
  const appointmentActorIds: string[] = [];
  for (let index = 0; index < localActorIds.length; index += appointmentInterval) {
    const actorId = localActorIds[index]!;
    const origin = engine.getActorSpatialProjection(actorId)?.membership.placeId;
    const route = routes.find((candidate) => candidate.originPlaceId === origin);
    if (!route) {
      throw new Error(`Fixture actor ${actorId} has no route-backed origin ${String(origin)}.`);
    }
    const startMinute = Math.min(1439, minuteOfDay + 20 + (index % 10));
    engine.world.scheduleAppointment({
      id: `bench_appointment_${population}_${index}`,
      characterId: actorId,
      locationId: route.destinationPlaceId,
      targetDay: day,
      startMinute,
      endMinute: Math.min(1440, startMinute + 30),
      description: 'scheduled population stress appointment',
      status: 'scheduled',
    });
    appointmentActorIds.push(actorId);
  }

  const knownLocalCount = Math.max(0, Math.floor(options.knownLocalContacts ?? 24));
  const knownRemoteCount = Math.max(0, Math.floor(options.knownRemoteContacts ?? 8));
  const knownActorIds = [
    ...localActorIds.slice(0, Math.min(knownLocalCount, localActorIds.length)),
    ...remoteActorIds.slice(0, Math.min(knownRemoteCount, remoteActorIds.length)),
  ];
  for (const actorId of knownActorIds) {
    const buddy = engine.social.getBuddy(actorId);
    if (!buddy || !engine.social.learnHandle(actorId, buddy.handle)) {
      throw new Error(`Unable to establish a learned contact for ${actorId}.`);
    }
  }

  const messagesPerContact = Math.max(0, Math.floor(options.messagesPerContact ?? 6));
  let seededMessageCount = 0;
  for (let contactIndex = 0; contactIndex < knownActorIds.length; contactIndex += 1) {
    const actorId = knownActorIds[contactIndex]!;
    for (let messageIndex = 0; messageIndex < messagesPerContact; messageIndex += 1) {
      const fromPlayer = messageIndex % 2 === 0;
      const atMinute = Math.max(1, engine.clock.getTotalMinutes() - 1 - (contactIndex * messagesPerContact + messageIndex));
      engine.social.sendMessage(
        actorId,
        fromPlayer ? 'player' : actorId,
        fromPlayer ? actorId : 'player',
        `population fixture ${contactIndex} message ${messageIndex}`,
        atMinute,
        !fromPlayer,
        ['benchmark'],
      );
      seededMessageCount += 1;
    }
  }
  const actualMessageCount = canonicalMessageCount(engine, knownActorIds);
  if (actualMessageCount < seededMessageCount) {
    throw new Error(
      `Population fixture seeded ${seededMessageCount} messages but only ${actualMessageCount} are readable.`,
    );
  }

  const actualPopulation = engine.social.getBuddies().length;
  if (actualPopulation !== population) {
    throw new Error(`Population fixture materialized ${actualPopulation} actors, expected ${population}.`);
  }

  return {
    population,
    seed,
    engine,
    base,
    actorIds,
    localActorIds,
    remoteActorIds,
    knownActorIds,
    agendaActorIds,
    appointmentActorIds,
    routes,
    seededMessageCount,
  };
}

