import { TelemetryStats, TelemetryRecord } from './types';
import { EventBus } from './EventBus';

export class TelemetryEngine {
  private stats: TelemetryStats;
  private logs: TelemetryRecord[];
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialStats?: Partial<TelemetryStats>, initialLogs?: TelemetryRecord[]) {
    this.eventBus = eventBus;
    this.stats = {
      sessionStartTimeMs: initialStats?.sessionStartTimeMs ?? Date.now(),
      totalRealPlayTimeSeconds: initialStats?.totalRealPlayTimeSeconds ?? 0,
      gameDaysReached: initialStats?.gameDaysReached ?? 1,
      minutesInPcView: initialStats?.minutesInPcView ?? 0,
      minutesInRoomView: initialStats?.minutesInRoomView ?? 0,
      totalMoneyEarned: initialStats?.totalMoneyEarned ?? 0,
      totalMoneySpent: initialStats?.totalMoneySpent ?? 0,
      peakCash: initialStats?.peakCash ?? 38.0,
      lowestCash: initialStats?.lowestCash ?? 38.0,
      rentPaymentsCompleted: initialStats?.rentPaymentsCompleted ?? 0,
      programsInstalledCount: initialStats?.programsInstalledCount ?? 0,
      downloadsCompletedCount: initialStats?.downloadsCompletedCount ?? 0,
      windowObservationsCount: initialStats?.windowObservationsCount ?? 0,
      workShiftsCompleted: initialStats?.workShiftsCompleted ?? 0,
      hardwareUpgradesCount: initialStats?.hardwareUpgradesCount ?? 0,
      osUpgradedDay: initialStats?.osUpgradedDay ?? null,
      cafeMeetingAttended: initialStats?.cafeMeetingAttended ?? false,
      endingReached: initialStats?.endingReached ?? null,
    };
    this.logs = initialLogs ? [...initialLogs] : [];

    this.registerEventListeners();
  }

  private registerEventListeners(): void {
    this.eventBus.on('economy:cash_changed', ({ delta }) => {
      if (delta > 0) {
        this.stats.totalMoneyEarned += delta;
      } else {
        this.stats.totalMoneySpent += Math.abs(delta);
      }
    });

    this.eventBus.on('economy:shift_completed', () => {
      this.stats.workShiftsCompleted += 1;
    });

    this.eventBus.on('economy:rent_paid', () => {
      this.stats.rentPaymentsCompleted += 1;
    });

    this.eventBus.on('hardware:upgraded', () => {
      this.stats.hardwareUpgradesCount += 1;
    });

    this.eventBus.on('hardware:os_migrated', () => {
      this.stats.osUpgradedDay = this.stats.gameDaysReached;
    });

    this.eventBus.on('software:installed', () => {
      this.stats.programsInstalledCount += 1;
    });

    this.eventBus.on('download:completed', () => {
      this.stats.downloadsCompletedCount += 1;
    });

    this.eventBus.on('time:day_changed', ({ newDay }) => {
      if (newDay > this.stats.gameDaysReached) {
        this.stats.gameDaysReached = newDay;
      }
    });
  }

  public recordPlayTime(deltaRealSeconds: number, currentView: 'pc' | 'room' | 'cafe' | 'work' | 'city'): void {
    this.stats.totalRealPlayTimeSeconds += deltaRealSeconds;
    const minutes = deltaRealSeconds / 60;
    if (currentView === 'pc') {
      this.stats.minutesInPcView += minutes;
    } else {
      this.stats.minutesInRoomView += minutes;
    }
  }

  public updateCashBounds(currentCash: number): void {
    if (currentCash > this.stats.peakCash) {
      this.stats.peakCash = currentCash;
    }
    if (currentCash < this.stats.lowestCash) {
      this.stats.lowestCash = currentCash;
    }
  }

  public recordWindowObservation(): void {
    this.stats.windowObservationsCount += 1;
  }

  public recordCafeMeeting(): void {
    this.stats.cafeMeetingAttended = true;
  }

  public recordEnding(endingId: string): void {
    this.stats.endingReached = endingId;
  }

  public logEvent(
    category: TelemetryRecord['category'],
    action: string,
    timestampMinutes: number,
    data?: Record<string, unknown>
  ): void {
    const record: TelemetryRecord = {
      timestampMinutes,
      realTimestampMs: Date.now(),
      category,
      action,
      data,
    };
    this.logs.push(record);
    if (this.logs.length > 1000) {
      this.logs.shift();
    }
    this.eventBus.emit('telemetry:event_logged', { record });
  }

  public getStats(): Readonly<TelemetryStats> {
    return { ...this.stats };
  }

  public getLogs(): readonly TelemetryRecord[] {
    return this.logs;
  }

  public exportTelemetryJson(): string {
    const payload = {
      schemaVersion: '1.0.0',
      exportedAtIso: new Date().toISOString(),
      stats: this.stats,
      recentLogs: this.logs.slice(-200),
    };
    return JSON.stringify(payload, null, 2);
  }

  public loadState(stats: TelemetryStats, logs: TelemetryRecord[]): void {
    this.stats = { ...stats };
    this.logs = [...logs];
  }
}
