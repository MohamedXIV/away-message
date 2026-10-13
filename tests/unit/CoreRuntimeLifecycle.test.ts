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

  it('invokes each domain daily subsystem exactly once per day transition', () => {
    const runtime = new CoreRuntime();
    const economySpy = vi.spyOn(runtime.owners.economy, 'handleDayTransition');
    const needsSpy = vi.spyOn(runtime.owners.needs, 'handleDayTransition');
    const relSpy = vi.spyOn(runtime.relationshipContinuity, 'processRelationshipDaily');
    const apptSpy = vi.spyOn(runtime.appointmentCoordination, 'processAppointmentsDaily');
    const myplaceSpy = vi.spyOn(runtime.myplaceSocial, 'processDay');
    const rentSpy = vi.spyOn(runtime.rentCoordination, 'processRentDaily');
    const npcSpy = vi.spyOn(runtime.npcSocialLife, 'processDay');
    const batterySpy = vi.spyOn(runtime.socialPresence, 'processPlayerBatteryDaily');

    // Advance by 1 day
    runtime.advanceGameMinutes(1440, 'advance to day 2');

    expect(economySpy).toHaveBeenCalledTimes(1);
    expect(economySpy).toHaveBeenCalledWith(2);
    expect(needsSpy).toHaveBeenCalledTimes(1);
    expect(relSpy).toHaveBeenCalledTimes(1);
    expect(relSpy).toHaveBeenCalledWith(2);
    expect(apptSpy).toHaveBeenCalledTimes(1);
    expect(apptSpy).toHaveBeenCalledWith(2);
    expect(myplaceSpy).toHaveBeenCalledTimes(1);
    expect(myplaceSpy).toHaveBeenCalledWith(2);
    expect(rentSpy).toHaveBeenCalledTimes(1);
    expect(rentSpy).toHaveBeenCalledWith(2);
    expect(npcSpy).toHaveBeenCalledTimes(1);
    expect(npcSpy).toHaveBeenCalledWith(2);
    expect(batterySpy).toHaveBeenCalledTimes(1);
    expect(batterySpy).toHaveBeenCalledWith(2);
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

  it('processes 60 sub-minute 1/60s render frames with exactly one tick on completion', () => {
    const runtime = new CoreRuntime();
    const startMinutes = runtime.owners.clock.getTotalMinutes();
    const tickSpy = vi.fn();
    runtime.owners.events.on('time:tick', tickSpy);

    // First 59 frames (16.66ms each): 0 ticks, time remains unchanged
    for (let f = 0; f < 59; f++) {
      runtime.advanceRealTime(1 / 60);
    }
    expect(runtime.owners.clock.getTotalMinutes()).toBe(startMinutes);
    expect(tickSpy).not.toHaveBeenCalled();

    // 60th frame: completes 1 full second = 1 simulation minute
    runtime.advanceRealTime(1 / 60);
    expect(runtime.owners.clock.getTotalMinutes()).toBe(startMinutes + 1);
    expect(tickSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps zero-minute game advancement requests inert', () => {
    const runtime = new CoreRuntime();
    const startMinutes = runtime.owners.clock.getTotalMinutes();
    const jumpSpy = vi.fn();
    runtime.owners.events.on('time:jump', jumpSpy);

    runtime.advanceGameMinutes(0);
    runtime.advanceGameMinutes(-5);

    expect(runtime.owners.clock.getTotalMinutes()).toBe(startMinutes);
    expect(jumpSpy).not.toHaveBeenCalled();
  });

  it('converges to equivalent state across different realtime chunk sizes', () => {
    const stepped = new CoreRuntime();
    const single = new CoreRuntime();

    // Multi-minute convergence: 10 minutes total (600 realtime seconds)
    // stepped advances via 600 single-second chunks
    for (let i = 0; i < 600; i++) {
      stepped.advanceRealTime(1);
    }
    // single advances via 10 sixty-second chunks
    for (let i = 0; i < 10; i++) {
      single.advanceRealTime(60);
    }

    expect(stepped.owners.clock.getTotalMinutes()).toBe(single.owners.clock.getTotalMinutes());
    expect(stepped.getState().time).toEqual(single.getState().time);
    expect(stepped.owners.needs.getState().hunger).toBeCloseTo(
      single.owners.needs.getState().hunger,
      4,
    );
    expect(stepped.getState().player.cash).toBe(single.getState().player.cash);
  });
});
