import { describe, it, expect, beforeEach } from 'vitest';
import { GameClock } from '../../src/engine/GameClock';

describe('GameClock (Deterministic Time Simulation)', () => {
  let clock: GameClock;

  beforeEach(() => {
    // Default start: Day 1, 08:00 AM
    clock = new GameClock({ initialDay: 1, initialHour: 8, initialMinute: 0 });
  });

  it('initializes to Day 1, 08:00 AM with correct initial properties', () => {
    const time = clock.getTime();
    expect(time.day).toBe(1);
    expect(time.hour).toBe(8);
    expect(time.minute).toBe(0);
    expect(time.totalMinutes).toBe(480);
    expect(time.timeOfDay).toBe('morning');
    expect(time.isWeekend).toBe(false);
  });

  it('accumulates real-time seconds into game minutes using 1s = 1min scale', () => {
    // 1 second real time -> 1 game minute
    const tick1 = clock.tickRealTime(1.0);
    expect(tick1.elapsedMinutes).toBe(1);
    expect(tick1.time.minute).toBe(1);
    expect(tick1.time.hour).toBe(8);
    expect(tick1.dayChanged).toBe(false);

    // Fractional increments accumulate
    const tick2 = clock.tickRealTime(0.5);
    expect(tick2.elapsedMinutes).toBe(0);
    const tick3 = clock.tickRealTime(0.5);
    expect(tick3.elapsedMinutes).toBe(1);
    expect(tick3.time.minute).toBe(2);
  });

  it('correctly handles midnight rollover and day change', () => {
    // Advance to 23:59 on Day 1
    // Day 1 08:00 (480 min) -> Day 1 23:59 (1439 min) = 959 minutes
    clock.advanceMinutes(959);
    let time = clock.getTime();
    expect(time.day).toBe(1);
    expect(time.hour).toBe(23);
    expect(time.minute).toBe(59);
    expect(time.timeOfDay).toBe('night');

    // Step 1 minute -> Rollover to Day 2 00:00
    const jump = clock.advanceMinutes(1);
    time = clock.getTime();
    expect(jump.dayChanged).toBe(true);
    expect(jump.daysSkipped).toBe(1);
    expect(time.day).toBe(2);
    expect(time.hour).toBe(0);
    expect(time.minute).toBe(0);
    expect(time.timeOfDay).toBe('night');
  });

  it('correctly classifies all five time-of-day phases', () => {
    // Morning: 06:00 - 11:59
    expect(GameClock.calculateGameTime(6 * 60).timeOfDay).toBe('morning');
    expect(GameClock.calculateGameTime(11 * 60 + 59).timeOfDay).toBe('morning');

    // Day: 12:00 - 17:59
    expect(GameClock.calculateGameTime(12 * 60).timeOfDay).toBe('day');
    expect(GameClock.calculateGameTime(17 * 60 + 59).timeOfDay).toBe('day');

    // Evening: 18:00 - 21:59
    expect(GameClock.calculateGameTime(18 * 60).timeOfDay).toBe('evening');
    expect(GameClock.calculateGameTime(21 * 60 + 59).timeOfDay).toBe('evening');

    // Night: 22:00 - 02:59
    expect(GameClock.calculateGameTime(22 * 60).timeOfDay).toBe('night');
    expect(GameClock.calculateGameTime(23 * 60 + 59).timeOfDay).toBe('night');
    expect(GameClock.calculateGameTime(0).timeOfDay).toBe('night');
    expect(GameClock.calculateGameTime(2 * 60 + 59).timeOfDay).toBe('night');

    // Late Night: 03:00 - 05:59
    expect(GameClock.calculateGameTime(3 * 60).timeOfDay).toBe('late_night');
    expect(GameClock.calculateGameTime(5 * 60 + 59).timeOfDay).toBe('late_night');
  });

  it('handles multi-day jumps and sleep transitions', () => {
    // Current: Day 1, 08:00
    // Sleep to next morning (08:00 next day) = 24 hours (1440 min)
    const jump = clock.jumpToNextMorning(8);
    expect(jump.elapsedMinutes).toBe(1440);
    expect(jump.dayChanged).toBe(true);
    expect(jump.daysSkipped).toBe(1);
    expect(jump.newTime.day).toBe(2);
    expect(jump.newTime.hour).toBe(8);
    expect(jump.newTime.minute).toBe(0);
  });

  it('pauses and resumes cleanly without drifting time', () => {
    clock.setPaused(true);
    expect(clock.isPaused()).toBe(true);

    const tick = clock.tickRealTime(60.0);
    expect(tick.elapsedMinutes).toBe(0);
    expect(clock.getTime().totalMinutes).toBe(480);

    clock.setPaused(false);
    expect(clock.isPaused()).toBe(false);
    const tickAfter = clock.tickRealTime(2.0);
    expect(tickAfter.elapsedMinutes).toBe(2);
    expect(clock.getTime().totalMinutes).toBe(482);
  });
});
