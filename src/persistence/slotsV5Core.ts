import { db } from './db';
import type { SaveSlotRecord } from './schema';
import type { SimulationState } from '../engine/types';
import type { SimulationEngine } from '../engine/SimulationEngine';
import { traitsForBuddy, resolveArchetype } from '../engine/characterTemplates';
import type { CharacterArchetype, CharacterTraits } from '../engine/types';
import { APP_VERSION } from '../version';
import {
  getCurrentPulseSlotId,
  setCurrentPulseSlotId,
  getPulseSlotStorageKey,
} from '../apps/pulse/persistence';

// P9 save slots: one Dexie document per slot = full engine snapshot +
// the Pulse UI moment it was saved with. Slots double as Pulse timelines
// (slot_1..3); autosave rides along without touching Pulse selection.
//
// VERSIONING (two independent numbers — do not conflate):
// - APP_VERSION (package.json SemVer): which game build wrote the save. Diagnostics only.
// - Save-FORMAT version (record.version): shape of the document itself.
//   CURRENT = 5, MIN_SUPPORTED = 2 (v2/v3/v4 docs share the snapshot shape and are
//   UPGRADED on load by migrateSnapshotToV4/V5 below — deterministic backfills only).
//   Older multi-table saves (no snapshot) predate this system and are refused
//   with a clear message. Newer-than-current is ALWAYS refused (silent corruption
//   is worse than an honest error).
// - NOTE: schema.ts MIGRATIONS[] governs legacy Dexie TABLE rows, not documents.
//   Breaking document changes: bump SAVE_FORMAT_VERSION here + add a migration
//   path in checkSaveCompatibility + one CHANGELOG line. No exceptions.
// - v4 adds Character Lives: fixed buddy traits, 4 extra relationship dims,
//   directed NPC<->NPC bonds, per-buddy agenda, player mediations, witness log.
// - v5 adds Modular Hardware & Retail OS CDs: hasComputer state, component
//   swaps (CPU, RAM sticks, HDD, Optical, Sound, Modem, Monitor), and retro OS setup.

export const SAVE_FORMAT_VERSION = 5;
export const SAVE_FORMAT_MIN_SUPPORTED = 2;

export type SaveCompatibility =
  | { status: 'ok' }
  | { status: 'legacy'; reason: string }
  | { status: 'refused'; reason: string };

