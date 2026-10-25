import type { SimulationAction, ActionResult } from '../../engine/types';
import type { LabCharacterCommand, LabCharacterResult, LabOsCommand, LabOsResult, LabProceduralCommand, LabProceduralResult, SimulationCafeNarrativeCommand, SimulationCafeNarrativeResult, SimulationPulseNarrativeCommand, SimulationPulseNarrativeResult, SimulationHardwareCommand, SimulationQuery, SimulationQueryResult } from './SimulationHostProtocol';
import type { OsInstallPlan } from '../../engine/kernel/ComputerOwnershipRuntime';
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
    // Once per new save; generated actors persist, cold load never rerolls.
    crypto.randomUUID(),
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
  /** Generation-bound refresh token: an old Worker read must not stall a new run. */
  private refreshOwner: { generation: number; host: WorkerSimulationHost } | null = null;
  private lastDay: number | null = null;
  private lastAutosavedDay: number | null = null;
  private autosaveDayInFlight: number | null = null;

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
    this.refreshOwner = null;
    this.lastDay = null;
    this.lastAutosavedDay = null;
    this.autosaveDayInFlight = null;
  }

  private fail(cause: unknown, generation: number): void {
    if (this.disposed || generation !== this.epoch) return;
    const error = cause instanceof Error ? cause.message : String(cause);
    this.release();
    this.patch({
      phase: 'error', hud: null, world: null, player: null, saved: null, error,
    });
  }

  /** Atomic, bounded gameplay read. Defensive validation fails closed on bad IPC. */
  private async readGameView(host: WorkerSimulationHost) {
    const read = await host.query({ kind: 'gameView' });
    if (read.revision !== read.hud.revision ||
      read.revision !== read.world.revision ||
      read.revision !== read.player.revision) {
      throw new Error('Worker game view revision mismatch');
    }
    return read;
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
      const { hud, world, player } = await this.readGameView(host);
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

  /** Collapse bursty changes into one in-flight bounded, atomic owner read. */
  private async refresh(generation: number, host: WorkerSimulationHost): Promise<void> {
    if (this.disposed || generation !== this.epoch || this.view.phase !== 'game') return;
    this.refreshPending = true;
    if (this.refreshOwner?.generation === generation && this.refreshOwner.host === host) return;
    const owner = { generation, host };
    this.refreshOwner = owner;
    try {
      while (this.refreshPending && generation === this.epoch && this.host === host) {
        this.refreshPending = false;
        const { hud, world, player } = await this.readGameView(host);
        if (generation !== this.epoch || this.host !== host) return;
        const previousDay = this.lastDay;
        this.lastDay = hud.time.day;
        this.patch({ hud, world, player });
        if (previousDay !== null && hud.time.day > (this.lastAutosavedDay ?? previousDay)
          && this.autosaveDayInFlight === null) {
          const saveDay = hud.time.day;
          this.autosaveDayInFlight = saveDay;
          void this.factories.saveGame(host, 'autosave').then(() => {
            if (generation !== this.epoch) return;
            // An attempted save is NOT a completed save. Retry after a later
            // canonical revision if IDB rejected this transaction.
            this.lastAutosavedDay = saveDay;
            this.patch({ saved: 'Autosaved' });
          }).catch(error => {
            if (generation === this.epoch) this.patch({ saved: 'Autosave failed: ' + String(error) });
          }).finally(() => {
            if (generation !== this.epoch || this.host !== host) return;
            this.autosaveDayInFlight = null;
            // The player may have crossed another day while the IDB save was
            // pending. Schedule its latest day without overlapping writes.
            if (this.view.hud && this.view.hud.time.day > saveDay) {
              void this.refresh(generation, host);
            }
          });
        }
      }
    } catch (error) {
      this.fail(error, generation);
    } finally {
      // A stale, delayed query may finish after release() and a new boot.
      // It must never clear the new generation's refresh lock.
      if (this.refreshOwner === owner) this.refreshOwner = null;
    }
  }

  private active(): WorkerSimulationHost {
    if (!this.host || this.view.phase !== 'game') throw new Error('Worker game not ready');
    return this.host;
  }

  /** Only player-safe bounded reads are authorized for UI consumers. */
  read<Q extends SimulationQuery>(query: Q): Promise<SimulationQueryResult<Q>> {
    return this.active().query(query);
  }

  hardware(command: SimulationHardwareCommand): Promise<ActionResult<OsInstallPlan>> {
    return this.active().hardware(command);
  }

  /** Authored dialogue commands; the Worker resolves the real guest and effects. */
  cafeNarrative(command: SimulationCafeNarrativeCommand): Promise<SimulationCafeNarrativeResult> {
    return this.active().cafeNarrative(command);
  }

  /** Context-safe authored chat; the UI never submits arbitrary message text. */
  pulseNarrative(command: SimulationPulseNarrativeCommand): Promise<SimulationPulseNarrativeResult> {
    return this.active().pulseNarrative(command);
  }

  async labCharacter(command: LabCharacterCommand): Promise<LabCharacterResult> {
    const host = this.active();
    const generation = this.epoch;
    const result = await host.labCharacter(command);
    if (generation !== this.epoch || this.host !== host || this.disposed) {
      throw new Error('Character Lab request belongs to an expired Worker session');
    }
    return result;
  }

  async labOs(command: LabOsCommand): Promise<LabOsResult> {
    const host = this.active();
    const generation = this.epoch;
    const result = await host.labOs(command);
    if (generation !== this.epoch || this.host !== host || this.disposed) {
      throw new Error('OS Lab request belongs to an expired Worker session');
    }
    return result;
  }

  /** Developer Lab may request bounded Worker generation, never raw world state. */
  async labProcedural(command: LabProceduralCommand): Promise<LabProceduralResult> {
    const host = this.active();
    const generation = this.epoch;
    const result = await host.labProcedural(command);
    if (generation !== this.epoch || this.host !== host || this.disposed) {
      throw new Error('Lab request belongs to an expired Worker session');
    }
    return result;
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
    await this.factories.saveGame(host, slotId);
    if (generation === this.epoch) {
      // Save As switches the active UI slot ONLY after the Worker confirms
      // the canonical save. Failed writes must not redirect Pulse state.
      setCurrentPulseSlotId(slotId);
      this.patch({ slotId, saved: 'Saved to ' + slotId });
    }
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
