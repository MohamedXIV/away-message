import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { TelemetryEngine } from '../../src/engine/TelemetryEngine';

describe('TelemetryEngine (Metrics Recording, Evaluation Summary & JSON Exporter)', () => {
  let eventBus: EventBus;
  let telemetry: TelemetryEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    telemetry = new TelemetryEngine(eventBus);
  });

  it('tracks money earned, spent, and cash bounds through event bus', () => {
    eventBus.emit('economy:cash_changed', {
      previousCash: 38.0,
      newCash: 100.0,
      delta: 62.0,
      reason: 'Shift',
    });

    eventBus.emit('economy:cash_changed', {
      previousCash: 100.0,
      newCash: 85.0,
      delta: -15.0,
      reason: 'Food',
    });

    const stats = telemetry.getStats();
    expect(stats.totalMoneyEarned).toBe(62.0);
    expect(stats.totalMoneySpent).toBe(15.0);
  });

  it('records real-time playtime across PC and room views', () => {
    telemetry.recordPlayTime(120, 'pc'); // 2 minutes in PC
    telemetry.recordPlayTime(60, 'room'); // 1 minute in Room

    const stats = telemetry.getStats();
    expect(stats.totalRealPlayTimeSeconds).toBe(180);
    expect(stats.minutesInPcView).toBe(2);
    expect(stats.minutesInRoomView).toBe(1);
  });

  it('logs events and exports valid evaluation JSON', () => {
    telemetry.logEvent('narrative', 'beat_completed', 500, { beatId: 'day1_intro' });
    telemetry.recordCafeMeeting();
    telemetry.recordEnding('ending_golden_path');

    const jsonStr = telemetry.exportTelemetryJson();
    expect(typeof jsonStr).toBe('string');

    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.stats.cafeMeetingAttended).toBe(true);
    expect(parsed.stats.endingReached).toBe('ending_golden_path');
    expect(parsed.recentLogs.length).toBeGreaterThan(0);
    expect(parsed.recentLogs[0].action).toBe('beat_completed');
  });
});
