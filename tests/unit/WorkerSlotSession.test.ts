// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentPulseSlotId, getPulseSlotStorageKey, setCurrentPulseSlotId } from '../../src/apps/pulse/persistence';
import { saveBrowserSimulationSlot } from '../../src/simulation/host/WorkerSlotSession';
import type { WorkerSimulationHost } from '../../src/simulation/host/WorkerSimulationHost';

beforeEach(() => {
  localStorage.clear();
  setCurrentPulseSlotId('slot_1');
});

describe('#175 UI-only Pulse moment follows canonical Worker save targets', () => {
  it('copies current-slot UI metadata into Save As target without switching active Pulse', async () => {
    localStorage.setItem(getPulseSlotStorageKey('slot_1'), JSON.stringify({ marker: 'source' }));
    localStorage.setItem(getPulseSlotStorageKey('slot_2'), JSON.stringify({ marker: 'stale-target' }));
    const saveSlot = vi.fn(async () => ({ id: 'slot_2' }));
    const host = { saveSlot } as unknown as WorkerSimulationHost;
    await saveBrowserSimulationSlot(host, 'slot_2');
    expect(saveSlot).toHaveBeenCalledWith('slot_2', {
      pulseSlotId: 'slot_2', pulsePayload: { marker: 'source' },
    }, undefined);
    expect(JSON.parse(localStorage.getItem(getPulseSlotStorageKey('slot_2'))!))
      .toEqual({ marker: 'source' });
    expect(getCurrentPulseSlotId()).toBe('slot_1');
  });

  it('autosave stores its own named copy without switching the live UI identity', async () => {
    localStorage.setItem(getPulseSlotStorageKey('slot_1'), JSON.stringify({ marker: 'current' }));
    const saveSlot = vi.fn(async () => ({ id: 'autosave' }));
    await saveBrowserSimulationSlot({ saveSlot } as unknown as WorkerSimulationHost, 'autosave');
    expect(saveSlot).toHaveBeenCalledWith('autosave', {
      pulseSlotId: 'autosave', pulsePayload: { marker: 'current' },
    }, undefined);
    expect(getCurrentPulseSlotId()).toBe('slot_1');
    expect(localStorage.getItem(getPulseSlotStorageKey('autosave'))).toContain('current');
  });

  it('never commits an optimistic UI target when the Worker transaction fails', async () => {
    localStorage.setItem(getPulseSlotStorageKey('slot_1'), JSON.stringify({ marker: 'current' }));
    const host = {
      saveSlot: async () => { throw new Error('transaction aborted'); },
    } as unknown as WorkerSimulationHost;
    await expect(saveBrowserSimulationSlot(host, 'slot_3')).rejects.toThrow('transaction aborted');
    expect(localStorage.getItem(getPulseSlotStorageKey('slot_3'))).toBeNull();
    expect(getCurrentPulseSlotId()).toBe('slot_1');
  });
});
