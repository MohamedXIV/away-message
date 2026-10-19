import { getCurrentPulseSlotId, getPulseSlotStorageKey } from '../../apps/pulse/persistence';
import { restoreSlotPulse, type SlotSummary } from '../../persistence/slotUi';
import { WorkerSimulationHost } from './WorkerSimulationHost';

/**
 * Browser UI owns its localStorage-only Pulse presentation moment; Worker
 * owns the one canonical simulation plus IndexedDB save and cold-page reader.
 * Only this small UI payload crosses the wire during an explicit save.
 */
function capturePulseMoment(targetSlotId: string): { pulseSlotId: string; pulsePayload: unknown } {
  // Save As and autosave copy the CURRENT UI moment into the target slot.
  // Reading the destination's previous localStorage would silently restore
  // an unrelated Pulse history the next time that destination is loaded.
  const sourceSlotId = getCurrentPulseSlotId();
  let pulsePayload: unknown = null;
  try {
    const raw = window.localStorage.getItem(getPulseSlotStorageKey(sourceSlotId))
      ?? window.localStorage.getItem('away_message_pulse_state_v1');
    if (raw) pulsePayload = JSON.parse(raw);
  } catch {
    // A broken UI-only cache cannot corrupt the authoritative world save.
  }
  return { pulseSlotId: targetSlotId, pulsePayload };
}

/** Explicit save: one worker transaction writes document + archived pages. */
export async function saveBrowserSimulationSlot(
  host: WorkerSimulationHost, slotId: string, saveName?: string,
): Promise<SlotSummary> {
  const moment = capturePulseMoment(slotId);
  const result = await host.saveSlot(slotId, moment, saveName);
  // Mirror only after the canonical IDB transaction commits. In particular,
  // autosave must never change the active Pulse identity to 'autosave'.
  try {
    window.localStorage.setItem(getPulseSlotStorageKey(slotId), JSON.stringify(moment.pulsePayload ?? {}));
  } catch { /* UI-only cache is best effort; the committed slot owns its copy */ }
  return result;
}

/**
 * No main-thread SimulationKernel is ever constructed during this boot.
 * The Worker cold-loads the saved v6 snapshot and attaches the generation-
 * guarded IDB conversation reader before accepting any gameplay commands.
 */
export async function openBrowserSimulationSlot(slotId: string): Promise<WorkerSimulationHost> {
  const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
  const host = new WorkerSimulationHost(worker);
  try {
    await host.initializeSlot(slotId);
    await restoreSlotPulse(slotId);
    return host;
  } catch (error) {
    host.dispose();
    throw error;
  }
}
