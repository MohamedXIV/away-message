import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { ActionResult } from '../../src/engine/types';

type InstallMode = 'fresh' | 'upgrade' | 'patch';
interface OsInstallPlan {
  targetOs: string;
  mediaInstanceId: string;
  mode: InstallMode;
  durationMinutes: number;
  installSizeBytes: number;
  preparedAtTotalMinutes: number;
}

type PhysicalOsApi = SimulationEngine & {
  insertOwnedMediaAtHome(instanceId: string): ActionResult;
  ejectOwnedMediaAtHome(): ActionResult<{ mediaInstanceId: string }>;
  prepareOsInstallFromInsertedMedia(): ActionResult<OsInstallPlan>;
  commitOsInstall(plan: OsInstallPlan): ActionResult;
};

function starterReady(): PhysicalOsApi {
  const engine = new SimulationEngine() as PhysicalOsApi;
  expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
  expect(engine.setupComputerAtHome().success).toBe(true);
  return engine;
}

function starterDiscId(engine: SimulationEngine): string {
  const disc = engine.getState().inventory.items.find(
    (item) => item.catalogItemId === 'media_orion_48_setup',
  );
  expect(disc).toBeDefined();
  return disc!.instanceId;
}

describe('physical OS media ownership and insertion', () => {
  it('starter OS media is owned but never auto-inserted by purchase or computer setup', () => {
    const engine = starterReady();
    const disc = engine.getState().inventory.items.find(
      (item) => item.catalogItemId === 'media_orion_48_setup',
    );

    expect(disc?.kind).toBe('media');
    expect(disc?.location).toBe('room_package');
    expect(engine.getState().computer.insertedMediaId).toBeNull();
    expect(engine.getState().os.currentOsId).toBeNull();
  });

  it('inserts only an owned media item into an assembled optical drive and ejects it back to inventory', () => {
    const engine = starterReady();
    const discId = starterDiscId(engine);

    expect(engine.insertOwnedMediaAtHome('missing-media').success).toBe(false);
    expect(engine.getState().computer.insertedMediaId).toBeNull();

    expect(engine.insertOwnedMediaAtHome(discId).success).toBe(true);
    expect(engine.getState().computer.insertedMediaId).toBe(discId);
    expect(engine.getState().inventory.items.find((item) => item.instanceId === discId)?.location).toBe('inserted');

    const ejected = engine.ejectOwnedMediaAtHome();
    expect(ejected.success).toBe(true);
    expect(ejected.data?.mediaInstanceId).toBe(discId);
    expect(engine.getState().computer.insertedMediaId).toBeNull();
    expect(engine.getState().inventory.items.find((item) => item.instanceId === discId)?.location).toBe('inventory');
  });
});

describe('fresh OS install transaction', () => {
  it('prepares Orion 4.8 as a fresh install from owned inserted media without mutating OS, time, disk, or media', () => {
    const engine = starterReady();
    const discId = starterDiscId(engine);
    expect(engine.insertOwnedMediaAtHome(discId).success).toBe(true);

    const before = engine.exportSnapshot();
    const prepared = engine.prepareOsInstallFromInsertedMedia();

    expect(prepared.success).toBe(true);
    expect(prepared.data?.targetOs).toBe('Orion_4.8');
    expect(prepared.data?.mode).toBe('fresh');
    expect(prepared.data?.durationMinutes).toBeGreaterThan(0);
    expect(prepared.data?.installSizeBytes).toBeGreaterThan(0);
    expect(engine.getState().os.currentOsId).toBeNull();
    expect(engine.getState().time.totalMinutes).toBe(before.time.totalMinutes);
    expect(engine.getState().computer.storage[0]?.freeBytes).toBe(before.computer.storage[0]?.freeBytes);
    expect(engine.getState().computer.insertedMediaId).toBe(discId);
  });

  it('rejects missing, unowned, or uninserted physical installer media before any install mutation', () => {
    const engine = starterReady();
    const before = engine.exportSnapshot();

    const result = engine.prepareOsInstallFromInsertedMedia();

    expect(result.success).toBe(false);
    expect(engine.exportSnapshot().os).toEqual(before.os);
    expect(engine.getState().time.totalMinutes).toBe(before.time.totalMinutes);
    expect(engine.getState().computer.storage).toEqual(before.computer.storage);
  });

  it('commits OS, disk, and authored time only after successful fresh-install commit', () => {
    const engine = starterReady();
    const discId = starterDiscId(engine);
    expect(engine.insertOwnedMediaAtHome(discId).success).toBe(true);
    const prepared = engine.prepareOsInstallFromInsertedMedia();
    expect(prepared.success).toBe(true);

    const before = engine.exportSnapshot();
    const result = engine.commitOsInstall(prepared.data!);

    expect(result.success).toBe(true);
    expect(engine.getState().os.currentOsId).toBe('Orion_4.8');
    expect(engine.getState().time.totalMinutes - before.time.totalMinutes).toBe(prepared.data!.durationMinutes);
    expect((before.computer.storage[0]?.freeBytes ?? 0) - (engine.getState().computer.storage[0]?.freeBytes ?? 0)).toBe(prepared.data!.installSizeBytes);
    expect(engine.getState().computer.insertedMediaId).toBe(discId);
    expect(engine.getState().inventory.items.find((item) => item.instanceId === discId)?.location).toBe('inserted');
  });

  it('rejects a stale install plan without mutating OS, disk, time, or media', () => {
    const engine = starterReady();
    const discId = starterDiscId(engine);
    expect(engine.insertOwnedMediaAtHome(discId).success).toBe(true);
    const prepared = engine.prepareOsInstallFromInsertedMedia();
    expect(prepared.success).toBe(true);
    expect(engine.ejectOwnedMediaAtHome().success).toBe(true);

    const before = engine.exportSnapshot();
    const result = engine.commitOsInstall(prepared.data!);

    expect(result.success).toBe(false);
    expect(engine.exportSnapshot().os).toEqual(before.os);
    expect(engine.getState().time.totalMinutes).toBe(before.time.totalMinutes);
    expect(engine.getState().computer.storage).toEqual(before.computer.storage);
    expect(engine.getState().inventory).toEqual(before.inventory);
  });

  it('preserves stable inserted pre-install and installed post-install states across save/reload', () => {
    const source = starterReady();
    const discId = starterDiscId(source);
    expect(source.insertOwnedMediaAtHome(discId).success).toBe(true);

    const preInstall = source.exportSnapshot();
    const restoredPre = new SimulationEngine() as PhysicalOsApi;
    restoredPre.loadSnapshot(preInstall);
    expect(restoredPre.getState().computer.insertedMediaId).toBe(discId);
    expect(restoredPre.getState().inventory.items.find((item) => item.instanceId === discId)?.location).toBe('inserted');
    expect(restoredPre.getState().os.currentOsId).toBeNull();

    const prepared = source.prepareOsInstallFromInsertedMedia();
    expect(prepared.success).toBe(true);
    expect(source.commitOsInstall(prepared.data!).success).toBe(true);
    const postInstall = source.exportSnapshot();

    const restoredPost = new SimulationEngine() as PhysicalOsApi;
    restoredPost.loadSnapshot(postInstall);
    expect(restoredPost.getState().os.currentOsId).toBe('Orion_4.8');
    expect(restoredPost.getState().computer.insertedMediaId).toBe(discId);
    expect(restoredPost.getState().inventory.items.find((item) => item.instanceId === discId)?.location).toBe('inserted');
  });
});
