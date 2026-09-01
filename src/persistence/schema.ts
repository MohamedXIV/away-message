import { z } from 'zod';
import type Dexie from 'dexie';

// ==========================================
// 1. Database Table Entity Interfaces
// ==========================================

export interface SaveSlotRecord {
  id: string;                    // Primary key: 'slot_1', 'slot_2', 'autosave'
  name: string;                  // User-visible label: "Day 3 - Evening in Room"
  version: number;               // Schema version (e.g. 1)
  createdAt: number;             // Epoch ms
  updatedAt: number;             // Epoch ms
  day: number;                   // Game day (1..14)
  totalMinutes: number;          // Monotonic elapsed game minutes
  clockState: {
    day: number;
    hour: number;
    minute: number;
    totalMinutes: number;
    timeOfDay: 'morning' | 'day' | 'evening' | 'night' | 'late_night';
    isPaused: boolean;
  };
  playerState: {
    cash: number;
    energy: number;              // 0..100
    fatigue: number;             // 0..100
    rentDueDay: number;          // Day 7, Day 14
    rentAmount: number;          // $140.00
    rentPaid: boolean;
    consecutiveLateWarnings: number;
  };
  hardwareState: {
    cpuTier: number;             // 1 = Base single-core, 2 = Upgraded
    ramMB: number;               // 512, 1024
    hddTotalGB: number;          // 40
    hddFreeGB: number;           // Calculated or stored
    connectionType: 'dialup_56k' | 'dsl_256k' | 'dsl_512k' | 'dsl_1m';
    connectionSpeedKbps: number; // 256, 512, 1024
    osVersion: 'Orion_4.8' | 'Orion_6.0';
    theme: 'orion_4_8' | 'orion_6_0';
    wallpaper: string;
  };
  narrativeFlags: Record<string, boolean | number | string>;
  meta?: Record<string, unknown>;
}

export interface VfsFileRecord {
  id: string;                    // Primary key
  name: string;                  // e.g. "PulseSetup.exe"
  path: string;                  // e.g. "C:/Downloads/PulseSetup.exe"
  parentPath: string;            // e.g. "C:/Downloads"
  kind: 'text' | 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'shortcut' | 'system' | 'directory';
  sizeBytes: number;
  content?: string;              // Text contents or data
  appAssociation?: string;       // e.g. "photobox", "notepad", "retroamp"
  isReadOnly?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: number;
  modifiedAt: number;
}

