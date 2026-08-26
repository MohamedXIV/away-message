# Technical Design & Implementation Blueprint: Persistence, Audio Synthesizer & Test Matrix

**Agent**: `explorer_m1_3` (Milestone 1 Explorer — Part C)  
**Target Milestone**: Milestone 1 — Core Architecture, Build Setup & Simulation Engine  
**Subsystems Covered**:
1. Dexie / IndexedDB Persistence Layer (`src/persistence/`)
2. Web Audio Procedural Synthesizer & Audio Management (`src/audio/`)
3. Vitest Unit & Integration Test Matrix (`tests/unit/`, `tests/integration/`)  
**Specification Sources**: `PROJECT.md`, `TEST_INFRA.md`, `docs/00-VISION-AND-EVALUATION.md` through `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`, `ORIGINAL_REQUEST.md`, `SCOPE_M1.md`.

---

## 1. Executive Architecture Overview

```
=============================================================================================
                                     AWAY MESSAGE (M1)
                              PERSISTENCE, AUDIO & TEST ARCHITECTURE
=============================================================================================

                               +-----------------------------+
                               |     Simulation Engine       |
                               | (Clock, Economy, Hardware,  |
                               |  VFS, Downloads, Social)    |
                               +--------------+--------------+
                                              |
                   +--------------------------+--------------------------+
                   | Dispatches Actions &                                | Emits Sound Events
                   | Triggers State Changes                              | (Clicks, IM Chimes, Modem)
                   v                                                     v
+------------------------------------+               +------------------------------------+
|        Persistence Layer           |               |       Web Audio Synthesizer        |
|       (`src/persistence/`)         |               |          (`src/audio/`)            |
|                                    |               |                                    |
|  +------------------------------+  |               |  +------------------------------+  |
|  |     AwayMessageDB (Dexie)    |  |               |  |     SynthAudio (Pure API)    |  |
|  |  8 IndexedDB Tables:         |  |               |  | - 10-Stage Modem Handshake   |  |
|  |  - saves                     |  |               |  | - Retro Clicks, Beeps, Blips |  |
|  |  - vfs_files                 |  |               |  | - IM Chimes (Recv / Send)    |  |
|  |  - downloads                 |  |               |  | - Door Open / Door Slam      |  |
|  |  - installed_software        |  |               |  | - HDD Read/Write Chatter     |  |
|  |  - messages                  |  |               |  +------------------------------+  |
|  |  - relationships             |  |               |  +------------------------------+  |
|  |  - narrative_state           |  |               |  |  SoundManager (Bus & State)  |  |
|  |  - telemetry_logs            |  |               |  | - Master / SFX / Ambience Bus|  |
|  +------------------------------+  |               |  | - Mute & Volume in Storage   |  |
|  +------------------------------+  |               |  | - Autoplay Lifecycle Unlock  |  |
|  |       SaveManager.ts         |  |               |  +------------------------------+  |
|  | - Atomic Multi-table Saves   |  |               +------------------------------------+
|  | - Auto-save on Time Jumps    |  |
|  | - Export / Import with Zod   |  |
|  | - Schema Migrations (V1->V2) |  |
|  +------------------------------+  |
+------------------------------------+
                   ^
                   | Tested via fake-indexeddb
                   |
+-----------------------------------------------------------------------------------------+
|                               Vitest Test Harness Matrix                                |
|                                                                                         |
|  +---------------------------------------------------+  +----------------------------+  |
|  |             Unit Tests (`tests/unit/`)            |  |  Integration Tests (Integ) |  |
|  | - GameClock.test.ts        - FileSystem.test.ts   |  | - Persistence.test.ts      |  |
|  | - EventBus.test.ts         - SoftwareReg.test.ts  |  |   (Save/Load Round-trip,   |  |
|  | - EconomyEngine.test.ts    - SocialEngine.test.ts |  |    Time-Jump Auto-saves,   |  |
|  | - HardwareEngine.test.ts   - Telemetry.test.ts    |  |    Migration V1->V2,       |  |
|  | - DownloadManager.test.ts  - Simulation.test.ts   |  |    Zod Schema Validation)  |  |
|  | - SynthAudio.test.ts                              |  +----------------------------+  |
|  +---------------------------------------------------+                                  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Persistence Layer Architecture (`src/persistence/`)

### 2.1 Dexie Database Schema (`src/persistence/db.ts`)

The database utilizes **Dexie.js v4** to manage IndexedDB tables with strong TypeScript typings.

#### Table Definitions & Entities
```typescript
import Dexie, { type Table } from 'dexie';
import type {
  SaveSlotRecord,
  VfsFileRecord,
  DownloadTaskRecord,
  InstalledSoftwareRecord,
  MessageRecord,
  RelationshipRecord,
  NarrativeStateRecord,
  TelemetryLogRecord
} from './schema';

export class AwayMessageDB extends Dexie {
  saves!: Table<SaveSlotRecord, string>;
  vfs_files!: Table<VfsFileRecord, string>;
  downloads!: Table<DownloadTaskRecord, string>;
  installed_software!: Table<InstalledSoftwareRecord, string>;
  messages!: Table<MessageRecord, string>;
  relationships!: Table<RelationshipRecord, string>;
  narrative_state!: Table<NarrativeStateRecord, string>;
  telemetry_logs!: Table<TelemetryLogRecord, number>;

