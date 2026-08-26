# Technical Architecture & Implementation Blueprint — Milestone 2 (Part A)
**Agent**: Explorer M2-1  
**Working Directory**: `f:/_WIP/away-message/.agents/explorer_m2_1/`  
**Targets**:
1. `src/store/useSimulationStore.ts`
2. `src/store/useWindowStore.ts`
3. `src/store/useAudioStore.ts`
4. `src/desktop/WindowFrame.tsx`
5. `src/desktop/WindowManager.tsx`
6. `src/desktop/CRTOverlay.tsx`

---

## 1. Executive Summary & Architecture Overview

The Milestone 2 UI layer connects the headless, authoritative pure-TypeScript `SimulationEngine` (completed in M1) to a fully responsive, period-authentic desktop environment built with React 19, TypeScript, Tailwind CSS, and Zustand.

```
+-----------------------------------------------------------------------------------+
|                              REACT VIEW LAYER                                     |
|                                                                                   |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  |  DesktopShell    |  |   WindowManager   |  |   CRTOverlay (Shader/Scanline) |  |
|  | (Icons, Wallp.)  |  |  (WindowFrames)   |  |  (Curvature, Bloom, Vignette)  |  |
|  +--------+---------+  +---------+---------+  +---------------+----------------+  |
|           |                      |                            |                   |
|  +--------+----------------------+----------------------------+----------------+  |
|  |                           ZUSTAND REACTIVE STORES                           |  |
|  |                                                                             |  |
|  |   +-----------------------+  +--------------------+  +------------------+   |  |
|  |   |  useSimulationStore   |  |   useWindowStore   |  |  useAudioStore   |   |  |
|  |   | (Subscribers/Actions) |  | (Z-Index/Cascade)  |  | (Synth/Volumes)  |   |  |
|  |   +-----------+-----------+  +---------+----------+  +--------+---------+   |  |
+------------------|------------------------|----------------------|----------------+
                   |                        |                      |
                   v                        v                      v
+------------------+----------+             |             +--------+---------+
|  src/engine/                |             |             |  src/audio/      |
|  SimulationEngine.ts        |             |             |  SoundManager.ts |
|  - GameClock (1s = 1min)    |             |             |  - Web Audio API |
|  - EventBus                 |             |             |  - Retro Synth   |
|  - VFS & Downloads          |             |             |  - Dial-up Modem |
|  - Economy & Hardware       |             |             +------------------+
|  - Social & Telemetry       |             |
+-----------------------------+             |
                                            v
                               +------------+------------+
                               |  Desktop Workspace      |
                               |  - Clamping Bounding Box|
                               |  - 28px/32px Taskbar    |
                               |  - 8-Handle Resizing    |
                               +-------------------------+
```

---

## 2. Zustand Reactive Stores Design

### 2.1 `src/store/useSimulationStore.ts`

#### Key Architectural Requirements:
1. **Engine Synchronization**: Provide a single bridge connecting `SimulationEngine.subscribe(listener)` to Zustand's state. When `SimulationEngine` changes (via tick, jump, action), it notifies the store, triggering optimal granular re-renders.
2. **Lifecycle Ticker Hook (`useSimulationTicker`)**: A React hook running `requestAnimationFrame` that calls `engine.advanceRealTime(deltaRealSeconds)`. When the browser tab is hidden or backgrounded (`document.hidden`), it throttles and clamps delta steps to prevent physics explosion while maintaining deterministic progression.
3. **Selector Performance**: Leverage Zustand's `subscribeWithSelector` middleware so UI components only re-render when their specific slice (e.g. `cash`, `time`, `downloads`) updates.
4. **Action Dispatching**: Expose `dispatchAction(action: SimulationAction): ActionResult` and typed domain convenience actions.

#### Complete Implementation Blueprint:
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useEffect, useRef } from 'react';
import {
  SimulationEngine,
} from '../engine/SimulationEngine';
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
  NarrativeState,
  TelemetryStats,
  TelemetryRecord,
  ConnectionType,
  OsVersion,
  FileRecord,
  Appointment,
} from '../engine/types';

