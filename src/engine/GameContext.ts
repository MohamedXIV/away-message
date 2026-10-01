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

function cloneEnvironment(snapshot: EnvironmentSnapshot): EnvironmentSnapshot {
  return {
    ...snapshot,
    weather: {
      ...snapshot.weather,
      tags: [...snapshot.weather.tags],
    },
    sourceEventIds: [...snapshot.sourceEventIds],
  };
}

function cloneNeeds(snapshot: Readonly<PlayerNeedsSnapshot>): PlayerNeedsSnapshot {
  return { ...snapshot };
}

function cloneMood(snapshot: MoodSnapshot): MoodSnapshot {
  return {
    ...snapshot,
    influences: snapshot.influences.map((influence) => ({ ...influence })),
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
      current: (context: EnvironmentContext = {}) =>
        cloneEnvironment(deps.getCurrentEnvironment(context)),
      at: (query: EnvironmentQuery) =>
        cloneEnvironment(deps.getEnvironmentAt(query)),
      forecast: (query: EnvironmentForecastQuery) =>
        deps.getEnvironmentForecast(query).map(cloneEnvironment),
    }),
    player: Object.freeze({
      needs: () => cloneNeeds(deps.getNeeds()),
      mood: () => cloneMood(deps.getMood()),
    }),
  });
}

export type {
  EnvironmentContext,
  EnvironmentForecastQuery,
  EnvironmentQuery,
  EnvironmentSnapshot,
} from './EnvironmentEngine';
export type { PlayerNeedsSnapshot } from './PlayerNeedsEngine';
export type { MoodSnapshot } from './MoodEngine';
