import { describe, expect, it, vi } from 'vitest';
import { CoreRuntime } from '../../src/engine/kernel/CoreRuntime';

describe('CoreRuntime Lifecycle — bootstrap and time boundary invariants', () => {
  it('initializes one authoritative domain graph with single EventBus and consistent roster', () => {
    const runtime = new CoreRuntime();

    expect(runtime.owners.events).toBeDefined();
    expect(runtime.owners.clock).toBeDefined();
    expect(runtime.owners.social).toBeDefined();

    const buddies = runtime.owners.social.getBuddies();
    expect(buddies.length).toBeGreaterThan(0);

    // World buddy provider is wired to the exact same roster
    const worldBuddies = (runtime.owners.world as any).buddyProvider();
    expect(worldBuddies.length).toBe(buddies.length);
  });

  it('fires daily callbacks and transitions once per day change', () => {
    const runtime = new CoreRuntime();
    const daySpy = vi.fn();
    runtime.owners.events.on('time:day_changed', daySpy);

    // Jump 24 hours (1440 minutes)
    runtime.advanceGameMinutes(1440, 'full day jump');

    expect(daySpy).toHaveBeenCalledTimes(1);
    expect(daySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        newDay: 2,
        previousDay: 1,
      }),
    );
  });

  it('respects pause state and skips time advancement while paused', () => {
    const runtime = new CoreRuntime();
    const startMinutes = runtime.owners.clock.getTotalMinutes();

    runtime.dispatchAction({ type: 'TIME_SET_PAUSED', paused: true });
    expect(runtime.owners.clock.isPaused()).toBe(true);

    runtime.advanceRealTime(10);
    expect(runtime.owners.clock.getTotalMinutes()).toBe(startMinutes);

    runtime.dispatchAction({ type: 'TIME_SET_PAUSED', paused: false });
    expect(runtime.owners.clock.isPaused()).toBe(false);

    runtime.advanceRealTime(60);
    expect(runtime.owners.clock.getTotalMinutes()).toBeGreaterThan(startMinutes);
  });

  it('preserves the #170 zero-minute invariant: sub-minute ticks do not advance simulation time', () => {
    const runtime = new CoreRuntime();
    const startMinutes = runtime.owners.clock.getTotalMinutes();
    const tickSpy = vi.fn();
    runtime.owners.events.on('time:tick', tickSpy);

    // Less than 1 minute of realtime
    runtime.advanceRealTime(0.5);

    expect(runtime.owners.clock.getTotalMinutes()).toBe(startMinutes);
    expect(tickSpy).not.toHaveBeenCalled();
  });

  it('converges to equivalent state across different realtime chunk sizes', () => {
    const stepped = new CoreRuntime();
    const single = new CoreRuntime();

    // 4 chunks of 0.25s vs 1 chunk of 1s
    for (let i = 0; i < 4; i++) {
      stepped.advanceRealTime(0.25);
    }
    single.advanceRealTime(1);

    expect(stepped.owners.clock.getTotalMinutes()).toBe(single.owners.clock.getTotalMinutes());
    expect(stepped.getState().time).toEqual(single.getState().time);
  });
});