// Default initial state matching starting Day 1 spec
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
  restOrSleep: (wakeHour?: number) => void;
  interactRoom: (activity: 'tea' | 'coffee' | 'meal' | 'shower' | 'window') => void;

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

  // Social & Narrative
  sendMessage: (buddyId: string, text: string, tags?: string[]) => void;
  applySocialAction: (buddyId: string, socialAction: string) => void;
  triggerNarrativeBeat: (beatId: string) => void;
  setNarrativeFlag: (key: string, value: boolean | number | string) => void;
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

      restOrSleep: (wakeHour) => {
        get().dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour });
      },

      interactRoom: (activity) => {
        get().dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity });
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
        get().dispatchAction({ type: 'NARRATIVE_SET_FLAG', key, value });
      },

      scheduleAppointment: (appointment) => {
        get().dispatchAction({ type: 'NARRATIVE_SCHEDULE_APPOINTMENT', appointment });
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
  const lastTimeRef = useRef<number>(performance.now());

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

    lastTimeRef.current = performance.now();
    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [engine, isEnabled]);
}
```

---

### 2.2 `src/store/useWindowStore.ts`

#### Key Architectural Requirements:
1. **Window State Registry**: Store list and dictionary of all window instances.
2. **Z-Index Layering**: Strict stacking order. Every `focusWindow` call elevates the window to `max(zIndex) + 1`. Modals are maintained above normal windows.
3. **Window Cascade & Positioning**: Automatically offset newly opened windows diagonally by `(index % 8) * 24px` from a base coordinate of `(60, 40)`, ensuring they spawn within the visible workspace.
4. **Boundary Clamping**:
   - Titlebar remains accessible ($\ge 0$ px from top, $\le$ desktop height minus taskbar).
   - Window width and height respect `minSize` and viewport workspace bounds.
5. **State Persistence**: Store per-window `customState` (e.g. `filePath` for Notepad, `currentUrl` for Browser, `workingDir` for Terminal) so opening the same window or restoring preserves context.
6. **Show Desktop & Window Controls**: Provide `minimizeAll()`, `cascadeWindows()`, `tileWindows()`.

#### Complete Implementation Blueprint:
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { soundManager } from '../audio/SoundManager';

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: WindowPosition;
  size: WindowSize;
  minSize: WindowSize;
  maxSize?: WindowSize;
  isResizable: boolean;
  isModal?: boolean;
  customState?: Record<string, any>;
  previousPosition?: WindowPosition;
  previousSize?: WindowSize;
}

export interface OpenWindowConfig {
  id: string;
  appId: string;
  title: string;
  icon: string;
  defaultPosition?: WindowPosition;
  defaultSize?: WindowSize;
  minSize?: WindowSize;
  maxSize?: WindowSize;
  isResizable?: boolean;
  isModal?: boolean;
  customState?: Record<string, any>;
}

export interface WindowStoreState {
  windows: Record<string, WindowState>;
  windowOrder: string[]; // Order of window IDs
  activeWindowId: string | null;
  highestZIndex: number;
  cascadeCounter: number;
}

export interface WindowStoreActions {
  openWindow: (config: OpenWindowConfig) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  focusWindow: (id: string) => void;
  setWindowPosition: (id: string, position: WindowPosition) => void;
  setWindowSize: (id: string, size: WindowSize) => void;
  updateWindowCustomState: (id: string, customState: Record<string, any>) => void;
  setWindowTitle: (id: string, title: string) => void;
  minimizeAll: () => void;
  cascadeWindows: (workspaceWidth?: number, workspaceHeight?: number) => void;
  tileWindows: (direction: 'horizontal' | 'vertical', workspaceWidth?: number, workspaceHeight?: number) => void;
}

export type WindowStore = WindowStoreState & WindowStoreActions;

const DEFAULT_MIN_SIZE: WindowSize = { width: 320, height: 220 };
const DEFAULT_SIZE: WindowSize = { width: 620, height: 440 };
const TASKBAR_HEIGHT = 32;

export const useWindowStore = create<WindowStore>()(
  subscribeWithSelector((set, get) => ({
    windows: {},
    windowOrder: [],
    activeWindowId: null,
    highestZIndex: 10,
    cascadeCounter: 0,

    openWindow: (config: OpenWindowConfig) => {
      const { windows, highestZIndex, cascadeCounter } = get();
      const existing = windows[config.id];
      const newZIndex = highestZIndex + 1;

      soundManager.play('window_open');

      if (existing) {
        // If window already exists, restore and focus it
        set((state) => ({
          windows: {
            ...state.windows,
            [config.id]: {
              ...existing,
              isOpen: true,
              isMinimized: false,
              zIndex: newZIndex,
              customState: config.customState
                ? { ...existing.customState, ...config.customState }
                : existing.customState,
            },
          },
          activeWindowId: config.id,
          highestZIndex: newZIndex,
        }));
        return;
      }

      // Calculate initial cascade position
      const cascadeStep = (cascadeCounter % 8) * 26;
      const initialPos: WindowPosition = config.defaultPosition ?? {
        x: Math.max(40, 60 + cascadeStep),
        y: Math.max(30, 40 + cascadeStep),
      };

      const newWindow: WindowState = {
        id: config.id,
        appId: config.appId,
        title: config.title,
        icon: config.icon,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        zIndex: newZIndex,
        position: initialPos,
        size: config.defaultSize ?? DEFAULT_SIZE,
        minSize: config.minSize ?? DEFAULT_MIN_SIZE,
        maxSize: config.maxSize,
        isResizable: config.isResizable ?? true,
        isModal: config.isModal ?? false,
        customState: config.customState ?? {},
      };

      set((state) => ({
        windows: { ...state.windows, [config.id]: newWindow },
        windowOrder: [...state.windowOrder.filter((id) => id !== config.id), config.id],
        activeWindowId: config.id,
        highestZIndex: newZIndex,
        cascadeCounter: cascadeCounter + 1,
      }));
    },

    closeWindow: (id: string) => {
      const { windows, windowOrder, activeWindowId } = get();
      const target = windows[id];
      if (!target || !target.isOpen) return;

      const remainingOpen = windowOrder.filter(
        (winId) => winId !== id && windows[winId]?.isOpen && !windows[winId]?.isMinimized
      );

      // Find the next topmost window to focus
      let nextActiveId: string | null = null;
      if (activeWindowId === id && remainingOpen.length > 0) {
        const sorted = remainingOpen
          .map((winId) => windows[winId])
          .sort((a, b) => b.zIndex - a.zIndex);
        nextActiveId = sorted[0]?.id ?? null;
      } else if (activeWindowId !== id) {
        nextActiveId = activeWindowId;
      }

      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            isOpen: false,
            isMinimized: false,
            isMaximized: false,
          },
        },
        activeWindowId: nextActiveId,
      }));
    },

    minimizeWindow: (id: string) => {
      const { windows, windowOrder, activeWindowId } = get();
      const target = windows[id];
      if (!target || target.isMinimized) return;

      soundManager.play('window_minimize');

      const remainingOpen = windowOrder.filter(
        (winId) => winId !== id && windows[winId]?.isOpen && !windows[winId]?.isMinimized
      );

      let nextActiveId: string | null = null;
      if (activeWindowId === id && remainingOpen.length > 0) {
        const sorted = remainingOpen
          .map((winId) => windows[winId])
          .sort((a, b) => b.zIndex - a.zIndex);
        nextActiveId = sorted[0]?.id ?? null;
      }

      set((state) => ({
        windows: {
          ...state.windows,
          [id]: { ...state.windows[id], isMinimized: true },
        },
        activeWindowId: nextActiveId,
      }));
    },

    maximizeWindow: (id: string) => {
      const { windows, highestZIndex } = get();
      const target = windows[id];
      if (!target || target.isMaximized) return;

      const newZIndex = highestZIndex + 1;
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            isMaximized: true,
            isMinimized: false,
            previousPosition: { ...target.position },
            previousSize: { ...target.size },
            zIndex: newZIndex,
          },
        },
        activeWindowId: id,
        highestZIndex: newZIndex,
      }));
    },

    restoreWindow: (id: string) => {
      const { windows, highestZIndex } = get();
      const target = windows[id];
      if (!target) return;

      const newZIndex = highestZIndex + 1;
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            isMinimized: false,
            isMaximized: false,
            position: target.previousPosition ?? target.position,
            size: target.previousSize ?? target.size,
            zIndex: newZIndex,
          },
        },
        activeWindowId: id,
        highestZIndex: newZIndex,
      }));
    },

    toggleMaximize: (id: string) => {
      const target = get().windows[id];
      if (!target) return;
      if (target.isMaximized) {
        get().restoreWindow(id);
      } else {
        get().maximizeWindow(id);
      }
    },

    focusWindow: (id: string) => {
      const { windows, highestZIndex, activeWindowId } = get();
      const target = windows[id];
      if (!target || (activeWindowId === id && target.zIndex === highestZIndex && !target.isMinimized)) {
        return;
      }

      const newZIndex = highestZIndex + 1;
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            isMinimized: false,
            zIndex: newZIndex,
          },
        },
        activeWindowId: id,
        highestZIndex: newZIndex,
      }));
    },

    setWindowPosition: (id: string, position: WindowPosition) => {
      set((state) => {
        const target = state.windows[id];
        if (!target) return state;
        return {
          windows: {
            ...state.windows,
            [id]: { ...target, position, isMaximized: false },
          },
        };
      });
    },

    setWindowSize: (id: string, size: WindowSize) => {
      set((state) => {
        const target = state.windows[id];
        if (!target) return state;
        const clampedWidth = Math.max(target.minSize.width, size.width);
        const clampedHeight = Math.max(target.minSize.height, size.height);
        return {
          windows: {
            ...state.windows,
            [id]: {
              ...target,
              size: { width: clampedWidth, height: clampedHeight },
              isMaximized: false,
            },
          },
        };
      });
    },

    updateWindowCustomState: (id: string, customState: Record<string, any>) => {
      set((state) => {
        const target = state.windows[id];
        if (!target) return state;
        return {
          windows: {
            ...state.windows,
            [id]: {
              ...target,
              customState: { ...target.customState, ...customState },
            },
          },
        };
      });
    },

    setWindowTitle: (id: string, title: string) => {
      set((state) => {
        const target = state.windows[id];
        if (!target) return state;
        return {
          windows: {
            ...state.windows,
            [id]: { ...target, title },
          },
        };
      });
    },

    minimizeAll: () => {
      set((state) => {
        const updated = { ...state.windows };
        Object.keys(updated).forEach((id) => {
          if (updated[id].isOpen) {
            updated[id] = { ...updated[id], isMinimized: true };
          }
        });
        return { windows: updated, activeWindowId: null };
      });
    },

    cascadeWindows: (workspaceWidth = 1024, workspaceHeight = 700) => {
      const { windows, windowOrder, highestZIndex } = get();
      const openWins = windowOrder.filter((id) => windows[id]?.isOpen);
      let currentZ = highestZIndex;
      const updated = { ...windows };

      openWins.forEach((id, index) => {
        currentZ++;
        const offset = (index % 10) * 28;
        const width = Math.min(640, workspaceWidth - 80);
        const height = Math.min(460, workspaceHeight - 80);

        updated[id] = {
          ...updated[id],
          isMinimized: false,
          isMaximized: false,
          position: { x: 30 + offset, y: 30 + offset },
          size: { width, height },
          zIndex: currentZ,
        };
      });

      const lastId = openWins[openWins.length - 1] ?? null;
      set({
        windows: updated,
        activeWindowId: lastId,
        highestZIndex: currentZ,
      });
    },

    tileWindows: (direction: 'horizontal' | 'vertical', workspaceWidth = 1024, workspaceHeight = 700) => {
      const { windows, windowOrder, highestZIndex } = get();
      const openWins = windowOrder.filter((id) => windows[id]?.isOpen && !windows[id]?.isMinimized);
      if (openWins.length === 0) return;

      const updated = { ...windows };
      let currentZ = highestZIndex;

      if (direction === 'horizontal') {
        const h = Math.floor((workspaceHeight - TASKBAR_HEIGHT) / openWins.length);
        openWins.forEach((id, idx) => {
          currentZ++;
          updated[id] = {
            ...updated[id],
            isMaximized: false,
            position: { x: 0, y: idx * h },
            size: { width: workspaceWidth, height: h },
            zIndex: currentZ,
          };
        });
      } else {
        const w = Math.floor(workspaceWidth / openWins.length);
        openWins.forEach((id, idx) => {
          currentZ++;
          updated[id] = {
            ...updated[id],
            isMaximized: false,
            position: { x: idx * w, y: 0 },
            size: { width: w, height: workspaceHeight - TASKBAR_HEIGHT },
            zIndex: currentZ,
          };
        });
      }

      set({
        windows: updated,
        highestZIndex: currentZ,
      });
    },
  }))
);

// Granular Selectors
export const useActiveWindowId = (): string | null => useWindowStore((s) => s.activeWindowId);
export const useOpenWindows = (): WindowState[] =>
  useWindowStore((s) => s.windowOrder.map((id) => s.windows[id]).filter((w): w is WindowState => !!w && w.isOpen));
export const useWindow = (id: string): WindowState | undefined => useWindowStore((s) => s.windows[id]);
```

