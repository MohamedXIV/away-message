import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useEffect, useRef } from 'react';
import { SimulationEngine } from '../engine/SimulationEngine';
import {
  SimulationState,
  SimulationAction,
  ActionResult,
  GameTime,
  PlayerState,
  HardwareState,
  VirtualFileSystemState,
  DownloadTask,
  InstalledSoftwareRecord,
  SocialEngineState,
  WorldState,
  NarrativeState,
  TelemetryStats,
  ConnectionType,
  OsVersion,
  FileRecord,
  Appointment,
} from '../engine/types';

// Default singleton engine instance
const defaultEngine = new SimulationEngine();

export interface SimulationStoreState {
  engine: SimulationEngine;
  state: SimulationState;
  isPaused: boolean;
  activeView: 'pc' | 'room' | 'cafe' | 'work';
}

export interface SimulationStoreActions {
  // Engine lifecycle
  setEngine: (engine: SimulationEngine) => void;
  syncStateFromEngine: () => void;

  // General Dispatch
  dispatchAction: (action: SimulationAction) => ActionResult;

  // Time & View
  advanceTime: (minutes: number, reason?: string) => void;
  setPaused: (paused: boolean) => void;
  switchView: (view: 'pc' | 'room' | 'cafe' | 'work') => void;

  // Economy & Player
  earnCash: (amount: number, reason: string) => void;
  spendCash: (amount: number, reason: string) => void;
  workShift: (durationMinutes?: number, wage?: number) => void;
  payRent: () => void;
  payInternet: () => void;
  restOrSleep: (wakeHour?: number, wakeMinute?: number) => void;
  interactRoom: (activity: 'tea' | 'coffee' | 'meal' | 'groceries' | 'shower' | 'window') => void;
  cityOuting: (outingId: string) => ActionResult;
  applyGig: (gigId: string) => ActionResult;

  // Hardware & OS
  upgradeRam: (ramMB: number, cost: number) => void;
  upgradeConnection: (connectionType: ConnectionType, cost: number) => void;
  upgradeOs: (targetOs: OsVersion, cost: number) => void;

  // Downloads
  startDownload: (params: {
    sourceId: string;
    url: string;
    fileName: string;
    totalBytes: number;
    sourceMaxKbps: number;
    fileKind?: 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text';
    appAssociation?: string;
    manager?: 'browser' | 'flashfetch';
  }) => void;
  pauseDownload: (taskId: string) => void;
  resumeDownload: (taskId: string) => void;
  cancelDownload: (taskId: string) => void;

  // Virtual File System (VFS)
  createFile: (file: Omit<FileRecord, 'id' | 'createdAtMinute' | 'modifiedAtMinute'> & { id?: string }) => void;
  deleteFile: (path: string) => void;
  moveFileToTrash: (path: string) => void;
  restoreFileFromTrash: (trashPath: string) => void;
  emptyTrash: () => void;

  // Software Registry
  installSoftware: (softwareId: string, selectedOptions?: Record<string, boolean>) => void;
  uninstallSoftware: (installedId: string) => void;

  // Social & World (sandbox)
  sendMessage: (buddyId: string, text: string, tags?: string[]) => void;
  applySocialAction: (buddyId: string, socialAction: string) => void;
  triggerNarrativeBeat: (beatId: string) => void; // deprecated alias
  setNarrativeFlag: (key: string, value: boolean | number | string) => void;
  setWorldFlag: (key: string, value: boolean | number | string) => void;
  triggerWorldEvent: (eventId: string) => void;
  generateProceduralEvents: (opts?: { maxEvents?: number; useAI?: boolean }) => Promise<import('../engine/types').GlobalEvent[]>;
  scheduleAppointment: (appointment: Omit<Appointment, 'isCompleted' | 'isMissed'>) => void;
}

export type SimulationStore = SimulationStoreState & SimulationStoreActions;

