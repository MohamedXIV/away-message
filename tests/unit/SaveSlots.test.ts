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
import { legacyModularToCanonical } from '../../src/engine/hardware/state';
import { APP_VERSION } from '../../src/version';
import { SaveSlotSchema } from '../../src/persistence/schema';
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
    expect(record?.snapshot?.computer?.assembled).toBe(false);
    expect(record?.snapshot?.os?.currentOsId).toBeNull();
    expect(SaveSlotSchema.safeParse(record).success).toBe(true);
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

  it('refuses pre-freeze development formats, newer writers and pre-snapshot saves', () => {
    expect(checkSaveCompatibility(undefined).status).toBe('refused');
    expect(checkSaveCompatibility(null).status).toBe('refused');
    expect(checkSaveCompatibility({ version: 2, snapshot: {} } as any).status).toBe('refused');
    expect(checkSaveCompatibility({ version: 5, snapshot: {} } as any).status).toBe('refused');
    const newer = checkSaveCompatibility({ version: SAVE_FORMAT_VERSION + 1, snapshot: {} } as any);
    expect(newer.status).toBe('refused');
    expect(checkSaveCompatibility({ version: 1 } as any).status).toBe('legacy');
    expect(checkSaveCompatibility({ version: 3 } as any).status).toBe('legacy');
  });

  it('refuses an old-format document even when a complete snapshot exists', async () => {
    const sim = new SimulationEngine();
    const record = await saveSlot(sim, 'old-doc');
    const stored = (await db.saves.get(record.id))!;
    await db.saves.put({ ...stored, version: 5 });
    expect(checkSaveCompatibility(await db.saves.get(record.id)).status).toBe('refused');
    expect(await loadSlotSnapshot(record.id)).toBeNull();
    await db.saves.delete(record.id);
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

describe('Current-format computer and item ownership persistence', () => {
  it('round-trips an assembled PC, monitor, installed OS and owned inventory over actual slots', async () => {
    const canonical = legacyModularToCanonical(createScrapYardBundle());
    const initial = new SimulationEngine({
      computer: canonical.computer,
      display: canonical.display,
      os: { currentOsId: 'Orion_4.8', installedPatchIds: [] },
      inventory: {
        items: [{
          instanceId: 'owned:monitor:0',
          catalogItemId: canonical.display.monitor!.id,
          kind: 'display',
          location: 'installed',
        }],
        purchaseCounts: {},
      },
    } as any);
    await saveSlot(initial, 'canonical_pc');
    const snapshot = (await loadSlotSnapshot('canonical_pc'))!;
    expect(snapshot).not.toBeNull();
    expect(snapshot.computer!.assembled).toBe(true);
    expect(snapshot.computer!.cpu?.id).toBe(canonical.computer.cpu?.id);
    expect(snapshot.display!.monitor?.id).toBe(canonical.display.monitor?.id);
    expect(snapshot.os.currentOsId).toBe('Orion_4.8');
    expect(snapshot.inventory!.items).toContainEqual({
      instanceId: 'owned:monitor:0',
      catalogItemId: canonical.display.monitor!.id,
      kind: 'display',
      location: 'installed',
    });
    const restored = new SimulationEngine(snapshot);
    expect(restored.hardware.getState().hasComputer).toBe(true);
    expect(restored.os.getCurrentOsId()).toBe('Orion_4.8');
    expect(restored.exportSnapshot().inventory.items).toEqual(snapshot.inventory!.items);
  });

  it('keeps inserted-media identity and inventory ownership in a current save', async () => {
    const canonical = legacyModularToCanonical(createScrapYardBundle());
    const sim = new SimulationEngine({
      computer: { ...canonical.computer, insertedMediaId: 'owned:inserted-cd' },
      display: canonical.display,
      os: { currentOsId: 'Orion_4.8', installedPatchIds: [] },
      inventory: { items: [{
        instanceId: 'owned:inserted-cd', catalogItemId: 'disc_orion_48_recovery',
        kind: 'media', location: 'inserted',
      }], purchaseCounts: {} },
    } as any);
    await saveSlot(sim, 'inserted_cd');
    const snapshot = (await loadSlotSnapshot('inserted_cd'))!;
    expect(snapshot.computer!.insertedMediaId).toBe('owned:inserted-cd');
    expect(snapshot.inventory!.items).toContainEqual({
      instanceId: 'owned:inserted-cd', catalogItemId: 'disc_orion_48_recovery',
      kind: 'media', location: 'inserted',
    });
  });
});
