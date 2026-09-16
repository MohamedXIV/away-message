// src/engine/ResidenceEngine.ts
// Residence / Tenancy Authority — owns only tenancy and current-home state.
// Home dynamically resolves to ResidenceState.currentResidencePlaceId.
// Does NOT duplicate canonical Place definitions, physical inventory,
// economy truth, delivery truth, computer state, or transit truth.

export interface ResidenceState {
  currentResidencePlaceId: string;
  tenancyId: string;
  moveInMinute: number;
  currentRent: number;
}

export const DEFAULT_RESIDENCE_STATE: ResidenceState = {
  currentResidencePlaceId: 'room_104',
  tenancyId: 'tenancy_room_104',
  moveInMinute: 480,
  currentRent: 140.0,
};

export class ResidenceEngine {
  private state: ResidenceState;

  public constructor(initialState?: Partial<ResidenceState>) {
    this.state = {
      currentResidencePlaceId: initialState?.currentResidencePlaceId ?? DEFAULT_RESIDENCE_STATE.currentResidencePlaceId,
      tenancyId: initialState?.tenancyId ?? DEFAULT_RESIDENCE_STATE.tenancyId,
      moveInMinute: initialState?.moveInMinute ?? DEFAULT_RESIDENCE_STATE.moveInMinute,
      currentRent: initialState?.currentRent ?? DEFAULT_RESIDENCE_STATE.currentRent,
    };
  }

  public getState(): ResidenceState {
    return { ...this.state };
  }

  public getCurrentResidencePlaceId(): string {
    return this.state.currentResidencePlaceId;
  }

  public setResidence(patch: Partial<ResidenceState>): ResidenceState {
    this.state = {
      ...this.state,
      ...patch,
    };
    return this.getState();
  }

  public loadState(state?: Partial<ResidenceState>): void {
    if (!state) return;
    this.state = {
      currentResidencePlaceId: state.currentResidencePlaceId ?? DEFAULT_RESIDENCE_STATE.currentResidencePlaceId,
      tenancyId: state.tenancyId ?? DEFAULT_RESIDENCE_STATE.tenancyId,
      moveInMinute: state.moveInMinute ?? DEFAULT_RESIDENCE_STATE.moveInMinute,
      currentRent: state.currentRent ?? DEFAULT_RESIDENCE_STATE.currentRent,
    };
  }
}