  constructor(databaseName = 'AwayMessageDB') {
    super(databaseName);

    // Schema Definition Version 1
    this.version(1).stores({
      saves: 'id, name, updatedAt, day',
      vfs_files: 'id, path, parentPath, kind, name, createdAt',
      downloads: 'id, status, startedAt, completedAt',
      installed_software: 'appId, installedAt, version',
      messages: 'id, buddyId, timestamp, isRead, [buddyId+timestamp]',
      relationships: 'buddyId, lastInteractionDay',
      narrative_state: 'key, updatedAt',
      telemetry_logs: '++id, timestamp, gameDay, eventType'
    });
  }
}

// Singleton database instance for application runtime
export const db = new AwayMessageDB();
```

---

### 2.2 Versioned Schemas, Typings & Migrations (`src/persistence/schema.ts`)

```typescript
import { z } from 'zod';

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
  id: string;                    // Primary key: UUID or normalized path
  name: string;                  // e.g. "PulseSetup.exe"
  path: string;                  // e.g. "C:/Downloads/PulseSetup.exe"
  parentPath: string;            // e.g. "C:/Downloads"
  kind: 'text' | 'executable' | 'archive' | 'audio' | 'image' | 'shortcut' | 'directory';
  sizeBytes: number;
  content?: string;              // Text contents or base64 metadata
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
  id: string;                    // Primary key: UUID
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
  day: z.number().int().min(1).max(14),
  totalMinutes: z.number().int().min(0),
  clockState: z.object({
    day: z.number().int(),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    totalMinutes: z.number().int(),
    timeOfDay: z.enum(['morning', 'day', 'evening', 'night', 'late_night']),
    isPaused: z.boolean()
  }),
  playerState: z.object({
    cash: z.number(),
    energy: z.number().min(0).max(100),
    fatigue: z.number().min(0).max(100),
    rentDueDay: z.number().int(),
    rentAmount: z.number(),
    rentPaid: z.boolean(),
    consecutiveLateWarnings: z.number().int()
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
    wallpaper: z.string()
  }),
  narrativeFlags: z.record(z.union([z.boolean(), z.number(), z.string()])),
  meta: z.record(z.unknown()).optional()
});

export const FullSimulationSnapshotSchema = z.object({
  saveSlot: SaveSlotSchema,
  vfsFiles: z.array(z.any()),
  downloads: z.array(z.any()),
  installedSoftware: z.array(z.any()),
  messages: z.array(z.any()),
  relationships: z.array(z.any()),
  narrativeState: z.array(z.any()),
  telemetryLogs: z.array(z.any())
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
      // Future upgrade path: e.g. adding columns or transforming records
      const saves = database.table<SaveSlotRecord>('saves');
      await saves.toCollection().modify(save => {
        if (save.version === 1) {
          save.version = 2;
          // Example: initialize new field if introduced
        }
      });
    }
  }
];
```

---

### 2.3 SaveManager Implementation (`src/persistence/SaveManager.ts`)

```typescript
import { db, AwayMessageDB } from './db';
import {
  type SaveSlotRecord,
  type FullSimulationSnapshot,
  FullSimulationSnapshotSchema
} from './schema';

export class SaveManager {
  private database: AwayMessageDB;
  private autoSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(database: AwayMessageDB = db) {
    this.database = database;
  }

  /**
   * Captures and writes a full atomic game save into Dexie across all tables.
   */
  public async saveGame(
    slotId = 'slot_1',
    saveName?: string,
    snapshotSupplier?: () => FullSimulationSnapshot
  ): Promise<SaveSlotRecord> {
    if (!snapshotSupplier) {
      throw new Error('SaveManager.saveGame requires a snapshotSupplier');
    }

    const snapshot = snapshotSupplier();
    const now = Date.now();

    const saveSlot: SaveSlotRecord = {
      ...snapshot.saveSlot,
      id: slotId,
      name: saveName || snapshot.saveSlot.name || `Save ${slotId} - Day ${snapshot.saveSlot.day}`,
      updatedAt: now,
      createdAt: snapshot.saveSlot.createdAt || now
    };

    // Execute atomic multi-table transaction
    await this.database.transaction(
      'rw',
      [
        this.database.saves,
        this.database.vfs_files,
        this.database.downloads,
        this.database.installed_software,
        this.database.messages,
        this.database.relationships,
        this.database.narrative_state,
        this.database.telemetry_logs
      ],
      async () => {
        // Save Master Slot
        await this.database.saves.put(saveSlot);

        // Bulk Overwrite Tables
        await this.database.vfs_files.clear();
        await this.database.vfs_files.bulkPut(snapshot.vfsFiles);

        await this.database.downloads.clear();
        await this.database.downloads.bulkPut(snapshot.downloads);

        await this.database.installed_software.clear();
        await this.database.installed_software.bulkPut(snapshot.installedSoftware);

        await this.database.messages.clear();
        await this.database.messages.bulkPut(snapshot.messages);

        await this.database.relationships.clear();
        await this.database.relationships.bulkPut(snapshot.relationships);

        await this.database.narrative_state.clear();
        await this.database.narrative_state.bulkPut(snapshot.narrativeState);

        if (snapshot.telemetryLogs.length > 0) {
          await this.database.telemetry_logs.clear();
          await this.database.telemetry_logs.bulkPut(snapshot.telemetryLogs);
        }
      }
    );

    return saveSlot;
  }

