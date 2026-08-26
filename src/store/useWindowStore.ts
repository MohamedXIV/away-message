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
  id?: string;
  appId: string;
  title?: string;
  icon?: string;
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
  openWindow: (
    configOrAppId: OpenWindowConfig | string,
    titleOrCustomState?: string | Record<string, any>,
    customState?: Record<string, any>
  ) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  unmaximizeWindow: (id: string) => void;
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

function getDefaultIcon(appId: string): string {
  switch (appId) {
    case 'terminal':
    case 'app.terminal':
      return '💻';
    case 'fileexplorer':
    case 'app.fileexplorer':
      return '📁';
    case 'controlpanel':
    case 'app.controlpanel':
      return '⚙️';
    case 'addremove':
    case 'app.addremove':
      return '📦';
    case 'notepad':
    case 'app.notepad':
      return '📝';
    case 'trash':
    case 'app.trash':
      return '🗑️';
    case 'browser':
    case 'app.browser':
      return '🌐';
    case 'pulse':
    case 'app.pulse':
      return '💬';
    case 'retroamp':
    case 'app.retroamp':
      return '🎵';
    case 'flashfetch':
    case 'app.flashfetch':
      return '⚡';
    case 'zipmate':
    case 'app.zipmate':
      return '🗜️';
    case 'photobox':
    case 'app.photobox':
      return '🖼️';
    case 'weatherbuddy':
    case 'app.weatherbuddy':
      return '⛅';
    case 'safesweep':
    case 'app.safesweep':
      return '🛡️';
    case 'dialup':
      return '📞';
    default:
      return '🗂️';
  }
}

function getDefaultTitle(appId: string): string {
  switch (appId) {
    case 'terminal':
    case 'app.terminal':
      return 'Terminal CLI';
    case 'fileexplorer':
    case 'app.fileexplorer':
      return 'My Computer';
    case 'controlpanel':
    case 'app.controlpanel':
      return 'Control Panel';
    case 'addremove':
    case 'app.addremove':
      return 'Add/Remove Programs';
    case 'notepad':
    case 'app.notepad':
      return 'Notepad';
    case 'trash':
    case 'app.trash':
      return 'Recycle Bin';
    case 'browser':
    case 'app.browser':
      return 'Voyager Browser';
    case 'pulse':
    case 'app.pulse':
      return 'Pulse Messenger';
    case 'retroamp':
    case 'app.retroamp':
      return 'RetroAmp';
    case 'flashfetch':
    case 'app.flashfetch':
      return 'FlashFetch Download Accelerator';
    case 'zipmate':
    case 'app.zipmate':
      return 'ZipMate Archive Utility';
    case 'photobox':
    case 'app.photobox':
      return 'PhotoBox 3.0';
    case 'weatherbuddy':
    case 'app.weatherbuddy':
      return 'WeatherBuddy';
    case 'safesweep':
    case 'app.safesweep':
      return 'SafeSweep Anti-Adware';
    case 'dialup':
      return 'Dial-Up Connection';
    default:
      return appId;
  }
}

