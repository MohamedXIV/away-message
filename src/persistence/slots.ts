// v6 save-document facade.
// Historical v2->v5 migrations are preserved byte-for-byte in slotsV5Core.ts.
// This file owns only the current format, v6 summary shape, and v6 chaining.

export * from './slotsV5Core';

import { db } from './db';
import type { SaveSlotRecord } from './schema';
import type { SimulationState } from '../engine/types';
import type { SimulationEngine } from '../engine/SimulationEngine';
import { APP_VERSION } from '../version';
import {
  getCurrentPulseSlotId,
  getPulseSlotStorageKey,
} from '../apps/pulse/persistence';
import {
  migrateSnapshotToV4,
  migrateSnapshotToV5,
  type SaveCompatibility,
  type SlotSummary,
} from './slotsV5Core';
import { migrateSnapshotToV6 } from './migrations/v6ComputerState';

export const SAVE_FORMAT_VERSION = 6;
export const SAVE_FORMAT_MIN_SUPPORTED = 2;

function readPulsePayload(slotId: string): unknown {
  try {
    const raw = window.localStorage.getItem(getPulseSlotStorageKey(slotId));
    if (raw) return JSON.parse(raw);
    const legacy = window.localStorage.getItem('away_message_pulse_state_v1');
    if (legacy && slotId === getCurrentPulseSlotId()) return JSON.parse(legacy);
  } catch {
    // Pulse payload is best-effort; the engine snapshot remains authoritative.
  }
  return null;
}

function toSummary(record: SaveSlotRecord): SlotSummary {
  return {
    id: record.id,
    name: record.name,
    day: record.day,
    totalMinutes: record.totalMinutes,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
    hasSnapshot: Boolean(record.snapshot),
  };
}

export function checkSaveCompatibility(record: SaveSlotRecord | undefined | null): SaveCompatibility {
  if (!record) return { status: 'refused', reason: 'No save data found.' };
  if (!record.snapshot || typeof record.snapshot !== 'object') {
    return {
      status: 'legacy',
      reason: 'This save predates the snapshot format and cannot be loaded by this version.',
    };
  }

  const version = record.version ?? 0;
  if (version > SAVE_FORMAT_VERSION) {
    return {
      status: 'refused',
      reason: `Saved by a newer game (format v${version}, this game reads up to v${SAVE_FORMAT_VERSION}). Update the game to load it.`,
    };
  }
  if (version < SAVE_FORMAT_MIN_SUPPORTED) {
    return {
      status: 'refused',
      reason: `Save format v${version} is no longer supported (minimum v${SAVE_FORMAT_MIN_SUPPORTED}).`,
    };
  }
  return { status: 'ok' };
}

/** Persist the canonical v6 engine snapshot (+ current Pulse moment) into a slot. */
export async function saveSlot(
  engine: Pick<SimulationEngine, 'exportSnapshot'>,
  slotId: string,
  saveName?: string,
): Promise<SlotSummary> {
  const snapshot = engine.exportSnapshot() as SimulationState;
  const now = Date.now();
  const existing = await db.saves.get(slotId).catch(() => undefined);
  const pulseSlotId = getCurrentPulseSlotId();

  const record: SaveSlotRecord = {
    id: slotId,
    name: saveName || `Day ${snapshot.time.day} • ${snapshot.time.timeOfDay}`,
    version: SAVE_FORMAT_VERSION,
    appVersion: APP_VERSION,
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
      socialBattery: snapshot.player.socialBattery ?? 100,
      rentDueDay: snapshot.player.rentDueDay,
      rentAmount: snapshot.player.rentAmount,
      rentPaid: snapshot.player.rentPaid,
      consecutiveLateWarnings: 0,
    },
    hardwareState: {
      hasComputer: snapshot.hardware.hasComputer,
      cpuTier: snapshot.hardware.cpuTier,
      ramMB: snapshot.hardware.ramMB,
      hddTotalGB: snapshot.hardware.hddTotalGB,
      hddFreeGB: snapshot.hardware.hddFreeGB,
      connectionType: snapshot.hardware.connectionType,
      connectionSpeedKbps: snapshot.hardware.connectionSpeedKbps,
      osVersion: snapshot.os.currentOsId,
      theme: snapshot.os.currentOsId ? 'orion' : 'none',
      wallpaper: 'default',
    },
    narrativeFlags: { ...snapshot.world.flags },
    meta: {
      pulseSlotId,
      pulsePayload: readPulsePayload(pulseSlotId),
    },
    snapshot,
  };

  await db.saves.put(record);
  return toSummary(record);
}

/** Load and deterministically chain any supported document through v4/v5/v6. */
export async function loadSlotSnapshot(slotId: string): Promise<SimulationState | null> {
  try {
    const record = await db.saves.get(slotId);
    if (checkSaveCompatibility(record).status !== 'ok') return null;
    const snapshot = record?.snapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;

    const sourceVersion = record.version ?? SAVE_FORMAT_VERSION;
    let upgraded = snapshot as SimulationState;
    if (sourceVersion < 4) upgraded = migrateSnapshotToV4(upgraded, sourceVersion);
    if (sourceVersion < 5) upgraded = migrateSnapshotToV5(upgraded, sourceVersion);
    if (sourceVersion < 6) upgraded = migrateSnapshotToV6(upgraded, sourceVersion);
    return upgraded;
  } catch {
    return null;
  }
}

/** Compatibility verdict using the current v6 document range. */
export async function slotCompatibility(slotId: string): Promise<SaveCompatibility> {
  try {
    const record = await db.saves.get(slotId);
    return checkSaveCompatibility(record);
  } catch {
    return { status: 'refused', reason: 'Storage unavailable.' };
  }
}