---

### 2.3 `src/store/useAudioStore.ts`

#### Key Architectural Requirements:
1. **SoundManager Bridge**: Connect Web Audio API synth functions to React components.
2. **Dial-up Handshake Management**: State tracking for active dial-up handshake sound playback with cancellation capability.
3. **Volume Settings Sync**: Persistent settings for Master, SFX, Ambience, and Music volumes.
4. **User Gesture Audio Unlock**: Automatically unlock AudioContext on first pointer/key interaction.

#### Complete Implementation Blueprint:
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { soundManager, SoundSettings } from '../audio/SoundManager';

export type SoundEffectName =
  | 'click'
  | 'window_open'
  | 'window_minimize'
  | 'error'
  | 'im_recv'
  | 'im_send'
  | 'door_open'
  | 'door_slam'
  | 'hdd_chirp';

export interface AudioStoreState {
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  musicVolume: number;
  isMuted: boolean;
  isDialupPlaying: boolean;
  isAudioUnlocked: boolean;
}

export interface AudioStoreActions {
  unlockAudio: () => void;
  playSound: (name: SoundEffectName) => void;
  startDialupHandshake: (onComplete?: () => void) => () => void;
  stopDialup: () => void;
  setMasterVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  setAmbienceVolume: (vol: number) => void;
  setMusicVolume: (vol: number) => void;
  setMute: (muted: boolean) => void;
  toggleMute: () => void;
}

