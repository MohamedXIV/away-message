// v6 save-document facade.
// Historical v2->v5 migrations are preserved byte-for-byte in slotsV5Core.ts.
// This file owns only the current format, v6 summary shape, and v6 chaining.

export * from './slotsV5Core';

import { db } from './db';
import {
  splitConversationArchive, hydrateConversationArchive, isConversationArchiveManifest,
  RECENT_CONVERSATION_MESSAGES, CONVERSATION_ARCHIVE_PAGE_SIZE, conversationArchivePageKey,
  readSavedColdConversationChunk,
} from './conversationArchive';
import type { ConversationColdIndex } from '../engine/social/ConversationHistory';
import type { SaveSlotRecord } from './schema';
import type { SimulationState } from '../engine/types';
import { SimulationEngine } from '../engine/SimulationEngine';
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
  engine: Pick<SimulationEngine, 'exportSnapshot'> & Partial<Pick<SimulationEngine,
    'exportSnapshotAsync' | 'rebindColdConversationReader'>>,
  slotId: string,
  saveName?: string,
): Promise<SlotSummary> {
  const snapshot = await (engine.exportSnapshotAsync?.() ?? engine.exportSnapshot()) as SimulationState;
  const { recent, pages, manifest } = splitConversationArchive(slotId, snapshot.social.conversations);
  // Only the last 32 messages/contact remain in the document; older history
  // is stored once in slot-bound IndexedDB archive pages. Live source unchanged.
  const compactSnapshot: SimulationState = {
    ...snapshot, social: { ...snapshot.social, conversations: recent },
  };
  const pulseSlotId = getCurrentPulseSlotId();
  // Generate the slot version *within* the same write transaction to avoid
  // two overlapping saves assigning the same cold-reader generation.
  const committed = await db.transaction('rw', db.saves, db.conversation_pages, async () => {
    const existing = await db.saves.get(slotId);
    const now = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1);
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
      conversationArchive: manifest,
    },
    snapshot: compactSnapshot,
  };

    // Atomic document + archive replacement: a failed page write rolls back both.
    await db.conversation_pages.where('slotId').equals(slotId).delete();
    if (pages.length > 0) await db.conversation_pages.bulkPut(pages);
    await db.saves.put(record);
    return { summary: toSummary(record), updatedAt: now };
  });
  // The existing in-memory cold owner remains authoritative. Rebind its
  // immutable prefix only when this save overwrote its source slot; a new
  // generation must never leave a live reader pointing at deleted pages.
  engine.rebindColdConversationReader?.(slotId, (id, pageIndex) =>
    readSavedColdConversationChunk(slotId, id, pageIndex, committed.updatedAt));
  return committed.summary;
}

/** Load and deterministically chain any supported document through v4/v5/v6. */
export async function loadSlotSnapshot(slotId: string): Promise<SimulationState | null> {
  try {
    // Snapshot and cold pages must be read from the SAME committed save.
    const loaded = await db.transaction('r', db.saves, db.conversation_pages, async () => {
      const record = await db.saves.get(slotId);
      if (checkSaveCompatibility(record).status !== 'ok') return null;
      const snapshot = record?.snapshot;
      if (!snapshot || typeof snapshot !== 'object') return null;
      const rawArchive = record.meta?.conversationArchive;
      if (rawArchive === undefined) return { snapshot, version: record.version ?? SAVE_FORMAT_VERSION };
      if (!isConversationArchiveManifest(rawArchive)) return null;
      const pages = await db.conversation_pages.where('slotId').equals(slotId).toArray();
      const conversations = hydrateConversationArchive(
        slotId, snapshot.social.conversations, rawArchive, pages,
      );
      if (!conversations) return null;
      return {
        snapshot: { ...snapshot, social: { ...snapshot.social, conversations } },
        version: record.version ?? SAVE_FORMAT_VERSION,
      };
    });
    if (!loaded) return null;
    const sourceVersion = loaded.version;
    let upgraded = loaded.snapshot as SimulationState;
    if (sourceVersion < 4) upgraded = migrateSnapshotToV4(upgraded, sourceVersion);
    if (sourceVersion < 5) upgraded = migrateSnapshotToV5(upgraded, sourceVersion);
    if (sourceVersion < 6) upgraded = migrateSnapshotToV6(upgraded, sourceVersion);
    return upgraded;
  } catch {
    return null;
  }
}


