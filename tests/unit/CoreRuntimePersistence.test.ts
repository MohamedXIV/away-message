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
});
