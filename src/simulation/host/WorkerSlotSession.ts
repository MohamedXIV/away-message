import { getCurrentPulseSlotId, getPulseSlotStorageKey } from '../../apps/pulse/persistence';
import { restoreSlotPulse, type SlotSummary } from '../../persistence/slots';
import { WorkerSimulationHost } from './WorkerSimulationHost';

/**
 * Browser UI owns its localStorage-only Pulse presentation moment; Worker
 * owns the one canonical simulation plus IndexedDB save and cold-page reader.
 * Only this small UI payload crosses the wire during an explicit save.
 */
function capturePulseMoment(): { pulseSlotId: string; pulsePayload: unknown } {
  const pulseSlotId = getCurrentPulseSlotId();
  let pulsePayload: unknown = null;
  try {
    const raw = window.localStorage.getItem(getPulseSlotStorageKey(pulseSlotId))
      ?? window.localStorage.getItem('away_message_pulse_state_v1');
    if (raw) pulsePayload = JSON.parse(raw);
  } catch {
    // A broken UI-only cache cannot corrupt the authoritative world save.
  }
  return { pulseSlotId, pulsePayload };
}

/** Explicit save: one worker transaction writes document + archived pages. */
export async function saveBrowserSimulationSlot(
  host: WorkerSimulationHost, slotId: string, saveName?: string,
): Promise<SlotSummary> {
  return host.saveSlot(slotId, capturePulseMoment(), saveName);
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
