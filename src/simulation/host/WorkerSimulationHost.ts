import type { ActionResult, SimulationAction, SimulationState } from '../../engine/types';
import type { InitialSimulationState } from '../../engine/kernel/PhysicalSimulationRuntime';
import type { SimulationChange } from '../../engine/kernel/SimulationPublication';
import type {
  SimulationHost, SimulationQuery, SimulationQueryResult,
  SimulationWorkerCommand, SimulationWorkerReply,
} from './SimulationHostProtocol';

/**
 * Main-thread RPC client. Owns no SimulationKernel or mutable domain graph.
 * If a worker crashes, reject pending commands; NEVER install a local fallback.
 */
export class WorkerSimulationHost implements SimulationHost {
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private readonly listeners = new Set<(change: Readonly<SimulationChange>) => void>();
  private lastChange: Readonly<SimulationChange> | null = null;
  private failure: Error | null = null;
  private disposed = false;

  private readonly onMessage = (event: MessageEvent<SimulationWorkerReply>): void => {
    if (this.disposed || this.failure) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'change') {
      // Worker structured clone drops Object.freeze. Re-freeze so a faulty
      // first subscriber cannot alter the change seen by the next subscriber.
      const change = Object.freeze({
        ...message.change,
        changedDomains: Object.freeze([...message.change.changedDomains]),
      });
      this.lastChange = change;
      for (const listener of this.listeners) {
        try { listener(change); } catch { /* isolate presentation listeners */ }
      }
      return;
    }
    if (message.type !== 'result') return;
    const entry = this.pending.get(message.id);
    if (!entry) return; // discarded or stale response
    this.pending.delete(message.id);
    if (message.ok) entry.resolve(message.value);
    else entry.reject(new Error(message.error.message));
  };

  private readonly onError = (): void => {
    this.fail(new Error('Dedicated Simulation Worker crashed; canonical state is unavailable'));
  };

  private readonly onMessageError = (): void => {
    this.fail(new Error('Dedicated Simulation Worker sent an unreadable message'));
  };

  constructor(private readonly worker: Worker) {
    worker.addEventListener('message', this.onMessage);
    worker.addEventListener('error', this.onError);
    worker.addEventListener('messageerror', this.onMessageError);
  }

  private fail(error: Error): void {
    if (this.failure || this.disposed) return;
    this.failure = error;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.listeners.clear();
    this.worker.terminate();
  }

  private request(request: SimulationWorkerCommand): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error('SimulationHost disposed'));
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ ...request, id });
      } catch (cause) {
        this.pending.delete(id);
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
  }

  async initialize(initialState?: InitialSimulationState): Promise<void> {
    await this.request({ op: 'init', initialState });
  }

  dispatch(action: SimulationAction): Promise<ActionResult> {
    return this.request({ op: 'dispatch', action }) as Promise<ActionResult>;
  }

  async advanceGameMinutes(minutes: number, reason?: string): Promise<void> {
    await this.request({ op: 'advance', minutes, reason });
  }

  async advanceRealTime(seconds: number): Promise<void> {
    await this.request({ op: 'realtime', seconds });
  }

  query<Q extends SimulationQuery>(query: Q): Promise<SimulationQueryResult<Q>> {
    return this.request({ op: 'query', query }) as Promise<SimulationQueryResult<Q>>;
  }

  exportSnapshot(): Promise<SimulationState> {
    return this.request({ op: 'export' }) as Promise<SimulationState>;
  }

  async loadSnapshot(snapshot: SimulationState): Promise<void> {
    await this.request({ op: 'load', snapshot });
  }

  subscribe(listener: (change: Readonly<SimulationChange>) => void): () => void {
    if (this.failure || this.disposed) throw new Error('SimulationHost unavailable');
    this.listeners.add(listener);
    if (this.lastChange) listener(this.lastChange);
    return () => { this.listeners.delete(listener); };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('SimulationHost disposed');
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
    this.listeners.clear();
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onError);
    this.worker.removeEventListener('messageerror', this.onMessageError);
    this.worker.terminate();
  }
}

/** A single Vite module Worker, not a dual-running browser simulation. */
export async function createBrowserSimulationHost(
  initialState?: InitialSimulationState,
): Promise<WorkerSimulationHost> {
  const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
  const host = new WorkerSimulationHost(worker);
  try {
    await host.initialize(initialState);
    return host;
  } catch (cause) {
    host.dispose();
    throw cause;
  }
}
