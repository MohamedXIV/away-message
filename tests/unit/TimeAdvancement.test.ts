import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import {
  TimeAdvancement,
  type TimeAdvancementHooks,
  type TimeAdvanceMode,
} from '../../src/engine/kernel/TimeAdvancement';

function fixture() {
  const owners = createCoreDomainOwners();
  const calls: string[] = [];
  let view: TimeAdvancementHooks['currentView'] extends () => infer T ? T : never = 'room';

  const hooks: TimeAdvancementHooks = {
    currentView: () => view,
    processDeliveries: () => { calls.push('deliveries'); },
    processJobReplies: () => { calls.push('jobs'); },
    sweepBusyLeaveLines: () => { calls.push('goodbyes'); },
    scheduleDailyProfileUpdate: (mode: TimeAdvanceMode) => {
      calls.push(`profile:${mode}`);
    },
    processNewDay: (day) => { calls.push(`new-day:${day}`); },
    publishState: () => { calls.push('publish'); },
  };

  const time = new TimeAdvancement(owners, hooks);
  return {
    owners,
    calls,
    time,
    setView: (next: typeof view) => { view = next; },
  };
}

describe('TimeAdvancement single-owner coordinator', () => {
  it('does not run domain boundary hooks for zero-minute render frames', () => {
    const { owners, calls, time } = fixture();
    const before = owners.clock.getTotalMinutes();

    time.advanceRealTime(1 / 60);

    expect(owners.clock.getTotalMinutes()).toBe(before);
    expect(calls).toEqual([]);
    expect(owners.telemetry.getStats().totalRealPlayTimeSeconds).toBeGreaterThan(0);
  });

  it('publishes exactly once when a realtime minute actually advances', () => {
    const { owners, calls, time } = fixture();
    const before = owners.clock.getTotalMinutes();
    const ticks: number[] = [];
    owners.events.on('time:tick', ({ deltaMinutes }) => ticks.push(deltaMinutes));

    time.advanceRealTime(1);

    expect(owners.clock.getTotalMinutes()).toBe(before + 1);
    expect(ticks).toEqual([1]);
    expect(calls).toEqual(['deliveries', 'jobs', 'goodbyes', 'publish']);
  });

  it('keeps paused realtime and non-positive jumps inert', () => {
    const { owners, calls, time } = fixture();
    owners.clock.setPaused(true);
    const before = owners.clock.getTotalMinutes();

    time.advanceRealTime(10);
    time.advanceGameMinutes(0);
    time.advanceGameMinutes(-7);

    expect(owners.clock.getTotalMinutes()).toBe(before);
    expect(calls).toEqual([]);
  });

  it('commits jump work before time:jump, then daily callbacks, then publication', () => {
    const { owners, calls, time } = fixture();
    owners.clock.setTotalMinutes(23 * 60 + 59);
    owners.events.on('time:jump', () => { calls.push('time:jump'); });
    owners.events.on('time:day_changed', () => { calls.push('time:day_changed'); });

    time.advanceGameMinutes(2, 'test:boundary');

    expect(owners.clock.getTime().day).toBe(2);
    expect(calls).toEqual([
      'deliveries',
      'jobs',
      'goodbyes',
      'profile:jump',
      'time:jump',
      'time:day_changed',
      'new-day:2',
      'publish',
    ]);
  });

  it('preserves the realtime-specific day-boundary event order', () => {
    const { owners, calls, time } = fixture();
    owners.clock.setTotalMinutes(23 * 60 + 59);
    owners.events.on('time:tick', () => { calls.push('time:tick'); });
    owners.events.on('time:day_changed', () => { calls.push('time:day_changed'); });

    time.advanceRealTime(2);

    expect(owners.clock.getTime().day).toBe(2);
    expect(calls).toEqual([
      'deliveries',
      'jobs',
      'goodbyes',
      'profile:realtime',
      'time:tick',
      'time:day_changed',
      'new-day:2',
      'publish',
    ]);
  });
});
