import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 room mood and WeatherBuddy revision projections', () => {
  it('matches original GameContext display and returns detached JSON', () => {
    const game = new SimulationEngine();
    const expectedCurrent = game.gameContext.environment.current();
    const expectedForecast = game.gameContext.environment.forecast({
      atMinute: game.clock.getTotalMinutes() + 1440,
      count: 5,
    });
    const expectedMoodBand = game.gameContext.player.mood().band;
    const fullState = vi.spyOn(game, 'getState');
    const worldState = vi.spyOn(game.world, 'getState');
    const socialState = vi.spyOn(game.social, 'getState');

    const weather = game.getWeatherBuddyRead();
    const status = game.getPlayerStatusRead();
    expect(weather).toEqual({
      revision: game.getRevision(),
      current: expectedCurrent,
      forecast: expectedForecast,
    });
    expect(weather.forecast).toHaveLength(5);
    expect(status.moodBand).toBe(expectedMoodBand);
    expect(JSON.parse(JSON.stringify(weather))).toEqual(weather);
    expect(JSON.parse(JSON.stringify(status))).toEqual(status);
    expect(fullState).not.toHaveBeenCalled();
    expect(worldState).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();

    weather.current.weather.tags.push('UI_MUTATION');
    weather.forecast[0]!.sourceEventIds.push('UI_MUTATION');
    const again = game.getWeatherBuddyRead();
    expect(again.current.weather.tags).not.toContain('UI_MUTATION');
    expect(again.forecast[0]!.sourceEventIds).not.toContain('UI_MUTATION');
  });

  it('moves the five-day forecast with canonical clock revisions at 500 actors', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const full = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const start = game.getWeatherBuddyRead();
    expect(start.forecast).toHaveLength(5);
    expect(start.forecast[0]!.atMinute).toBe(game.clock.getTotalMinutes() + 1440);
    game.advanceGameMinutes(30, 'weather display revision');
    const after = game.getWeatherBuddyRead();
    expect(after.revision).toBeGreaterThan(start.revision);
    expect(after.current.atMinute).toBe(game.clock.getTotalMinutes());
    expect(after.forecast[0]!.atMinute).toBe(game.clock.getTotalMinutes() + 1440);
    expect(after.forecast[0]!.atMinute).toBe(start.forecast[0]!.atMinute + 30);
    expect(after.forecast).toHaveLength(5);
    expect(game.getPlayerStatusRead().moodBand).toBe(game.mood.getCurrentSnapshot().band);
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
    const count = full.mock.calls.length;
    const socialCount = social.mock.calls.length;
    game.getWeatherBuddyRead();
    game.getPlayerStatusRead();
    expect(full.mock.calls.length).toBe(count);
    expect(social.mock.calls.length).toBe(socialCount);
  }, 30_000);
});