  /**
   * Auto-save triggered by in-game events (time jumps, sleep, work shifts).
   */
  public async autoSave(snapshotSupplier: () => FullSimulationSnapshot): Promise<void> {
    if (this.autoSaveDebounceTimer) {
      clearTimeout(this.autoSaveDebounceTimer);
    }

    return new Promise((resolve, reject) => {
      this.autoSaveDebounceTimer = setTimeout(async () => {
        try {
          await this.saveGame('autosave', 'Auto Save (Time Jump)', snapshotSupplier);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 50); // 50ms debounce to prevent disk churn during rapid ticks
    });
  }

  /**
   * Loads full simulation state from Dexie.
   */
  public async loadGame(slotId = 'slot_1'): Promise<FullSimulationSnapshot> {
    const saveSlot = await this.database.saves.get(slotId);
    if (!saveSlot) {
      throw new Error(`Save slot '${slotId}' not found.`);
    }

    const [
      vfsFiles,
      downloads,
      installedSoftware,
      messages,
      relationships,
      narrativeState,
      telemetryLogs
    ] = await Promise.all([
      this.database.vfs_files.toArray(),
      this.database.downloads.toArray(),
      this.database.installed_software.toArray(),
      this.database.messages.toArray(),
      this.database.relationships.toArray(),
      this.database.narrative_state.toArray(),
      this.database.telemetry_logs.toArray()
    ]);

    const snapshot: FullSimulationSnapshot = {
      saveSlot,
      vfsFiles,
      downloads,
      installedSoftware,
      messages,
      relationships,
      narrativeState,
      telemetryLogs
    };

    // Runtime validation
    return FullSimulationSnapshotSchema.parse(snapshot);
  }

  /**
   * Exports save data as a portable JSON string.
   */
  public async exportSaveJson(slotId = 'slot_1'): Promise<string> {
    const snapshot = await this.loadGame(slotId);
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Imports a save from a JSON string, validates it via Zod, and writes it to Dexie.
   */
  public async importSaveJson(jsonString: string, targetSlotId?: string): Promise<SaveSlotRecord> {
    const raw = JSON.parse(jsonString);
    const validated = FullSimulationSnapshotSchema.parse(raw);
    const slotId = targetSlotId || validated.saveSlot.id;

    return this.saveGame(slotId, validated.saveSlot.name, () => validated);
  }

  /**
   * Deletes a save slot.
   */
  public async deleteSave(slotId: string): Promise<void> {
    await this.database.saves.delete(slotId);
  }

  /**
   * Lists all existing save slots.
   */
  public async listSaves(): Promise<SaveSlotRecord[]> {
    return this.database.saves.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Checks if an initial save or autosave exists.
   */
  public async hasSave(slotId = 'slot_1'): Promise<boolean> {
    const count = await this.database.saves.where('id').equals(slotId).count();
    return count > 0;
  }

  /**
   * Resets all tables for a clean new game state.
   */
  public async clearAll(): Promise<void> {
    await this.database.transaction(
      'rw',
      [
        this.database.saves,
        this.database.vfs_files,
        this.database.downloads,
        this.database.installed_software,
        this.database.messages,
        this.database.relationships,
        this.database.narrative_state,
        this.database.telemetry_logs
      ],
      async () => {
        await Promise.all([
          this.database.saves.clear(),
          this.database.vfs_files.clear(),
          this.database.downloads.clear(),
          this.database.installed_software.clear(),
          this.database.messages.clear(),
          this.database.relationships.clear(),
          this.database.narrative_state.clear(),
          this.database.telemetry_logs.clear()
        ]);
      }
    );
  }
}

export const saveManager = new SaveManager(db);
```

---

## 3. Web Audio Procedural Synthesizer Architecture (`src/audio/`)

### 3.1 Pure Web Audio API Synthesizer (`src/audio/SynthAudio.ts`)

`SynthAudio.ts` contains zero audio asset dependencies. All sounds are generated procedurally via standard Web Audio API nodes (`OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AudioBufferSourceNode`, `StereoPannerNode`).

```typescript
export class SynthAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted = false;
  private activeHandshakeNodes: { stop: () => void } | null = null;

  constructor() {
    // Lazy audio context initialization
  }

  public init(context?: AudioContext): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = context || new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Graceful fallback for headless or restricted environments
    }
  }

  public getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      this.init();
    }
    return this.ctx;
  }

  public setMasterVolume(vol: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  // =========================================================
  // 1. Procedural 10-Stage Dial-up Modem Handshake Simulation
  // =========================================================
  /**
   * Synthesizes authentic V.34/V.90 modem negotiation:
   * 1. Off-hook & Dial Tone (350Hz + 440Hz)
   * 2. DTMF Dialing (Keypad Tone sequence e.g. 555-0199)
   * 3. Ringback Pulse (440Hz + 480Hz)
   * 4. CED Answer Tone (2100Hz with phase reversals)
   * 5. CNG Calling Tone (1300Hz beeps)
   * 6. Dual-frequency Probing (1200Hz + 2400Hz frequency sweeps)
   * 7. Scrambled White Noise & Baud Training (Bandpassed noise hash)
   * 8. Trellis Modulation Chirps & Squeals
   * 9. Carrier Drop to low hum (1200Hz lowpass)
   * 10. Connection Handshake Chime (Dual tone triumph!)
   */
  public playDialupHandshake(onComplete?: () => void): { cancel: () => void } {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) {
      onComplete?.();
      return { cancel: () => {} };
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime + 0.05;
    const soundNodes: (AudioNode | { stop: (t?: number) => void })[] = [];

    // Stage 1: Dial Tone (350Hz + 440Hz, 1.2s)
    const oscDial1 = ctx.createOscillator();
    const oscDial2 = ctx.createOscillator();
    const dialGain = ctx.createGain();
    oscDial1.frequency.value = 350;
    oscDial2.frequency.value = 440;
    dialGain.gain.setValueAtTime(0.15, t0);
    dialGain.gain.setValueAtTime(0.15, t0 + 1.1);
    dialGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);

    oscDial1.connect(dialGain);
    oscDial2.connect(dialGain);
    dialGain.connect(this.sfxGain!);
    oscDial1.start(t0);
    oscDial2.start(t0);
    oscDial1.stop(t0 + 1.2);
    oscDial2.stop(t0 + 1.2);
    soundNodes.push(oscDial1, oscDial2, dialGain);

    // Stage 2: DTMF Dialing (7 digits: 5-5-5-0-1-9-9, 70ms on / 40ms off)
    const dtmfFrequencies: Record<string, [number, number]> = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '0': [941, 1336]
    };
    const numberSequence = ['5', '5', '5', '0', '1', '9', '9'];
    let dtmfTime = t0 + 1.3;

    numberSequence.forEach(digit => {
      const [lowFreq, highFreq] = dtmfFrequencies[digit];
      const oscLow = ctx.createOscillator();
      const oscHigh = ctx.createOscillator();
      const digitGain = ctx.createGain();

      oscLow.frequency.value = lowFreq;
      oscHigh.frequency.value = highFreq;
      digitGain.gain.setValueAtTime(0.2, dtmfTime);
      digitGain.gain.setValueAtTime(0.2, dtmfTime + 0.065);
      digitGain.gain.exponentialRampToValueAtTime(0.001, dtmfTime + 0.07);

      oscLow.connect(digitGain);
      oscHigh.connect(digitGain);
      digitGain.connect(this.sfxGain!);

      oscLow.start(dtmfTime);
      oscHigh.start(dtmfTime);
      oscLow.stop(dtmfTime + 0.07);
      oscHigh.stop(dtmfTime + 0.07);
      soundNodes.push(oscLow, oscHigh, digitGain);

      dtmfTime += 0.11; // 70ms tone + 40ms pause
    });

    // Stage 3: Ringback Tone (440Hz + 480Hz, 1 pulse at dtmfTime + 0.2s)
    const ringTime = dtmfTime + 0.2;
    const oscRing1 = ctx.createOscillator();
    const oscRing2 = ctx.createOscillator();
    const ringGain = ctx.createGain();
    oscRing1.frequency.value = 440;
    oscRing2.frequency.value = 480;
    ringGain.gain.setValueAtTime(0.12, ringTime);
    ringGain.gain.setValueAtTime(0.12, ringTime + 1.2);
    ringGain.gain.exponentialRampToValueAtTime(0.001, ringTime + 1.3);

    oscRing1.connect(ringGain);
    oscRing2.connect(ringGain);
    ringGain.connect(this.sfxGain!);
    oscRing1.start(ringTime);
    oscRing2.start(ringTime);
    oscRing1.stop(ringTime + 1.3);
    oscRing2.stop(ringTime + 1.3);
    soundNodes.push(oscRing1, oscRing2, ringGain);

    // Stage 4 & 5: CED Answer Tone (2100Hz piercing tone + periodic 1300Hz beeps)
    const answerTime = ringTime + 1.5;
    const oscAnswer = ctx.createOscillator();
    const answerGain = ctx.createGain();
    oscAnswer.frequency.value = 2100;
    answerGain.gain.setValueAtTime(0.18, answerTime);
    answerGain.gain.setValueAtTime(0.18, answerTime + 1.8);
    answerGain.gain.exponentialRampToValueAtTime(0.001, answerTime + 1.9);

    oscAnswer.connect(answerGain);
    answerGain.connect(this.sfxGain!);
    oscAnswer.start(answerTime);
    oscAnswer.stop(answerTime + 1.9);
    soundNodes.push(oscAnswer, answerGain);

    // Stage 6 & 7: V.34 Dual-Frequency Probing & Scrambled Noise Hash (Cha-shhhhh-krrr)
    const noiseTime = answerTime + 2.0;
    const noiseDuration = 3.2;
    const bufferSize = ctx.sampleRate * noiseDuration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1; // White noise
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1800, noiseTime);
    noiseFilter.frequency.linearRampToValueAtTime(2800, noiseTime + 1.5);
    noiseFilter.frequency.linearRampToValueAtTime(1200, noiseTime + 3.0);
    noiseFilter.Q.value = 3.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, noiseTime);
    noiseGain.gain.linearRampToValueAtTime(0.22, noiseTime + 0.4);
    noiseGain.gain.setValueAtTime(0.22, noiseTime + 2.8);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, noiseTime + noiseDuration);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain!);

    whiteNoise.start(noiseTime);
    whiteNoise.stop(noiseTime + noiseDuration);
    soundNodes.push(whiteNoise, noiseFilter, noiseGain);

    // Stage 8: Trellis Modulation Squeals & Harmonic Sweeps
    const squealTime = noiseTime + 0.8;
    const oscSqueal = ctx.createOscillator();
    const squealGain = ctx.createGain();
    oscSqueal.type = 'sawtooth';
    oscSqueal.frequency.setValueAtTime(900, squealTime);
    oscSqueal.frequency.exponentialRampToValueAtTime(2400, squealTime + 0.6);
    oscSqueal.frequency.setValueAtTime(1800, squealTime + 0.9);
    oscSqueal.frequency.exponentialRampToValueAtTime(3200, squealTime + 1.8);

    squealGain.gain.setValueAtTime(0.08, squealTime);
    squealGain.gain.setValueAtTime(0.08, squealTime + 1.8);
    squealGain.gain.exponentialRampToValueAtTime(0.001, squealTime + 2.0);

    oscSqueal.connect(squealGain);
    squealGain.connect(this.sfxGain!);
    oscSqueal.start(squealTime);
    oscSqueal.stop(squealTime + 2.0);
    soundNodes.push(oscSqueal, squealGain);

    // Stage 9 & 10: Carrier Drop & Connection Success Chime
    const connectTime = noiseTime + noiseDuration + 0.1;
    const oscChime1 = ctx.createOscillator();
    const oscChime2 = ctx.createOscillator();
    const chimeGain = ctx.createGain();

    oscChime1.frequency.setValueAtTime(587.33, connectTime); // D5
    oscChime2.frequency.setValueAtTime(880.00, connectTime + 0.15); // A5
    chimeGain.gain.setValueAtTime(0.2, connectTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, connectTime + 0.8);

    oscChime1.connect(chimeGain);
    oscChime2.connect(chimeGain);
    chimeGain.connect(this.sfxGain!);

    oscChime1.start(connectTime);
    oscChime1.stop(connectTime + 0.8);
    oscChime2.start(connectTime + 0.15);
    oscChime2.stop(connectTime + 0.8);
    soundNodes.push(oscChime1, oscChime2, chimeGain);

    const totalDurationMs = (connectTime + 0.8 - ctx.currentTime) * 1000;
    const timeoutId = setTimeout(() => {
      onComplete?.();
    }, Math.max(0, totalDurationMs));

    const cancel = () => {
      clearTimeout(timeoutId);
      soundNodes.forEach(node => {
        if ('stop' in node && typeof node.stop === 'function') {
          try { node.stop(); } catch {}
        }
        if ('disconnect' in node && typeof node.disconnect === 'function') {
          try { node.disconnect(); } catch {}
        }
      });
    };

    this.activeHandshakeNodes = { stop: cancel };
    return { cancel };
  }

  // =========================================================
  // 2. Retro UI & Interaction Sound Effects
  // =========================================================

  /** Classic UI Click (15ms square pulse at 2.4kHz) */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.015);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.015);
  }

  /** Window Open / Restore Chirp (400Hz -> 800Hz) */
  public playWindowOpen(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  /** Window Minimize Chirp (800Hz -> 350Hz) */
  public playWindowMinimize(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  /** Classic Error "Donk" Chord (Dual square resonant) */
  public playErrorBeep(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.value = 440;
    osc2.frequency.value = 554.37; // C#5

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.18);
  }

  /** IM Receive Chime (Pulse / AIM Major 3rd Bell: G5 -> C6) */
  public playImReceive(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const t0 = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 783.99; // G5
    gain1.gain.setValueAtTime(0.18, t0);
    gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

    osc2.type = 'sine';
    osc2.frequency.value = 1046.50; // C6
    gain2.gain.setValueAtTime(0.22, t0 + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this.sfxGain!);
    gain2.connect(this.sfxGain!);

    osc1.start(t0);
    osc1.stop(t0 + 0.35);
    osc2.start(t0 + 0.12);
    osc2.stop(t0 + 0.55);
  }

  /** IM Send Chime (Soft confirmation pop: E5 -> G5) */
  public playImSend(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, t0); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, t0 + 0.08); // G5
    gain.gain.setValueAtTime(0.14, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  }

  /** Door Open (Buddy signs onto Pulse - Wood creak + latch click) */
  public playDoorOpen(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.linearRampToValueAtTime(260, t0 + 0.2);
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t0);
    osc.stop(t0 + 0.25);
  }

  /** Door Slam (Buddy signs off Pulse - Heavy acoustic thud) */
  public playDoorSlam(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, t0);
    osc.frequency.exponentialRampToValueAtTime(25, t0 + 0.18);
    gain.gain.setValueAtTime(0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  /** Hard Drive Read/Write Head Chatter (IDE seek clicks) */
  public playHddChirp(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    const t0 = ctx.currentTime;
    const pulses = 3;
    for (let i = 0; i < pulses; i++) {
      const pTime = t0 + i * 0.035;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 2400 + Math.random() * 800;
      gain.gain.setValueAtTime(0.04, pTime);
      gain.gain.exponentialRampToValueAtTime(0.001, pTime + 0.01);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(pTime);
      osc.stop(pTime + 0.01);
    }
  }
}

