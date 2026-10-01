// src/engine/GameContext.ts
// Stable read-only consumer boundary for canonical simulation context (#132).

import type {
  EnvironmentContext,
  EnvironmentQuery,
  EnvironmentSnapshot,
} from './EnvironmentEngine';
import type { GameTime } from './types';
import type { MoodSnapshot } from './MoodEngine';
import type { PlayerNeedsSnapshot } from './PlayerNeedsEngine';

export interface GameContextForecastQuery extends EnvironmentContext {
  days: number;
  atMinute?: number;
}

export interface GameContextReadApi {
  readonly time: {
    current(): Readonly<GameTime>;
  };
  readonly environment: {
    current(context?: EnvironmentContext): EnvironmentSnapshot;
    at(query: EnvironmentQuery): EnvironmentSnapshot;
    forecast(query: GameContextForecastQuery): EnvironmentSnapshot[];
  };
  readonly player: {
    needs(): Readonly<PlayerNeedsSnapshot>;
    mood(): MoodSnapshot;
  };
}

export interface GameContextSources {
  time(): GameTime;
  environmentCurrent(context?: EnvironmentContext): EnvironmentSnapshot;
  environmentAt(query: EnvironmentQuery): EnvironmentSnapshot;
  environmentForecast(atMinute: number, days: number, context?: EnvironmentContext): EnvironmentSnapshot[];
  needs(): Readonly<PlayerNeedsSnapshot>;
  mood(): MoodSnapshot;
}

function cloneTime(time: GameTime): GameTime {
  return { ...time };
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

/**
 * Build the sole public read facade for cross-domain consumers.
 *
 * Commands remain on SimulationEngine/domain authorities. Every result is a
 * detached semantic projection so callers cannot mutate canonical state.
 */
export function createGameContext(sources: GameContextSources): GameContextReadApi {
  return {
    time: {
      current: () => cloneTime(sources.time()),
    },
    environment: {
      current: (context = {}) => cloneEnvironment(sources.environmentCurrent(context)),
      at: (query) => cloneEnvironment(sources.environmentAt(query)),
      forecast: (query) => sources.environmentForecast(
        query.atMinute ?? sources.time().totalMinutes,
        query.days,
        {
          ...(query.placeId ? { placeId: query.placeId } : {}),
          ...(query.districtId ? { districtId: query.districtId } : {}),
        },
      ).map(cloneEnvironment),
    },
    player: {
      needs: () => cloneNeeds(sources.needs()),
      mood: () => cloneMood(sources.mood()),
    },
  };
}
