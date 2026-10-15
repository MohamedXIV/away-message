import type { CoreDomainOwners } from './CoreDomainOwners';
import type { CharacterIntent, CharacterObligation, LifeMatrixSnapshot } from '../life';
import type { NpcMobilityState, NpcPlaceQuery } from '../transit/NpcTrips';
import {
  collectEncounterCandidates,
  decideEncounter as decideEncounterPure,
  emptyEncounterDirectorState,
  hydrateEncounterDirectorState,
  type EncounterCandidate,
  type EncounterDecision,
  type EncounterDecisionInput,
  type EncounterDirectorState,
  type EncounterPlayerTransitRead,
} from '../encounters';
import {
  getSharedPlaceAliases,
  getSharedTransitNetwork,
  resolveTransitPlaceId,
} from '../transit/NpcTrips';

export interface EncounterDomainReads {
  getNpcMobilityState(): NpcMobilityState;
  getNpcPlaceState(actorId: string, atMinute?: number): NpcPlaceQuery;
  getCharacterIntent(actorId: string): CharacterIntent | null;
  getCharacterObligations(actorId: string): CharacterObligation[];
  getLifeSnapshot(actorId: string): LifeMatrixSnapshot | null;
}

/**
 * Encounter decisions own only cooldown/one-shot marks. Trip, Social,
 * knowledge, and World authority always remain in their original owners.
 * Candidate collection is pure and never marks an encounter as consumed.
 */
export class EncounterRuntime {
  private state: EncounterDirectorState = emptyEncounterDirectorState();

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'clock' | 'social' | 'world' | 'economy'>,
    private readonly reads: EncounterDomainReads,
    private readonly invalidate: () => void,
    initial?: EncounterDirectorState,
  ) {
    this.loadState(initial);
  }

  public loadState(state?: EncounterDirectorState): void {
    this.state = hydrateEncounterDirectorState(state ?? {});
    this.invalidate();
  }

  /** Encounter Director slice as plain snapshot data (deep copy, bounded). */
  public getEncounterDirectorState(): EncounterDirectorState {
    return JSON.parse(JSON.stringify(this.state)) as EncounterDirectorState;
  }

  /**
   * Assemble the read-only Encounter Director input from canonical systems
   * (#47). Pure reads — no NPC, transit, relationship, event, or economy
   * writes. Subclasses may supply live player transit; the default (null)
   * settles the player at their authoritative location.
   */
  public buildEncounterInput(playerTransit: EncounterPlayerTransitRead | null = null): EncounterDecisionInput {
    const nowMinute = this.owners.clock.getTotalMinutes();
    const network = getSharedTransitNetwork();
    const aliases = getSharedPlaceAliases();
    const playerPlaceId =
      playerTransit !== null || !network
        ? null
        : resolveTransitPlaceId(this.owners.economy.getLocation(), network, aliases);
    const mobility = this.reads.getNpcMobilityState();
    const actors = this.owners.social.getBuddies().map((buddy) => ({
      actorId: buddy.id,
      place: this.reads.getNpcPlaceState(buddy.id, nowMinute),
      intent: this.reads.getCharacterIntent(buddy.id),
      obligations: this.reads.getCharacterObligations(buddy.id),
      relationship: this.owners.social.getRelationships(buddy.id) ?? null,
      knownToPlayer: this.owners.social.isKnown(buddy.id),
      eventEffects: this.reads.getLifeSnapshot(buddy.id)?.eventEffects ?? [],
    }));
    return {
      nowMinute,
      playerPlaceId,
      playerTransit,
      actors,
      trips: mobility.trips,
      network,
      activeModifiers: this.owners.world.queryActiveModifiers({ atMinute: nowMinute }),
    };
  }

  /**
   * Renderer-safe candidate collection (#47): pure surfacing read, marks
   * nothing, so opening a view can never create an encounter.
   */
  public collectEncounterCandidates(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterCandidate[] {
    return collectEncounterCandidates(this.buildEncounterInput(playerTransit));
  }

  /**
   * Decide the encounter worth surfacing right now (#47). Records cooldown /
   * one-shot marks in the director's own slice only — source authorities
   * (mobility, obligations, events, relationships) are never written.
   */
  public decideEncounter(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterDecision {
    const { decision, nextState } = decideEncounterPure(
      this.buildEncounterInput(playerTransit),
      this.state,
    );
    this.state = nextState;
    if (decision.kind === 'encounter') this.invalidate();
    return decision;
  }

}