export const useWindowStore = create<WindowStore>()(
  subscribeWithSelector((set, get) => ({
    windows: {},
    windowOrder: [],
    activeWindowId: null,
    highestZIndex: 10,
    cascadeCounter: 0,

    openWindow: (configOrAppId, titleOrCustomState, maybeCustomState) => {
      let config: OpenWindowConfig;

      if (typeof configOrAppId === 'string') {
        const appId = configOrAppId;
        let title: string | undefined;
        let customState: Record<string, any> | undefined;

        if (typeof titleOrCustomState === 'string') {
          title = titleOrCustomState;
          customState = maybeCustomState;
        } else if (typeof titleOrCustomState === 'object') {
          customState = titleOrCustomState;
        }

        config = {
          id: appId,
          appId,
          title: title || getDefaultTitle(appId),
          icon: getDefaultIcon(appId),
          customState,
        };
      } else {
        config = configOrAppId;
      }

      const id = config.id || config.appId;
      const { windows, highestZIndex, cascadeCounter } = get();
      const existing = windows[id];
      const newZIndex = highestZIndex + 1;

      soundManager.play('window_open');

      if (existing) {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...existing,
              isOpen: true,
              isMinimized: false,
              zIndex: newZIndex,
              title: config.title || existing.title,
              icon: config.icon || existing.icon,
              customState: config.customState
                ? { ...existing.customState, ...config.customState }
                : existing.customState,
            },
          },
          activeWindowId: id,
          highestZIndex: newZIndex,
        }));
        return id;
      }

      const cascadeStep = (cascadeCounter % 8) * 26;
      const initialPos: WindowPosition = config.defaultPosition ?? {
        x: Math.max(40, 60 + cascadeStep),
        y: Math.max(30, 40 + cascadeStep),
      };

      const newWindow: WindowState = {
        id,
        appId: config.appId,
        title: config.title ?? getDefaultTitle(config.appId),
        icon: config.icon ?? getDefaultIcon(config.appId),
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
        windows: { ...state.windows, [id]: newWindow },
        windowOrder: [...state.windowOrder.filter((wId) => wId !== id), id],
        activeWindowId: id,
        highestZIndex: newZIndex,
        cascadeCounter: cascadeCounter + 1,
      }));

      return id;
    },

    closeWindow: (id: string) => {
      const { windows, windowOrder, activeWindowId } = get();
      const target = windows[id];
      if (!target) return;

      const remainingOpen = windowOrder.filter(
        (winId) => winId !== id && windows[winId]?.isOpen && !windows[winId]?.isMinimized
      );

      let nextActiveId: string | null = null;
      if (activeWindowId === id && remainingOpen.length > 0) {
        const sorted = remainingOpen
          .map((winId) => windows[winId]!)
          .sort((a, b) => b.zIndex - a.zIndex);
        nextActiveId = sorted[0]?.id ?? null;
      } else if (activeWindowId !== id) {
        nextActiveId = activeWindowId;
      }

      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...target,
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
          .map((winId) => windows[winId]!)
          .sort((a, b) => b.zIndex - a.zIndex);
        nextActiveId = sorted[0]?.id ?? null;
      }

      set((state) => ({
        windows: {
          ...state.windows,
          [id]: { ...target, isMinimized: true },
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
            ...target,
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

    unmaximizeWindow: (id: string) => {
      const { windows, highestZIndex } = get();
      const target = windows[id];
      if (!target || !target.isMaximized) return;

      const newZIndex = highestZIndex + 1;
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...target,
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

    restoreWindow: (id: string) => {
      const { windows, highestZIndex } = get();
      const target = windows[id];
      if (!target) return;

      const newZIndex = highestZIndex + 1;
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...target,
            isOpen: true,
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
        get().unmaximizeWindow(id);
      } else {
        get().maximizeWindow(id);
      }
    },

    focusWindow: (id: string) => {
      const { windows, highestZIndex, activeWindowId } = get();
      const target = windows[id];
      if (!target) return;
      if (activeWindowId === id && target.zIndex === highestZIndex && !target.isMinimized) {
        return;
      }

      const newZIndex = highestZIndex + 1;
      set((state) => {
        const currentTarget = state.windows[id];
        if (!currentTarget) return state;
        return {
          windows: {
            ...state.windows,
            [id]: {
              ...currentTarget,
              isMinimized: false,
              zIndex: newZIndex,
            },
          },
          activeWindowId: id,
          highestZIndex: newZIndex,
        };
      });
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
        const updated: Record<string, WindowState> = { ...state.windows };
        Object.keys(updated).forEach((id) => {
          const win = updated[id];
          if (win && win.isOpen) {
            updated[id] = { ...win, isMinimized: true };
          }
        });
        return { windows: updated, activeWindowId: null };
      });
    },

    cascadeWindows: (workspaceWidth = 1024, workspaceHeight = 700) => {
      const { windows, windowOrder, highestZIndex } = get();
      const openWins = windowOrder.filter((id) => windows[id]?.isOpen);
      let currentZ = highestZIndex;
      const updated: Record<string, WindowState> = { ...windows };

      openWins.forEach((id, index) => {
        const win = updated[id];
        if (!win) return;
        currentZ++;
        const offset = (index % 10) * 28;
        const width = Math.min(640, Math.max(320, workspaceWidth - 80));
        const height = Math.min(460, Math.max(240, workspaceHeight - 80));

        updated[id] = {
          ...win,
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

      const updated: Record<string, WindowState> = { ...windows };
      let currentZ = highestZIndex;

      if (direction === 'horizontal') {
        const h = Math.floor((workspaceHeight - TASKBAR_HEIGHT) / openWins.length);
        openWins.forEach((id, idx) => {
          const win = updated[id];
          if (!win) return;
          currentZ++;
          updated[id] = {
            ...win,
            isMaximized: false,
            position: { x: 0, y: idx * h },
            size: { width: workspaceWidth, height: h },
            zIndex: currentZ,
          };
        });
      } else {
        const w = Math.floor(workspaceWidth / openWins.length);
        openWins.forEach((id, idx) => {
          const win = updated[id];
          if (!win) return;
          currentZ++;
          updated[id] = {
            ...win,
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