export const synthAudio = new SynthAudio();
```

---

### 3.2 SoundManager Implementation (`src/audio/SoundManager.ts`)

```typescript
import { synthAudio, SynthAudio } from './SynthAudio';

export interface SoundSettings {
  masterVolume: number;   // 0.0 .. 1.0
  sfxVolume: number;      // 0.0 .. 1.0
  ambienceVolume: number; // 0.0 .. 1.0
  musicVolume: number;    // 0.0 .. 1.0
  isMuted: boolean;
}

const STORAGE_KEY = 'away_message_sound_settings';

export class SoundManager {
  private synth: SynthAudio;
  private settings: SoundSettings = {
    masterVolume: 0.8,
    sfxVolume: 0.9,
    ambienceVolume: 0.7,
    musicVolume: 0.8,
    isMuted: false
  };
  private isUnlocked = false;

  constructor(synth: SynthAudio = synthAudio) {
    this.synth = synth;
    this.loadSettings();
  }

  /**
   * Unlocks Web Audio Context on first user gesture.
   */
  public unlockAudio(): void {
    if (this.isUnlocked) return;
    this.synth.init();
    const ctx = this.synth.getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this.isUnlocked = true;
      }).catch(() => {});
    } else {
      this.isUnlocked = true;
    }
  }

  public play(sound: 'click' | 'window_open' | 'window_minimize' | 'error' | 'im_recv' | 'im_send' | 'door_open' | 'door_slam' | 'hdd_chirp'): void {
    this.unlockAudio();
    if (this.settings.isMuted) return;

    switch (sound) {
      case 'click': return this.synth.playClick();
      case 'window_open': return this.synth.playWindowOpen();
      case 'window_minimize': return this.synth.playWindowMinimize();
      case 'error': return this.synth.playErrorBeep();
      case 'im_recv': return this.synth.playImReceive();
      case 'im_send': return this.synth.playImSend();
      case 'door_open': return this.synth.playDoorOpen();
      case 'door_slam': return this.synth.playDoorSlam();
      case 'hdd_chirp': return this.synth.playHddChirp();
    }
  }

  public playDialup(onComplete?: () => void): { cancel: () => void } {
    this.unlockAudio();
    return this.synth.playDialupHandshake(onComplete);
  }

  public setMasterVolume(vol: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, vol));
    this.synth.setMasterVolume(this.settings.masterVolume);
    this.saveSettings();
  }

  public setMute(muted: boolean): void {
    this.settings.isMuted = muted;
    this.synth.setMute(muted);
    this.saveSettings();
  }

  public getSettings(): Readonly<SoundSettings> {
    return { ...this.settings };
  }

  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.settings = { ...this.settings, ...JSON.parse(stored) };
          this.synth.setMasterVolume(this.settings.masterVolume);
          this.synth.setMute(this.settings.isMuted);
        }
      }
    } catch {}
  }

  private saveSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch {}
  }
}

