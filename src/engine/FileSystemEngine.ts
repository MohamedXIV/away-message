import type { FileRecord, VirtualFileSystemState } from './types';

/** Editor-facing data for exactly one explicitly opened file. */
export type DisplayFileRecord = Pick<FileRecord,
  'id' | 'name' | 'path' | 'parentPath' | 'kind' | 'sizeBytes'
  | 'createdAtMinute' | 'modifiedAtMinute' | 'appAssociation'
  | 'targetPath' | 'content' | 'isReadOnly'> & {
  metadata?: { textContent?: string };
};
import { EventBus } from './EventBus';

export class FileSystemEngine {
  private totalDiskBytes = 42_949_672_960; // 40 GB
  private baseSystemBytes = 36_293_869_568; // 33.8 GB Base OS
  private files: Map<string, FileRecord> = new Map();
  // Disk usage belongs to the VFS owner. Directory projections must not sum
  // an unbounded file map just to show free space on each UI revision.
  private occupiedFileBytes = 0;
  /** Per-world owner allocator, preserved even after permanent deletion. */
  private nextFileOrdinal = 1;
  private eventBus: EventBus;

  private fileBytes(record: FileRecord | undefined): number {
    return record && record.kind !== 'directory' ? record.sizeBytes : 0;
  }

  private putFile(path: string, record: FileRecord): void {
    this.occupiedFileBytes += this.fileBytes(record) - this.fileBytes(this.files.get(path));
    this.files.set(path, record);
  }

  private removeFile(path: string): void {
    this.occupiedFileBytes -= this.fileBytes(this.files.get(path));
    this.files.delete(path);
  }

  public static readonly CANONICAL_DIRECTORIES = [
    'C:',
    'C:/Desktop',
    'C:/Downloads',
    'C:/Program Files',
    'C:/Documents',
    'C:/Music',
    'C:/Pictures',
    'C:/Trash',
  ];

  constructor(eventBus: EventBus, initialState?: VirtualFileSystemState) {
    this.eventBus = eventBus;

    if (initialState) {
      this.restoreState(initialState);
    } else {
      this.initializeCanonicalHierarchy();
    }
  }

  /** Directory view with no file bodies, image payloads or unrelated folders. */
  public listDirectoryMetadata(dirPath: string, limit = Infinity, offset = 0): FileRecord[] {
    const normalized = this.normalizePath(dirPath);
    const max = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : Infinity;
    const skip = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
    const result: FileRecord[] = [];
    if (max === 0) return result;
    let seen = 0;
    for (const record of this.files.values()) {
      if (record.parentPath !== normalized || record.path === normalized) continue;
      if (seen++ < skip) continue;
      const { id, name, path, parentPath, kind, sizeBytes, createdAtMinute, modifiedAtMinute,
        appAssociation, targetPath } = record;
      result.push({
        id, name, path, parentPath, kind, sizeBytes, createdAtMinute, modifiedAtMinute,
        ...(appAssociation ? { appAssociation } : {}),
        ...(targetPath ? { targetPath } : {}),
        ...(record.metadata?.originalTrashPath
          ? { metadata: { originalTrashPath: record.metadata.originalTrashPath } } : {}),
      });
      if (result.length >= max) break;
    }
    return result;
  }

  public getDiskCapacity(): { totalDiskBytes: number; baseSystemBytes: number } {
    return { totalDiskBytes: this.totalDiskBytes, baseSystemBytes: this.baseSystemBytes };
  }

  public getState(): VirtualFileSystemState {
    const fileRecords: Record<string, FileRecord> = {};
    for (const [path, record] of this.files.entries()) {
      fileRecords[path] = { ...record };
    }
    return {
      totalDiskBytes: this.totalDiskBytes,
      baseSystemBytes: this.baseSystemBytes,
      files: fileRecords,
      nextFileOrdinal: this.nextFileOrdinal,
    };
  }

  public restoreState(state: VirtualFileSystemState): void {
    this.totalDiskBytes = state.totalDiskBytes;
    this.baseSystemBytes = state.baseSystemBytes;
    this.files.clear();
    this.occupiedFileBytes = 0;
    // Earlier development snapshots may not contain the allocator checkpoint.
    // Reconstruct a safe lower bound from the remaining owner IDs; current
    // saves always include the checkpoint so deletion cannot recycle an ID.
    let maxSeen = 0;
    for (const [path, record] of Object.entries(state.files)) {
      this.putFile(this.normalizePath(path), { ...record });
      const match = /^file_(\d+)$/.exec(record.id);
      if (match) maxSeen = Math.max(maxSeen, Number(match[1]));
    }
    const saved = state.nextFileOrdinal;
    this.nextFileOrdinal = Math.max(maxSeen + 1,
      Number.isSafeInteger(saved) && saved! > 0 ? saved! : 1);
  }

