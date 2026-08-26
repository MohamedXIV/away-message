import { SimulationEventMap } from './types';

type EventHandler<T> = (payload: T) => void;

export class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<keyof SimulationEventMap, Set<EventHandler<any>>> = new Map();

  public on<K extends keyof SimulationEventMap>(
    event: K,
    handler: EventHandler<SimulationEventMap[K]>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);

    return () => this.off(event, handler);
  }

  public off<K extends keyof SimulationEventMap>(
    event: K,
    handler: EventHandler<SimulationEventMap[K]>
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof SimulationEventMap>(
    event: K,
    payload: SimulationEventMap[K]
  ): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    const handlers = Array.from(set);
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event '${event}':`, err);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }

  public listenerCount<K extends keyof SimulationEventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