export type AudioStore = AudioStoreState & AudioStoreActions;

let activeDialupCancel: (() => void) | null = null;

export const useAudioStore = create<AudioStore>()(
  subscribeWithSelector((set, get) => {
    const initialSettings: SoundSettings = soundManager.getSettings();

    return {
      masterVolume: initialSettings.masterVolume,
      sfxVolume: initialSettings.sfxVolume,
      ambienceVolume: initialSettings.ambienceVolume,
      musicVolume: initialSettings.musicVolume,
      isMuted: initialSettings.isMuted,
      isDialupPlaying: false,
      isAudioUnlocked: false,

      unlockAudio: () => {
        soundManager.unlockAudio();
        set({ isAudioUnlocked: true });
      },

      playSound: (name: SoundEffectName) => {
        soundManager.play(name);
      },

      startDialupHandshake: (onComplete?: () => void) => {
        if (activeDialupCancel) {
          activeDialupCancel();
          activeDialupCancel = null;
        }

        set({ isDialupPlaying: true });

        const handle = soundManager.playDialup(() => {
          set({ isDialupPlaying: false });
          activeDialupCancel = null;
          if (onComplete) onComplete();
        });

        activeDialupCancel = handle.cancel;

        return () => {
          handle.cancel();
          set({ isDialupPlaying: false });
          activeDialupCancel = null;
        };
      },

      stopDialup: () => {
        if (activeDialupCancel) {
          activeDialupCancel();
          activeDialupCancel = null;
        }
        set({ isDialupPlaying: false });
      },

      setMasterVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        soundManager.setMasterVolume(clamped);
        set({ masterVolume: clamped });
      },

      setSfxVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ sfxVolume: clamped });
      },

      setAmbienceVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ ambienceVolume: clamped });
      },

      setMusicVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ musicVolume: clamped });
      },

      setMute: (muted: boolean) => {
        soundManager.setMute(muted);
        set({ isMuted: muted });
      },

      toggleMute: () => {
        const newMuted = !get().isMuted;
        get().setMute(newMuted);
      },
    };
  })
);
```

---

## 3. Desktop Shell & Window Manager Design

### 3.1 `src/desktop/WindowFrame.tsx`

#### Key Architectural Requirements:
1. **Dual OS Theming**:
   - **Orion 4.8 (Win95/98)**: Sharp 3D beveled borders, solid Navy `#000080` (active) / Gray `#808080` (inactive) titlebar, classic square `_` `□` `✕` buttons with retro outset bevel.
   - **Orion 6.0 (XP)**: Rounded top corners, rich blue gradient titlebar, red glossy close button, subtle drop shadow.