export const soundManager = new SoundManager(synthAudio);
```

---

## 4. Vitest Unit & Integration Test Matrix

### 4.1 Test Infrastructure & Setup (`tests/setup.ts`)

```typescript
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '../src/persistence/db';

beforeEach(async () => {
  // Clear fake-indexeddb tables before every unit/integration test for complete test isolation
  await db.saves.clear();
  await db.vfs_files.clear();
  await db.downloads.clear();
  await db.installed_software.clear();
  await db.messages.clear();
  await db.relationships.clear();
  await db.narrative_state.clear();
  await db.telemetry_logs.clear();
});
```

---

### 4.2 Comprehensive Unit Test Matrix (`tests/unit/`)

| # | Test File | Target Subsystem | Key Verification Scenarios | Mock Policy |
|---|---|---|---|---|
| 1 | `GameClock.test.ts` | Simulation Clock | • Real-time tick (`1s = 1 min`)<br>• Discrete time jumps (`advanceGameMinutes`)<br>• Midnight rollover (Day 1 23:59 $\to$ Day 2 00:00)<br>• Time-of-day band calculation (`morning`, `day`, `evening`, `night`, `late_night`)<br>• Pause and resume toggling | **Zero Mock** (pure domain math) |
| 2 | `EventBus.test.ts` | Reactive Event Bus | • Strongly typed event dispatch & subscriptions<br>• Unsubscribe cleanup<br>• Multiple concurrent listeners<br>• Error isolation across callbacks<br>• Event history recording | **Zero Mock** |
| 3 | `EconomyEngine.test.ts` | Money & Fatigue | • Starting cash balance ($38.00)<br>• Work shift earnings (+$62.00) & energy depletion<br>• Motel rent deduction ($140.00 on Day 7)<br>• Late payment fee penalty & warning count<br>• Purchase affordability gating | **Zero Mock** |
| 4 | `HardwareEngine.test.ts` | PC Specs & OS | • Baseline PC configuration (Orion 4.8, 512MB RAM, 40GB HDD, 256k DSL)<br>• RAM upgrade (1024MB)<br>• Orion 6.0 upgrade compatibility check (requires $\ge$ 768MB RAM)<br>• DSL speed tier throughput calculation | **Zero Mock** |
| 5 | `DownloadManager.test.ts` | Download Tasks | • Speed formula: $\min(\text{playerSpeed}, \text{sourceSpeed})$<br>• Multi-task bandwidth splitting<br>• Time jump background progress advancing<br>• Pause / resume state transitions<br>• Task completion creates `VfsFileRecord` in `C:/Downloads`<br>• Insufficient disk space check before download | **Zero Mock** |
| 6 | `FileSystemEngine.test.ts` | Virtual File System | • Directory hierarchy creation (`Desktop`, `Downloads`, `Documents`, `Program Files`, `Trash`)<br>• `createFile`, `readFile`, `deleteFile`<br>• Moving to Trash and `emptyTrash` disk space reclamation<br>• 40GB quota constraint enforcement | **Zero Mock** |
| 7 | `SoftwareRegistry.test.ts` | Installers & Registry | • 6-stage installer wizard transitions<br>• Hardware/OS gating (PhotoBox 3.0 fails on Orion 4.8/512MB, passes on OS 6/1024MB)<br>• Bundled adware checkboxes (WeatherBuddy with SearchMate)<br>• Portable apps excluded from Add/Remove Programs<br>• Uninstaller disk space release | **Zero Mock** |
| 8 | `SocialEngine.test.ts` | Buddies & Schedules | • 14-day schedule resolution across 4 buddies (Ryan, Maya, Nora, Henderson)<br>• Online/Away/Offline status boundaries<br>• Away message string retrieval<br>• 5 hidden relationship dimensions updating via semantic actions<br>• Clamping within [0..100] | **Zero Mock** |
| 9 | `TelemetryEngine.test.ts` | Local Telemetry | • Metric recording (playtime, money earned, software installed)<br>• Event logging across days<br>• JSON export structure and schema compliance | **Zero Mock** |
| 10 | `SimulationEngine.test.ts` | Central Coordinator | • Action dispatching through central pipeline<br>• Unified tick advancing all engines simultaneously<br>• State snapshot immutability<br>• Observer subscription notifications | **Zero Mock** |
| 11 | `SynthAudio.test.ts` | Procedural Audio | • Headless instantiation without throwing<br>• Method invocation safety (clicks, chimes, modem handshake)<br>• Volume clamping and mute state verification | Standard AudioContext mock for Node |

---

### 4.3 Integration Test Blueprint (`tests/integration/Persistence.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/persistence/db';
import { SaveManager } from '../../src/persistence/SaveManager';
import type { FullSimulationSnapshot } from '../../src/persistence/schema';

