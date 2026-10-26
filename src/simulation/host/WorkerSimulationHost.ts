import type { ActionResult, SimulationAction, SimulationState } from '../../engine/types';
import type { InitialSimulationState } from '../../engine/kernel/PhysicalSimulationRuntime';
import type { MinuteAdvanceGranularity } from '../../engine/kernel/TimeAdvancement';
import type { OsInstallPlan } from '../../engine/kernel/ComputerOwnershipRuntime';
import type { SlotPulseMetadata, SlotSummary } from '../../persistence/slots';
import type { SimulationChange } from '../../engine/kernel/SimulationPublication';
import type {
  LabCharacterCommand, LabCharacterResult, LabOsCommand, LabOsResult, LabProceduralCommand, LabProceduralResult, SimulationCafeNarrativeCommand, SimulationCafeNarrativeResult, SimulationPulseNarrativeCommand, SimulationPulseNarrativeResult, SimulationHardwareCommand, SimulationHost, SimulationQuery, SimulationQueryResult,
  SimulationWorkerCommand, SimulationWorkerReply,
} from './SimulationHostProtocol';

/**
 * Boot watchdog protects against workers that never answer the very first
 * handshake (for example an invalid module, blocked script or startup hang).
 * The saved-world cold load gets a longer window for IndexedDB.
 */
export const WORKER_BOOT_TIMEOUT_MS = 30_000;
export const WORKER_COLD_BOOT_TIMEOUT_MS = 60_000;

/**
 * Main-thread RPC client. Owns no SimulationKernel or mutable domain graph.
 * If a worker crashes, reject pending commands; NEVER install a local fallback.
 */
export class WorkerSimulationHost implements SimulationHost {
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout> | null;
  }>();
  private readonly listeners = new Set<(change: Readonly<SimulationChange>) => void>();
  private readonly failureListeners = new Set<(error: Error) => void>();
  private lastChange: Readonly<SimulationChange> | null = null;
  private failure: Error | null = null;
  private disposed = false;

  private readonly onMessage = (event: MessageEvent<SimulationWorkerReply>): void => {
    if (this.disposed || this.failure) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'fatal') {
      this.fail(new Error(message.error.message));
      return;
    }
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
    if (entry.timeout !== null) clearTimeout(entry.timeout);
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
    for (const pending of this.pending.values()) {
      if (pending.timeout !== null) clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    this.listeners.clear();
    this.worker.terminate();
    for (const listener of this.failureListeners) {
      try { listener(error); } catch { /* UI failures must not hide the Worker fault */ }
    }
    this.failureListeners.clear();
  }

  private request(request: SimulationWorkerCommand, bootTimeoutMs?: number): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error('SimulationHost disposed'));
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = bootTimeoutMs === undefined ? null : setTimeout(() => {
        this.fail(new Error('Dedicated Simulation Worker startup timed out; no fallback world was created'));
      }, bootTimeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.worker.postMessage({ ...request, id });
      } catch (cause) {
        this.pending.delete(id);
        if (timeout !== null) clearTimeout(timeout);
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
  }

  async initialize(initialState?: InitialSimulationState, freshRosterSeed?: string): Promise<void> {
    await this.request({ op: 'init', initialState, freshRosterSeed }, WORKER_BOOT_TIMEOUT_MS);
  }

  async initializeSlot(slotId: string): Promise<void> {
    await this.request({ op: 'initSlot', slotId }, WORKER_COLD_BOOT_TIMEOUT_MS);
  }

  dispatch(action: SimulationAction): Promise<ActionResult> {
    return this.request({ op: 'dispatch', action }) as Promise<ActionResult>;
  }

  hardware(command: SimulationHardwareCommand): Promise<ActionResult<OsInstallPlan>> {
    return this.request({ op: 'hardware', command }) as Promise<ActionResult<OsInstallPlan>>;
  }

  cafeNarrative(command: SimulationCafeNarrativeCommand): Promise<SimulationCafeNarrativeResult> {
    return this.request({ op: 'cafeNarrative', command }) as Promise<SimulationCafeNarrativeResult>;
  }

  pulseNarrative(command: SimulationPulseNarrativeCommand): Promise<SimulationPulseNarrativeResult> {
    return this.request({ op: 'pulseNarrative', command }) as Promise<SimulationPulseNarrativeResult>;
  }

  markConversationRead(actorId: string): Promise<boolean> {
    return this.request({ op: 'markConversationRead', actorId }) as Promise<boolean>;
  }

  labCharacter(command: LabCharacterCommand): Promise<LabCharacterResult> {
    return this.request({ op: 'labCharacter', command }) as Promise<LabCharacterResult>;
  }

  labOs(command: LabOsCommand): Promise<LabOsResult> {
    return this.request({ op: 'labOs', command }) as Promise<LabOsResult>;
  }

  labProcedural(command: LabProceduralCommand): Promise<LabProceduralResult> {
    return this.request({ op: 'labProcedural', command }) as Promise<LabProceduralResult>;
  }

  async advanceGameMinutes(
    minutes: number,
    reason?: string,
    granularity?: MinuteAdvanceGranularity,
  ): Promise<void> {
    await this.request({ op: 'advance', minutes, reason, granularity });
  }

  async advanceRealTime(seconds: number): Promise<void> {
    await this.request({ op: 'realtime', seconds });
  }

  async setClockRunning(running: boolean): Promise<void> {
    await this.request({ op: 'clock', running });
  }

  query<Q extends SimulationQuery>(query: Q): Promise<SimulationQueryResult<Q>> {
    return this.request({ op: 'query', query }) as Promise<SimulationQueryResult<Q>>;
  }

  saveSlot(slotId: string, pulse: SlotPulseMetadata, saveName?: string): Promise<SlotSummary> {
    return this.request({ op: 'saveSlot', slotId, pulse, saveName }) as Promise<SlotSummary>;
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

  /** Fatal Worker failures are observable even while no RPC is outstanding. */
  onFailure(listener: (error: Error) => void): () => void {
    if (this.failure) {
      listener(this.failure);
      return () => {};
    }
    if (this.disposed) {
      listener(new Error('SimulationHost disposed'));
      return () => {};
    }
    this.failureListeners.add(listener);
    return () => { this.failureListeners.delete(listener); };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('SimulationHost disposed');
    for (const entry of this.pending.values()) {
      if (entry.timeout !== null) clearTimeout(entry.timeout);
      entry.reject(error);
    }
    this.pending.clear();
    this.listeners.clear();
    this.failureListeners.clear();
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onError);
    this.worker.removeEventListener('messageerror', this.onMessageError);
    this.worker.terminate();
  }
}

/** A single Vite module Worker, not a dual-running browser simulation. */
export async function createBrowserSimulationHost(
  initialState?: InitialSimulationState,
  freshRosterSeed?: string,
): Promise<WorkerSimulationHost> {
  const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
  const host = new WorkerSimulationHost(worker);
  try {
    await host.initialize(initialState, freshRosterSeed);
    return host;
  } catch (cause) {
    host.dispose();
    throw cause;
  }
}
