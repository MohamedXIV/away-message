import { describe, expect, it, vi } from 'vitest';
import { CoreRuntime } from '../../src/engine/kernel/CoreRuntime';
import { registerProceduralRelease, clearProceduralReleases } from '../../src/engine/OsCatalog';
import { registerProceduralPulseRelease, clearProceduralPulseReleases } from '../../src/engine/PulseCatalog';
import { registerProceduralMyPlaceRelease, clearProceduralMyPlaceReleases } from '../../src/engine/MyPlaceCatalog';

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
  it('invokes onNotifySubscribers hook when provided in CoreRuntimeHooks', () => {
    const onNotify = vi.fn();
    const runtime = new CoreRuntime(undefined, {
      onNotifySubscribers: onNotify,
    });

    expect(onNotify).not.toHaveBeenCalled();

    runtime.notifySubscribers();
    expect(onNotify).toHaveBeenCalledTimes(1);

    runtime.dispatchAction({
      type: 'PLAYER_EARN_CASH',
      amount: 10,
      reason: 'test hook',
    });
    expect(onNotify).toHaveBeenCalledTimes(2);
  });

  it('does not mutate mood state or emit mood:changed during getState reads', () => {
    const runtime = new CoreRuntime();
    const moodChanged = vi.fn();
    runtime.owners.events.on('mood:changed', moodChanged);

    const moodBefore = JSON.stringify(runtime.owners.mood.getState());

    for (let i = 0; i < 10; i++) {
      runtime.getState();
    }

    expect(moodChanged).not.toHaveBeenCalled();
    expect(JSON.stringify(runtime.owners.mood.getState())).toBe(moodBefore);
  });

  it('returns deep-frozen public snapshots preventing caller mutation of nested domain state', () => {
    const runtime = new CoreRuntime();
    const state = runtime.getState();

    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.player)).toBe(true);
    expect(Object.isFrozen(state.world)).toBe(true);
    expect(Object.isFrozen(state.world.flags)).toBe(true);
    expect(Object.isFrozen(state.needs)).toBe(true);

    expect(() => {
      (state.player as any).cash = 999999;
    }).toThrow();

    expect(() => {
      (state.world.flags as any).test_injected_flag = true;
    }).toThrow();

    // Verify domain authority was not affected
    expect(runtime.owners.economy.getCash()).toBe(state.player.cash);
    expect(runtime.owners.world.getFlag('test_injected_flag')).toBeFalsy();
  });

  it('publishes only the committed transaction for multi-step room and travel actions', () => {
    const runtime = new CoreRuntime();
    const snapshots: Array<{ minute: number; energy: number; location: string }> = [];

    runtime.subscribe((state) => {
      snapshots.push({
        minute: state.time.minute,
        energy: state.needs?.energy ?? 100,
        location: state.player.location,
      });
    });

    // 1 snapshot from initial subscribe
    expect(snapshots.length).toBe(1);

    // Multi-step tea interaction
    const teaRes = runtime.dispatchAction({
      type: 'PLAYER_INTERACT_ROOM',
      activity: 'tea',
    });
    expect(teaRes.success).toBe(true);

    // Exactly one update notification published for the entire room interaction
    expect(snapshots.length).toBe(2);
    const teaSnapshot = snapshots[1]!;
    expect(teaSnapshot.minute).toBe(6); // tea takes 6 minutes
    expect(teaSnapshot.energy).toBe(Math.min(100, snapshots[0]!.energy + 5));

    // Travel to cafe
    const travelRes = runtime.cityActivity.travelTo('cafe', 'walk');
    expect(travelRes.success).toBe(true);

    // Exactly one update notification published for the entire travel transaction
    expect(snapshots.length).toBe(3);
    const travelSnapshot = snapshots[2]!;
    expect(travelSnapshot.location).toBe('cafe');
    expect(travelSnapshot.energy).toBeLessThan(teaSnapshot.energy);
  });
  it('publishes once after a sleep transaction settles an arriving grocery delivery', () => {
    const runtime = new CoreRuntime();
    const now = runtime.owners.clock.getTotalMinutes();
    const order = runtime.owners.delivery.placeDelivery(
      [{ sku: 'noodles_cup', qty: 1 }],
      2,
      now,
    );
    const snapshots: Array<{ minute: number; deliveryStatus?: string }> = [];

    runtime.subscribe((state) => {
      snapshots.push({
        minute: state.time.totalMinutes,
        deliveryStatus: state.deliveries.orders.find((candidate) => candidate.id === order.id)?.status,
      });
    });

    const result = runtime.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });

    expect(result.success).toBe(true);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toEqual({
      minute: runtime.owners.clock.getTotalMinutes(),
      deliveryStatus: 'done',
    });
  });
  it('does not freeze or alter registered catalog records while still returning immutable snapshots', () => {
    clearProceduralReleases();
    clearProceduralPulseReleases();
    clearProceduralMyPlaceReleases();

    try {
      const osRel = registerProceduralRelease({
        id: 'Orion_test_rel' as any,
        version: 'test.1',
        build: 'test.1.0',
        displayName: 'Test OS',
        family: '7.x',
        kind: 'major',
        channel: 'stable',
        releaseDay: 2,
        changelog: ['first release'],
        requirements: { minRamMB: 256, minCpuTier: 1, minDiskGB: 2 },
        installSizeGB: 2,
        ramOverheadMB: 64,
        bootTimeSeconds: 30,
        theme: 'orion70',
      });

      const pulseRel = registerProceduralPulseRelease({
        id: 'pulse_test_rel',
        version: 'test.1',
        build: 'test.1.0',
        displayName: 'Test Pulse',
        family: '6.x',
        kind: 'major',
        channel: 'stable',
        releaseDay: 2,
        changelog: ['initial pulse'],
        requirements: { minOs: 'Orion_4.8' as any, minRamMB: 64, minDiskMB: 32 },
        installSizeMB: 5,
      });

      const myplaceRel = registerProceduralMyPlaceRelease({
        id: 'myplace_test_rel',
        version: 'test.1',
        build: 'test.1.0',
        displayName: 'Test MyPlace',
        family: '2.x',
        kind: 'major',
        channel: 'stable',
        releaseDay: 2,
        changelog: ['initial myplace'],
        features: {
          top8: true,
          profileMusic: true,
          tiler: false,
          glitter: false,
          guestbookThreaded: false,
          autoplay: false,
          videoEmbed: false,
        },
      });

      const runtime = new CoreRuntime();
      const state = runtime.getState();

      // The returned snapshot is deep-frozen
      expect(Object.isFrozen(state.os.proceduralCatalog)).toBe(true);
      expect(Object.isFrozen(state.os.proceduralCatalog![0])).toBe(true);
      expect(Object.isFrozen((state.os.proceduralCatalog![0] as any).requirements)).toBe(true);
      expect(Object.isFrozen(state.pulse.proceduralCatalog)).toBe(true);
      expect(Object.isFrozen(state.pulse.proceduralCatalog![0])).toBe(true);
      expect(Object.isFrozen((state.pulse.proceduralCatalog![0] as any).requirements)).toBe(true);
      expect(Object.isFrozen(state.myplace.proceduralCatalog)).toBe(true);
      expect(Object.isFrozen(state.myplace.proceduralCatalog![0])).toBe(true);
      expect(Object.isFrozen((state.myplace.proceduralCatalog![0] as any).features)).toBe(true);

      // The original catalog records in the registries are NOT frozen
      expect(Object.isFrozen(osRel)).toBe(false);
      expect(Object.isFrozen(osRel.requirements)).toBe(false);
      expect(Object.isFrozen(osRel.changelog)).toBe(false);
      expect(Object.isFrozen(pulseRel)).toBe(false);
      expect(Object.isFrozen(pulseRel.requirements)).toBe(false);
      expect(Object.isFrozen(pulseRel.changelog)).toBe(false);
      expect(Object.isFrozen(myplaceRel)).toBe(false);
      expect(Object.isFrozen(myplaceRel.features)).toBe(false);
      expect(Object.isFrozen(myplaceRel.changelog)).toBe(false);

      // Original catalog records can still be safely mutated by their domain authorities
      osRel.requirements.minRamMB = 512;
      osRel.changelog.push('second note');
      pulseRel.requirements.minRamMB = 128;
      pulseRel.changelog.push('second pulse note');
      myplaceRel.features.glitter = true;
      myplaceRel.changelog.push('second myplace note');

      expect(osRel.requirements.minRamMB).toBe(512);
      expect(pulseRel.requirements.minRamMB).toBe(128);
      expect(myplaceRel.features.glitter).toBe(true);
    } finally {
      clearProceduralReleases();
      clearProceduralPulseReleases();
      clearProceduralMyPlaceReleases();
    }
  });

  it('keeps owner VFS metadata, telemetry logs, and World appointment origin unfrozen and mutable after getState', () => {
    const runtime = new CoreRuntime();

    // 1. VFS file with nested metadata and extractedFiles array
    runtime.owners.vfs.createFile(
      {
        name: 'archive_manifest.txt',
        path: 'C:/Documents/archive_manifest.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 256,
        metadata: {
          author: 'system',
          extractedFiles: ['fileA.txt', 'fileB.txt'],
        },
      },
      0,
    );

    // 2. Telemetry event with nested payload data
    runtime.owners.telemetry.logEvent('economy', 'test_alias_action', 0, {
      initialNote: 'must_remain_mutable',
      count: 1,
    });

    // 3. World appointment with nested origin object
    runtime.owners.world.scheduleAppointment({
      id: 'apt_origin_test',
      characterId: 'maya',
      locationId: 'cafe',
      targetDay: 1,
      startMinute: 600,
      endMinute: 660,
      description: 'Test appointment with origin',
      origin: { kind: 'job', id: 'job_board_99' },
    });

    // Take public snapshot
    const snapshot = runtime.getState();

    // --- Assert snapshot is deeply frozen ---
    const snapshotFile = snapshot.vfs.files['C:/Documents/archive_manifest.txt']!;
    expect(snapshotFile).toBeDefined();
    expect(Object.isFrozen(snapshotFile)).toBe(true);
    expect(Object.isFrozen(snapshotFile.metadata)).toBe(true);
    expect(Object.isFrozen((snapshotFile.metadata as any).extractedFiles)).toBe(true);

    const snapshotTelemetry = snapshot.telemetry.logs.find((l) => l.action === 'test_alias_action')!;
    expect(snapshotTelemetry).toBeDefined();
    expect(Object.isFrozen(snapshotTelemetry)).toBe(true);
    expect(Object.isFrozen(snapshotTelemetry.data)).toBe(true);

    const snapshotApt = snapshot.world.appointments.find((a) => a.id === 'apt_origin_test')!;
    expect(snapshotApt).toBeDefined();
    expect(Object.isFrozen(snapshotApt)).toBe(true);
    expect(Object.isFrozen(snapshotApt.origin)).toBe(true);

    // --- Assert owner domain instances remain unfrozen and mutable ---
    const ownerFile = runtime.owners.vfs.readFile('C:/Documents/archive_manifest.txt')!;
    expect(ownerFile).toBeDefined();
    expect(Object.isFrozen(ownerFile.metadata)).toBe(false);
    expect(Object.isFrozen((ownerFile.metadata as any).extractedFiles)).toBe(false);

    // Mutating owner metadata succeeds without throwing TypeError (from Object.freeze)
    (ownerFile.metadata as any).author = 'author_mutated';
    (ownerFile.metadata as any).extractedFiles.push('fileC.txt');
    expect((ownerFile.metadata as any).author).toBe('author_mutated');
    expect((ownerFile.metadata as any).extractedFiles).toHaveLength(3);

    const ownerLogs = runtime.owners.telemetry.getLogs();
    const ownerRecord = ownerLogs.find((l) => l.action === 'test_alias_action')!;
    expect(ownerRecord).toBeDefined();
    expect(Object.isFrozen(ownerRecord)).toBe(false);
    expect(Object.isFrozen(ownerRecord.data)).toBe(false);

    // Mutating owner telemetry payload succeeds
    (ownerRecord.data as any).initialNote = 'mutated_in_owner';
    expect((ownerRecord.data as any).initialNote).toBe('mutated_in_owner');

    const ownerApts = runtime.owners.world.getAppointments();
    const ownerApt = ownerApts.find((a) => a.id === 'apt_origin_test')!;
    expect(ownerApt).toBeDefined();
    expect(Object.isFrozen(ownerApt)).toBe(false);
    expect(Object.isFrozen(ownerApt.origin)).toBe(false);

    // Mutating owner appointment origin succeeds
    ownerApt.origin!.id = 'job_board_mutated';
    expect(ownerApt.origin!.id).toBe('job_board_mutated');
  });
});
