export type PhysicalItemLocation =
  | { kind: 'container'; containerInstanceId: string }
  | { kind: 'worldAnchor'; anchorId: string }
  | { kind: 'storeStock'; storeId: string; slotId: string }
  | { kind: 'installed'; hostInstanceId: string; slotId: string }
  | { kind: 'terminal'; state: 'consumed' | 'discarded' | 'removed' };

export interface PhysicalItemDefinition {
  id: string;
  kind: string;
  portable: boolean;
  volume: number;
}

export interface PhysicalContainerDefinition {
  id: string;
  capacity: number;
  allowedItemKinds: readonly string[];
}

export interface ItemInstance {
  instanceId: string;
  definitionId: string;
  location: PhysicalItemLocation;
}

export interface ContainerInstance {
  instanceId: string;
  definitionId: string;
}

export interface PhysicalWorldState {
  items: Record<string, ItemInstance>;
  containers: Record<string, ContainerInstance>;
}

function cloneLocation(location: PhysicalItemLocation): PhysicalItemLocation {
  return { ...location };
}

function cloneState(state: PhysicalWorldState): PhysicalWorldState {
  return {
    items: Object.fromEntries(
      Object.entries(state.items).map(([id, item]) => [
        id,
        { ...item, location: cloneLocation(item.location) },
      ]),
    ),
    containers: Object.fromEntries(
      Object.entries(state.containers).map(([id, container]) => [id, { ...container }]),
    ),
  };
}

function assertNonEmptyId(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must be a non-empty ID.`);
}

export class PhysicalItemEngine {
  private state: PhysicalWorldState;

  public constructor(
    initialState: PhysicalWorldState,
    private readonly itemDefinitions: Readonly<Record<string, PhysicalItemDefinition>>,
    private readonly containerDefinitions: Readonly<Record<string, PhysicalContainerDefinition>>,
  ) {
    this.state = cloneState(initialState);
    this.validateState(this.state);
  }

  public getState(): PhysicalWorldState {
    return cloneState(this.state);
  }

  public getItem(instanceId: string): ItemInstance {
    const item = this.state.items[instanceId];
    if (!item) throw new Error(`Unknown physical item instance: ${instanceId}.`);
    return { ...item, location: cloneLocation(item.location) };
  }

  public getContainerContents(containerInstanceId: string): ItemInstance[] {
    this.requireContainer(containerInstanceId);
    return Object.values(this.state.items)
      .filter(
        (item) =>
          item.location.kind === 'container' &&
          item.location.containerInstanceId === containerInstanceId,
      )
      .map((item) => ({ ...item, location: cloneLocation(item.location) }));
  }

  public transfer(instanceId: string, destination: PhysicalItemLocation): ItemInstance {
    const current = this.state.items[instanceId];
    if (!current) throw new Error(`Unknown physical item instance: ${instanceId}.`);

    // Validate a candidate snapshot first. No mutation occurs until every invariant passes.
    const candidate = cloneState(this.state);
    candidate.items[instanceId] = {
      ...candidate.items[instanceId]!,
      location: cloneLocation(destination),
    };
    this.validateState(candidate);

    this.state = candidate;
    return this.getItem(instanceId);
  }

  private validateState(state: PhysicalWorldState): void {
    for (const [instanceId, container] of Object.entries(state.containers)) {
      assertNonEmptyId(instanceId, 'Container instance ID');
      if (container.instanceId !== instanceId) {
        throw new Error(`Container map key does not match instance identity: ${instanceId}.`);
      }
      const definition = this.containerDefinitions[container.definitionId];
      if (!definition) {
        throw new Error(`Unknown container definition: ${container.definitionId}.`);
      }
      if (!Number.isInteger(definition.capacity) || definition.capacity < 0) {
        throw new Error(`Container ${instanceId} has invalid capacity.`);
      }
    }

    for (const [instanceId, item] of Object.entries(state.items)) {
      assertNonEmptyId(instanceId, 'Item instance ID');
      if (item.instanceId !== instanceId) {
        throw new Error(`Item map key does not match instance identity: ${instanceId}.`);
      }
      if (!this.itemDefinitions[item.definitionId]) {
        throw new Error(`Unknown item definition: ${item.definitionId}.`);
      }
      this.validateLocation(item, state);
    }

    for (const [containerInstanceId, container] of Object.entries(state.containers)) {
      const definition = this.containerDefinitions[container.definitionId]!;
      const contents = Object.values(state.items).filter(
        (item) =>
          item.location.kind === 'container' &&
          item.location.containerInstanceId === containerInstanceId,
      );
      if (contents.length > definition.capacity) {
        throw new Error(`Container ${containerInstanceId} exceeds capacity ${definition.capacity}.`);
      }
      for (const item of contents) {
        const itemDefinition = this.itemDefinitions[item.definitionId]!;
        if (
          definition.allowedItemKinds.length > 0 &&
          !definition.allowedItemKinds.includes(itemDefinition.kind)
        ) {
          throw new Error(
            `Item ${item.instanceId} category ${itemDefinition.kind} is not allowed in container ${containerInstanceId}.`,
          );
        }
      }
    }
  }

  private validateLocation(item: ItemInstance, state: PhysicalWorldState): void {
    const location = item.location;
    switch (location.kind) {
      case 'container':
        this.requireContainerFromState(location.containerInstanceId, state);
        return;
      case 'worldAnchor':
        assertNonEmptyId(location.anchorId, 'World anchor ID');
        return;
      case 'storeStock':
        assertNonEmptyId(location.storeId, 'Store ID');
        assertNonEmptyId(location.slotId, 'Store stock slot ID');
        return;
      case 'installed':
        assertNonEmptyId(location.hostInstanceId, 'Installed host instance ID');
        assertNonEmptyId(location.slotId, 'Installed slot ID');
        return;
      case 'terminal':
        return;
      default: {
        const exhaustive: never = location;
        throw new Error(`Unsupported physical item location: ${String(exhaustive)}.`);
      }
    }
  }

  private requireContainer(instanceId: string): ContainerInstance {
    return this.requireContainerFromState(instanceId, this.state);
  }

  private requireContainerFromState(
    instanceId: string,
    state: PhysicalWorldState,
  ): ContainerInstance {
    const container = state.containers[instanceId];
    if (!container) throw new Error(`Unknown container instance: ${instanceId}.`);
    return container;
  }
}
