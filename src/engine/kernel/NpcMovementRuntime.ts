import type { CoreDomainOwners } from './CoreDomainOwners';
import type { CharacterIntent } from '../life';
import {
  emptyNpcMobility,
  findNpcCoLocation,
  getNpcPlaceState,
  getSharedPlaceAliases,
  getSharedTransitNetwork,
  hydrateNpcMobility,
  planDueNpcTrips,
  progressNpcTrips,
  type NpcCoLocation,
  type NpcMobilityState,
  type NpcPlaceQuery,
  type NpcTripRecord,
} from '../transit/NpcTrips';
import {
  clearActorSpatialPosition,
  cloneActorSpatialPositions,
  emptyActorSpatialPositions,
  getActorSpatialProjection as projectActorSpatial,
  hydrateActorSpatialPositions,
  relocateActorSpatialPosition,
  type ActorSpatialPositions,
  type ActorSpatialProjection,
  type ActorSpatialRelocation,
} from '../spatial/ActorSpatialState';
import {
  GENERATED_SPATIAL_WORLD,
  getGeneratedPlaceEntryPosition,
} from '../spatial/GeneratedSpatialWorld';
import type { SpatialPosition } from '../spatial/SpatialPresence';

/**
 * The single writer for NPC trip commitments and actor town-space XYZ.
 *
 * Transit plans/intervals are canonical route facts; settled place derives
 * from spatial containment, with mobility.places only a migration-era cache.
 * No private ticking, Social roster, or additional position authority.
 */
