import type { GameTime } from '../types';

/**
 * Serializable #172 wire-safe publication seed. 'unknown' deliberately
 * means that this milestone cannot yet prove a bounded dirty-domain set;
 * never pretend the clock was the only domain changed during a time jump.
 */
export interface SimulationChange {
  revision: number;
  atMinute: number;
  changedDomains: readonly ['unknown'];
}

export interface SimulationHudProjection {
  revision: number;
  time: GameTime;
  paused: boolean;
  cash: number;
  socialBattery: number;
  activeView: 'pc' | 'room' | 'cafe' | 'work' | 'city';
}
