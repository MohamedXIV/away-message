import { db, AwayMessageDB } from './db';
import {
  type SaveSlotRecord,
  type FullSimulationSnapshot,
  FullSimulationSnapshotSchema,
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
      createdAt: snapshot.saveSlot.createdAt || now,
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
        this.database.telemetry_logs,
      ],
      async () => {
        // Save Master Slot
        await this.database.saves.put(saveSlot);

        // Bulk Overwrite Tables
        await this.database.vfs_files.clear();
        if (snapshot.vfsFiles.length > 0) {
          await this.database.vfs_files.bulkPut(snapshot.vfsFiles);
        }

        await this.database.downloads.clear();
        if (snapshot.downloads.length > 0) {
          await this.database.downloads.bulkPut(snapshot.downloads);
        }

        await this.database.installed_software.clear();
        if (snapshot.installedSoftware.length > 0) {
          await this.database.installed_software.bulkPut(snapshot.installedSoftware);
        }

        await this.database.messages.clear();
        if (snapshot.messages.length > 0) {
          await this.database.messages.bulkPut(snapshot.messages);
        }

        await this.database.relationships.clear();
        if (snapshot.relationships.length > 0) {
          await this.database.relationships.bulkPut(snapshot.relationships);
        }

        await this.database.narrative_state.clear();
        if (snapshot.narrativeState.length > 0) {
          await this.database.narrative_state.bulkPut(snapshot.narrativeState);
        }

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
      }, 50); // 50ms debounce
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
      telemetryLogs,
    ] = await Promise.all([
      this.database.vfs_files.toArray(),
      this.database.downloads.toArray(),
      this.database.installed_software.toArray(),
      this.database.messages.toArray(),
      this.database.relationships.toArray(),
      this.database.narrative_state.toArray(),
      this.database.telemetry_logs.toArray(),
    ]);

    const snapshot: FullSimulationSnapshot = {
      saveSlot,
      vfsFiles,
      downloads,
      installedSoftware,
      messages,
      relationships,
      narrativeState,
      telemetryLogs,
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
        this.database.telemetry_logs,
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
          this.database.telemetry_logs.clear(),
        ]);
      }
    );
  }
}

export const saveManager = new SaveManager(db);