2. **PointerCapture Dragging**: Use `setPointerCapture` on pointer down over the titlebar so dragging remains fluid even over child `iframe` elements or fast mouse sweeps.
3. **8-Handle Resizing**:
   - `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw` handles.
   - Live drag resizing with viewport clamping and minimum dimensions (`minSize`).
4. **Boundary Clamping**: Prevent dragging windows below taskbar or completely outside visible desktop.
5. **Titlebar Actions**: Double click titlebar toggles maximize/restore; right click displays window menu.

#### Complete Implementation Blueprint:
```tsx
import React, { useRef, useCallback, memo } from 'react';
import { WindowState, useWindowStore } from '../store/useWindowStore';
import { useHardwareState } from '../store/useSimulationStore';

export interface WindowFrameProps {
  window: WindowState;
  isActive: boolean;
  children: React.ReactNode;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const WindowFrame: React.FC<WindowFrameProps> = memo(({ window, isActive, children }) => {
  const hardware = useHardwareState();
  const isOrion6 = hardware.osVersion === 'Orion_6.0';
  const frameRef = useRef<HTMLDivElement>(null);

  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const setWindowPosition = useWindowStore((s) => s.setWindowPosition);
  const setWindowSize = useWindowStore((s) => s.setWindowSize);

  // Dragging Titlebar Handler
  const handleTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // Left click only
      if (window.isMaximized) return;

      focusWindow(window.id);

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = window.position.x;
      const startPosY = window.position.y;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // Desktop bounds clamping
        const newX = Math.max(-window.size.width + 100, Math.min(window.innerWidth || 1920 - 100, startPosX + deltaX));
        const newY = Math.max(0, startPosY + deltaY);

        setWindowPosition(window.id, { x: newX, y: newY });
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [window.id, window.position, window.size, window.isMaximized, focusWindow, setWindowPosition]
  );

  // Resizing Handler
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, direction: ResizeDirection) => {
      if (e.button !== 0) return;
      if (window.isMaximized || !window.isResizable) return;

      e.stopPropagation();
      focusWindow(window.id);

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = window.position.x;
      const startPosY = window.position.y;
      const startWidth = window.size.width;
      const startHeight = window.size.height;
      const minW = window.minSize.width;
      const minH = window.minSize.height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newX = startPosX;
        let newY = startPosY;
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction.includes('e')) {
          newWidth = Math.max(minW, startWidth + deltaX);
        }
        if (direction.includes('s')) {
          newHeight = Math.max(minH, startHeight + deltaY);
        }
        if (direction.includes('w')) {
          const maxDeltaW = startWidth - minW;
          const clampedDeltaX = Math.min(maxDeltaW, deltaX);
          newWidth = startWidth - clampedDeltaX;
          newX = startPosX + clampedDeltaX;
        }
        if (direction.includes('n')) {
          const maxDeltaH = startHeight - minH;
          const clampedDeltaY = Math.min(maxDeltaH, deltaY);
          newHeight = startHeight - clampedDeltaY;
          newY = Math.max(0, startPosY + clampedDeltaY);
        }

        setWindowPosition(window.id, { x: newX, y: newY });
        setWindowSize(window.id, { width: newWidth, height: newHeight });
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [window.id, window.position, window.size, window.minSize, window.isMaximized, window.isResizable, focusWindow, setWindowPosition, setWindowSize]
  );

  // Maximized vs Normal Style calculation
  const frameStyle: React.CSSProperties = window.isMaximized
    ? {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: 'calc(100% - 32px)',
        zIndex: window.zIndex,
      }
    : {
        position: 'absolute',
        left: `${window.position.x}px`,
        top: `${window.position.y}px`,
        width: `${window.size.width}px`,
        height: `${window.size.height}px`,
        zIndex: window.zIndex,
      };

  return (
    <div
      ref={frameRef}
      style={frameStyle}
      onPointerDown={() => focusWindow(window.id)}
      className={`flex flex-col select-none ${
        isOrion6
          ? 'rounded-t-lg bg-[#ece9d8] border border-[#0055ea]/60 shadow-2xl'
          : 'bg-[#c0c0c0] p-[3px] shadow-orion-window'
      }`}
    >
      {/* Titlebar */}
      <div
        onPointerDown={handleTitlePointerDown}
        onDoubleClick={() => toggleMaximize(window.id)}
        className={`flex items-center justify-between px-2 py-1 cursor-default ${
          isOrion6
            ? `rounded-t-md text-white font-sans ${
                isActive
                  ? 'bg-gradient-to-r from-[#0055ea] via-[#0b60ff] to-[#0040cc] font-semibold'
                  : 'bg-gradient-to-r from-[#7c97b9] to-[#607797] text-gray-200'
              }`
            : `text-xs font-pixel ${
                isActive
                  ? 'bg-[#000080] text-white font-bold'
                  : 'bg-[#808080] text-[#c0c0c0]'
              }`
        }`}
      >
        {/* App Icon & Title */}
        <div className="flex items-center gap-1.5 overflow-hidden pr-2">
          <span className="text-sm shrink-0">{window.icon}</span>
          <span className="truncate text-xs tracking-wide">{window.title}</span>
        </div>

        {/* Title Bar Buttons */}
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {/* Minimize Button */}
          <button
            onClick={() => minimizeWindow(window.id)}
            title="Minimize"
            className={
              isOrion6
                ? 'w-5 h-5 rounded bg-[#0055ea] hover:bg-[#2070ff] text-white flex items-center justify-center text-xs font-bold border border-white/40'
                : 'w-4 h-4 bg-[#c0c0c0] active:shadow-orion-inset shadow-orion-outset text-black flex items-center justify-center text-[10px] font-bold leading-none'
            }
          >
            _
          </button>

          {/* Maximize / Restore Button */}
          {window.isResizable && (
            <button
              onClick={() => toggleMaximize(window.id)}
              title={window.isMaximized ? 'Restore' : 'Maximize'}
              className={
                isOrion6
                  ? 'w-5 h-5 rounded bg-[#0055ea] hover:bg-[#2070ff] text-white flex items-center justify-center text-xs font-bold border border-white/40'
                  : 'w-4 h-4 bg-[#c0c0c0] active:shadow-orion-inset shadow-orion-outset text-black flex items-center justify-center text-[10px] font-bold leading-none'
              }
            >
              {window.isMaximized ? '❐' : '□'}
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={() => closeWindow(window.id)}
            title="Close"
            className={
              isOrion6
                ? 'w-5 h-5 rounded bg-[#d32f2f] hover:bg-[#f44336] text-white flex items-center justify-center text-xs font-bold border border-white/40'
                : 'w-4 h-4 bg-[#c0c0c0] active:shadow-orion-inset shadow-orion-outset text-black flex items-center justify-center text-[10px] font-bold leading-none ml-0.5'
            }
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Body Container */}
      <div
        className={`flex-1 overflow-auto relative ${
          isOrion6
            ? 'bg-white rounded-b-md m-1'
            : 'bg-white shadow-orion-inset m-1'
        }`}
      >
        {children}
      </div>

      {/* Resize Handles (8 directions, active only when not maximized and resizable) */}
      {!window.isMaximized && window.isResizable && (
        <>
          {/* North */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
            className="absolute top-0 left-2 right-2 h-1 cursor-n-resize"
          />
          {/* South */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
            className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize"
          />
          {/* West */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
            className="absolute top-2 bottom-2 left-0 w-1 cursor-w-resize"
          />
          {/* East */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
            className="absolute top-2 bottom-2 right-0 w-1 cursor-e-resize"
          />
          {/* North-West */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
            className="absolute top-0 left-0 w-2 h-2 cursor-nwse-resize z-10"
          />
          {/* North-East */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
            className="absolute top-0 right-0 w-2 h-2 cursor-nesw-resize z-10"
          />
          {/* South-West */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            className="absolute bottom-0 left-0 w-2 h-2 cursor-nesw-resize z-10"
          />
          {/* South-East */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            className="absolute bottom-0 right-0 w-2 h-2 cursor-nwse-resize z-10"
          />
        </>
      )}
    </div>
  );
});
```