  private initializeCanonicalHierarchy(): void {
    for (const dir of FileSystemEngine.CANONICAL_DIRECTORIES) {
      const parent = dir === 'C:' ? '' : dir.substring(0, dir.lastIndexOf('/')) || 'C:';
      const name = dir === 'C:' ? 'C:' : dir.substring(dir.lastIndexOf('/') + 1);
      this.files.set(dir, {
        id: `dir_${name.toLowerCase()}`,
        name,
        path: dir,
        parentPath: parent,
        kind: 'directory',
        sizeBytes: 0,
        createdAtMinute: 0,
        modifiedAtMinute: 0,
      });
    }

    // Default desktop readme
    this.createFile(
      {
        name: 'Readme.txt',
        path: 'C:/Documents/Readme.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 2048,
        appAssociation: 'app.notepad',
        content: 'Welcome to Orion OS 4.8.\nYour temporary workstation is configured for standard productivity.',
        metadata: {
          textContent: 'Welcome to Orion OS 4.8.\nYour temporary workstation is configured for standard productivity.',
        },
      },
      0
    );
  }

  public normalizePath(path: string): string {
    let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').trim();
    if (normalized.endsWith('/') && normalized.length > 3) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  public getOccupiedDiskBytes(): number {
    return this.baseSystemBytes + this.occupiedFileBytes;
  }

  public getFreeDiskBytes(): number {
    return Math.max(0, this.totalDiskBytes - this.getOccupiedDiskBytes());
  }

  private allocateFileId(): string {
    if (!Number.isSafeInteger(this.nextFileOrdinal)) {
      throw new Error('VFS file ID space exhausted');
    }
    // The counter already exceeds every generated/explicit file_N ID. Do not
    // scan the entire VFS for every file creation (500 files must remain cheap).
    return `file_${this.nextFileOrdinal++}`;
  }

  public createFile(
    fileData: Omit<FileRecord, 'id' | 'createdAtMinute' | 'modifiedAtMinute'> & {
      id?: string;
      createdAtMinute?: number;
      modifiedAtMinute?: number;
    },
    currentMinute = 0
  ): FileRecord {
    const path = this.normalizePath(fileData.path);
    const parentPath = this.normalizePath(fileData.parentPath);

    if (this.files.has(path)) {
      throw new Error(`File already exists at ${path}`);
    }

    if (parentPath !== '' && !this.files.has(parentPath)) {
      throw new Error(`Parent directory does not exist: ${parentPath}`);
    }

    if (fileData.kind !== 'directory') {
      const freeSpace = this.getFreeDiskBytes();
      if (fileData.sizeBytes > freeSpace) {
        throw new Error(`Disk Full. Required: ${fileData.sizeBytes} bytes, Available: ${freeSpace} bytes.`);
      }
    }

    // Explicit ID callers remain responsible for their own identities. If
    // they insert file_N, advance this owner's allocator past it as well.
    if (fileData.id) {
      const match = /^file_(\d+)$/.exec(fileData.id);
      if (match) this.nextFileOrdinal = Math.max(this.nextFileOrdinal, Number(match[1]) + 1);
    }
    const record: FileRecord = {
      id: fileData.id || this.allocateFileId(),
      name: fileData.name,
      path,
      parentPath,
      kind: fileData.kind,
      sizeBytes: fileData.sizeBytes,
      createdAtMinute: fileData.createdAtMinute ?? currentMinute,
      modifiedAtMinute: fileData.modifiedAtMinute ?? currentMinute,
      appAssociation: fileData.appAssociation,
      targetPath: fileData.targetPath,
      content: fileData.content,
      isReadOnly: fileData.isReadOnly,
      metadata: fileData.metadata ? { ...fileData.metadata } : undefined,
    };

    this.putFile(path, record);
    this.eventBus.emit('vfs:file_created', { file: { ...record } });
    return { ...record };
  }

  /**
   * Selected-file projection for the editor. Arbitrary VFS metadata can
   * contain owner-private extensions and non-cloneable values; only the
   * authored text fallback travels to React or a future Worker boundary.
   */
  public readFileForDisplay(path: string): DisplayFileRecord | undefined {
    const record = this.files.get(this.normalizePath(path));
    if (!record) return undefined;
    const {
      id, name, path: filePath, parentPath, kind, sizeBytes, createdAtMinute,
      modifiedAtMinute, appAssociation, targetPath, content, isReadOnly,
    } = record;
    const textContent = record.metadata?.textContent;
    return {
      id, name, path: filePath, parentPath, kind, sizeBytes, createdAtMinute,
      modifiedAtMinute, ...(appAssociation !== undefined ? { appAssociation } : {}),
      ...(targetPath !== undefined ? { targetPath } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(isReadOnly !== undefined ? { isReadOnly } : {}),
      ...(typeof textContent === 'string' ? { metadata: { textContent } } : {}),
    };
  }

  public readFile(path: string): FileRecord | undefined {
    const record = this.files.get(this.normalizePath(path));
    return record ? { ...record } : undefined;
  }

  /** Resolve a host API's bare file name only on explicit open; never publish the file map. */
  public findFileByPathOrName(pathOrName: string): FileRecord | undefined {
    const exact = this.readFile(pathOrName);
    if (exact) return exact;
    for (const record of this.files.values()) {
      if (record.name === pathOrName) return { ...record };
    }
    return undefined;
  }

  public listDirectory(dirPath: string): FileRecord[] {
    const normalized = this.normalizePath(dirPath);
    const results: FileRecord[] = [];
    for (const record of this.files.values()) {
      if (record.parentPath === normalized && record.path !== normalized) {
        results.push({ ...record });
      }
    }
    return results;
  }

  public moveToTrash(path: string, currentMinute = 0): FileRecord {
    const normalized = this.normalizePath(path);
    const record = this.files.get(normalized);
    if (!record) throw new Error(`File not found: ${normalized}`);
    if (record.kind === 'directory') throw new Error('Deleting entire directories not supported directly');

    this.removeFile(normalized);

    const trashPath = `C:/Trash/${record.name}`;
    const trashedRecord: FileRecord = {
      ...record,
      path: trashPath,
      parentPath: 'C:/Trash',
      modifiedAtMinute: currentMinute,
      metadata: {
        ...record.metadata,
        originalTrashPath: normalized,
      },
    };

    this.putFile(trashPath, trashedRecord);
    this.eventBus.emit('vfs:file_trashed', { file: { ...trashedRecord } });
    return { ...trashedRecord };
  }

  public restoreFromTrash(trashPath: string, currentMinute = 0): FileRecord {
    const normalized = this.normalizePath(trashPath);
    const record = this.files.get(normalized);
    if (!record || record.parentPath !== 'C:/Trash') {
      throw new Error(`File not in trash: ${normalized}`);
    }

    const originalPath = record.metadata?.originalTrashPath as string | undefined;
    if (!originalPath) throw new Error(`Missing original path metadata for ${normalized}`);

    const originalParent = originalPath.substring(0, originalPath.lastIndexOf('/')) || 'C:';
    if (!this.files.has(originalParent)) {
      throw new Error(`Original parent directory no longer exists: ${originalParent}`);
    }

    this.removeFile(normalized);

    const restored: FileRecord = {
      ...record,
      path: originalPath,
      parentPath: originalParent,
      modifiedAtMinute: currentMinute,
      metadata: {
        ...record.metadata,
        originalTrashPath: undefined,
      },
    };

    this.putFile(originalPath, restored);
    this.eventBus.emit('vfs:file_restored', { file: { ...restored } });
    return { ...restored };
  }

  public emptyTrash(): number {
    let bytesReclaimed = 0;
    let count = 0;
    for (const [path, file] of this.files) {
      if (file.parentPath !== 'C:/Trash' || path === 'C:/Trash') continue;
      this.removeFile(path);
      bytesReclaimed += file.sizeBytes;
      count++;
    }
    // Emptying an already empty directory is a read/no-op; don't emit an
    // owner mutation that would fabricate a simulation revision.
    if (count > 0) this.eventBus.emit('vfs:trash_emptied', { bytesReclaimed });
    return bytesReclaimed;
  }

  public deletePermanently(path: string): boolean {
    const normalized = this.normalizePath(path);
    const record = this.files.get(normalized);
    if (!record) return false;

    this.removeFile(normalized);
    this.eventBus.emit('vfs:file_deleted', { path: normalized, sizeBytes: record.sizeBytes });
    return true;
  }

  public updateFile(
    path: string,
    updates: Partial<Pick<FileRecord, 'content' | 'sizeBytes' | 'metadata'>>,
    currentMinute = 0
  ): FileRecord {
    const normalized = this.normalizePath(path);
    const record = this.files.get(normalized);
    if (!record) throw new Error(`File not found: ${normalized}`);

    const updated: FileRecord = {
      ...record,
      content: updates.content !== undefined ? updates.content : record.content,
      sizeBytes: updates.sizeBytes !== undefined ? updates.sizeBytes : record.sizeBytes,
      modifiedAtMinute: currentMinute,
      metadata: updates.metadata ? { ...record.metadata, ...updates.metadata } : record.metadata,
    };

    this.putFile(normalized, updated);
    return { ...updated };
  }
}
