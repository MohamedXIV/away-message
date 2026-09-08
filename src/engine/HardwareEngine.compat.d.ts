import type { HardwareState } from './types';

declare module './HardwareEngine' {
  interface HardwareEngine {
    /** @deprecated SimulationEngineCore-only restore bridge. */
    loadState(state: HardwareState): void;
  }
}

export {};