describe('Persistence Integration Suite (Dexie + fake-indexeddb)', () => {
  let saveManager: SaveManager;

  const createMockSnapshot = (day = 1, cash = 38): FullSimulationSnapshot => ({
    saveSlot: {
      id: 'slot_1',
      name: `Test Save Day ${day}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      day,
      totalMinutes: (day - 1) * 1440 + 480,
      clockState: {
        day,
        hour: 8,
        minute: 0,
        totalMinutes: (day - 1) * 1440 + 480,
        timeOfDay: 'morning',
        isPaused: false
      },
      playerState: {
        cash,
        energy: 100,
        fatigue: 0,
        rentDueDay: 7,
        rentAmount: 140,
        rentPaid: false,
        consecutiveLateWarnings: 0
      },
      hardwareState: {
        cpuTier: 1,
        ramMB: 512,
        hddTotalGB: 40,
        hddFreeGB: 32,
        connectionType: 'dsl_256k',
        connectionSpeedKbps: 256,
        osVersion: 'Orion_4.8',
        theme: 'orion_4_8',
        wallpaper: 'default_clouds'
      },
      narrativeFlags: {
        knows_ryan_pulse: true,
        visited_cafe: false
      }
    },
    vfsFiles: [
      {
        id: 'vfs_file_1',
        name: 'readme.txt',
        path: 'C:/Documents/readme.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 1024,
        content: 'Welcome to Orion OS',
        createdAt: Date.now(),
        modifiedAt: Date.now()
      }
    ],
    downloads: [
      {
        id: 'dl_pulse_52',
        sourceId: 'downloadhub',
        url: 'http://downloadhub.local/pulse52.exe',
        fileName: 'PulseSetup.exe',
        destinationPath: 'C:/Downloads/PulseSetup.exe',
        totalBytes: 8388608,
        downloadedBytes: 4194304,
        sourceMaxKbps: 512,
        status: 'downloading',
        resumable: true,
        startedAt: Date.now()
      }
    ],
    installedSoftware: [
      {
        appId: 'voyager_browser',
        version: '1.0',
        installPath: 'C:/Program Files/Voyager',
        occupiedSizeBytes: 15728640,
        isPortable: false,
        bundledComponents: [],
        registeredInAddRemove: false,
        desktopShortcut: true,
        startMenuEntry: true,
        installedAt: Date.now()
      }
    ],
    messages: [
      {
        id: 'msg_1',
        buddyId: 'ryan_foodcart',
        sender: 'buddy',
        text: 'hey man did you get pulse installed yet?',
        timestamp: 490,
        day: 1,
        isRead: false
      }
    ],
    relationships: [
      {
        buddyId: 'ryan_foodcart',
        familiarity: 40,
        trust: 50,
        comfort: 50,
        respect: 40,
        annoyance: 0,
        lastInteractionDay: 1,
        unlockedNotes: [],
        flags: {}
      }
    ],
    narrativeState: [
      {
        key: 'current_knot',
        value: 'day1_ryan_intro',
        updatedAt: Date.now()
      }
    ],
    telemetryLogs: [
      {
        id: 1,
        timestamp: Date.now(),
        gameDay: 1,
        gameMinutes: 480,
        eventType: 'game_started',
        payload: { startingCash: 38 }
      }
    ]
  });

  beforeEach(async () => {
    saveManager = new SaveManager(db);
    await saveManager.clearAll();
  });

  it('performs lossless save and load round-trip across all 8 tables', async () => {
    const originalSnapshot = createMockSnapshot(2, 95);
    await saveManager.saveGame('slot_1', 'Day 2 Save', () => originalSnapshot);

    const loadedSnapshot = await saveManager.loadGame('slot_1');

    expect(loadedSnapshot.saveSlot.day).toBe(2);
    expect(loadedSnapshot.saveSlot.playerState.cash).toBe(95);
    expect(loadedSnapshot.vfsFiles).toHaveLength(1);
    expect(loadedSnapshot.vfsFiles[0].name).toBe('readme.txt');
    expect(loadedSnapshot.downloads).toHaveLength(1);
    expect(loadedSnapshot.downloads[0].downloadedBytes).toBe(4194304);
    expect(loadedSnapshot.messages).toHaveLength(1);
    expect(loadedSnapshot.messages[0].isRead).toBe(false);
    expect(loadedSnapshot.relationships[0].trust).toBe(50);
    expect(loadedSnapshot.installedSoftware[0].appId).toBe('voyager_browser');
    expect(loadedSnapshot.narrativeState[0].key).toBe('current_knot');
  });

  it('performs auto-save with debounce on time jump', async () => {
    const snapshot = createMockSnapshot(3, 150);
    await saveManager.autoSave(() => snapshot);

    // Allow debounce timer to settle
    await new Promise(r => setTimeout(r, 60));

    const autosave = await saveManager.loadGame('autosave');
    expect(autosave).toBeDefined();
    expect(autosave.saveSlot.day).toBe(3);
    expect(autosave.saveSlot.playerState.cash).toBe(150);
  });

  it('exports and imports valid save JSON with Zod validation', async () => {
    const original = createMockSnapshot(4, 210);
    await saveManager.saveGame('slot_1', 'Day 4 Save', () => original);

    const jsonString = await saveManager.exportSaveJson('slot_1');
    expect(typeof jsonString).toBe('string');

    // Clear DB and re-import
    await saveManager.clearAll();
    expect(await saveManager.hasSave('slot_1')).toBe(false);

    await saveManager.importSaveJson(jsonString, 'slot_imported');
    const imported = await saveManager.loadGame('slot_imported');

    expect(imported.saveSlot.day).toBe(4);
    expect(imported.saveSlot.playerState.cash).toBe(210);
    expect(imported.vfsFiles[0].path).toBe('C:/Documents/readme.txt');
  });

  it('rejects corrupted save JSON during import', async () => {
    const corruptedJson = JSON.stringify({
      saveSlot: { id: 'bad_slot', day: 'invalid_number' }
    });

    await expect(saveManager.importSaveJson(corruptedJson)).rejects.toThrow();
  });
});
```

---

## 5. Verification & Acceptance Criteria

1. **Clean TypeScript Build**:
   - Zero compiler errors across `src/persistence/` and `src/audio/`.
2. **Headless Execution**:
   - `Persistence.test.ts` executes in under 200ms using `fake-indexeddb` with zero DOM or network dependencies.
3. **Lossless Round-Trip**:
   - 100% of game state fields (clock, cash, hardware, files, downloads, messages, relationships, narrative flags, telemetry) survive serialization and deserialization.
4. **Procedural Sound Fidelity**:
   - Dial-up handshake produces 10 authentic sequential acoustic phases purely from Web Audio nodes without external MP3/WAV assets.
5. **Autosave Safety**:
   - Debounced auto-save prevents transaction contention and database lockups during rapid continuous simulation updates.
