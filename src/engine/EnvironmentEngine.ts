// src/engine/EnvironmentEngine.ts
// #129 authoritative resolved Environment domain.

import type { EventBus } from './EventBus';
import {
  getWeatherForDay,
  isSevereWeather,
  isWetWeather,
  type WeatherCondition,
} from './WeatherEngine';
import type { WorldModifier, WorldModifierFilter } from './WorldModifiers';

export interface EnvironmentQuery {
  atMinute: number;
  placeId?: string;
  districtId?: string;
}

export interface EnvironmentWeatherSnapshot {
  condition: WeatherCondition;
  precipitation: number;
  wind: number;
  visibility: number;
  temperatureF: number;
  highF: number;
  lowF: number;
  tags: string[];
}

export interface EnvironmentSnapshot {
  atMinute: number;
  day: number;
  weather: EnvironmentWeatherSnapshot;
  sourceEventIds: string[];
}

export type EnvironmentContext = Omit<EnvironmentQuery, 'atMinute'>;

export interface EnvironmentForecastQuery extends EnvironmentQuery {
  count: number;
}

export interface EnvironmentModifierSource {
  queryActiveModifiers(options: WorldModifierFilter & { atMinute: number }): WorldModifier[];
}

const CONDITION_DEFAULTS: Record<WeatherCondition, {
  precipitation: number;
  wind: number;
  visibility: number;
}> = {
  rain: { precipitation: 0.85, wind: 0.5, visibility: 0.78 },
  drizzle: { precipitation: 0.35, wind: 0.25, visibility: 0.88 },
  overcast: { precipitation: 0, wind: 0.22, visibility: 0.9 },
  fog: { precipitation: 0, wind: 0.12, visibility: 0.32 },
  clear: { precipitation: 0, wind: 0.15, visibility: 1 },
  heat: { precipitation: 0, wind: 0.3, visibility: 0.94 },
  storm: { precipitation: 1, wind: 0.9, visibility: 0.52 },
};

