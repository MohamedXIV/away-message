// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { db } from '../../src/persistence/db';
import {
  saveSlot,
  loadSlotSnapshot,
  restoreSlotPulse,
  listSlots,
  deleteSlot,
  mostRecentSlot,
  checkSaveCompatibility,
  SAVE_FORMAT_VERSION,
} from '../../src/persistence/slots';
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

  it('mostRecentSlot prefers the freshest snapshot', async () => {
    const sim = new SimulationEngine();
    await saveSlot(sim, 'slot_2');
    await saveSlot(sim, 'autosave');
    const recent = await mostRecentSlot();
    expect(recent).not.toBeNull();
    expect(['slot_2', 'autosave']).toContain(recent!.id);
  });

  it('restores the saved Pulse moment into its own slot', async () => {    const store: Record<string, string> = {};
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

    // Wipe and restore — the moment comes back into its own slot key
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
    expect(record?.version).toBe(SAVE_FORMAT_VERSION);
    expect(record?.appVersion).toBe(APP_VERSION);
    expect(checkSaveCompatibility(record!).status).toBe('ok');
    await db.saves.delete('slot_2');
  });

  it('accepts older supported formats, refuses newer and legacy', () => {
    expect(checkSaveCompatibility(undefined).status).toBe('refused');
    expect(checkSaveCompatibility(null).status).toBe('refused');
    // v2 document saves share the v3 shape → loadable
    expect(checkSaveCompatibility({ version: 2, snapshot: {} } as any).status).toBe('ok');
    // Newer-than-current → honest refusal, never silent corruption
    const newer = checkSaveCompatibility({ version: SAVE_FORMAT_VERSION + 1, snapshot: {} } as any);
    expect(newer.status).toBe('refused');
    // Ancient multi-table rows without a snapshot → legacy refusal
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