export function checkSaveCompatibility(record: SaveSlotRecord | undefined | null): SaveCompatibility {
  if (!record) return { status: 'refused', reason: 'No save data found.' };
  if (!(record as SaveSlotRecord).snapshot || typeof (record as SaveSlotRecord).snapshot !== 'object') {
    return {
      status: 'legacy',
      reason: 'This save predates the snapshot format and cannot be loaded by this version.',
    };
  }
  const version = (record as SaveSlotRecord).version ?? 0;
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
      modular: snapshot.hardware.modular as unknown as Record<string, unknown>,
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

/** Load a slot's engine snapshot (null when missing or incompatible). */
export async function loadSlotSnapshot(slotId: string): Promise<SimulationState | null> {
  try {
    const record = await db.saves.get(slotId);
    if (checkSaveCompatibility(record).status !== 'ok') return null;
    const snapshot = (record as SaveSlotRecord).snapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const version = (record as SaveSlotRecord).version ?? SAVE_FORMAT_VERSION;
    // Migration path (see header): pre-v5 snapshots are upgraded
    // deterministically — never refused, never silently corrupted.
    if (version < SAVE_FORMAT_VERSION) {
      let upgraded = snapshot as SimulationState;
      if (version < 4) {
        upgraded = migrateSnapshotToV4(upgraded, version);
      }
      if (version < 5) {
        upgraded = migrateSnapshotToV5(upgraded, version);
      }
      return upgraded;
    }
    return snapshot as SimulationState;
  } catch {
    return null;
  }
}

/**
 * Upgrade a pre-v4 engine snapshot to the v4 shape (pure — never mutates input).
 * - v3 and earlier lack: buddy traits, affection/attraction/suspicion/resentment
 *   dims, npcBonds, agenda, mediations, npcSocialLog.
 * - Traits for persisted procedural defs are derived exactly as
 *   buildCharacter()/validatePersistedBuddy would roll them (archetype base +
 *   stable id jitter); core 4 are code-owned and re-seeded with hand-authored
 *   traits, so nothing is needed for them here.
 * - New relationship dims start at 0 (honest neutral); bonds/agenda/mediations
 *   start empty and fill through play. No randomness, no AI, no wall-clock.
 */
export function migrateSnapshotToV4(snapshot: SimulationState, fromVersion: number): SimulationState {
  void fromVersion;
  const social = (snapshot as SimulationState).social ?? ({} as SimulationState['social']);
  const buddies = { ...(social.buddies ?? {}) };
  for (const [id, def] of Object.entries(buddies)) {
    const d = def as unknown as Record<string, unknown>;
    if (d && typeof d === 'object' && !d.traits) {
      buddies[id] = { ...def, traits: traitsForBuddySnapshot(String(id), d) };
    }
  }
  const relationships: Record<string, SimulationState['social']['relationships'][string]> = {};
  for (const [id, rel] of Object.entries(social.relationships ?? {})) {
    const r = (rel ?? {}) as unknown as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0);
    relationships[id] = {
      familiarity: num(r.familiarity),
      trust: num(r.trust),
      comfort: num(r.comfort),
      respect: num(r.respect),
      annoyance: num(r.annoyance),
      affection: num(r.affection),
      attraction: num(r.attraction),
      suspicion: num(r.suspicion),
      resentment: num(r.resentment),
    };
  }
  const player = ((snapshot as SimulationState).player ?? {}) as unknown as Record<string, unknown>;
  const battery = typeof player.socialBattery === 'number' && Number.isFinite(player.socialBattery)
    ? Math.max(0, Math.min(100, Math.round(player.socialBattery)))
    : 100;
  return {
    ...(snapshot as object),
    player: { ...player, socialBattery: battery },
    social: {
      ...social,
      buddies,
      relationships,
      npcBonds: { ...(social.npcBonds ?? {}) },
      agenda: { ...(social.agenda ?? {}) },
      mediations: Array.isArray(social.mediations) ? [...social.mediations] : [],
      npcSocialLog: Array.isArray(social.npcSocialLog) ? [...social.npcSocialLog] : [],
      playerReads: { ...(social.playerReads ?? {}) },
    },
  } as SimulationState;
}

