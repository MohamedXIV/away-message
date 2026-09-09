import { DownloadTask, DownloadManagerState, DownloadManagerType } from './types';
import { EventBus } from './EventBus';
import { FileSystemEngine } from './FileSystemEngine';

export interface DownloadClientProfile {
  clientId: string;
  maxConcurrent: number;
  supportsResume: boolean;
  supportsQueueReordering?: boolean;
}

type ProfiledDownloadTask = DownloadTask & {
  clientProfile?: DownloadClientProfile;
};

const LEGACY_BROWSER_PROFILE: DownloadClientProfile = {
  clientId: 'browser',
  maxConcurrent: 1,
  supportsResume: true,
};

const LEGACY_FLASHFETCH_PROFILE: DownloadClientProfile = {
  clientId: 'flashfetch',
  maxConcurrent: 4,
  supportsResume: true,
};

export interface DownloadManagerDependencies {
  eventBus: EventBus;
  vfs: FileSystemEngine;
  getConnectionSpeedKbps: () => number;
}

export class DownloadManager {
  private tasks: Map<string, ProfiledDownloadTask> = new Map();
  private eventBus: EventBus;
  private vfs: FileSystemEngine;
  private getConnectionSpeedKbps: () => number;
  private maxConcurrentBrowser = 1;
  private maxConcurrentFlashFetch = 4;

  constructor(deps: DownloadManagerDependencies, initialState?: DownloadManagerState) {
    this.eventBus = deps.eventBus;
    this.vfs = deps.vfs;
    this.getConnectionSpeedKbps = deps.getConnectionSpeedKbps;

    if (initialState) {
      this.restoreState(initialState);
    }
  }

  public getState(): DownloadManagerState {
    return {
      tasks: Array.from(this.tasks.values()).map(t => ({ ...t })),
      // Retained for save compatibility while callers migrate to per-client profiles.
      maxConcurrentBrowser: this.maxConcurrentBrowser,
      maxConcurrentFlashFetch: this.maxConcurrentFlashFetch,
    };
  }

  public restoreState(state: DownloadManagerState): void {
    this.tasks.clear();
    for (const task of state.tasks) {
      this.tasks.set(task.id, { ...task });
    }
    this.recalculateBandwidth();
  }

  public startDownload(params: {
    sourceId: string;
    sourceUrl: string;
    fileName: string;
    totalBytes: number;
    sourceMaxKbps: number;
    fileKind?: 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text';
    resumable?: boolean;
    manager?: DownloadManagerType;
    clientProfile?: DownloadClientProfile;
    currentMinute?: number;
    appAssociation?: string;
  }): DownloadTask {
    const connectionSpeedKbps = this.getConnectionSpeedKbps();
    if (!Number.isFinite(connectionSpeedKbps) || connectionSpeedKbps <= 0) {
      throw new Error('No usable network connection is available for this download.');
    }

    // Check available disk space
    if (this.vfs.getFreeDiskBytes() < params.totalBytes) {
      throw new Error(
        `Insufficient disk space on C:. Required: ${params.totalBytes} bytes, Available: ${this.vfs.getFreeDiskBytes()} bytes.`
      );
    }

    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const manager = params.manager || 'browser';
    const clientProfile = params.clientProfile ?? this.legacyProfileForManager(manager);
    const currentMinute = params.currentMinute ?? 0;

    const task: ProfiledDownloadTask = {
      id,
      sourceId: params.sourceId,
      sourceUrl: params.sourceUrl,
      fileName: params.fileName,
      targetDirectory: 'C:/Downloads',
      totalBytes: params.totalBytes,
      downloadedBytes: 0,
      sourceMaxKbps: params.sourceMaxKbps,
      allocatedKbps: 0,
      status: 'queued',
      resumable: clientProfile.supportsResume && (params.resumable ?? true),
      manager,
      clientProfile: { ...clientProfile },
      startedAtMinute: currentMinute,
      fileKind: params.fileKind ?? 'executable',
      appAssociation: params.appAssociation,
    };

    this.tasks.set(id, task);
    this.updateQueueSlots();
    this.recalculateBandwidth();
    this.eventBus.emit('download:started', { task: { ...task } });

    return { ...task };
  }

  public pauseDownload(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'downloading') return false;

