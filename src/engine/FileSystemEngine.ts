import { FileRecord, VirtualFileSystemState } from './types';
import { EventBus } from './EventBus';

export class FileSystemEngine {
  private totalDiskBytes = 42_949_672_960; // 40 GB
  private baseSystemBytes = 36_293_869_568; // 33.8 GB Base OS
  private files: Map<string, FileRecord> = new Map();
  private eventBus: EventBus;

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

  public getState(): VirtualFileSystemState {
    const fileRecords: Record<string, FileRecord> = {};
    for (const [path, record] of this.files.entries()) {
      fileRecords[path] = { ...record };
    }
    return {
      totalDiskBytes: this.totalDiskBytes,
      baseSystemBytes: this.baseSystemBytes,
      files: fileRecords,
    };
  }

  public restoreState(state: VirtualFileSystemState): void {
    this.totalDiskBytes = state.totalDiskBytes;
    this.baseSystemBytes = state.baseSystemBytes;
    this.files.clear();
    for (const [path, record] of Object.entries(state.files)) {
      this.files.set(this.normalizePath(path), { ...record });
    }
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
    let total = this.baseSystemBytes;
    for (const file of this.files.values()) {
      if (file.kind !== 'directory') {
        total += file.sizeBytes;
      }
    }
    return total;
  }

  public getFreeDiskBytes(): number {
    return Math.max(0, this.totalDiskBytes - this.getOccupiedDiskBytes());
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

    const record: FileRecord = {
      id: fileData.id || `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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

    this.files.set(path, record);
    this.eventBus.emit('vfs:file_created', { file: { ...record } });
    return { ...record };
  }

  public readFile(path: string): FileRecord | undefined {
    const record = this.files.get(this.normalizePath(path));
    return record ? { ...record } : undefined;
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

    this.files.delete(normalized);

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

    this.files.set(trashPath, trashedRecord);
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

    this.files.delete(normalized);

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

    this.files.set(originalPath, restored);
    this.eventBus.emit('vfs:file_restored', { file: { ...restored } });
    return { ...restored };
  }

  public emptyTrash(): number {
    let bytesReclaimed = 0;
    const trashFiles = this.listDirectory('C:/Trash');
    for (const file of trashFiles) {
      this.files.delete(file.path);
      bytesReclaimed += file.sizeBytes;
    }
    this.eventBus.emit('vfs:trash_emptied', { bytesReclaimed });
    return bytesReclaimed;
  }

  public deletePermanently(path: string): boolean {
    const normalized = this.normalizePath(path);
    const record = this.files.get(normalized);
    if (!record) return false;

    this.files.delete(normalized);
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

    this.files.set(normalized, updated);
    return { ...updated };
  }
}
