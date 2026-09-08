// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createScrapYardBundle } from '../../src/engine/hardware/catalog';
import { db } from '../../src/persistence/db';
import {
  SAVE_FORMAT_VERSION,
  checkSaveCompatibility,
  deleteSlot,
  listSlots,
  loadSlotSnapshot,
  mostRecentSlot,
  restoreSlotPulse,
  saveSlot,
} from '../../src/persistence/slots';
import {
  isRecoverableBrokenStarterPurchase,
  migrateSnapshotToV6,
} from '../../src/persistence/migrations/v6ComputerState';
import { APP_VERSION } from '../../src/version';
import { setCurrentPulseSlotId } from '../../src/apps/pulse/persistence';

describe('P9 save slots (Dexie documents + Pulse coherence)', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await db.saves.clear().catch(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves, lists, loads and deletes engine snapshots', async () => {
    const sim = new SimulationEngine();
    sim.advanceGameMinutes(60, 'test hour');
    sim.social.addCoreMemory('maya', { text: 'Slot memory', kind: 'fact', day: 1 });

    const summary = await saveSlot(sim, 'slot_1');
    expect(summary.id).toBe('slot_1');
    expect(summary.hasSnapshot).toBe(true);
    expect(summary.day).toBe(1);

    const rows = await listSlots();
    expect(rows.map((r) => r.id)).toContain('slot_1');

    const snapshot = await loadSlotSnapshot('slot_1');
    expect(snapshot).not.toBeNull();
    const restored = new SimulationEngine(snapshot as any);
    expect(restored.clock.getTotalMinutes()).toBe(sim.clock.getTotalMinutes());
    expect(restored.social.getCoreMemories('maya').some((m) => m.text === 'Slot memory')).toBe(true);

    await deleteSlot('slot_1');
    expect(await loadSlotSnapshot('slot_1')).toBeNull();
  });

  it('persists an honest fresh no-PC/no-OS summary', async () => {
    const sim = new SimulationEngine();
    await saveSlot(sim, 'slot_empty');
    const record = await db.saves.get('slot_empty');

    expect(record?.version).toBe(6);
    expect(record?.hardwareState.hasComputer).toBe(false);
    expect(record?.hardwareState.connectionType).toBeNull();
    expect(record?.hardwareState.osVersion).toBeNull();
    expect(record?.snapshot?.computer.assembled).toBe(false);
    expect(record?.snapshot?.os.currentOsId).toBeNull();
  });

  it('mostRecentSlot prefers the freshest snapshot', async () => {
    const sim = new SimulationEngine();
    await saveSlot(sim, 'slot_2');
    await saveSlot(sim, 'autosave');
    const recent = await mostRecentSlot();
    expect(recent).not.toBeNull();
    expect(['slot_2', 'autosave']).toContain(recent!.id);
  });

  it('restores the saved Pulse moment into its own slot', async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => (key in store ? store[key]! : null),
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
    });
    const { getPulseSlotStorageKey } = await import('../../src/apps/pulse/persistence');
    setCurrentPulseSlotId('slot_1');
    store[getPulseSlotStorageKey('slot_1')] = JSON.stringify({ marker: 'pulse-moment-1' });

    const sim = new SimulationEngine();
    await saveSlot(sim, 'slot_1');

    delete store[getPulseSlotStorageKey('slot_1')];
    await restoreSlotPulse('slot_1');
    expect(store[getPulseSlotStorageKey('slot_1')]).toContain('pulse-moment-1');
  });
});

describe('P9 save compatibility matrix', () => {
  it('stamps new saves with the current format + app version', async () => {
    const sim = new SimulationEngine();
    await saveSlot(sim, 'slot_2');
    const record = await db.saves.get('slot_2');
    expect(SAVE_FORMAT_VERSION).toBe(6);
    expect(record?.version).toBe(SAVE_FORMAT_VERSION);
    expect(record?.appVersion).toBe(APP_VERSION);
    expect(checkSaveCompatibility(record!).status).toBe('ok');
    await db.saves.delete('slot_2');
  });

  it('accepts older supported formats, refuses newer and legacy', () => {
    expect(checkSaveCompatibility(undefined).status).toBe('refused');
    expect(checkSaveCompatibility(null).status).toBe('refused');
    expect(checkSaveCompatibility({ version: 2, snapshot: {} } as any).status).toBe('ok');
    const newer = checkSaveCompatibility({ version: SAVE_FORMAT_VERSION + 1, snapshot: {} } as any);
    expect(newer.status).toBe('refused');
    expect(checkSaveCompatibility({ version: 1 } as any).status).toBe('legacy');
    expect(checkSaveCompatibility({ version: 3 } as any).status).toBe('legacy');
  });

  it('loadSlotSnapshot returns null for incompatible saves', async () => {
    await db.saves.put({
      id: 'slot_future', name: 'future', version: SAVE_FORMAT_VERSION + 5,
      createdAt: 1, updatedAt: 2, day: 9, totalMinutes: 3,
      clockState: {}, playerState: {}, hardwareState: {}, narrativeFlags: {},
      snapshot: { time: { day: 9 } },
    } as any);
    expect(await loadSlotSnapshot('slot_future')).toBeNull();
    await db.saves.delete('slot_future');
  });
});

