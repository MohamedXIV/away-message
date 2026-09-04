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
} from '../../src/persistence/slots';
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

    // Wipe and restore — the moment comes back into its own slot key
    delete store[getPulseSlotStorageKey('slot_1')];
    await restoreSlotPulse('slot_1');
    expect(store[getPulseSlotStorageKey('slot_1')]).toContain('pulse-moment-1');
  });
});
