export interface ResidenceState {
  currentResidencePlaceId: string;
  tenancyId: string;
  moveInMinute: number;
  currentRent: number;
}

export interface ResidenceTenancyInput {
  placeId: string;
  tenancyId: string;
  moveInMinute: number;
  currentRent: number;
}

/**
 * Minimal mutable authority for which canonical Place is the player's home.
 * Place definitions, spatial membership, physical affordances, inventory,
 * deliveries, and economic balances remain owned by their existing domains.
 */
export class ResidenceTenancy {
  private state: ResidenceState | null;

  constructor(initialState: ResidenceState | null = null) {
    this.state = initialState ? ResidenceTenancy.copy(initialState) : null;
  }

  getState(): ResidenceState | null {
    return this.state ? ResidenceTenancy.copy(this.state) : null;
  }

  resolveHomePlaceId(): string | null {
    return this.state?.currentResidencePlaceId ?? null;
  }

  setCurrentResidence(input: Readonly<ResidenceTenancyInput>): ResidenceState {
    ResidenceTenancy.assertValid(input);
    this.state = {
      currentResidencePlaceId: input.placeId,
      tenancyId: input.tenancyId,
      moveInMinute: input.moveInMinute,
      currentRent: input.currentRent,
    };
    return ResidenceTenancy.copy(this.state);
  }

  restore(state: ResidenceState | null): void {
    if (state === null) {
      this.state = null;
      return;
    }
    ResidenceTenancy.assertValid({
      placeId: state.currentResidencePlaceId,
      tenancyId: state.tenancyId,
      moveInMinute: state.moveInMinute,
      currentRent: state.currentRent,
    });
    this.state = ResidenceTenancy.copy(state);
  }

  private static copy(state: ResidenceState): ResidenceState {
    return { ...state };
  }

  private static assertValid(input: Readonly<ResidenceTenancyInput>): void {
    if (!input.placeId.trim()) throw new Error('Residence placeId must be non-empty');
    if (!input.tenancyId.trim()) throw new Error('Residence tenancyId must be non-empty');
    if (!Number.isFinite(input.moveInMinute) || input.moveInMinute < 0) {
      throw new Error('Residence moveInMinute must be a non-negative finite number');
    }
    if (!Number.isFinite(input.currentRent) || input.currentRent < 0) {
      throw new Error('Residence currentRent must be a non-negative finite number');
    }
  }
}