describe('v5 -> v6 computer state migration', () => {
  it('preserves a working modular PC, display, installed OS, and ownership', () => {
    const modular = createScrapYardBundle();
    const v5 = {
      version: 1,
      time: { day: 4, totalMinutes: 5000 },
      player: { cash: 20 },
      hardware: {
        hasComputer: true,
        isPoweredOn: false,
        modular,
        cpuTier: 1,
        cpuName: modular.cpu.name,
        ramMB: 64,
        hddTotalGB: 2.1,
        hddFreeGB: 0.9,
        connectionType: 'dialup_56k',
        connectionSpeedKbps: 56,
        osVersion: 'Orion_5.0',
        soundCardInstalled: true,
        speakersInstalled: false,
        webcamInstalled: false,
      },
      os: {
        currentOsId: 'Orion_5.0',
        installedPatchIds: [],
        lastInstallAtMinute: 3200,
      },
    } as any;

    const migrated = migrateSnapshotToV6(v5, 5);

    expect(migrated.computer.assembled).toBe(true);
    expect(migrated.computer.cpu?.id).toBe(modular.cpu.id);
    expect(migrated.computer.ramSticks[0]?.sizeMb).toBe(64);
    expect(migrated.display.monitor?.id).toBe(modular.monitor.id);
    expect(migrated.os.currentOsId).toBe('Orion_5.0');
    expect(migrated.inventory.items.map((item) => item.instanceId)).toContain('migrated:monitor:0');
    expect(migrated.inventory.items.every((item) => item.location === 'installed')).toBe(true);
    expect(migrated.hardware.hasComputer).toBe(true);
    expect(migrated.hardware.ramMB).toBe(64);
    expect('osVersion' in migrated.hardware).toBe(false);
    expect('modular' in migrated.hardware).toBe(false);
  });

  it('does not turn stale v5 default hardware/Orion into a ghost computer or OS', () => {
    const v5 = {
      version: 1,
      time: { day: 1, totalMinutes: 480 },
      player: { cash: 38 },
      hardware: {
        hasComputer: false,
        isPoweredOn: false,
        cpuTier: 1,
        cpuName: 'Single-Core Orion x86 450MHz',
        ramMB: 512,
        hddTotalGB: 40,
        hddFreeGB: 7,
        connectionType: 'dsl_256k',
        connectionSpeedKbps: 256,
        osVersion: 'Orion_4.8',
        soundCardInstalled: true,
        speakersInstalled: false,
        webcamInstalled: false,
      },
      os: { currentOsId: 'Orion_4.8', installedPatchIds: [] },
    } as any;

    const migrated = migrateSnapshotToV6(v5, 5);

    expect(migrated.computer.assembled).toBe(false);
    expect(migrated.display.monitor).toBeNull();
    expect(migrated.inventory.items).toEqual([]);
    expect(migrated.os.currentOsId).toBeNull();
    expect(migrated.hardware.ramMB).toBe(0);
    expect(migrated.hardware.connectionType).toBeNull();
  });

  it('adds only the narrow one-time marker for the known lost $35 starter purchase', () => {
    const broken = {
      time: { day: 1 },
      player: { cash: 3 },
      hardware: { hasComputer: false },
      os: { currentOsId: 'Orion_4.8', installedPatchIds: [] },
    } as any;

    expect(isRecoverableBrokenStarterPurchase(broken, 5)).toBe(true);
    const migrated = migrateSnapshotToV6(broken, 5);
    expect(migrated.inventory.items).toEqual([]);
    expect(migrated.inventory.legacyRecovery).toEqual({
      starterBundlePurchaseLost: true,
      consumed: false,
    });
  });

  it.each([
    ['cash $2', { time: { day: 1 }, player: { cash: 2 }, hardware: { hasComputer: false }, os: { currentOsId: 'Orion_4.8', installedPatchIds: [] } }],
    ['cash $4', { time: { day: 1 }, player: { cash: 4 }, hardware: { hasComputer: false }, os: { currentOsId: 'Orion_4.8', installedPatchIds: [] } }],
    ['day 2', { time: { day: 2 }, player: { cash: 3 }, hardware: { hasComputer: false }, os: { currentOsId: 'Orion_4.8', installedPatchIds: [] } }],
    ['working PC', { time: { day: 1 }, player: { cash: 3 }, hardware: { hasComputer: true }, os: { currentOsId: 'Orion_4.8', installedPatchIds: [] } }],
    ['install timestamp', { time: { day: 1 }, player: { cash: 3 }, hardware: { hasComputer: false }, os: { currentOsId: 'Orion_4.8', installedPatchIds: [], lastInstallAtMinute: 500 } }],
    ['patch evidence', { time: { day: 1 }, player: { cash: 3 }, hardware: { hasComputer: false }, os: { currentOsId: 'Orion_4.8', installedPatchIds: ['Orion_4.8.1'] } }],
  ])('does not grant the recovery marker for %s', (_label, snapshot) => {
    expect(isRecoverableBrokenStarterPurchase(snapshot as any, 5)).toBe(false);
  });
});
