import type { SimulationAction, ActionResult } from '../../engine/types';
import type {
  SimulationHudProjection, SimulationWorldRead, SimulationPlayerStatusRead,
} from '../../engine/kernel/SimulationPublication';
import { setCurrentPulseSlotId } from '../../apps/pulse/persistence';
import { createBrowserSimulationHost, type WorkerSimulationHost } from './WorkerSimulationHost';
import { openBrowserSimulationSlot, saveBrowserSimulationSlot } from './WorkerSlotSession';

export interface WorkerSessionView {
  phase: 'menu' | 'loading' | 'game' | 'error';
  slotId: string;
  hud: SimulationHudProjection | null;
  world: SimulationWorldRead | null;
  player: SimulationPlayerStatusRead | null;
  error: string | null;
  saved: string | null;
}

/** Factories are injectable for headless lifecycle tests. Never create a local Kernel. */
export interface WorkerSessionFactories {
  newGame: (housingOfferId?: string) => Promise<WorkerSimulationHost>;
  loadGame: (slotId: string) => Promise<WorkerSimulationHost>;
  saveGame: (host: WorkerSimulationHost, slotId: string, name?: string) => Promise<unknown>;
}

const browserFactories: WorkerSessionFactories = {
  newGame: (housingOfferId) => createBrowserSimulationHost(
    housingOfferId ? { starterHousingOfferId: housingOfferId } : undefined,
  ),
  loadGame: openBrowserSimulationSlot,
  saveGame: saveBrowserSimulationSlot,
};

/**
 * Transitional Worker-only game session. This owner exposes ONLY bounded
 * projection caches and serializable commands to a React renderer.
 * It never imports Zustand, the legacy App, or SimulationKernel.
 */
export class WorkerGameSession {
  private view: WorkerSessionView = {
    phase: 'menu', slotId: 'slot_1', hud: null, world: null,
    player: null, error: null, saved: null,
  };
  private readonly listeners = new Set<() => void>();
  private host: WorkerSimulationHost | null = null;
  private offChange: (() => void) | null = null;
  private offFailure: (() => void) | null = null;
  private epoch = 0;
  private disposed = false;
  private refreshPending = false;
  private refreshing = false;
  private lastDay: number | null = null;
  private lastAutosavedDay: number | null = null;

  constructor(private readonly factories: WorkerSessionFactories = browserFactories) {}

  getSnapshot = (): WorkerSessionView => this.view;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private patch(delta: Partial<WorkerSessionView>): void {
    this.view = { ...this.view, ...delta };
    for (const listener of this.listeners) listener();
  }

  /** Invalidate all outstanding replies before disposing an old Worker. */
  private release(): void {
    this.epoch++;
    this.offChange?.();
    this.offChange = null;
    this.offFailure?.();
    this.offFailure = null;
    this.host?.dispose();
    this.host = null;
    this.refreshPending = false;
    this.lastDay = null;
    this.lastAutosavedDay = null;
  }

  private fail(cause: unknown, generation: number): void {
    if (this.disposed || generation !== this.epoch) return;
    const error = cause instanceof Error ? cause.message : String(cause);
    this.release();
    this.patch({
      phase: 'error', hud: null, world: null, player: null, saved: null, error,
    });
  }

  /** No dual-world fallback if Worker initialization or cold boot fails. */
  private async boot(factory: () => Promise<WorkerSimulationHost>, slotId: string): Promise<void> {
    if (this.disposed) throw new Error('Worker session disposed');
    this.release();
    const generation = this.epoch;
    this.patch({ phase: 'loading', slotId, error: null, saved: null, hud: null, world: null, player: null });
    let host: WorkerSimulationHost | null = null;
    try {
      host = await factory();
      if (this.disposed || generation !== this.epoch) {
        host.dispose();
        return;
      }
      this.host = host;
      this.offFailure = host.onFailure(error => this.fail(error, generation));
      const [hud, world, player] = await Promise.all([
        host.query({ kind: 'hud' }),
        host.query({ kind: 'world' }),
        host.query({ kind: 'playerStatus' }),
      ]);
      if (this.disposed || generation !== this.epoch) return;
      this.lastDay = hud.time.day;
      this.lastAutosavedDay = hud.time.day;
      setCurrentPulseSlotId(slotId);
      this.patch({ phase: 'game', hud, world, player, error: null });
      this.offChange = host.subscribe(() => { void this.refresh(generation, host!); });
      await host.setClockRunning(true);
    } catch (error) {
      if (this.disposed || generation !== this.epoch) {
        if (host && host !== this.host) host.dispose();
        return;
      }
      this.fail(error, generation);
    }
  }

  async newGame(housingOfferId?: string): Promise<void> {
    await this.boot(() => this.factories.newGame(housingOfferId), 'slot_1');
  }
  async loadGame(slotId: string): Promise<void> {
    await this.boot(() => this.factories.loadGame(slotId), slotId);
  }

  /** Collapse bursty changes into at most one in-flight set of three owner reads. */
  private async refresh(generation: number, host: WorkerSimulationHost): Promise<void> {
    if (this.disposed || generation !== this.epoch || this.view.phase !== 'game') return;
    this.refreshPending = true;
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      while (this.refreshPending && generation === this.epoch && this.host === host) {
        this.refreshPending = false;
        const [hud, world, player] = await Promise.all([
          host.query({ kind: 'hud' }),
          host.query({ kind: 'world' }),
          host.query({ kind: 'playerStatus' }),
        ]);
        if (generation !== this.epoch || this.host !== host) return;
        // Do not publish a mixed-revision read, including after an
        // asynchronous time tick interleaved between the three queries.
        if (hud.revision !== world.revision || hud.revision !== player.revision) {
          this.refreshPending = true;
          continue;
        }
        const previousDay = this.lastDay;
        this.lastDay = hud.time.day;
        this.patch({ hud, world, player });
        if (previousDay !== null && hud.time.day > previousDay
          && this.lastAutosavedDay !== hud.time.day) {
          this.lastAutosavedDay = hud.time.day;
          void this.factories.saveGame(host, 'autosave').then(() => {
            if (generation === this.epoch) this.patch({ saved: 'Autosaved' });
          }).catch(error => {
            if (generation === this.epoch) this.patch({ saved: 'Autosave failed: ' + String(error) });
          });
        }
      }
    } catch (error) {
      this.fail(error, generation);
    } finally {
      this.refreshing = false;
    }
  }

  private active(): WorkerSimulationHost {
    if (!this.host || this.view.phase !== 'game') throw new Error('Worker game not ready');
    return this.host;
  }

  async dispatch(action: SimulationAction): Promise<ActionResult> {
    const host = this.active();
    const result = await host.dispatch(action);
    return result;
  }

  async advanceMinutes(minutes: number): Promise<void> {
    await this.active().advanceGameMinutes(minutes, 'Worker session UI command');
  }

  async save(slotId = this.view.slotId): Promise<void> {
    const host = this.active();
    const generation = this.epoch;
    setCurrentPulseSlotId(slotId);
    await this.factories.saveGame(host, slotId);
    if (generation === this.epoch) this.patch({ slotId, saved: 'Saved to ' + slotId });
  }

  backToMenu(): void {
    if (this.disposed) return;
    this.release();
    this.patch({ phase: 'menu', hud: null, world: null, player: null, error: null, saved: null });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.listeners.clear();
  }
}
