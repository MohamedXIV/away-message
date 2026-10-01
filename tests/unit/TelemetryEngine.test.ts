import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { TelemetryEngine } from '../../src/engine/TelemetryEngine';

describe('TelemetryEngine (sandbox metrics & JSON exporter)', () => {
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

  it('logs sandbox events and exports diagnostics', () => {
    telemetry.logEvent('world', 'place_discovered', 500, { placeId: 'corner_mart' });

    const jsonStr = telemetry.exportTelemetryJson();
    expect(typeof jsonStr).toBe('string');

    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.recentLogs.length).toBeGreaterThan(0);
    expect(parsed.recentLogs[0].action).toBe('place_discovered');
  });
});
