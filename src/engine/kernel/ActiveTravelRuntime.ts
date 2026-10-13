import type { CoreDomainOwners } from './CoreDomainOwners';
import {
  commitTravelPlan as createActiveTravel,
  activeTravelLegWindows,
  parseActiveTravel,
  travelStateAtMinute,
} from '../transit/ActiveTravel';
import type { ActiveTravelState, TravelPlan } from '../transit/types';
import type {
  EncounterCandidate,
  EncounterDecision,
  EncounterPlayerTransitRead,
} from '../encounters';
import type { ActionResult } from '../types';

/**
 * Owns one committed active journey and its canonical clock progression.
 * Actor spatial position and actual cash stay with their domain owners.
 * Encounter candidates are read from the same NPC movement + encounter truth.
 */
export class ActiveTravelRuntime {
  private state: ActiveTravelState | null;

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'economy' | 'telemetry'>,
    private readonly clearSpatialForTravel: (actorId: string) => void,
    private readonly relocateActorToPlace: (actorId: string, placeId: string) => boolean,
    private readonly chargeFare: (action: { type: 'PLAYER_SPEND_CASH'; amount: number; reason: string }) => ActionResult,
    private readonly collectNpcCandidates: (travel: EncounterPlayerTransitRead | null) => EncounterCandidate[],
    private readonly decideNpcEncounter: (travel: EncounterPlayerTransitRead | null) => EncounterDecision,
    initial?: ActiveTravelState | null,
  ) {
    this.state = initial ? cloneActiveTravel(initial) : null;
  }

  public loadState(raw?: unknown): void {
    this.state = raw == null ? null : parseActiveTravel(raw);
  }

  public synchronizeActiveTravel(): void {
    const current = this.state;
    if (!current || current.status !== 'active') return;

    const resolved = travelStateAtMinute(current, this.owners.clock.getTotalMinutes());
    if (
      resolved.status === current.status &&
      resolved.currentLegIndex === current.currentLegIndex
    ) {
      return;
    }

    const arrivedNow = resolved.status === 'arrived';
    this.state = {
      ...current,
      ...resolved,
    };

    if (arrivedNow) {
      this.relocateActorToPlace(current.actorId, current.plan.destinationPlaceId);
      try {
        this.owners.telemetry.logEvent('world', 'travel_arrived', this.owners.clock.getTotalMinutes(), {
          actorId: current.actorId,
          destinationPlaceId: current.plan.destinationPlaceId,
          purposeRef: current.purposeRef ?? null,
        });
      } catch {}
    }
  }


  public setActiveTravel(state: ActiveTravelState | null): void {
    this.state = state ? cloneActiveTravel(state) : null;
  }

  public getActiveTravel(): ActiveTravelState | null {
    return this.state ? cloneActiveTravel(this.state) : null;
  }

  /**
   * Live player wait/ride leg for #47 transit overlap, derived from the
   * player's own committed journey. Walk legs and settled/arrived travel
   * yield null (no transit candidacy). Pure read.
   */
  private currentPlayerTransit(): EncounterPlayerTransitRead | null {
    const travel = this.getActiveTravel();
    if (!travel || travel.status !== 'active') return null;
    const resolved = travelStateAtMinute(travel, this.owners.clock.getTotalMinutes());
    if (resolved.status !== 'active') return null;
    const window = activeTravelLegWindows(travel)[resolved.currentLegIndex];
    const leg = travel.plan.legs[resolved.currentLegIndex];
    if (!window || !leg || leg.kind === 'walk') return null;
    if (leg.kind === 'wait') {
      return { kind: 'wait', stopId: leg.stopId, windowStart: window.startMinute, windowEnd: window.endMinute };
    }
    return {
      kind: 'bus',
      lineId: leg.lineId,
      fromStopId: leg.fromStopId,
      toStopId: leg.toStopId,
      boardMinute: window.startMinute,
      windowStart: window.startMinute,
      windowEnd: window.endMinute,
    };
  }

  public override collectEncounterCandidates(): EncounterCandidate[] {
    return this.collectNpcCandidates(this.currentPlayerTransit());
  }

  public override decideEncounter(): EncounterDecision {
    return this.decideNpcEncounter(this.currentPlayerTransit());
  }

  public startTravel(
    actorId: string,
    plan: TravelPlan,
    purposeRef?: string,
  ): { success: boolean; data?: ActiveTravelState; error?: string } {
    if (this.state?.status === 'active') {
      return { success: false, error: 'An active journey is already in progress.' };
    }
    if (!Number.isFinite(plan.fare) || plan.fare < 0) {
      return { success: false, error: 'Travel fare is invalid.' };
    }
    if (actorId === 'player' && !this.owners.economy.canAfford(plan.fare)) {
      return { success: false, error: `Cannot afford $${plan.fare.toFixed(2)} travel fare.` };
    }

    const committed = createActiveTravel(
      actorId,
      plan,
      this.owners.clock.getTotalMinutes(),
      purposeRef,
    );

    this.state = committed;
    if (actorId === 'player') {
      const fareResult = this.chargeFare({
        type: 'PLAYER_SPEND_CASH',
        amount: plan.fare,
        reason: 'Transit fare',
      });
      if (!fareResult.success) {
        this.state = null;
        return { success: false, error: fareResult.error ?? `Cannot afford $${plan.fare.toFixed(2)} travel fare.` };
      }
    }

    this.clearSpatialForTravel(actorId);

    try {
      this.owners.telemetry.logEvent('world', 'travel_departed', this.owners.clock.getTotalMinutes(), {
        actorId,
        originPlaceId: plan.originPlaceId,
        destinationPlaceId: plan.destinationPlaceId,
        fare: plan.fare,
        purposeRef: purposeRef ?? null,
      });
    } catch {}

    return { success: true, data: cloneActiveTravel(committed) };
  }


}

function cloneActiveTravel(state: ActiveTravelState): ActiveTravelState {
  return parseActiveTravel(structuredClone(state));
}
