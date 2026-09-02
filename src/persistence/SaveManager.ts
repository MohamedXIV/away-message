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
    const worldTable = (this.database as unknown as { world_state?: unknown }).world_state;
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
        ...(worldTable ? [worldTable as never] : []),
        this.database.telemetry_logs,
        ...(this.database.pulse_state ? [this.database.pulse_state] : []),
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

        const worldTable = (this.database as unknown as { world_state?: { clear: () => Promise<void>; bulkPut: (items: unknown[]) => Promise<void> } }).world_state;
        if (worldTable) {
          await worldTable.clear();
          const worldState = (snapshot as any).worldState ?? snapshot.narrativeState;
          const osState = (snapshot as any).osState;
          const toPut: unknown[] = [];
          if (worldState && worldState.length > 0) toPut.push(...worldState);
          if (osState && osState.length > 0) toPut.push(...osState);
          if (toPut.length > 0) await worldTable.bulkPut(toPut as any);
        }

        if (snapshot.telemetryLogs.length > 0) {
          await this.database.telemetry_logs.clear();
          await this.database.telemetry_logs.bulkPut(snapshot.telemetryLogs);
        }

        // Save slot-specific Pulse state if provided
        if (snapshot.pulseState && (this.database as unknown as { pulse_state?: { put: (record: unknown) => Promise<void> } }).pulse_state) {
          try {
            await (this.database as unknown as { pulse_state: { put: (record: unknown) => Promise<void> } }).pulse_state.put({
              saveSlotId: slotId,
              state: snapshot.pulseState,
              updatedAt: now,
            });
          } catch {
            // Pulse state is best-effort; core save should not fail if this does
          }
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

    let worldState: typeof narrativeState | undefined = undefined;
    let osState: typeof narrativeState | undefined = undefined;
    try {
      const worldTable = (this.database as unknown as { world_state?: { toArray: () => Promise<typeof narrativeState> } }).world_state;
      if (worldTable) {
        const allWorld = await worldTable.toArray();
        // Split by key prefix: os_ -> osState, else worldState
        worldState = allWorld.filter((r: any) => !String(r.key).startsWith('os_'));
        osState = allWorld.filter((r: any) => String(r.key).startsWith('os_'));
        if (osState.length === 0) osState = undefined;
        if (worldState.length === 0) worldState = undefined;
      }
    } catch {
      worldState = undefined;
      osState = undefined;
    }

    let pulseState: unknown = undefined;
    try {
      const pulseTable = (this.database as unknown as { pulse_state?: { get: (id: string) => Promise<{ state: unknown } | undefined> } }).pulse_state;
      if (pulseTable) {
        const pulseRecord = await pulseTable.get(slotId);
        pulseState = pulseRecord?.state;
      }
    } catch {
      pulseState = undefined;
    }

    const snapshot: FullSimulationSnapshot = {
      saveSlot,
      vfsFiles,
      downloads,
      installedSoftware,
      messages,
      relationships,
      narrativeState: worldState && worldState.length > 0 ? worldState : narrativeState,
      worldState: worldState && worldState.length > 0 ? worldState : narrativeState,
      osState: osState && osState.length > 0 ? osState : undefined,
      telemetryLogs,
      pulseState,
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
    try {
      const pulseTable = (this.database as unknown as { pulse_state?: { delete: (id: string) => Promise<void> } }).pulse_state;
      if (pulseTable) await pulseTable.delete(slotId);
    } catch {
      // ignore
    }
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
    const tables: unknown[] = [
      this.database.saves,
      this.database.vfs_files,
      this.database.downloads,
      this.database.installed_software,
      this.database.messages,
      this.database.relationships,
      this.database.narrative_state,
      this.database.telemetry_logs,
    ];
    const worldTable = (this.database as unknown as { world_state?: unknown }).world_state;
    if (worldTable) tables.push(worldTable);
    const pulseTable = (this.database as unknown as { pulse_state?: unknown }).pulse_state;
    if (pulseTable) tables.push(pulseTable);
    await this.database.transaction(
      'rw',
      tables as never[],
      async () => {
        const clears: Promise<void>[] = [
          this.database.saves.clear(),
          this.database.vfs_files.clear(),
          this.database.downloads.clear(),
          this.database.installed_software.clear(),
          this.database.messages.clear(),
          this.database.relationships.clear(),
          this.database.narrative_state.clear(),
          this.database.telemetry_logs.clear(),
        ];
        const worldClear = (this.database as unknown as { world_state?: { clear: () => Promise<void> } }).world_state;
        if (worldClear) clears.push(worldClear.clear());
        const pulseClear = (this.database as unknown as { pulse_state?: { clear: () => Promise<void> } }).pulse_state;
        if (pulseClear) clears.push(pulseClear.clear());
        await Promise.all(clears);
      }
    );
  }
}

export const saveManager = new SaveManager(db);