    task.status = 'paused';
    task.allocatedKbps = 0;
    this.updateQueueSlots();
    this.recalculateBandwidth();
    this.eventBus.emit('download:paused', { task: { ...task } });
    return true;
  }

  public resumeDownload(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    if (!task.resumable) {
      task.downloadedBytes = 0; // Non-resumable downloads restart
    }

    task.status = 'queued';
    this.updateQueueSlots();
    this.recalculateBandwidth();
    this.eventBus.emit('download:resumed', { task: { ...task } });
    return true;
  }

  public cancelDownload(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'cancelled';
    task.allocatedKbps = 0;
    this.tasks.delete(taskId);
    this.updateQueueSlots();
    this.recalculateBandwidth();
    this.eventBus.emit('download:cancelled', { taskId });
    return true;
  }

  public getActiveDownloads(): DownloadTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === 'downloading');
  }

  public getTask(taskId: string): DownloadTask | undefined {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : undefined;
  }

  /**
   * Authoritative Time Advance (handles both 1-minute ticks and multi-hour jumps).
   * Uses water-filling discrete event advancement.
   */
  public advanceTime(elapsedMinutes: number, currentMinute: number): void {
    let remainingSeconds = elapsedMinutes * 60;

    while (remainingSeconds > 0) {
      this.updateQueueSlots();
      this.recalculateBandwidth();
      const activeTasks = this.getActiveDownloads();
      if (activeTasks.length === 0) break;

      // Find the earliest completion time among active tasks
      let minTimeToCompletion = remainingSeconds;
      for (const task of activeTasks) {
        if (task.allocatedKbps > 0) {
          const bytesRemaining = task.totalBytes - task.downloadedBytes;
          const bytesPerSec = (task.allocatedKbps * 1024) / 8;
          const timeToFinish = bytesRemaining / bytesPerSec;
          if (timeToFinish < minTimeToCompletion) {
            minTimeToCompletion = timeToFinish;
          }
        }
      }

      const stepSeconds = Math.min(remainingSeconds, Math.max(0.1, minTimeToCompletion));

      // Advance bytes for all active tasks
      for (const task of activeTasks) {
        if (task.allocatedKbps > 0) {
          const bytesTransferred = ((task.allocatedKbps * 1024) / 8) * stepSeconds;
          task.downloadedBytes = Math.min(task.totalBytes, task.downloadedBytes + bytesTransferred);

          if (task.downloadedBytes >= task.totalBytes) {
            this.completeTask(task, currentMinute);
          }
        }
      }

      remainingSeconds -= stepSeconds;
    }
  }

  private completeTask(task: DownloadTask, currentMinute: number): void {
    task.status = 'complete';
    task.allocatedKbps = 0;
    task.completedAtMinute = currentMinute;

    // Create persistent file in VFS
    const filePath = `${task.targetDirectory}/${task.fileName}`;
    try {
      this.vfs.createFile(
        {
          name: task.fileName,
          path: filePath,
          parentPath: task.targetDirectory,
          kind: task.fileKind === 'installer' ? 'installer' : 'executable',
          sizeBytes: task.totalBytes,
          appAssociation: task.appAssociation,
          metadata: {
            author: task.sourceId,
            version: '1.0',
          },
        },
        currentMinute
      );
    } catch {
      // File might already exist if re-downloaded
    }

    this.eventBus.emit('download:completed', { task: { ...task }, filePath });
  }

  public updateQueueSlots(): void {
    const activeCounts = new Map<string, number>();
    for (const task of this.tasks.values()) {
      if (task.status !== 'downloading') continue;
      const profile = this.profileForTask(task);
      activeCounts.set(profile.clientId, (activeCounts.get(profile.clientId) ?? 0) + 1);
    }

    for (const task of this.tasks.values()) {
      if (task.status !== 'queued') continue;
      const profile = this.profileForTask(task);
      const active = activeCounts.get(profile.clientId) ?? 0;
      const maxConcurrent = Math.max(1, Math.floor(profile.maxConcurrent));
      if (active < maxConcurrent) {
        task.status = 'downloading';
        activeCounts.set(profile.clientId, active + 1);
      }
    }
  }

  /**
   * Water-filling bandwidth allocation algorithm.
   */
  public recalculateBandwidth(): void {
    const activeTasks = this.getActiveDownloads();
    if (activeTasks.length === 0) return;

    const totalConnectionKbps = this.getConnectionSpeedKbps();
    let unassigned = [...activeTasks];
    let remainingBandwidth = totalConnectionKbps;

    // Reset allocated
    for (const t of activeTasks) t.allocatedKbps = 0;

    while (unassigned.length > 0 && remainingBandwidth > 0) {
      const fairShare = remainingBandwidth / unassigned.length;
      const bottleneckTasks = unassigned.filter(t => t.sourceMaxKbps <= fairShare);

      if (bottleneckTasks.length > 0) {
        for (const task of bottleneckTasks) {
          task.allocatedKbps = task.sourceMaxKbps;
          remainingBandwidth -= task.sourceMaxKbps;
          unassigned = unassigned.filter(t => t.id !== task.id);
        }
      } else {
        for (const task of unassigned) {
          task.allocatedKbps = fairShare;
        }
        remainingBandwidth = 0;
        break;
      }
    }
  }

  private profileForTask(task: ProfiledDownloadTask): DownloadClientProfile {
    return task.clientProfile ?? this.legacyProfileForManager(task.manager);
  }

  private legacyProfileForManager(manager: DownloadManagerType): DownloadClientProfile {
    return manager === 'flashfetch' ? LEGACY_FLASHFETCH_PROFILE : LEGACY_BROWSER_PROFILE;
  }
}
