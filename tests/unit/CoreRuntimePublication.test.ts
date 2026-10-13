import { describe, expect, it, vi } from 'vitest';
import { CoreRuntime } from '../../src/engine/kernel/CoreRuntime';

describe('CoreRuntime Publication & State Projection — state authority and subscriptions', () => {
  it('delivers committed state immediately to new subscribers and on mutation', () => {
    const runtime = new CoreRuntime();
    const states: Array<number> = [];

    const unsubscribe = runtime.subscribe((state) => {
      states.push(state.player.cash);
    });

    expect(states.length).toBe(1);
    const initialCash = states[0]!;

    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 25,
      reason: 'test',
    });

    expect(states.length).toBe(2);
    expect(states[1]).toBe(initialCash + 25);

    unsubscribe();
    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 10,
      reason: 'test after unsub',
    });

    // No further updates delivered after unsubscribe
    expect(states.length).toBe(2);
  });

  it('keeps getState reference-stable when version has not changed', () => {
    const runtime = new CoreRuntime();
    const read1 = runtime.getState();
    const read2 = runtime.getState();

    // Cache stability
    expect(read1).toBe(read2);

    // After mutation, reference updates
    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 5,
      reason: 'version bump',
    });
    const read3 = runtime.getState();
    expect(read3).not.toBe(read1);
    expect(read3.player.cash).toBe(read1.player.cash + 5);
  });

  it('does not mutate canonical hardware or domain truth during public reads', () => {
    const runtime = new CoreRuntime();
    const hwBefore = { ...runtime.owners.hardware.getState() };
    const hwStateBefore = (runtime.owners.hardware as any).state.osVersion;

    // Multiple reads
    for (let i = 0; i < 5; i++) {
      runtime.getState();
      runtime.exportSnapshot();
    }

    expect(runtime.owners.hardware.getState()).toEqual(hwBefore);
    expect((runtime.owners.hardware as any).state.osVersion).toBe(hwStateBefore);
  });

  it('does not cause duplicate domain updates when multiple subscribers are registered', () => {
    const runtime = new CoreRuntime();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    runtime.subscribe(listener1);
    runtime.subscribe(listener2);
    runtime.subscribe(listener3);

    const cashBefore = runtime.owners.economy.getCash();
    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 15,
      reason: 'single earn',
    });

    // Cash is credited exactly once
    expect(runtime.owners.economy.getCash()).toBe(cashBefore + 15);
    // All 3 listeners notified
    expect(listener1).toHaveBeenCalledTimes(2); // 1 initial + 1 update
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);
  });
});
