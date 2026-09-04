import { db } from './db';
import type { SaveSlotRecord } from './schema';
import type { SimulationState } from '../engine/types';
import type { SimulationEngine } from '../engine/SimulationEngine';
import {
  getCurrentPulseSlotId,
  setCurrentPulseSlotId,
  getPulseSlotStorageKey,
} from '../apps/pulse/persistence';

// P9 save slots: one Dexie document per slot = full engine snapshot +
// the Pulse UI moment it was saved with. Slots double as Pulse timelines
// (slot_1..3); autosave rides along without touching Pulse selection.

export const SAVE_SLOTS = ['slot_1', 'slot_2', 'slot_3'] as const;
export const AUTOSAVE_ID = 'autosave';
const BOOT_KEY = 'away_message_boot_v1';

export interface BootRequest {
  kind: 'new' | 'slot';
  slotId: string;
}

export interface SlotSummary {
  id: string;
  name: string;
  day: number;
  totalMinutes: number;
  updatedAt: number;
  createdAt: number;
  hasSnapshot: boolean;
}

function readPulsePayload(slotId: string): unknown {
  try {
    const raw = window.localStorage.getItem(getPulseSlotStorageKey(slotId));
    if (raw) return JSON.parse(raw);
    const legacy = window.localStorage.getItem('away_message_pulse_state_v1');
    if (legacy && slotId === getCurrentPulseSlotId()) return JSON.parse(legacy);
  } catch { /* best-effort */ }
  return null;
}

function writePulsePayload(slotId: string, payload: unknown): void {
  try {
    window.localStorage.setItem(getPulseSlotStorageKey(slotId), JSON.stringify(payload ?? {}));
    if (slotId === getCurrentPulseSlotId()) {
      window.localStorage.setItem('away_message_pulse_state_v1', JSON.stringify(payload ?? {}));
    }
  } catch { /* best-effort */ }
}

function toSummary(record: SaveSlotRecord): SlotSummary {
  return {
    id: record.id,
    name: record.name,
    day: record.day,
    totalMinutes: record.totalMinutes,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
    hasSnapshot: Boolean((record as SaveSlotRecord).snapshot),
  };
}

/** Persist the live engine (+ current Pulse moment) into a slot. */
export async function saveSlot(
  engine: Pick<SimulationEngine, 'exportSnapshot'>,
  slotId: string,
  saveName?: string
): Promise<SlotSummary> {
  const snapshot = engine.exportSnapshot() as SimulationState;
  const now = Date.now();
  const existing = await db.saves.get(slotId).catch(() => undefined);
  const pulseSlotId = getCurrentPulseSlotId();
  const record: SaveSlotRecord = {
    id: slotId,
    name: saveName || `Day ${snapshot.time.day} • ${snapshot.time.timeOfDay}`,
    version: 2,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    day: snapshot.time.day,
    totalMinutes: snapshot.time.totalMinutes,
    clockState: {
      day: snapshot.time.day,
      hour: snapshot.time.hour,
      minute: snapshot.time.minute,
      totalMinutes: snapshot.time.totalMinutes,
      timeOfDay: snapshot.time.timeOfDay,
      isPaused: false,
    },
    playerState: {
      cash: snapshot.player.cash,
      energy: snapshot.player.energy,
      fatigue: snapshot.player.fatigue,
      rentDueDay: snapshot.player.rentDueDay,
      rentAmount: snapshot.player.rentAmount,
      rentPaid: snapshot.player.rentPaid,
      consecutiveLateWarnings: 0,
    },
    hardwareState: {
      cpuTier: snapshot.hardware.cpuTier,
      ramMB: snapshot.hardware.ramMB,
      hddTotalGB: snapshot.hardware.hddTotalGB,
      hddFreeGB: snapshot.hardware.hddFreeGB,
      connectionType: snapshot.hardware.connectionType,
      connectionSpeedKbps: snapshot.hardware.connectionSpeedKbps,
      osVersion: String((snapshot.hardware as unknown as { osVersion: unknown }).osVersion ?? ''),
      theme: 'orion',
      wallpaper: 'default',
    },
    narrativeFlags: { ...(snapshot.world.flags as Record<string, boolean | number | string>) },
    meta: {
      pulseSlotId,
      pulsePayload: readPulsePayload(pulseSlotId),
    },
    snapshot,
  };
  await db.saves.put(record);
  return toSummary(record);
}

/** Load a slot's engine snapshot (null when missing/legacy). */
export async function loadSlotSnapshot(slotId: string): Promise<SimulationState | null> {
  try {
    const record = await db.saves.get(slotId);
    const snapshot = (record as SaveSlotRecord | undefined)?.snapshot;
    if (!record || !snapshot || typeof snapshot !== 'object') return null;
    return snapshot as SimulationState;
  } catch {
    return null;
  }
}

/** Restore the Pulse moment saved with a slot (no-op when absent). */
export async function restoreSlotPulse(slotId: string): Promise<void> {
  try {
    const record = await db.saves.get(slotId);
    const meta = (record as SaveSlotRecord | undefined)?.meta as
      | { pulseSlotId?: string; pulsePayload?: unknown }
      | undefined;
    if (meta && typeof meta.pulseSlotId === 'string' && meta.pulsePayload) {
      setCurrentPulseSlotId(meta.pulseSlotId);
      writePulsePayload(meta.pulseSlotId, meta.pulsePayload);
    }
  } catch { /* best-effort */ }
}

export async function listSlots(): Promise<SlotSummary[]> {
  try {
    const records = await db.saves.orderBy('updatedAt').reverse().toArray();
    return records.map(toSummary);
  } catch {
    return [];
  }
}

export async function deleteSlot(slotId: string): Promise<void> {
  try {
    await db.saves.delete(slotId);
  } catch { /* best-effort */ }
}

export async function hasAnySave(): Promise<boolean> {
  try {
    const count = await db.saves.count();
    return count > 0;
  } catch {
    return false;
  }
}

/** Most recently updated slot snapshot (autosave included), if any. */
export async function mostRecentSlot(): Promise<SlotSummary | null> {
  const slots = await listSlots();
  return slots.find((s) => s.hasSnapshot) ?? null;
}

// Boot handshake across the reload boundary (menu → game).
export function requestBoot(request: BootRequest): void {
  try {
    window.localStorage.setItem(BOOT_KEY, JSON.stringify(request));
  } catch { /* ignore */ }
  window.location.reload();
}

export function consumeBootRequest(): BootRequest | null {
  try {
    const raw = window.localStorage.getItem(BOOT_KEY);
    window.localStorage.removeItem(BOOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BootRequest>;
    if (parsed.kind === 'new') return { kind: 'new', slotId: 'slot_1' };
    if (parsed.kind === 'slot' && typeof parsed.slotId === 'string' && parsed.slotId) {
      return { kind: 'slot', slotId: parsed.slotId };
    }
    return null;
  } catch {
    return null;
  }
}
