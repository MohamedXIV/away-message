import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  POPULATION_SCALE_SEED,
  POPULATION_SCALE_TIERS,
  collectPopulationScaleMetrics,
  createPopulationScaleFixture,
  flushPopulationScaleAsyncCompletions,
  populationScaleEngineDigest,
  type PopulationScaleFixture,
} from '../../src/engine/benchmark/PopulationScaleGate';

const TIER_TIMEOUT_MS = 180_000;

function readableMessages(fixture: PopulationScaleFixture): number {
  let total = 0;
  for (const actorId of fixture.knownActorIds) {
    total += fixture.engine.social.getConversationPage(actorId, 0, 1).total;
  }
  return total;
}

describe('PopulationScaleGate (#177)', () => {
  it(
    'materializes every tier with canonical owners, schedules, contacts and routes',
    () => {
      for (const tier of POPULATION_SCALE_TIERS) {
        const fixture = createPopulationScaleFixture(tier);
        const { engine, localActorIds, remoteActorIds } = fixture;

        expect(fixture.population).toBe(tier);
        expect(engine.social.getBuddies()).toHaveLength(tier);
        expect(fixture.actorIds).toHaveLength(tier);
        expect(new Set(fixture.actorIds).size).toBe(tier);
        expect(localActorIds.length + remoteActorIds.length).toBe(tier);
        expect(localActorIds.length).toBeGreaterThan(0);
        expect(remoteActorIds.length).toBeGreaterThan(0);
        expect(fixture.routes.length).toBeGreaterThan(0);

        expect(fixture.agendaActorIds).toEqual(localActorIds);
        expect(fixture.appointmentActorIds).toHaveLength(Math.ceil(localActorIds.length / 10));
        expect(engine.world.getAppointments()).toHaveLength(fixture.appointmentActorIds.length);
        expect(engine.world.getAppointments().every((appointment) => appointment.status === 'scheduled')).toBe(true);

        const expectedKnown = Math.min(24, localActorIds.length) + Math.min(8, remoteActorIds.length);
        expect(fixture.knownActorIds).toHaveLength(expectedKnown);
        expect(fixture.seededMessageCount).toBe(expectedKnown * 6);
        expect(readableMessages(fixture)).toBeGreaterThanOrEqual(fixture.seededMessageCount);
        for (const actorId of fixture.knownActorIds) {
          expect(engine.social.isKnown(actorId)).toBe(true);
        }

        const positions = engine.getActorSpatialPositions();
        for (const actorId of localActorIds) {
          expect(Object.prototype.hasOwnProperty.call(positions, actorId)).toBe(true);
        }
        for (const actorId of remoteActorIds) {
          expect(engine.getFidelityTier(actorId)).toBe('background_remote');
          expect(Object.prototype.hasOwnProperty.call(positions, actorId)).toBe(false);
          expect(engine.getNpcMobilityState().trips[actorId]).toBeUndefined();
          expect(engine.getActorSpatialProjection(actorId)?.membership.placeId ?? null).toBeNull();
        }

        const day = engine.clock.getTime().day;
        const agendaEntries = fixture.actorIds.reduce(
          (total, actorId) => total + engine.social.getAgenda(actorId, day).length,
          0,
        );
        expect(agendaEntries).toBe(localActorIds.length);
      }
    },
    TIER_TIMEOUT_MS,
  );

  it(
    'does not advance population work on sub-minute presentation frames',
    () => {
      const fixture = createPopulationScaleFixture(500);
      const beforeMinute = fixture.engine.clock.getTotalMinutes();
      const beforeRevision = fixture.engine.getRevision();
      const beforeDigest = populationScaleEngineDigest(fixture.engine);

      for (let frame = 0; frame < 30; frame += 1) {
        fixture.engine.advanceRealTime(1 / 60);
      }

      expect(fixture.engine.clock.getTotalMinutes()).toBe(beforeMinute);
      expect(fixture.engine.getRevision()).toBe(beforeRevision);
      expect(populationScaleEngineDigest(fixture.engine)).toBe(beforeDigest);
    },
    TIER_TIMEOUT_MS,
  );

  it(
    'runs deterministic scheduled NPC activity at every tier',
    () => {
      for (const tier of POPULATION_SCALE_TIERS) {
        const first = createPopulationScaleFixture(tier);
        const second = createPopulationScaleFixture(tier);
        const startMinute = first.engine.clock.getTotalMinutes();

        for (let tick = 0; tick < 2; tick += 1) {
          first.engine.advanceGameMinutes(1, 'population-scale-test');
          second.engine.advanceGameMinutes(1, 'population-scale-test');
        }

        expect(first.engine.clock.getTotalMinutes()).toBe(startMinute + 2);
        expect(first.engine.social.getBuddies()).toHaveLength(tier);
        expect(populationScaleEngineDigest(first.engine)).toBe(
          populationScaleEngineDigest(second.engine),
        );

        const trips = Object.values(first.engine.getNpcMobilityState().trips);
        expect(trips).toHaveLength(first.appointmentActorIds.length);
        expect(trips.every((trip) => trip.status !== 'failed')).toBe(true);
        expect(trips.some((trip) => trip.status === 'planned' || trip.status === 'active')).toBe(true);

        const appointmentIntents = first.appointmentActorIds.map(
          (actorId) => first.engine.getCharacterIntent(actorId)?.kind,
        );
        expect(
          appointmentIntents.some(
            (kind) => kind === 'prepare_to_leave' || kind === 'attend_appointment',
          ),
        ).toBe(true);

        const day = first.engine.clock.getTime().day;
        const agendaEntries = first.actorIds.reduce(
          (total, actorId) => total + first.engine.social.getAgenda(actorId, day).length,
          0,
        );
        expect(agendaEntries).toBe(first.localActorIds.length);

        for (const actorId of first.remoteActorIds) {
          expect(first.engine.getNpcMobilityState().trips[actorId]).toBeUndefined();
          expect(first.engine.getActorSpatialPositions()[actorId]).toBeUndefined();
        }
      }
    },
    TIER_TIMEOUT_MS,
  );

  it(
    'stays bounded and deterministic across multi-day advancement',
    async () => {
      for (const tier of [20, 100]) {
        const first = createPopulationScaleFixture(tier);
        const second = createPopulationScaleFixture(tier);

        for (let day = 0; day < 2; day += 1) {
          first.engine.advanceGameMinutes(1440, 'population-scale-multiday');
          second.engine.advanceGameMinutes(1440, 'population-scale-multiday');
        }
        await flushPopulationScaleAsyncCompletions();

        expect(first.engine.clock.getTime().day).toBe(3);
        expect(first.engine.social.getBuddies()).toHaveLength(tier);
        expect(populationScaleEngineDigest(first.engine)).toBe(
          populationScaleEngineDigest(second.engine),
        );

        const metrics = collectPopulationScaleMetrics(first);
        expect(metrics.population).toBe(tier);
        expect(metrics.remotePhysicalActors).toBe(0);
        expect(metrics.fidelity.background_remote).toBe(first.remoteActorIds.length);
        expect(metrics.tripActors).toBeLessThanOrEqual(metrics.localActors);
        expect(metrics.agendaEntries).toBeLessThanOrEqual(metrics.localActors * 3);
        expect(metrics.messageCount).toBeGreaterThanOrEqual(first.seededMessageCount);
        expect(metrics.projections.messengerContacts).toBeLessThanOrEqual(32);
        expect(metrics.projections.conversationMessages).toBeLessThanOrEqual(30);
        expect(metrics.projections.pulseContacts).toBeLessThanOrEqual(500);
        expect(metrics.snapshotBytes).toBeGreaterThan(0);
        expect(metrics.digest).toBe(populationScaleEngineDigest(first.engine));
      }
    },
    TIER_TIMEOUT_MS,
  );

  it(
    'serves bounded semantic projections without mutating canonical state',
    () => {
      const fixture = createPopulationScaleFixture(500);
      const { engine } = fixture;
      engine.advanceGameMinutes(1, 'population-scale-reads');
      const beforeDigest = populationScaleEngineDigest(engine);
      const snapshotSpy = vi.spyOn(engine, 'exportSnapshot');

      for (const actorId of fixture.knownActorIds.slice(0, 16)) {
        engine.getPlayerActorRead(actorId);
        engine.getActorSemanticView(actorId);
        engine.getLifeSnapshot(actorId);
        engine.getCharacterObligations(actorId);
        engine.getCharacterIntent(actorId);
      }
      engine.getHudProjection();
      engine.getWorldRead();
      engine.getChromeRead();
      engine.getPresenceRead();
      engine.getSituationRead();
      engine.getWebsiteRead();
      const messenger = engine.getMessengerRead(32);
      const pulse = engine.getPulseContactsRead();
      const conversation = engine.getConversationRead(fixture.knownActorIds[0]!, 0, 30);
      const unknownConversation = engine.getConversationRead('unknown_actor_probe', 0, 30);

      expect(snapshotSpy).not.toHaveBeenCalled();
      snapshotSpy.mockRestore();

      expect(messenger.contacts.length).toBeLessThanOrEqual(32);
      expect(pulse.contacts.length).toBeLessThanOrEqual(500);
      expect(conversation.messages.length).toBeLessThanOrEqual(30);
      expect(unknownConversation.messages).toHaveLength(0);
      expect(engine.getMessengerRead(999).contacts.length).toBeLessThanOrEqual(100);
      expect(populationScaleEngineDigest(engine)).toBe(beforeDigest);
    },
    TIER_TIMEOUT_MS,
  );

  it(
    'round-trips current-format snapshots without losing canonical state',
    async () => {
      for (const tier of [100, 500]) {
        const fixture = createPopulationScaleFixture(tier);
        fixture.engine.advanceGameMinutes(1, 'population-scale-persistence');
        const expectedDigest = populationScaleEngineDigest(fixture.engine);

        const restored = new SimulationEngine(fixture.engine.exportSnapshot());
        expect(restored.social.getBuddies()).toHaveLength(tier);
        expect(populationScaleEngineDigest(restored)).toBe(expectedDigest);

        const asyncSnapshot = await fixture.engine.exportSnapshotAsync();
        const restoredAsync = new SimulationEngine(asyncSnapshot);
        expect(restoredAsync.social.getBuddies()).toHaveLength(tier);
        expect(populationScaleEngineDigest(restoredAsync)).toBe(expectedDigest);
      }
    },
    TIER_TIMEOUT_MS,
  );

  it(
    'reproduces identical fixtures from the same explicit seed',
    () => {
      const first = createPopulationScaleFixture(20);
      const repeated = createPopulationScaleFixture(20);
      const alternate = createPopulationScaleFixture(20, { seed: 'away-177-alternate-seed' });

      expect(first.seed).toBe(POPULATION_SCALE_SEED);
      expect(first.actorIds).toEqual(repeated.actorIds);
      expect(populationScaleEngineDigest(first.engine)).toBe(
        populationScaleEngineDigest(repeated.engine),
      );
      expect(populationScaleEngineDigest(alternate.engine)).not.toBe(
        populationScaleEngineDigest(first.engine),
      );
      expect(alternate.engine.social.getBuddies()).toHaveLength(20);
    },
    TIER_TIMEOUT_MS,
  );
});
