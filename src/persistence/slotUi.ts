import { db } from './db';
import type { SaveSlotRecord } from './schema';
import {
  setCurrentPulseSlotId,
  getCurrentPulseSlotId,
  getPulseSlotStorageKey,
} from '../apps/pulse/persistence';

/**
 * UI/slot-selection helpers only. The sole persisted game writer/reader
 * is slots.ts. No v2-v5 save facade or simulation migration lives here.
 */
export const SAVE_SLOTS = ['slot_1', 'slot_2', 'slot_3'] as const;
export const AUTOSAVE_ID = 'autosave';
const BOOT_KEY = 'away_message_boot_v1';

export interface BootRequest {
  kind: 'new' | 'slot';
  slotId: string;
  housingOfferId?: string;
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

function writePulsePayload(slotId: string, payload: unknown): void {
  try {
    window.localStorage.setItem(getPulseSlotStorageKey(slotId), JSON.stringify(payload ?? {}));
    if (slotId === getCurrentPulseSlotId()) {
      window.localStorage.setItem('away_message_pulse_state_v1', JSON.stringify(payload ?? {}));
    }
  } catch { /* best-effort */ }
}

export function toSummary(record: SaveSlotRecord): SlotSummary {
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
  // #173: never strand another slot's history or delete a save without its
  // archive in the same transaction.
  await db.transaction('rw', db.saves, db.conversation_pages, async () => {
    await db.conversation_pages.where('slotId').equals(slotId).delete();
    await db.saves.delete(slotId);
  });
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
    if (parsed.kind === 'new') {
      return {
        kind: 'new',
        slotId: 'slot_1',
        ...(typeof parsed.housingOfferId === 'string' && parsed.housingOfferId
          ? { housingOfferId: parsed.housingOfferId }
          : {}),
      };
    }
    if (parsed.kind === 'slot' && typeof parsed.slotId === 'string' && parsed.slotId) {
      return { kind: 'slot', slotId: parsed.slotId };
    }
    return null;
  } catch {
    return null;
  }
}
