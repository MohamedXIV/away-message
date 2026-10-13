import type { SimulationState } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import { projectCoreState } from './CoreStateProjection';

/**
 * Authoritative subscriber notification and state-cache invalidation coordinator.
 * Ensures subscribers observe committed state, prevents duplicate domain updates,
 * and maintains cache coherence without duplicate mutable state.
 */
export class CoreStatePublication {
  private subscribers: Set<(state: Readonly<SimulationState>) => void> = new Set();
  private _cachedState: Readonly<SimulationState> | null = null;
  private _cachedStateVersion = -1;
  private _stateVersion = 0;

  public getState(
    owners: CoreDomainOwners,
    activeView: SimulationState['activeView'],
  ): Readonly<SimulationState> {
    // Mood context is derived, reconcile before consulting cache
    owners.mood.publishIfChanged();

    if (this._cachedState && this._cachedStateVersion === this._stateVersion) {
      return this._cachedState;
    }

    const newState = projectCoreState(owners, activeView);
    this._cachedState = newState;
    this._cachedStateVersion = this._stateVersion;
    return newState;
  }

  public subscribe(
    listener: (state: Readonly<SimulationState>) => void,
    getCurrentState: () => Readonly<SimulationState>,
  ): () => void {
    this.subscribers.add(listener);
    listener(getCurrentState());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  public notifySubscribers(getCurrentState: () => Readonly<SimulationState>): void {
    this._stateVersion++;
    this._cachedState = null;
    const currentState = getCurrentState();
    for (const listener of this.subscribers) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[CoreStatePublication] Subscriber error:', err);
      }
    }
  }

  public invalidateCache(): void {
    this._cachedState = null;
  }

  public bumpVersion(): void {
    this._stateVersion++;
    this._cachedState = null;
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }
}
