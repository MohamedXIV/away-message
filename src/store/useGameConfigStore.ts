import { create } from 'zustand';

export interface PlayerConfig {
  soundVolume: number; // 0..1
  crtEffects: boolean;
  typingSpeedMultiplier: number; // 0.5..2
  autoSignInPulse: boolean;
}

export interface DevConfig {
  godMode: boolean;
  infiniteBattery: boolean;
  forceOfflineTemplates: boolean;
  fastClock: boolean;
  debugTelemetry: boolean;
}

export interface GameConfigState {
  player: PlayerConfig;
  dev: DevConfig;
  setPlayerConfig: (partial: Partial<PlayerConfig>) => void;
  setDevConfig: (partial: Partial<DevConfig>) => void;
  resetDefaults: () => void;
}

const STORAGE_KEY = 'away_game_config_v1';

const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  soundVolume: 0.8,
  crtEffects: true,
  typingSpeedMultiplier: 1.0,
  autoSignInPulse: false,
};

const DEFAULT_DEV_CONFIG: DevConfig = {
  godMode: false,
  infiniteBattery: false,
  forceOfflineTemplates: false,
  fastClock: false,
  debugTelemetry: false,
};

function loadStoredConfig(): { player: PlayerConfig; dev: DevConfig } {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        player: { ...DEFAULT_PLAYER_CONFIG, ...(parsed.player ?? {}) },
        dev: { ...DEFAULT_DEV_CONFIG, ...(parsed.dev ?? {}) },
      };
    }
  } catch {
    // Fall back to defaults on parse or storage errors
  }
  return {
    player: { ...DEFAULT_PLAYER_CONFIG },
    dev: { ...DEFAULT_DEV_CONFIG },
  };
}

function persistConfig(state: { player: PlayerConfig; dev: DevConfig }): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: state.player, dev: state.dev }));
    }
  } catch {
    // Storage quota or sandboxed env
  }
}

export const useGameConfigStore = create<GameConfigState>((set) => {
  const initial = loadStoredConfig();

  return {
    player: initial.player,
    dev: initial.dev,

    setPlayerConfig: (partial) => {
      set((state) => {
        const next = {
          ...state,
          player: { ...state.player, ...partial },
        };
        persistConfig(next);
        return next;
      });
    },

    setDevConfig: (partial) => {
      set((state) => {
        const next = {
          ...state,
          dev: { ...state.dev, ...partial },
        };
        persistConfig(next);
        return next;
      });
    },

    resetDefaults: () => {
      const reset = {
        player: { ...DEFAULT_PLAYER_CONFIG },
        dev: { ...DEFAULT_DEV_CONFIG },
      };
      persistConfig(reset);
      set(reset);
    },
  };
});