/** Archetype-base traits for a persisted def (stable; mirrors CharacterEngine backfill). */
function traitsForBuddySnapshot(id: string, def: Record<string, unknown>): CharacterTraits {
  const stored = typeof def.archetype === 'string' ? (def.archetype as CharacterArchetype) : undefined;
  const base = traitsForBuddy(id, resolveArchetype(id, stored));
  const jitter = (dim: string): number => {
    let h = 0;
    const s = `${id}:trait:${dim}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h % 11) - 5;
  };
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    shyness: clamp(base.shyness + jitter('shyness')),
    warmth: clamp(base.warmth + jitter('warmth')),
    discipline: clamp(base.discipline + jitter('discipline')),
    spontaneity: clamp(base.spontaneity + jitter('spontaneity')),
    loyalty: clamp(base.loyalty + jitter('loyalty')),
  };
}

/**
 * Upgrade a pre-v5 engine snapshot to the v5 shape (pure — never mutates input).
 * - v4 and earlier lack: hasComputer flag, modular hardware state.
 * - For existing saves, the player already had a computer and was using it, so
 *   hasComputer defaults to true to preserve their existing save playthrough.
 * - Modular hardware is backfilled using the legacy hardware state (CPU tier, RAM,
 *   HDD capacity/free, network card) so hardware inspection and OS requirements
 *   seamlessly function.
 */
export function migrateSnapshotToV5(snapshot: SimulationState, fromVersion: number): SimulationState {
  void fromVersion;
  const hardware = (snapshot as SimulationState).hardware ?? ({} as SimulationState['hardware']);
  if (hardware.hasComputer !== undefined && hardware.modular) {
    return snapshot;
  }

  const hasComputer = hardware.hasComputer !== undefined ? hardware.hasComputer : true;
  let modular = hardware.modular;

  if (!modular && hasComputer) {
    // Construct deterministic modular hardware matching existing save specs
    const ramMb = typeof hardware.ramMB === 'number' && hardware.ramMB > 0 ? hardware.ramMB : 512;
    const hddTotal = typeof hardware.hddTotalGB === 'number' && hardware.hddTotalGB > 0 ? hardware.hddTotalGB : 40.0;
    const hddFree = typeof hardware.hddFreeGB === 'number' && hardware.hddFreeGB >= 0 ? hardware.hddFreeGB : 7.0;

    modular = {
      hasComputer: true,
      isPoweredOn: true,
      motherboard: {
        id: 'mb_standard_atx',
        name: 'Standard ATX Slot-1 Board',
        ramSlots: 2,
        maxRamMbPerSlot: 512,
        cpuSocket: 'Slot-1',
      },
      cpu: {
        id: hardware.cpuTier === 2 ? 'cpu_pentium3_800' : 'cpu_celeron_450',
        name: hardware.cpuName || (hardware.cpuTier === 2 ? 'Orion P-III 800 MHz' : 'Single-Core Orion x86 450MHz'),
        tier: (hardware.cpuTier === 2 ? 2 : 1) as 1 | 2 | 3,
        clockMhz: hardware.cpuTier === 2 ? 800 : 450,
        socket: 'Slot-1',
        throughputUnits: hardware.cpuTier === 2 ? 2.0 : 1.0,
      },
      ramSticks: [
        {
          id: `ram_stick_migrated_${ramMb}`,
          name: `${ramMb}MB SDRAM`,
          sizeMb: ramMb,
        },
      ],
      storage: {
        id: 'hdd_migrated',
        name: `${hddTotal} GB IDE Hard Drive`,
        capacityBytes: Math.round(hddTotal * 1_000_000_000),
        freeBytes: Math.round(hddFree * 1_000_000_000),
        rpm: 5400,
        throughputUnits: 1.0,
      },
      opticalDrive: {
        id: 'optical_cdrom_24x',
        name: '24x IDE CD-ROM Drive',
        type: 'cd_rom',
        speedMultiplier: 24,
      },
      soundCard: {
        id: 'sound_sb16',
        name: 'SoundBlaster 16 ISA',
        tier: 'sb16',
        richAudio: true,
        midiSupport: true,
      },
      networkCard: {
        id: 'nic_migrated',
        name: hardware.connectionType === 'dialup_56k' ? 'V.90 56k Dial-Up Voice/Fax Modem' : 'PCI Fast Ethernet Adapter',
        type: hardware.connectionType || 'dsl_256k',
        speedKbps: hardware.connectionSpeedKbps || 256,
      },
      monitor: {
        id: 'mon_standard_15',
        name: '15" Standard CRT Monitor',
        type: 'crt_standard_15',
        curvature: 0.7,
        scanlineIntensity: 0.5,
        bloomIntensity: 0.4,
        flicker: true,
      },
      insertedDisc: null,
    };
  }

  return {
    ...(snapshot as object),
    hardware: {
      ...hardware,
      hasComputer,
      modular,
    },
  } as SimulationState;
}

/** Compatibility verdict for UI badges (menu shows refused/legacy explicitly). */
export async function slotCompatibility(slotId: string): Promise<SaveCompatibility> {
  try {
    const record = await db.saves.get(slotId);
    return checkSaveCompatibility(record);
  } catch {
    return { status: 'refused', reason: 'Storage unavailable.' };
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