---

### 3.2 `src/desktop/WindowManager.tsx`

#### Key Architectural Requirements:
1. **Application Registry**: Maps `appId` to React components (`terminal`, `fileexplorer`, `controlpanel`, `addremove`, `notepad`, `trash`, `pulse`, `browser`, `retroamp`, `flashfetch`, `zipmate`, `photobox`, `weatherbuddy`, `safesweep`, `dialup`).
2. **Layering & Ordering**: Iterates over all open, non-minimized windows sorted by z-index.
3. **Modal Overlay**: When a modal window (e.g. `dialup`, confirmation dialog) is open, renders a pointer-blocking backdrop over lower windows.
4. **Keyboard Accessibility**: Supports `Alt+F4` to close active window and `Alt+Tab` cycling.
5. **Fallback View**: Renders informative retro placeholder if an app component is still in progress.

#### Complete Implementation Blueprint:
```tsx
import React, { useEffect, useMemo } from 'react';
import { WindowFrame } from './WindowFrame';
import { useWindowStore, WindowState } from '../store/useWindowStore';

// App Components (Core M2 utilities + App placeholders for M3/M4)
// Note: Implemented apps are dynamically imported or referenced from src/apps/
export interface AppRegistryProps {
  window: WindowState;
}

// Fallback component for apps in development
const DefaultAppPlaceholder: React.FC<{ window: WindowState }> = ({ window }) => (
  <div className="p-6 font-pixel text-gray-800 flex flex-col items-center justify-center h-full text-center">
    <div className="text-4xl mb-3">{window.icon}</div>
    <div className="font-bold text-sm mb-1">{window.title}</div>
    <div className="text-xs text-gray-600 mb-4">Application ID: {window.appId}</div>
    <div className="text-[11px] bg-yellow-50 border border-yellow-300 p-2 rounded max-w-sm">
      This application is initializing its subsystem. All window management controls (drag, resize, minimize, maximize) are fully functional.
    </div>
  </div>
);

// App Registry Interface
export type AppRegistry = Record<string, React.ComponentType<AppRegistryProps>>;

interface WindowManagerProps {
  customAppRegistry?: AppRegistry;
}

export const WindowManager: React.FC<WindowManagerProps> = ({ customAppRegistry = {} }) => {
  const windows = useWindowStore((s) => s.windows);
  const windowOrder = useWindowStore((s) => s.windowOrder);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

  // Filter open, non-minimized windows sorted by Z-Index
  const visibleWindows = useMemo(() => {
    return windowOrder
      .map((id) => windows[id])
      .filter((w): w is WindowState => !!w && w.isOpen && !w.isMinimized)
      .sort((a, b) => a.zIndex - b.zIndex);
  }, [windows, windowOrder]);

  // Global Keyboard Shortcuts (Alt+F4 to close, Alt+Tab cycling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F4' && activeWindowId) {
        e.preventDefault();
        closeWindow(activeWindowId);
      } else if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        if (visibleWindows.length > 1) {
          const currentIndex = visibleWindows.findIndex((w) => w.id === activeWindowId);
          const nextIndex = (currentIndex + 1) % visibleWindows.length;
          const nextWin = visibleWindows[nextIndex];
          if (nextWin) focusWindow(nextWin.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWindowId, visibleWindows, closeWindow, focusWindow]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" id="window-manager-root">
      {visibleWindows.map((win) => {
        const AppComponent = customAppRegistry[win.appId] || DefaultAppPlaceholder;
        const isActive = activeWindowId === win.id;

        return (
          <div key={win.id} className="pointer-events-auto">
            {/* Optional Modal Backdrop */}
            {win.isModal && isActive && (
              <div
                style={{ zIndex: win.zIndex - 1 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-auto"
              />
            )}

            <WindowFrame window={win} isActive={isActive}>
              <AppComponent window={win} />
            </WindowFrame>
          </div>
        );
      })}
    </div>
  );
};
```

