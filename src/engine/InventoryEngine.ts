import type { PlayerInventoryState } from './types';
import { createEmptyInventoryState } from './hardware/state';

function cloneState(state: PlayerInventoryState): PlayerInventoryState {
  return {
    items: state.items.map((item) => ({ ...item })),
    legacyRecovery: state.legacyRecovery ? { ...state.legacyRecovery } : undefined,
  };
}

export class InventoryEngine {
  private state: PlayerInventoryState;

  constructor(initial?: Partial<PlayerInventoryState>) {
    const empty = createEmptyInventoryState();
    this.state = {
      ...empty,
      items: initial?.items?.map((item) => ({ ...item })) ?? [],
      legacyRecovery: initial?.legacyRecovery ? { ...initial.legacyRecovery } : undefined,
    };
  }

  public getState(): Readonly<PlayerInventoryState> {
    return cloneState(this.state);
  }

  public loadState(state: PlayerInventoryState): void {
    this.state = cloneState(state);
  }
}