export class NpcMovementRuntime {
  private mobility: NpcMobilityState = emptyNpcMobility();
  private positions: ActorSpatialPositions = emptyActorSpatialPositions();

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'social' | 'events' | 'telemetry'>,
    private readonly readIntent: (actorId: string) => CharacterIntent | null,
    private readonly invalidate: () => void,
    initialMobility?: NpcMobilityState,
    initialPositions?: ActorSpatialPositions,
  ) {
    this.loadState(initialMobility, initialPositions);
  }

  public loadState(
    mobility?: NpcMobilityState,
    positions?: ActorSpatialPositions,
  ): void {
    this.mobility = hydrateNpcMobility(mobility ?? {});
    this.positions = hydrateActorSpatialPositions(positions ?? {});
    this.invalidate();
  }

  /**
   * Before a coarse clock jump, commit only actors that do not already have
   * a mobility record. Existing planned/active commitments must remain under
   * normal #37 replacement/departure rules; re-running the selector here can
   * otherwise replace a trip immediately before its protected departure.
   * Failed/cancelled outcomes also stay endpoint-owned: this primer copies
   * only successful new commitments and emits no receipts.
   */
  public primeMissingNpcMobility(): void {
    const network = getSharedTransitNetwork();
    if (!network) return;
    const missingIntents = new Map(
      this.owners.social.getBuddies()
        .filter((buddy) => this.mobility.trips[buddy.id] === undefined)
        .map((buddy) => [buddy.id, this.readIntent(buddy.id)]),
    );
    if (missingIntents.size === 0) return;

    const due = planDueNpcTrips(
      this.mobility,
      missingIntents,
      this.owners.clock.getTotalMinutes(),
      { network, aliases: getSharedPlaceAliases() },
    );
    if (due.planned.length === 0) return;

    const trips = { ...this.mobility.trips };
    for (const actorId of due.planned) {
      const record = due.state.trips[actorId];
      if (record) trips[actorId] = record;
    }
    this.mobility = { trips, places: { ...this.mobility.places } };
    this.invalidate();
  }

  /** Canonical #37 slice as plain snapshot data (deep copies). */
  public getNpcMobilityState(): NpcMobilityState {
    return JSON.parse(JSON.stringify(this.mobility)) as NpcMobilityState;
  }

  /** Canonical #93 XYZ snapshot (deep copy, no derived membership). */
  public getActorSpatialPositions(): ActorSpatialPositions {
    return cloneActorSpatialPositions(this.positions);
  }

  /** Read-only derived spatial projection for one actor. */
  public getActorSpatialProjection(actorId: string): ActorSpatialProjection | null {
    return projectActorSpatial(
      this.positions,
      actorId,
      GENERATED_SPATIAL_WORLD,
    );
  }

  private applyActorSpatialRelocation(
    actorId: string,
    relocation: ActorSpatialRelocation,
    position: SpatialPosition | null,
  ): void {
    this.positions = relocation.positions;

    // #37's places map remains a transit-planning cache only. Once an actor
    // is settled (or has no trip), keep that cache derived from #93 spatial
    // membership so it cannot drift into a second physical authority.
    const trip = this.mobility.trips[actorId];
    if (
      actorId !== 'player' &&
      (!trip || trip.status === 'arrived' || trip.status === 'failed' || trip.status === 'cancelled')
    ) {
      const places = { ...this.mobility.places };
      if (relocation.membership.placeId) {
        places[actorId] = relocation.membership.placeId;
      } else {
        delete places[actorId];
      }
      this.mobility = { ...this.mobility, places };
    }

    this.invalidate();
    for (const transition of relocation.transitions) {
      this.owners.events.emit('spatial:transition', {
        actorId,
        transition,
        position,
      });
    }
  }

  /**
   * Explicit simulation/debug relocation. Renderer/view changes must never
   * call this implicitly; the caller supplies canonical town-space XYZ.
   */
  public relocateActorSpatially(
    actorId: string,
    position: SpatialPosition,
  ): ActorSpatialProjection {
    const relocation = relocateActorSpatialPosition(
      this.positions,
      actorId,
      position,
      GENERATED_SPATIAL_WORLD,
    );
    this.applyActorSpatialRelocation(actorId, relocation, { ...position });
    return {
      position: { ...position },
      membership: relocation.membership,
    };
  }

  /** Transit departure removes local XYZ; the trip remains timing authority. */
  public clearActorSpatialForTravel(actorId: string): void {
    const relocation = clearActorSpatialPosition(
      this.positions,
      actorId,
      GENERATED_SPATIAL_WORLD,
    );
    if (relocation.transitions.length === 0 && this.positions[actorId] === undefined) {
      return;
    }
    this.applyActorSpatialRelocation(actorId, relocation, null);
  }

  /**
   * Transit arrival handoff: resolve an authored destination entry point
   * exactly once, without calculating or changing trip timing/fare.
   */
  public relocateActorToGeneratedPlaceEntry(actorId: string, placeId: string): boolean {
    const entry = getGeneratedPlaceEntryPosition(placeId);
    if (!entry) return false;
    const projection = this.relocateActorSpatially(actorId, entry);
    if (projection.membership.placeId !== placeId) {
      throw new Error(
        `Authored entry position for '${placeId}' does not resolve to that canonical place.`,
      );
    }
    return true;
  }

  /** Live trip record copy for one actor, or null when the actor holds none. */
  public getNpcTrip(actorId: string): NpcTripRecord | null {
    const record = this.mobility.trips[actorId];
    if (!record) return null;
    return JSON.parse(JSON.stringify(record)) as NpcTripRecord;
  }

  /**
   * Combined mobility/spatial read. Transit owns whether an actor is currently
   * travelling; once locally settled, #93 XYZ containment owns physical place.
   * Un-authored actors fall back to the #37 place cache during migration.
   */
  public getNpcPlaceState(actorId: string, atMinute?: number): NpcPlaceQuery {
    const mobility = getNpcPlaceState(
      this.mobility,
      actorId,
      atMinute ?? this.owners.clock.getTotalMinutes(),
    );
    if (mobility.status === 'in_transit' || mobility.status === 'planned') {
      return mobility;
    }

    const spatial = this.getActorSpatialProjection(actorId);
    if (!spatial) return mobility;
    return spatial.membership.placeId
      ? { status: 'at_place', placeId: spatial.membership.placeId }
      : { status: 'unknown' };
  }

  /** Factual deterministic travel overlap for later consumers. Facts only. */
  public getNpcCoLocation(): NpcCoLocation[] {
    const network = getSharedTransitNetwork();
    if (!network) return [];
    return findNpcCoLocation(this.mobility.trips, network);
  }

  /**
   * Tick-driven NPC mobility (#37). Plans trips from current #44 intents
   * and progresses live trips on the authoritative clock. Idempotent at a
   * fixed minute; departed trips are never replanned; arrivals emit once
   * (status flags persist the completion identity).
   *
   * Note: this runs after the tick's subscriber notify, so arrival
   * telemetry becomes visible via getState/exportSnapshot on the next
   * state rebuild (exportSnapshot always rebuilds fresh). Arrival EVENTS
   * fire synchronously to current listeners. Same lag profile as other
   * post-tick engine writes.
   */
  public progressNpcMobility(): void {
    const nowMinute = this.owners.clock.getTotalMinutes();
    const network = getSharedTransitNetwork();
    if (!network) return;
    const intents = new Map(
      this.owners.social.getBuddies().map((buddy) => [buddy.id, this.readIntent(buddy.id)]),
    );
    const due = planDueNpcTrips(this.mobility, intents, nowMinute, {
      network,
      aliases: getSharedPlaceAliases(),
    });
    this.mobility = due.state;
    for (const failure of due.failed) {
      try {
        this.owners.events.emit('npc:trip_failed', { ...failure, atMinute: nowMinute });
      } catch {}
    }
    const progressed = progressNpcTrips(this.mobility, nowMinute);
    this.mobility = progressed.state;
    for (const actorId of progressed.departed) {
      this.clearActorSpatialForTravel(actorId);
      try {
        const record = this.mobility.trips[actorId];
        this.owners.telemetry.logEvent('world', 'travel_departed', nowMinute, {
          actorId,
          originPlaceId: record?.originPlaceId ?? null,
          destinationPlaceId: record?.destinationPlaceId ?? null,
          sourceId: record?.sourceId ?? null,
        });
      } catch {}
    }
    for (const arrival of progressed.arrivals) {
      this.relocateActorToGeneratedPlaceEntry(arrival.actorId, arrival.destinationPlaceId);
      try {
        this.owners.events.emit('npc:trip_arrived', { ...arrival });
      } catch {}
      try {
        this.owners.telemetry.logEvent('world', 'travel_arrived', nowMinute, {
          actorId: arrival.actorId,
          destinationPlaceId: arrival.destinationPlaceId,
          sourceId: arrival.sourceId ?? null,
        });
      } catch {}
    }
    if (
      due.planned.length > 0 ||
      due.failed.length > 0 ||
      due.cancelled.length > 0 ||
      progressed.departed.length > 0 ||
      progressed.arrivals.length > 0
    ) {
      this.invalidate();
    }
  }


}