---

### 3.3 `src/desktop/CRTOverlay.tsx`

#### Key Architectural Requirements:
1. **Authentic CRT Shading**:
   - High-density horizontal scanlines with subtle alpha gradient.
   - Aperture grille subpixel vertical mesh.
   - Radial vignette corner roll-off simulating curved glass monitor.
   - Phosphor bloom/glow effect via soft backdrop filters.
2. **Zero Performance Penalty**: Built with GPU-accelerated CSS repeating gradients and pseudo-elements; `pointer-events: none` allows all mouse and click actions to pass through without lag.
3. **Dynamic Display Config**: Controlled via Display Settings in Control Panel or simulation flags (`crtEnabled`, `scanlines`, `bloom`, `curvature`).

#### Complete Implementation Blueprint:
```tsx
import React, { memo } from 'react';

export interface CRTOverlayProps {
  enabled?: boolean;
  scanlines?: boolean;
  curvature?: boolean;
  bloom?: boolean;
  flicker?: boolean;
}

export const CRTOverlay: React.FC<CRTOverlayProps> = memo(({
  enabled = true,
  scanlines = true,
  curvature = true,
  bloom = true,
  flicker = false,
}) => {
  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none" aria-hidden="true">
      {/* 1. Horizontal Scanlines */}
      {scanlines && (
        <div
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)',
            backgroundSize: '100% 2px',
          }}
        />
      )}

      {/* 2. Aperture Grille Micro-Mesh (Phosphor RGB Grid) */}
      <div
        className="absolute inset-0 opacity-15 mix-blend-color-burn"
        style={{
          background: 'repeating-linear-gradient(90deg, rgba(255,0,0,0.06) 0px, rgba(0,255,0,0.06) 1px, rgba(0,0,255,0.06) 2px, transparent 3px)',
          backgroundSize: '3px 100%',
        }}
      />

      {/* 3. Curved Glass Vignette & Radial Edge Darkening */}
      {curvature && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 65%, rgba(0,0,0,0.25) 90%, rgba(0,0,0,0.65) 100%)',
            boxShadow: 'inset 0 0 80px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* 4. Phosphor Bloom / Subtle Warm Glow */}
      {bloom && (
        <div
          className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(200, 240, 255, 0.08) 0%, transparent 80%)',
          }}
        />
      )}

      {/* 5. CRT Glass Bezel Border */}
      <div className="absolute inset-0 border-[3px] border-black/40 rounded-none pointer-events-none" />

      {/* Optional Subtle Refresh Flicker Roll */}
      {flicker && (
        <div
          className="absolute inset-0 opacity-5 pointer-events-none animate-pulse"
          style={{
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
            backgroundSize: '100% 4px',
          }}
        />
      )}
    </div>
  );
});
```

