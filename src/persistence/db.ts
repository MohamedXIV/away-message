import Dexie, { type Table } from 'dexie';
import type { MessageRecord as CanonicalMessageRecord } from '../engine/types';

/** Slot-specific cold chronological pages, never the old global messages table. */
export interface ConversationArchivePage {
  key: string;
  slotId: string;
  conversationId: string;
  pageIndex: number;
  messages: CanonicalMessageRecord[];
}
import type {
  SaveSlotRecord,
  VfsFileRecord,
  DownloadTaskRecord,
  InstalledSoftwareRecord,
  MessageRecord,
  RelationshipRecord,
  NarrativeStateRecord,
  TelemetryLogRecord,
  AICacheRecord,
  PulseStateRecord,
} from './schema';

export class AwayMessageDB extends Dexie {
  saves!: Table<SaveSlotRecord, string>;
  conversation_pages!: Table<ConversationArchivePage, string>;
  vfs_files!: Table<VfsFileRecord, string>;
  downloads!: Table<DownloadTaskRecord, string>;
  installed_software!: Table<InstalledSoftwareRecord, string>;
  messages!: Table<MessageRecord, string>;
  relationships!: Table<RelationshipRecord, string>;
  narrative_state!: Table<NarrativeStateRecord, string>;
  world_state!: Table<NarrativeStateRecord, string>;
  telemetry_logs!: Table<TelemetryLogRecord, number>;
  ai_cache!: Table<AICacheRecord, string>;
  pulse_state!: Table<PulseStateRecord, string>;

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
      world_state: 'key, updatedAt',
      telemetry_logs: '++id, timestamp, gameDay, eventType',
    });

    // AI artifacts are app-level cache, intentionally excluded from save slots.
    this.version(2).stores({
      saves: 'id, name, updatedAt, day',
      vfs_files: 'id, path, parentPath, kind, name, createdAt',
      downloads: 'id, status, startedAt, completedAt',
      installed_software: 'appId, installedAt, version',
      messages: 'id, buddyId, timestamp, isRead, [buddyId+timestamp]',
      relationships: 'buddyId, lastInteractionDay',
      narrative_state: 'key, updatedAt',
      world_state: 'key, updatedAt',
      telemetry_logs: '++id, timestamp, gameDay, eventType',
      ai_cache: 'key, kind, expiresAt, providerId',
    });

    // Pulse social state is save-slot-specific so each timeline stays independent.
    this.version(3).stores({
      saves: 'id, name, updatedAt, day',
      vfs_files: 'id, path, parentPath, kind, name, createdAt',
      downloads: 'id, status, startedAt, completedAt',
      installed_software: 'appId, installedAt, version',
      messages: 'id, buddyId, timestamp, isRead, [buddyId+timestamp]',
      relationships: 'buddyId, lastInteractionDay',
      narrative_state: 'key, updatedAt',
      world_state: 'key, updatedAt',
      telemetry_logs: '++id, timestamp, gameDay, eventType',
      ai_cache: 'key, kind, expiresAt, providerId',
      pulse_state: 'saveSlotId',
    });

    this.version(4).stores({
      saves: 'id, name, updatedAt, day',
      vfs_files: 'id, path, parentPath, kind, name, createdAt',
      downloads: 'id, status, startedAt, completedAt',
      installed_software: 'appId, installedAt, version',
      messages: 'id, buddyId, timestamp, isRead, [buddyId+timestamp]',
      relationships: 'buddyId, lastInteractionDay',
      narrative_state: 'key, updatedAt',
      world_state: 'key, updatedAt',
      telemetry_logs: '++id, timestamp, gameDay, eventType',
      ai_cache: 'key, kind, expiresAt, providerId',
      pulse_state: 'saveSlotId',
    });

    // #173: append-only schema migration; unlike legacy messages these
    // pages are per save slot and replaced atomically with that slot document.
    this.version(5).stores({
      conversation_pages: 'key, slotId, [slotId+conversationId+pageIndex]',
    });
  }
}

// Singleton database instance for application runtime
export const db = new AwayMessageDB();
