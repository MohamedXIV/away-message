import { GameClock } from '../GameClock';
import { EventBus } from '../EventBus';
import { EconomyEngine } from '../EconomyEngine';
import { PlayerNeedsEngine } from '../PlayerNeedsEngine';
import { HardwareEngine } from '../HardwareEngine';
import { FileSystemEngine } from '../FileSystemEngine';
import { DownloadManager } from '../DownloadManager';
import { DeliveryEngine } from '../DeliveryEngine';
import { SoftwareRegistry } from '../SoftwareRegistry';
import { SocialEngine } from '../SocialEngine';
import { TelemetryEngine } from '../TelemetryEngine';
import { WorldEventsEngine } from '../WorldEventsEngine';
import { EnvironmentEngine } from '../EnvironmentEngine';
import { MoodEngine, type MoodContext } from '../MoodEngine';
import { createGameContextReadApi } from '../GameContext';
import { OsEngine } from '../OsEngine';
import { PulseEngine } from '../PulseEngine';
import { MyPlaceEngine } from '../MyPlaceEngine';
import type { SimulationState } from '../types';

/**
 * The *single* core-domain composition root.
 *
 * Each engine below is an existing domain authority, instantiated once here
 * with explicit dependencies and a shared event bus. This is not another
 * SimulationEngine, does not tick, has no snapshots of its own and must not
 * become a second mutable source of truth.
 *
 * #171 production cutover: only the composed SimulationKernel constructs
 * this graph. No inherited executor exists; the root retains a single writer
 * and delegates bounded responsibilities to explicit runtime coordinators.
 */
export function createCoreDomainOwners(initialState?: Partial<SimulationState>) {
  const events = new EventBus();
  const clock = new GameClock({
    initialDay: initialState?.time?.day ?? 1,
    initialHour: initialState?.time?.hour ?? 8,
    initialMinute: initialState?.time?.minute ?? 0,
  });

  const needs = new PlayerNeedsEngine(
    events,
    (initialState as any)?.needs ?? initialState?.player,
  );
  const economy = new EconomyEngine(events, initialState?.player, needs);
  const hardware = new HardwareEngine(events, initialState?.hardware);
  const vfs = new FileSystemEngine(events, initialState?.vfs);

  // World is initialized before consumers that derive forecasts, OS releases
  // or UI context from canonical world-event truth.
  const worldInitial = (initialState as any)?.world ?? (initialState as any)?.narrative;
  const world = new WorldEventsEngine(events, worldInitial);
  const environment = new EnvironmentEngine(events, world, () => clock.getTotalMinutes());

  const moodContext = (): MoodContext => {
    // Mood samples the finance owner, not the merged Economy+Needs
    // compatibility PlayerState. Needs has its own canonical snapshot.
    const rent = economy.getRentStatus();
    return {
      atMinute: clock.getTotalMinutes(),
      needs: needs.getSnapshot(),
      environment: environment.getCurrentSnapshot(),
      finance: {
        cash: economy.getCash(),
        rentDueDay: rent.rentDueDay,
        rentAmount: rent.rentAmount,
        rentPaid: rent.rentPaid,
        currentDay: clock.getTime().day,
      },
    };
  };
  const mood = new MoodEngine(events, (initialState as any)?.mood, moodContext);
  const gameContext = createGameContextReadApi({
    getTime: () => clock.getTime(),
    getCurrentEnvironment: (context) => environment.getCurrentSnapshot(context),
    getEnvironmentAt: (query) => environment.getSnapshot(query),
    getEnvironmentForecast: (query) => environment.getForecast(query),
    getNeeds: () => needs.getSnapshot(),
    getMood: () => mood.getCurrentSnapshot(),
  });

  const osInitial = (initialState as any)?.os ?? {
    currentOsId: initialState?.hardware?.osVersion,
  };
  const os = new OsEngine(events, {
    currentOsId: osInitial.currentOsId ?? initialState?.hardware?.osVersion,
    ...(osInitial as object),
  });
  const pulseInitial = (initialState as any)?.pulse ?? { currentPulseId: 'pulse_5.2' };
  const pulse = new PulseEngine(events, pulseInitial);
  const myplace = new MyPlaceEngine(events, (initialState as any)?.myplace);

  try {
    os.syncFromWorldState({
      triggeredEvents: world.getTriggeredEvents(),
      pendingEvents: world.getPendingEvents(),
    } as any, clock.getTime().day);
  } catch {
    // Preserve the existing recovery semantics for malformed legacy catalog.
  }

  const downloads = new DownloadManager(
    {
      eventBus: events,
      vfs,
      getConnectionSpeedKbps: () => hardware.getState().connectionSpeedKbps,
    },
    initialState?.downloads
      ? { tasks: initialState.downloads, maxConcurrentBrowser: 1, maxConcurrentFlashFetch: 4,
        nextDownloadOrdinal: initialState.downloadNextOrdinal }
      : undefined,
  );
  const delivery = new DeliveryEngine((initialState as any)?.deliveries);
  const software = new SoftwareRegistry(
    events,
    vfs,
    {
      getOsVersion: () => os.getCurrentOsId() as any,
      getRamMb: () => hardware.getState().ramMB,
      getCpuTier: () => hardware.getState().cpuTier,
    },
    initialState?.installedSoftware,
  );
  const social = new SocialEngine(events, initialState?.social);
  const telemetry = new TelemetryEngine(
    events,
    initialState?.telemetry?.stats,
    initialState?.telemetry?.logs,
  );

  // Historical event rehydration must happen after every initial domain has
  // been constructed and before the runtime registers its event handlers.
  try {
    world.checkAndTriggerEvents(clock.getTotalMinutes(), clock.getTime().day);
    os.syncFromWorldState({
      triggeredEvents: world.getTriggeredEvents(),
      pendingEvents: world.getPendingEvents(),
    } as any, clock.getTime().day);
  } catch {
    // Preserve current recovery behavior; #174 owns save-schema cleanup.
  }

  return {
    events,
    clock,
    needs,
    economy,
    hardware,
    vfs,
    world,
    environment,
    mood,
    gameContext,
    os,
    pulse,
    myplace,
    downloads,
    delivery,
    software,
    social,
    telemetry,
  };
}

export type CoreDomainOwners = ReturnType<typeof createCoreDomainOwners>;