const CONDITIONS = new Set<WeatherCondition>([
  'rain', 'drizzle', 'overcast', 'fog', 'clear', 'heat', 'storm',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function normalizeMinute(raw: number): number {
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function dayForMinute(atMinute: number): number {
  return Math.floor(normalizeMinute(atMinute) / 1440) + 1;
}

function minuteOfDay(atMinute: number): number {
  return normalizeMinute(atMinute) % 1440;
}

function baseTemperature(lowF: number, highF: number, minute: number): number {
  const phase = ((minute - 900) / 1440) * Math.PI * 2;
  return round(lowF + (highF - lowF) * ((1 + Math.cos(phase)) / 2), 1);
}

function conditionFromModifier(modifier: WorldModifier): WeatherCondition | null {
  if (modifier.kind !== 'condition_override' || typeof modifier.value !== 'string') return null;
  return CONDITIONS.has(modifier.value as WeatherCondition)
    ? modifier.value as WeatherCondition
    : null;
}

function modifierApplies(modifier: WorldModifier, query: EnvironmentQuery): boolean {
  const targets = modifier.targetIds ?? [];
  if (targets.length === 0) return true;
  return Boolean(
    (query.placeId && targets.includes(query.placeId))
    || (query.districtId && targets.includes(query.districtId)),
  );
}

function semanticTags(weather: Omit<EnvironmentWeatherSnapshot, 'tags'>): string[] {
  const tags = new Set<string>();
  if (isWetWeather(weather.condition) || weather.precipitation > 0.05) tags.add('wet');
  if (isSevereWeather(weather.condition)) tags.add('severe');
  if (weather.visibility < 0.6) tags.add('low_visibility');
  if (weather.wind >= 0.65) tags.add('windy');
  if (weather.temperatureF >= 80) tags.add('hot');
  if (weather.temperatureF <= 45) tags.add('cold');
  if (weather.condition === 'fog') tags.add('fog');
  return [...tags].sort();
}

function signature(snapshot: EnvironmentSnapshot): string {
  const w = snapshot.weather;
  return JSON.stringify({
    condition: w.condition,
    precipitation: round(w.precipitation, 2),
    wind: round(w.wind, 2),
    visibility: round(w.visibility, 2),
    temperatureF: Math.round(w.temperatureF),
    highF: Math.round(w.highF),
    lowF: Math.round(w.lowF),
    tags: w.tags,
    sourceEventIds: snapshot.sourceEventIds,
  });
}

function cloneSnapshot(snapshot: EnvironmentSnapshot): EnvironmentSnapshot {
  return {
    ...snapshot,
    weather: { ...snapshot.weather, tags: [...snapshot.weather.tags] },
    sourceEventIds: [...snapshot.sourceEventIds],
  };
}

export class EnvironmentEngine {
  private lastPublished: EnvironmentSnapshot | null = null;
  private lastPublishedSignature: string | null = null;

  public constructor(
    private readonly eventBus: EventBus,
    private readonly modifierSource?: EnvironmentModifierSource,
    private readonly currentMinute: () => number = () => 0,
  ) {}

  public getCurrentSnapshot(context: EnvironmentContext = {}): EnvironmentSnapshot {
    return this.getSnapshot({
      ...context,
      atMinute: this.currentMinute(),
    });
  }

  public getSnapshot(rawQuery: EnvironmentQuery): EnvironmentSnapshot {
    const query: EnvironmentQuery = { ...rawQuery, atMinute: normalizeMinute(rawQuery.atMinute) };
    const day = dayForMinute(query.atMinute);
    const base = getWeatherForDay(day);
    const modifiers = (this.modifierSource?.queryActiveModifiers({
      domain: 'environment',
      atMinute: query.atMinute,
    }) ?? [])
      .filter((modifier) => modifier.domain === 'environment' && modifierApplies(modifier, query))
      .slice()
      .sort((a, b) => a.startsAtMinute - b.startsAtMinute || a.id.localeCompare(b.id));

    // Newest condition override wins; equal starts resolve by lexically later id.
    let condition = base.condition;
    for (const modifier of modifiers) {
      const candidate = conditionFromModifier(modifier);
      if (candidate) condition = candidate;
    }

    const defaults = CONDITION_DEFAULTS[condition];
    let precipitation = defaults.precipitation;
    let wind = defaults.wind;
    let visibility = defaults.visibility;
    let temperatureDelta = 0;
    const applied: WorldModifier[] = [];

    for (const modifier of modifiers) {
      if (conditionFromModifier(modifier)) {
        applied.push(modifier);
        continue;
      }
      if (typeof modifier.value !== 'number' || !Number.isFinite(modifier.value)) continue;
      switch (modifier.kind) {
        case 'temperature_delta':
          temperatureDelta += clamp(modifier.value, -30, 30);
          applied.push(modifier);
          break;
        case 'precipitation_delta':
          precipitation += clamp(modifier.value, -1, 1);
          applied.push(modifier);
          break;
        case 'wind_delta':
          wind += clamp(modifier.value, -1, 1);
          applied.push(modifier);
          break;
        case 'visibility_delta':
          visibility += clamp(modifier.value, -1, 1);
          applied.push(modifier);
          break;
      }
    }

    const weatherWithoutTags = {
      condition,
      precipitation: round(clamp(precipitation, 0, 1)),
      wind: round(clamp(wind, 0, 1)),
      visibility: round(clamp(visibility, 0, 1)),
      temperatureF: round(clamp(
        baseTemperature(base.lowF, base.highF, minuteOfDay(query.atMinute)) + temperatureDelta,
        -20,
        120,
      ), 1),
      highF: round(clamp(base.highF + temperatureDelta, -20, 120), 1),
      lowF: round(clamp(base.lowF + temperatureDelta, -20, 120), 1),
    };

    return {
      atMinute: query.atMinute,
      day,
      weather: {
        ...weatherWithoutTags,
        tags: semanticTags(weatherWithoutTags),
      },
      sourceEventIds: [...new Set(applied.map((modifier) => modifier.sourceEventId))].sort(),
    };
  }

  public getCurrentForecast(
    count: number,
    context: EnvironmentContext = {},
  ): EnvironmentSnapshot[] {
    return this.getForecast({
      ...context,
      atMinute: this.currentMinute(),
      count,
    });
  }

  public getForecast(query: EnvironmentForecastQuery): EnvironmentSnapshot[] {
    const count = Math.max(1, Math.min(10, Math.floor(query.count) || 1));
    const start = normalizeMinute(query.atMinute);
    return Array.from({ length: count }, (_, index) => this.getSnapshot({
      atMinute: start + index * 1440,
      ...(query.placeId ? { placeId: query.placeId } : {}),
      ...(query.districtId ? { districtId: query.districtId } : {}),
    }));
  }

  public publishIfChanged(query: EnvironmentQuery): EnvironmentSnapshot {
    const current = this.getSnapshot(query);
    const currentSignature = signature(current);
    if (currentSignature === this.lastPublishedSignature) return current;

    const previous = this.lastPublished ? cloneSnapshot(this.lastPublished) : null;
    this.lastPublished = cloneSnapshot(current);
    this.lastPublishedSignature = currentSignature;
    this.eventBus.emit('environment:changed', {
      previous,
      current: cloneSnapshot(current),
    });
    return current;
  }
}

export function isWetEnvironment(snapshot: EnvironmentSnapshot): boolean {
  return snapshot.weather.tags.includes('wet');
}

export function isSevereEnvironment(snapshot: EnvironmentSnapshot): boolean {
  return snapshot.weather.tags.includes('severe');
}
