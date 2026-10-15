import type { CoreDomainOwners } from './CoreDomainOwners';
import type { CharacterIntent } from '../life/types';
import {
  advanceVenueActivities,
  cloneVenueRuntimeState,
  evaluateVenueService,
  hydrateVenueRuntimeState,
  resolveIntentToVenueActivity,
  setVenueRoleAssignment as setVenueRoleAssignmentState,
  startVenueActivity,
  type ResolveVenueActivityResult,
  type StartVenueActivityResult,
  type VenueActivityInstance,
  type VenueRoleAssignment,
  type VenueRuntimeState,
  type VenueServiceAvailability,
} from '../venue/VenueOperations';
import { GENERATED_VENUE_DEFINITIONS } from '../venue/GeneratedVenueDefinitions';
import type { ContextRequirement, ContextRequirementResult } from '../physical/PhysicalContextRuntime';

/**
 * Owns only canonical venue assignments and active activity instances.
 * Spatial positions, character intents, physical affordances and the clock
 * are read from independent canonical owners: no duplicate NPC simulation.
 */
export class VenueOperationsRuntime {
  private state: VenueRuntimeState;

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'events'>,
    private readonly readActorPlace: (actorId: string) => string | null,
    private readonly resolveContext: (spaceId: string, requirements: readonly ContextRequirement[]) => ContextRequirementResult,
    private readonly readIntent: (actorId: string) => CharacterIntent | null,
    initial?: VenueRuntimeState,
  ) {
    this.state = hydrateVenueRuntimeState(initial, GENERATED_VENUE_DEFINITIONS);
  }

  public loadState(snapshot?: VenueRuntimeState): void {
    this.state = hydrateVenueRuntimeState(snapshot, GENERATED_VENUE_DEFINITIONS);
  }

  private venueActorPlaceIds(extraActorIds: readonly string[] = []): Record<string, string | null> {
    const actorIds = new Set<string>(extraActorIds);
    for (const assignment of Object.values(this.state.roleAssignments)) {
      actorIds.add(assignment.actorId);
    }
    for (const activity of Object.values(this.state.activities)) {
      if (activity.status === 'active') actorIds.add(activity.actorId);
    }

    return Object.fromEntries(
      [...actorIds].sort().map((actorId) => [
        actorId,
        this.readActorPlace(actorId),
      ]),
    );
  }

  public synchronizeVenueActivities(): void {
    const advanced = advanceVenueActivities(
      this.state,
      this.owners.clock.getTotalMinutes(),
      GENERATED_VENUE_DEFINITIONS,
    );
    this.state = advanced.state;
    for (const command of advanced.completed) {
      this.owners.events.emit('venue:activity_completed', command);
    }
  }

  public getVenueRuntimeState(): VenueRuntimeState {
    return cloneVenueRuntimeState(this.state);
  }

  public setVenueRoleAssignment(assignment: VenueRoleAssignment): void {
    this.state = setVenueRoleAssignmentState(
      this.state,
      assignment,
      GENERATED_VENUE_DEFINITIONS,
    );
  }

  public getVenueServiceAvailability(serviceId: string): VenueServiceAvailability {
    const service = GENERATED_VENUE_DEFINITIONS.services.find(
      (candidate) => candidate.id === serviceId,
    );
    if (!service) return { available: false, blockers: ['unknown_service'] };

    return evaluateVenueService({
      serviceId,
      definitions: GENERATED_VENUE_DEFINITIONS,
      state: this.state,
      actorPlaceIds: this.venueActorPlaceIds(),
      contextResult: this.resolveContext(
        service.spaceId,
        service.contextRequirements,
      ),
    });
  }

  public resolveVenueActivityIntent(intent: CharacterIntent): ResolveVenueActivityResult {
    return resolveIntentToVenueActivity({
      intent,
      actorPlaceId:
        this.readActorPlace(intent.actorId),
      definitions: GENERATED_VENUE_DEFINITIONS,
      state: this.state,
      actorPlaceIds: this.venueActorPlaceIds([intent.actorId]),
      resolveContext: (spaceId, requirements) =>
        this.resolveContext(spaceId, requirements),
    });
  }

  public startVenueActivityFromIntent(intent: CharacterIntent): StartVenueActivityResult {
    const resolved = this.resolveVenueActivityIntent(intent);
    if (!resolved.ok) return { ok: false, reason: resolved.reason };

    const started = startVenueActivity(
      this.state,
      resolved.proposal,
      GENERATED_VENUE_DEFINITIONS,
      this.owners.clock.getTotalMinutes(),
    );
    if (started.ok) this.state = started.state;
    return started;
  }

  public startCurrentVenueActivity(actorId: string): StartVenueActivityResult {
    const intent = this.readIntent(actorId);
    if (!intent) return { ok: false, reason: 'no_character_intent' };
    return this.startVenueActivityFromIntent(intent);
  }

  public getActiveVenueActivity(actorId: string): VenueActivityInstance | null {
    const state = this.getVenueRuntimeState();
    return (
      Object.values(state.activities)
        .filter((activity) => activity.actorId === actorId && activity.status === 'active')
        .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null
    );
  }

}
