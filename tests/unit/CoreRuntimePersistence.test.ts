import { describe, expect, it } from 'vitest';
import { CoreRuntime } from '../../src/engine/kernel/CoreRuntime';

describe('CoreRuntime Persistence — snapshot round-trip and rehydration invariants', () => {
  it('round-trips complete current-format Core state across exportSnapshot and loadSnapshot', () => {
    const runtime = new CoreRuntime();

    // Mutate various domain states
    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 120,
      reason: 'savings',
    });
    runtime.owners.needs.consumeEnergy(25);
    runtime.owners.clock.setPaused(true);
    runtime.advanceGameMinutes(180, 'time progression');
    runtime.owners.world.setFlag('test_custom_flag', 'persisted_value');

    const exported = runtime.exportSnapshot();
    expect(exported.version).toBe(1);
    expect(exported.player.cash).toBe(runtime.owners.economy.getCash());
    expect(exported.time.totalMinutes).toBe(runtime.owners.clock.getTotalMinutes());
    expect(exported.world.flags.test_custom_flag).toBe('persisted_value');

    // Create a fresh runtime and load the snapshot
    const restored = new CoreRuntime();
    restored.loadSnapshot(exported);

    expect(restored.owners.economy.getCash()).toBe(exported.player.cash);
    expect(restored.owners.clock.getTotalMinutes()).toBe(exported.time.totalMinutes);
    expect(restored.owners.needs.getState().energy).toBe(exported.needs?.energy);
    expect(restored.owners.world.getFlag('test_custom_flag')).toBe('persisted_value');
    expect(restored.getState().os.currentOsId).toBe(exported.os.currentOsId);
  });

  it('exports valid FullSimulationSnapshot records', () => {
    const runtime = new CoreRuntime();
    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 40,
      reason: 'export check',
    });

    const fullSnapshot = runtime.exportFullSnapshot('slot_test', 'Test Save');

    expect(fullSnapshot.saveSlot.id).toBe('slot_test');
    expect(fullSnapshot.saveSlot.name).toBe('Test Save');
    expect(fullSnapshot.saveSlot.playerState.cash).toBe(runtime.owners.economy.getCash());
    expect(fullSnapshot.vfsFiles).toBeDefined();
    expect(fullSnapshot.downloads).toBeDefined();
    expect(fullSnapshot.installedSoftware).toBeDefined();
    expect(fullSnapshot.worldState).toBeDefined();
    expect(fullSnapshot.osState).toBeDefined();
    expect(fullSnapshot.telemetryLogs).toBeDefined();
  });

  it('does not duplicate initial character roster or stubs across reload', () => {
    const runtime = new CoreRuntime();
    const buddyCountBefore = runtime.owners.social.getBuddies().length;

    const snapshot = runtime.exportSnapshot();

    const reloaded = new CoreRuntime();
    reloaded.loadSnapshot(snapshot);

    const buddyCountAfter = reloaded.owners.social.getBuddies().length;
    expect(buddyCountAfter).toBe(buddyCountBefore);
  });

  it('preserves pause state across exportSnapshot, reload, and initial snapshot construction', () => {
    const runtime = new CoreRuntime();
    runtime.dispatchAction({ type: 'TIME_SET_PAUSED', paused: true });
    expect(runtime.owners.clock.isPaused()).toBe(true);

    const snapshot = runtime.exportSnapshot();
    expect((snapshot as any).isPaused).toBe(true);

    // Load into existing runtime instance
    const reloaded = new CoreRuntime();
    reloaded.loadSnapshot(snapshot);
    expect(reloaded.owners.clock.isPaused()).toBe(true);

    // Verify time does not advance while paused
    const minsBefore = reloaded.owners.clock.getTotalMinutes();
    reloaded.advanceRealTime(60);
    expect(reloaded.owners.clock.getTotalMinutes()).toBe(minsBefore);

    // Unpausing allows time to progress
    reloaded.dispatchAction({ type: 'TIME_SET_PAUSED', paused: false });
    expect(reloaded.owners.clock.isPaused()).toBe(false);
    reloaded.advanceRealTime(60);
    expect(reloaded.owners.clock.getTotalMinutes()).toBe(minsBefore + 60);

    // Also verify new CoreRuntime(snapshot) honors initial paused state
    const instantiatedFromSave = new CoreRuntime(snapshot);
    expect(instantiatedFromSave.owners.clock.isPaused()).toBe(true);
  });

  it('does not re-register or duplicate event listeners during reload or multiple register calls', () => {
    const runtime = new CoreRuntime();
    const events = runtime.owners.events;

    const dayListenersBefore = events.listenerCount('time:day_changed');
    const moodListenersBefore = events.listenerCount('mood:changed');
    const cashListenersBefore = events.listenerCount('economy:cash_changed');

    expect(dayListenersBefore).toBeGreaterThan(0);

    const snapshot = runtime.exportSnapshot();

    // Repeated loadSnapshot calls must not register duplicate handlers
    runtime.loadSnapshot(snapshot);
    runtime.loadSnapshot(snapshot);

    expect(events.listenerCount('time:day_changed')).toBe(dayListenersBefore);
    expect(events.listenerCount('mood:changed')).toBe(moodListenersBefore);
    expect(events.listenerCount('economy:cash_changed')).toBe(cashListenersBefore);

    // Calling lifecycle.register() again must be idempotent
    runtime.lifecycle.register();
    expect(events.listenerCount('time:day_changed')).toBe(dayListenersBefore);

    // Emitting day_changed fires exactly once per registration
    const dayCalls: number[] = [];
    events.on('time:day_changed', ({ newDay }) => {
      dayCalls.push(newDay);
    });
    events.emit('time:day_changed', {
      newDay: 3,
      previousDay: 2,
      time: runtime.owners.clock.getTime(),
    });
    expect(dayCalls).toEqual([3]);
  });

  it('preserves existing saved gameplay state without rerolling story or reapplying new-game initializations', () => {
    const sourceRuntime = new CoreRuntime();

    // Modify economy, world flags, needs, and time to non-initial values
    sourceRuntime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 450,
      reason: 'freelance contract',
    });
    sourceRuntime.owners.needs.consumeEnergy(45);
    sourceRuntime.owners.world.setFlag('scenario_completed_act1', true);
    sourceRuntime.advanceGameMinutes(720, '12 hours progress');

    const savedCash = sourceRuntime.owners.economy.getCash();
    const savedEnergy = sourceRuntime.owners.needs.getState().energy;
    const savedMinutes = sourceRuntime.owners.clock.getTotalMinutes();
    const savedBuddies = sourceRuntime.owners.social.getBuddies().map((b) => b.id);

    const snapshot = sourceRuntime.exportSnapshot();

    // Reloading into a fresh instance restores exact facts
    const freshInstance = new CoreRuntime();
    freshInstance.loadSnapshot(snapshot);

    // Cash is not reset to starting $38
    expect(freshInstance.owners.economy.getCash()).toBe(savedCash);
    expect(freshInstance.owners.economy.getCash()).toBeGreaterThan(100);

    // Energy is restored, not reset to starting 100
    expect(freshInstance.owners.needs.getState().energy).toBe(savedEnergy);

    // Elapsed clock minutes are restored
    expect(freshInstance.owners.clock.getTotalMinutes()).toBe(savedMinutes);

    // World flags remain intact without reroll
    expect(freshInstance.owners.world.getFlag('scenario_completed_act1')).toBe(true);

    // Roster is preserved
    expect(freshInstance.owners.social.getBuddies().map((b) => b.id)).toEqual(savedBuddies);
  });
});