---

## 4. Verification & Testing Strategy

### Unit Test Blueprint: `tests/unit/WindowManager.test.ts`
1. **Window Opening & Focus**:
   - `openWindow()` creates window with unique z-index.
   - Re-opening an existing window unminimizes it and elevates its z-index.
   - Cascade algorithm positions consecutive windows with diagonal offset within bounds.
2. **Minimize / Maximize / Restore / Close**:
   - `minimizeWindow()` sets `isMinimized: true`, transfers active focus to next highest window.
   - `maximizeWindow()` preserves `previousPosition` and `previousSize`.
   - `restoreWindow()` restores coordinates and dimension.
   - `closeWindow()` clears active window and focuses next open window.
3. **Zustand Store Reactivity**:
   - Verifies `useSimulationStore` synchronizes with `SimulationEngine.advanceGameMinutes()`.
   - Verifies `useAudioStore` reflects mute and volume modifications.

---

## 5. Integration Contracts with Peers

- **With Explorer M2-2 (`DesktopShell.tsx`, `Taskbar.tsx`, `StartMenu.tsx`, `SystemTray.tsx`)**:
  - `Taskbar.tsx` reads `useOpenWindows()` to render taskbar items with active/pressed status and icon.
  - Clicking taskbar button calls `focusWindow(id)` or `minimizeWindow(id)` if already focused.
  - `StartMenu.tsx` calls `openWindow()` with predefined configs for standard apps.
  - `SystemTray.tsx` uses `useAudioStore` for volume popup slider.
- **With Explorer M2-3 (`TerminalApp.tsx`, `FileExplorerApp.tsx`, `ControlPanelApp.tsx`, `AddRemoveApp.tsx`, `NotepadApp.tsx`, `TrashApp.tsx`)**:
  - All apps render inside `WindowFrame` via `WindowManager`'s `customAppRegistry`.
  - Apps access VFS and engine actions directly via `useSimulationStore`.