export interface DownloadTaskRecord {
  id: string;                    // Primary key: "dl_pulse_52"
  sourceId: string;              // "downloadhub"
  url: string;                   // "http://downloadhub.local/files/pulse52.exe"
  fileName: string;              // "PulseSetup.exe"
  destinationPath: string;       // "C:/Downloads/PulseSetup.exe"
  totalBytes: number;            // e.g. 8388608 (8 MB)
  downloadedBytes: number;
  sourceMaxKbps: number;         // Server rate cap (e.g. 512)
  status: 'queued' | 'downloading' | 'paused' | 'complete' | 'failed' | 'cancelled';
  resumable: boolean;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface InstalledSoftwareRecord {
  appId: string;                 // Primary key: "pulse_messenger", "photobox"
  version: string;               // "5.2", "6.0", "3.0"
  installPath: string;           // "C:/Program Files/Pulse Messenger"
  occupiedSizeBytes: number;
  isPortable: boolean;           // True for ZipMate portable (no Add/Remove entry)
  bundledComponents: string[];   // e.g. ["searchmate_toolbar", "searchmate_homepage"]
  registeredInAddRemove: boolean;
  desktopShortcut: boolean;
  startMenuEntry: boolean;
  installedAt: number;
  modifiedSettings?: Record<string, unknown>;
}

export interface MessageRecord {
  id: string;                    // Primary key
  buddyId: string;               // "ryan_foodcart", "starlight_maya", "NightOwl87", "motel_office"
  sender: 'player' | 'buddy' | 'system';
  text: string;
  timestamp: number;             // Game monotonic minute or epoch ms
  day: number;
  isRead: boolean;
  choiceId?: string;
  narrativeKnot?: string;
}

export interface RelationshipRecord {
  buddyId: string;               // Primary key
  familiarity: number;           // 0..100
  trust: number;                 // 0..100
  comfort: number;               // 0..100
  respect: number;               // 0..100
  annoyance: number;             // 0..100
  lastInteractionDay: number;
  unlockedNotes: string[];
  statusOverride?: string;
  flags: Record<string, boolean | number | string>;
}

export interface NarrativeStateRecord {
  key: string;                   // Primary key: "ink_story_state", "scheduled_appointments"
  value: unknown;
  updatedAt: number;
}

export interface TelemetryLogRecord {
  id?: number;                   // Auto-increment primary key
  timestamp: number;
  gameDay: number;
  gameMinutes: number;
  eventType: string;             // "work_shift_completed", "software_installed", "os_upgraded"
  payload: Record<string, unknown>;
}

export interface AICacheRecord {
  key: string;                   // Deterministic cache key
  kind: 'site' | 'chat';
  providerId: string;
  model: string;
  payload: unknown;
  createdAt: number;
  expiresAt: number;
}

export interface PulseStateRecord {
  saveSlotId: string;            // Primary key: save slot id (e.g. 'slot_1', 'autosave')
  state: unknown;                // PulsePersistedState JSON — stored as opaque to avoid circular imports
  updatedAt: number;
}

// ==========================================
// 2. Full Simulation Snapshot Interface
// ==========================================

export interface FullSimulationSnapshot {
  saveSlot: SaveSlotRecord;
  vfsFiles: VfsFileRecord[];
  downloads: DownloadTaskRecord[];
  installedSoftware: InstalledSoftwareRecord[];
  messages: MessageRecord[];
  relationships: RelationshipRecord[];
  narrativeState: NarrativeStateRecord[];
  telemetryLogs: TelemetryLogRecord[];
  pulseState?: unknown;
}

// ==========================================
// 3. Zod Schemas for Runtime Validation
// ==========================================

export const SaveSlotSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  day: z.number().int().min(1),
  totalMinutes: z.number().int().min(0),
  clockState: z.object({
    day: z.number().int(),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    totalMinutes: z.number().int(),
    timeOfDay: z.enum(['morning', 'day', 'evening', 'night', 'late_night']),
    isPaused: z.boolean(),
  }),
  playerState: z.object({
    cash: z.number(),
    energy: z.number().min(0).max(100),
    fatigue: z.number().min(0).max(100),
    rentDueDay: z.number().int(),
    rentAmount: z.number(),
    rentPaid: z.boolean(),
    consecutiveLateWarnings: z.number().int(),
  }),
  hardwareState: z.object({
    cpuTier: z.number().int(),
    ramMB: z.number().int(),
    hddTotalGB: z.number(),
    hddFreeGB: z.number(),
    connectionType: z.enum(['dialup_56k', 'dsl_256k', 'dsl_512k', 'dsl_1m']),
    connectionSpeedKbps: z.number(),
    osVersion: z.enum(['Orion_4.8', 'Orion_6.0']),
    theme: z.enum(['orion_4_8', 'orion_6_0']),
    wallpaper: z.string(),
  }),
  narrativeFlags: z.record(z.union([z.boolean(), z.number(), z.string()])),
  meta: z.record(z.unknown()).optional(),
});

export const FullSimulationSnapshotSchema = z.object({
  saveSlot: SaveSlotSchema,
  vfsFiles: z.array(z.any()),
  downloads: z.array(z.any()),
  installedSoftware: z.array(z.any()),
  messages: z.array(z.any()),
  relationships: z.array(z.any()),
  narrativeState: z.array(z.any()),
  telemetryLogs: z.array(z.any()),
  pulseState: z.any().optional(),
});

// ==========================================
// 4. Migration Engine Framework
// ==========================================

export interface SchemaMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (db: Dexie) => Promise<void>;
}

export const MIGRATIONS: SchemaMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: async (database: Dexie) => {
      const saves = database.table<SaveSlotRecord>('saves');
      await saves.toCollection().modify((save) => {
        if (save.version === 1) {
          save.version = 2;
        }
      });
    },
  },
];