/**
 * #173 cold-load seam. Unlike loadSlotSnapshot this does NOT hydrate old chat
 * bodies; it returns a snapshot containing only the saved 32-message tails
 * and owner-derived small indices needed for the future async Social adapter.
 *
 * A complete inventory of expected archive page KEYS is checked without
 * reading historical message values. Page contents remain verified by
 * readSavedConversationPage when requested; missing keys fail closed now.
 *
 * Never construct a live engine from this partial snapshot without attaching
 * a matching, generation-guarded cold reader via loadSlotEngine.
 */
export async function loadSlotColdBootstrap(slotId: string): Promise<{
  snapshot: SimulationState;
  archive: { slotId: string; updatedAt: number; counts: Record<string, number>;
    indexes: Record<string, ConversationColdIndex> };
} | null> {
  try {
    return await db.transaction('r', db.saves, db.conversation_pages, async () => {
      const record = await db.saves.get(slotId);
      if (checkSaveCompatibility(record).status !== 'ok') return null;
      const snapshot = record?.snapshot;
      const raw = record?.meta?.conversationArchive;
      if (!snapshot || !isConversationArchiveManifest(raw) || !raw.indexes) return null;
      const savedIds = Object.keys(snapshot.social.conversations);
      if (savedIds.length !== Object.keys(raw.counts).length) return null;
      for (const id of savedIds) {
        const recent = snapshot.social.conversations[id];
        if (!Object.hasOwn(raw.counts, id) || !Array.isArray(recent)
          || recent.length > RECENT_CONVERSATION_MESSAGES) return null;
        const index = raw.indexes[id];
        if (!index || index.anyUnread > raw.counts[id]! + recent.length
          || index.unread > raw.counts[id]! + recent.length) return null;
      }
      const keys = await db.conversation_pages.where('slotId').equals(slotId).primaryKeys();
      const expected = new Set<string>();
      for (const [conversationId, count] of Object.entries(raw.counts)) {
        for (let page = 0; page < Math.ceil(count / CONVERSATION_ARCHIVE_PAGE_SIZE); page++) {
          expected.add(conversationArchivePageKey(slotId, conversationId, page));
        }
      }
      if (keys.length !== expected.size || keys.some(key => !expected.has(String(key)))) return null;
      return {
        snapshot,
        archive: { slotId, updatedAt: record.updatedAt,
          counts: { ...raw.counts }, indexes: raw.indexes },
      };
    });
  } catch {
    return null;
  }
}

/**
 * Production boot. The single Social owner starts with a bounded recent tail,
 * canonical derived indices and a validated slot-scoped cold reader. Older
 * index-free save documents use the existing explicit eager load path.
 * A malformed/unavailable archive cannot silently produce a playable game.
 */
export async function loadSlotEngine(slotId: string): Promise<SimulationEngine | null> {
  const boot = await loadSlotColdBootstrap(slotId);
  if (boot) {
    const engine = new SimulationEngine(boot.snapshot);
    engine.social.attachColdConversations(
      boot.snapshot.social.conversations,
      boot.archive.counts,
      boot.archive.indexes,
      (id, pageIndex) =>
        readSavedColdConversationChunk(slotId, id, pageIndex, boot.archive.updatedAt),
      slotId,
    );
    // The source must still be the same committed slot after engine construction.
    // Future pages independently recheck this generation in each read transaction.
    const current = await db.saves.get(slotId);
    if (current?.updatedAt !== boot.archive.updatedAt) return null;
    return engine;
  }
  const snapshot = await loadSlotSnapshot(slotId);
  return snapshot ? new SimulationEngine(snapshot) : null;
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
