// Canonical simulation facade with the universal physical-world persistence seam.
//
// The established v6 PC/OS facade remains byte-for-byte in
// SimulationEngineLegacyFacade.ts. This thin layer owns #18's new persisted
// physical root so the material-world migration cannot rewrite unrelated
// gameplay coordination.

import {
  SimulationEngine as LegacySimulationEngine,
  type LiveSimulationState as LegacyLiveSimulationState,
} from './SimulationEngineLegacyFacade';
import {
  bridgeOwnedInventoryIntoPhysicalWorld,
  PLAYER_INVENTORY_CONTAINER_ID,
} from './PhysicalItemBridge';
import type { PhysicalWorldState } from './PhysicalItemEngine';
import type { SimulationState as TransportSimulationState } from './types';

export * from './SimulationEngineLegacyFacade';

export type LiveSimulationState = LegacyLiveSimulationState & {
  physicalWorld: PhysicalWorldState;
};

type InitialSimulationState = Partial<TransportSimulationState> & {
  physicalWorld?: PhysicalWorldState;
};

function emptyPhysicalWorld(): PhysicalWorldState {
  return {
    items: {},
    containers: {
      [PLAYER_INVENTORY_CONTAINER_ID]: {
        instanceId: PLAYER_INVENTORY_CONTAINER_ID,
        definitionId: 'player_inventory',
      },
    },
  };
}

function clonePhysicalWorld(state: PhysicalWorldState): PhysicalWorldState {
  return {
    items: Object.fromEntries(
      Object.entries(state.items).map(([id, item]) => [
        id,
        { ...item, location: { ...item.location } },
      ]),
    ),
    containers: Object.fromEntries(
      Object.entries(state.containers).map(([id, container]) => [id, { ...container }]),
    ),
  };
}

export class SimulationEngine extends LegacySimulationEngine {
  private physicalWorldState: PhysicalWorldState | null = null;

  public constructor(initialState?: InitialSimulationState) {
    super(initialState);
    this.physicalWorldState = this.hydratePhysicalWorld(initialState?.physicalWorld);
  }

  private hydratePhysicalWorld(persisted?: PhysicalWorldState): PhysicalWorldState {
    return bridgeOwnedInventoryIntoPhysicalWorld(
      persisted ? clonePhysicalWorld(persisted) : emptyPhysicalWorld(),
      this.inventory.getState(),
    );
  }

  private currentPhysicalWorld(): PhysicalWorldState {
    // Defensive only for superclass construction: once our constructor returns,
    // physicalWorldState is always initialized through hydratePhysicalWorld().
    return this.physicalWorldState ?? emptyPhysicalWorld();
  }

  public override getState(): Readonly<LiveSimulationState> {
    return {
      ...super.getState(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
    };
  }

  public override exportSnapshot(): LiveSimulationState {
    return {
      ...super.exportSnapshot(),
      physicalWorld: clonePhysicalWorld(this.currentPhysicalWorld()),
    };
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const persisted = (snapshot as TransportSimulationState & { physicalWorld?: PhysicalWorldState })
      .physicalWorld;
    super.loadSnapshot(snapshot);
    this.physicalWorldState = this.hydratePhysicalWorld(persisted);
  }
}
