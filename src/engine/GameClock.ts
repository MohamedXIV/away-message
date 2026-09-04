import { GameTime, TimeOfDay, TimeJumpResult, GameClockConfig } from './types';

export class GameClock {
  private totalMinutes: number;
  private timeScale: number;
  private isPausedState: boolean;
  private accumulatedFractionalMinutes: number;

  constructor(config: GameClockConfig = {}) {
    const day = config.initialDay ?? 1;
    const hour = config.initialHour ?? 8;
    const minute = config.initialMinute ?? 0;

    this.totalMinutes = ((day - 1) * 24 * 60) + (hour * 60) + minute;
    this.timeScale = config.timeScaleMinutesPerRealSecond ?? 1.0;
    this.isPausedState = false;
    this.accumulatedFractionalMinutes = 0;
  }

  public getTime(): GameTime {
    return GameClock.calculateGameTime(this.totalMinutes);
  }

  public static calculateGameTime(totalMinutes: number): GameTime {
    const totalDaysElapsed = Math.floor(totalMinutes / (24 * 60));
    const day = totalDaysElapsed + 1;
    const minuteOfDay = totalMinutes % (24 * 60);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    let timeOfDay: TimeOfDay;
    if (hour >= 6 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 18) {
      timeOfDay = 'day';
    } else if (hour >= 18 && hour < 22) {
      timeOfDay = 'evening';
    } else if (hour >= 22 || hour < 3) {
      timeOfDay = 'night';
    } else {
      timeOfDay = 'late_night';
    }

    const dayOfWeek = ((day - 1) % 7) + 1;
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;

    return {
      day,
      hour,
      minute,
      totalMinutes,
      timeOfDay,
      isWeekend,
    };
  }

  public tickRealTime(deltaRealSeconds: number): { elapsedMinutes: number; time: GameTime; dayChanged: boolean } {
    if (this.isPausedState || deltaRealSeconds <= 0) {
      return { elapsedMinutes: 0, time: this.getTime(), dayChanged: false };
    }

    this.accumulatedFractionalMinutes += deltaRealSeconds * this.timeScale;
    const wholeMinutes = Math.floor(this.accumulatedFractionalMinutes);

    if (wholeMinutes > 0) {
      this.accumulatedFractionalMinutes -= wholeMinutes;
      const jumpResult = this.advanceMinutes(wholeMinutes);
      return {
        elapsedMinutes: wholeMinutes,
        time: jumpResult.newTime,
        dayChanged: jumpResult.dayChanged,
      };
    }

    return { elapsedMinutes: 0, time: this.getTime(), dayChanged: false };
  }

  public advanceMinutes(minutes: number): TimeJumpResult {
    if (minutes <= 0) {
      const current = this.getTime();
      return { elapsedMinutes: 0, previousTime: current, newTime: current, dayChanged: false, daysSkipped: 0 };
    }

    const previousTime = this.getTime();
    this.totalMinutes += minutes;
    const newTime = this.getTime();

    const dayChanged = newTime.day !== previousTime.day;
    const daysSkipped = Math.max(0, newTime.day - previousTime.day);

    return {
      elapsedMinutes: minutes,
      previousTime,
      newTime,
      dayChanged,
      daysSkipped,
    };
  }

  public calculateMinutesUntil(targetDay: number, targetHour: number, targetMinute = 0): number {
    const targetTotalMinutes = ((targetDay - 1) * 24 * 60) + (targetHour * 60) + targetMinute;
    return Math.max(0, targetTotalMinutes - this.totalMinutes);
  }

  public jumpToNextMorning(wakeHour = 8, wakeMinute = 0): TimeJumpResult {
    const current = this.getTime();
    let targetDay = current.day;
    const cleanMinute = Math.max(0, Math.min(59, Math.floor(wakeMinute) || 0));
    if (current.hour > wakeHour || (current.hour === wakeHour && current.minute >= cleanMinute)) {
      targetDay += 1;
    }
    const minutesToJump = this.calculateMinutesUntil(targetDay, wakeHour, cleanMinute);
    return this.advanceMinutes(minutesToJump);
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  public setPaused(paused: boolean): void {
    this.isPausedState = paused;
    if (paused) {
      this.accumulatedFractionalMinutes = 0;
    }
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, scale);
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public setTotalMinutes(totalMinutes: number): void {
    this.totalMinutes = Math.max(0, totalMinutes);
    this.accumulatedFractionalMinutes = 0;
  }

  public getTotalMinutes(): number {
    return this.totalMinutes;
  }
}