export const useSimulationStore = create<SimulationStore>()(
  subscribeWithSelector((set, get) => {
    let unsubscribeEngine: (() => void) | null = null;

    const setupEngineSubscription = (engineInstance: SimulationEngine) => {
      if (unsubscribeEngine) {
        unsubscribeEngine();
      }
      unsubscribeEngine = engineInstance.subscribe((newState) => {
        set({
          state: newState,
          isPaused: engineInstance.clock.isPaused(),
          activeView: newState.activeView,
        });
      });
    };

    // Initial subscription
    setupEngineSubscription(defaultEngine);

    return {
      engine: defaultEngine,
      state: defaultEngine.getState(),
      isPaused: defaultEngine.clock.isPaused(),
      activeView: defaultEngine.getState().activeView,

      setEngine: (engine: SimulationEngine) => {
        setupEngineSubscription(engine);
        set({
          engine,
          state: engine.getState(),
          isPaused: engine.clock.isPaused(),
          activeView: engine.getState().activeView,
        });
      },

      syncStateFromEngine: () => {
        const { engine } = get();
        set({
          state: engine.getState(),
          isPaused: engine.clock.isPaused(),
          activeView: engine.getState().activeView,
        });
      },

      dispatchAction: (action: SimulationAction): ActionResult => {
        const { engine } = get();
        const result = engine.dispatchAction(action);
        get().syncStateFromEngine();
        return result;
      },

      // Convenience Action Wrappers
      advanceTime: (minutes, reason) => {
        get().dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes, reason });
      },

      setPaused: (paused) => {
        get().dispatchAction({ type: 'TIME_SET_PAUSED', paused });
      },

      switchView: (view) => {
        get().dispatchAction({ type: 'VIEW_SWITCH', view });
      },

      earnCash: (amount, reason) => {
        get().dispatchAction({ type: 'PLAYER_EARN_CASH', amount, reason });
      },

      spendCash: (amount, reason) => {
        get().dispatchAction({ type: 'PLAYER_SPEND_CASH', amount, reason });
      },

      workShift: (durationMinutes, wage) => {
        get().dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes, wage });
      },

      payRent: () => {
        get().dispatchAction({ type: 'PLAYER_PAY_RENT' });
      },

      payInternet: () => {
        get().dispatchAction({ type: 'PLAYER_PAY_INTERNET' });
      },

      restOrSleep: (wakeHour, wakeMinute) => {
        get().dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour, wakeMinute });
      },

      interactRoom: (activity) => {
        get().dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity });
      },

      cityOuting: (outingId) => {
        return get().dispatchAction({ type: 'PLAYER_CITY_OUTING', outingId });
      },

      applyGig: (gigId) => {
        return get().dispatchAction({ type: 'JOB_APPLY', gigId });
      },

      upgradeRam: (ramMB, cost) => {
        get().dispatchAction({ type: 'HARDWARE_UPGRADE_RAM', ramMB, cost });
      },

      upgradeConnection: (connectionType, cost) => {
        get().dispatchAction({ type: 'HARDWARE_UPGRADE_CONNECTION', connectionType, cost });
      },

      upgradeOs: (targetOs, cost) => {
        get().dispatchAction({ type: 'HARDWARE_UPGRADE_OS', targetOs, cost });
      },

      startDownload: (params) => {
        get().dispatchAction({
          type: 'DOWNLOAD_START',
          sourceId: params.sourceId,
          url: params.url,
          fileName: params.fileName,
          totalBytes: params.totalBytes,
          sourceMaxKbps: params.sourceMaxKbps,
          fileKind: params.fileKind,
          appAssociation: params.appAssociation,
          manager: params.manager,
        });
      },

      pauseDownload: (taskId) => {
        get().dispatchAction({ type: 'DOWNLOAD_PAUSE', taskId });
      },

      resumeDownload: (taskId) => {
        get().dispatchAction({ type: 'DOWNLOAD_RESUME', taskId });
      },

      cancelDownload: (taskId) => {
        get().dispatchAction({ type: 'DOWNLOAD_CANCEL', taskId });
      },

      createFile: (file) => {
        get().dispatchAction({ type: 'VFS_CREATE_FILE', file });
      },

      deleteFile: (path) => {
        get().dispatchAction({ type: 'VFS_DELETE_FILE', path });
      },

      moveFileToTrash: (path) => {
        get().dispatchAction({ type: 'VFS_MOVE_TRASH', path });
      },

      restoreFileFromTrash: (trashPath) => {
        get().dispatchAction({ type: 'VFS_RESTORE_TRASH', trashPath });
      },

      emptyTrash: () => {
        get().dispatchAction({ type: 'VFS_EMPTY_TRASH' });
      },

      installSoftware: (softwareId, selectedOptions) => {
        get().dispatchAction({ type: 'SOFTWARE_INSTALL', softwareId, selectedOptions });
      },

      uninstallSoftware: (installedId) => {
        get().dispatchAction({ type: 'SOFTWARE_UNINSTALL', installedId });
      },

      sendMessage: (buddyId, text, tags) => {
        get().dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId, text, tags });
      },

      applySocialAction: (buddyId, socialAction) => {
        get().dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId, socialAction });
      },

      triggerNarrativeBeat: (beatId) => {
        get().dispatchAction({ type: 'NARRATIVE_TRIGGER_BEAT', beatId });
      },

      setNarrativeFlag: (key, value) => {
        get().dispatchAction({ type: 'WORLD_SET_FLAG', key, value });
      },

      setWorldFlag: (key, value) => {
        get().dispatchAction({ type: 'WORLD_SET_FLAG', key, value });
      },

      triggerWorldEvent: (eventId) => {
        get().dispatchAction({ type: 'WORLD_TRIGGER_EVENT', eventId });
      },

      generateProceduralEvents: async (opts) => {
        const { engine } = get();
        return engine.generateProceduralEventsNow(opts);
      },

      scheduleAppointment: (appointment) => {
        get().dispatchAction({ type: 'WORLD_SCHEDULE_APPOINTMENT', appointment });
      },
    };
  })
);

