import type {
  EnvironmentContext,
  EnvironmentForecastQuery,
  EnvironmentQuery,
  EnvironmentSnapshot,
} from './EnvironmentEngine';
import type { MoodSnapshot } from './MoodEngine';
import type { PlayerNeedsSnapshot } from './PlayerNeedsEngine';
import type { GameTime } from './types';

export interface GameContextReadApi {
  readonly time: {
    current(): GameTime;
  };
  readonly environment: {
    current(context?: EnvironmentContext): EnvironmentSnapshot;
    at(query: EnvironmentQuery): EnvironmentSnapshot;
    forecast(query: EnvironmentForecastQuery): EnvironmentSnapshot[];
  };
  readonly player: {
    needs(): Readonly<PlayerNeedsSnapshot>;
    mood(): MoodSnapshot;
  };
}

export interface GameContextReadDependencies {
  getTime(): GameTime;
  getCurrentEnvironment(context?: EnvironmentContext): EnvironmentSnapshot;
  getEnvironmentAt(query: EnvironmentQuery): EnvironmentSnapshot;
  getEnvironmentForecast(query: EnvironmentForecastQuery): EnvironmentSnapshot[];
  getNeeds(): Readonly<PlayerNeedsSnapshot>;
  getMood(): MoodSnapshot;
}

/**
 * Stable read-only consumer boundary for cross-domain game context.
 * Commands remain on their owning domains / SimulationEngine.
 */
export function createGameContextReadApi(
  deps: GameContextReadDependencies,
): GameContextReadApi {
  return Object.freeze({
    time: Object.freeze({
      current: () => ({ ...deps.getTime() }),
    }),
    environment: Object.freeze({
      current: (context: EnvironmentContext = {}) => deps.getCurrentEnvironment(context),
      at: (query: EnvironmentQuery) => deps.getEnvironmentAt(query),
      forecast: (query: EnvironmentForecastQuery) => deps.getEnvironmentForecast(query),
    }),
    player: Object.freeze({
      needs: () => deps.getNeeds(),
      mood: () => deps.getMood(),
    }),
  });
}