// Granular Selectors
export const useGameTime = (): GameTime => useSimulationStore((s) => s.state.time);
export const usePlayerState = (): PlayerState => useSimulationStore((s) => s.state.player);
export const useHardwareState = (): HardwareState => useSimulationStore((s) => s.state.hardware);
export const useVfsState = (): VirtualFileSystemState => useSimulationStore((s) => s.state.vfs);
export const useDownloads = (): DownloadTask[] => useSimulationStore((s) => s.state.downloads);
export const useInstalledSoftware = (): InstalledSoftwareRecord[] => useSimulationStore((s) => s.state.installedSoftware);
export const useSocialState = (): SocialEngineState => useSimulationStore((s) => s.state.social);
export const useWorldState = (): WorldState => useSimulationStore((s) => s.state.world);
export const useNarrativeState = (): NarrativeState => useSimulationStore((s) => s.state.narrative);
export const useTelemetryStats = (): TelemetryStats => useSimulationStore((s) => s.state.telemetry.stats);
export const useActiveView = (): 'pc' | 'room' | 'cafe' | 'work' => useSimulationStore((s) => s.activeView);
export const useIsPaused = (): boolean => useSimulationStore((s) => s.isPaused);

/**
 * Hook to run real-time simulation clock loop in React app root
 */
export function useSimulationTicker(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  const engine = useSimulationStore((s) => s.engine);
  const lastTimeRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());

  useEffect(() => {
    if (!isEnabled) return;

    let animFrameId: number;

    const tick = (currentTime: number) => {
      const deltaSeconds = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Clamp delta to prevent huge jumps on tab switch / background resumption (max 2 seconds per tick)
      const clampedDelta = Math.min(Math.max(deltaSeconds, 0), 2.0);
      if (clampedDelta > 0) {
        engine.advanceRealTime(clampedDelta);
      }

      animFrameId = requestAnimationFrame(tick);
    };

    lastTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    animFrameId = requestAnimationFrame(tick);

    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [engine, isEnabled]);
}
