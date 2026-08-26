# Milestone 1 (Part B) Technical Architecture & Implementation Blueprint
## Subsystems: DownloadManager, FileSystemEngine, SoftwareRegistry, and SocialEngine

**Author**: Explorer M1-2  
**Role**: Teamwork Explorer (Core Subsystems Architect)  
**Target Milestone**: Milestone 1 (Foundation & Simulation Engine)  
**Integrity Mode**: Pure TypeScript, Zero UI Coupling, 100% Deterministic  
**Files Designed**:
1. `src/engine/DownloadManager.ts` & `src/engine/types/downloads.ts`
2. `src/engine/FileSystemEngine.ts` & `src/engine/types/vfs.ts`
3. `src/engine/SoftwareRegistry.ts` & `src/engine/types/software.ts`
4. `src/engine/SocialEngine.ts` & `src/engine/types/social.ts`

---

# Table of Contents
1. [Core Architectural Principles & Contracts](#1-core-architectural-principles--contracts)
2. [Subsystem 1: DownloadManager.ts](#2-subsystem-1-downloadmanagerts)
   - 2.1 Domain Requirements & Bandwidth Mathematics
   - 2.2 Download State Machine
   - 2.3 Continuous Ticking & Discrete Time Jump Invariant
   - 2.4 Manager Modes (Browser vs FlashFetch 3.1)
   - 2.5 Complete TypeScript Code Blueprint
3. [Subsystem 2: FileSystemEngine.ts](#3-subsystem-2-filesystemengine)
   - 3.1 VFS Hierarchy & FileRecord Schema
   - 3.2 40GB HDD Storage Accounting & Free Space Math
   - 3.3 CRUD Operations, Trash Lifecycle & Execution Hooks
   - 3.4 Complete TypeScript Code Blueprint
4. [Subsystem 3: SoftwareRegistry.ts](#4-subsystem-3-softwareregistryts)
   - 4.1 6-Stage Installer Wizard State Machine
   - 4.2 Hardware & OS Requirement Gating
   - 4.3 Bundled Adware (WeatherBuddy & SearchMate) & Uninstallation
   - 4.4 Software Catalog (10+ Applications) & Portable Distinction
   - 4.5 Complete TypeScript Code Blueprint
5. [Subsystem 4: SocialEngine.ts](#5-subsystem-4-socialenginets)
   - 5.1 14-Day Schedule Matrices (Ryan, Maya, Nora, Mr. Henderson)
   - 5.2 5 Hidden Relationship Dimensions & Vector Mathematics
   - 5.3 Semantic Social Action Tag Processing
   - 5.4 Message Logging, Unread Tracking & Offline Delivery
   - 5.5 Complete TypeScript Code Blueprint
6. [Subsystem Integration & Event Flow Diagram](#6-subsystem-integration--event-flow-diagram)
7. [Unit & Integration Test Specifications](#7-unit--integration-test-specifications)

---

# 1. Core Architectural Principles & Contracts

All four subsystems adhere strictly to the fundamental rule of the Away Message simulation:
> **"Rendering observes simulation; rendering does not create reality."**

### Invariants:
1. **Zero UI / React / DOM / Phaser Dependencies**: All domain logic lives in pure, headless TypeScript files within `src/engine/`. No browser globals (`window`, `document`, `localStorage`) are accessed directly.
2. **Deterministic Time Advancement**: Every subsystem accepts time advances either via single-minute steps (`advanceGameMinutes(1)`) or arbitrary multi-hour discrete jumps (`advanceGameMinutes(mins)`). The final state after $N$ discrete 1-minute steps is mathematically identical to a single step of $N$ minutes.
3. **Event-Driven Pub/Sub**: Systems communicate across boundaries via a typed `EventBus`, emitting domain events (e.g. `download:completed`, `vfs:file_created`, `software:installed`, `social:message_received`).
4. **Lossless Persistence Serialization**: Every subsystem produces and consumes JSON-serializable state slices matching Dexie IndexedDB schemas.

```
+----------------------------------------------------------------------------------------------------+
|                                    SIMULATION ENGINE ROOT                                          |
|                                                                                                    |
|  +--------------------+   +---------------------+   +---------------------+   +-----------------+  |
|  |  DownloadManager   |-->|  FileSystemEngine   |-->|  SoftwareRegistry   |   |  SocialEngine   |  |
|  | - Bandwidth Math   |   | - Directory Tree    |   | - 6-Stage Wizard    |   | - 14-Day Sched  |  |
|  | - Multi-task queue |   | - FileRecord CRUD   |   | - Hardware Gating   |   | - 5 Hidden Dims |  |
|  | - Time Jump Invar  |   | - 40GB HDD Quota    |   | - Adware & Uninstall|   | - Message Logs  |  |
|  +--------------------+   +---------------------+   +---------------------+   +-----------------+  |
|            │                         │                         │                       │           |
|            ▼                         ▼                         ▼                       ▼           |
|  +----------------------------------------------------------------------------------------------+  |
|  |                                  TYPED EVENT BUS & DISPATCH                                  |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

# 2. Subsystem 1: DownloadManager.ts

## 2.1 Domain Requirements & Bandwidth Mathematics

The player's PC is connected to the fake internet via a simulated DSL or dial-up connection.
- **Connection Tiers**:
  - `dialup_56k`: 56 kbps $\approx$ 7.0 KB/s
  - `dsl_256k` (Default Starting Tier): 256 kbps $\approx$ 32.0 KB/s
  - `dsl_512k`: 512 kbps $\approx$ 64.0 KB/s
  - `dsl_1m`: 1024 kbps $\approx$ 128.0 KB/s

### Bandwidth Splitting & Allocation (Water-Filling Algorithm)
When $N$ active downloads $\{d_1, d_2, \dots, d_N\}$ are running simultaneously:
- Let $C = \text{connectionSpeedKbps}$ (total client bandwidth in kbps).
- Each download $i$ has an individual server cap $S_i = \text{sourceMaxKbps}_i$.
- Bandwidth is allocated dynamically using progressive fair-share water-filling:
  1. Initialize unassigned pool $U = \{d_1, \dots, d_N\}$, remaining bandwidth $R = C$.
  2. While $U \ne \emptyset$:
     - Equal share $E = R / |U|$.
     - Identify any download $j \in U$ where $S_j \le E$.
     - If found:
       - Allocate $A_j = S_j$.
       - $R \leftarrow R - S_j$.
       - $U \leftarrow U \setminus \{j\}$.
     - If no downloads in $U$ have $S_j \le E$:
       - For all $k \in U$, allocate $A_k = E$.
       - $R \leftarrow 0$.
       - $U \leftarrow \emptyset$.
  3. Total allocated bandwidth for task $i$ is $A_i$ (kbps).

### Byte Transfer Formula
For elapsed simulation duration $\Delta t$ (in seconds):
$$\Delta \text{Bytes}_i = \left( A_i \times \frac{1024}{8} \right) \times \Delta t$$
$$\text{downloadedBytes}_i = \min\left(\text{totalBytes}_i, \text{downloadedBytes}_i + \Delta \text{Bytes}_i\right)$$

### ETA Calculation
$$\text{ETA (seconds)} = \begin{cases} \frac{\text{totalBytes}_i - \text{downloadedBytes}_i}{A_i \times 128}, & A_i > 0 \\ \infty, & A_i = 0 \end{cases}$$

---

## 2.2 Download State Machine

```
               +-------------------------------------------------+
               |                                                 |
               v                                                 |
         [  QUEUED  ] ──(slot available)──> [ DOWNLOADING ]      |
                                                  │ │            |
                        ┌─────────────────────────┘ └──────┐     |
                        │ (user pause / disconnect)        │     |
                        ▼                                  ▼     |
                  [  PAUSED  ]                      [  FAILED  ] │
                        │ (resume)                         │     |
                        ├─────────────(if non-resumable)───┘     |
                        │                                        |
                        v                                        |
                 [ DOWNLOADING ]                                 |
                        │                                        |
                        │ (bytes >= totalBytes)                  |
                        ▼                                        |
                 [  COMPLETE  ]                                  |
                        │                                        |
                        └───────> (creates FileRecord in VFS)    |
```

### State Definitions:
- `queued`: Task registered but waiting for an active concurrency slot.
- `downloading`: Actively transferring bytes during clock ticks.
- `paused`: Temporarily suspended. If `resumable = true`, retains `downloadedBytes`; if `resumable = false`, resuming resets `downloadedBytes = 0`.
- `complete`: Transfer reached 100%. Triggers `FileSystemEngine.createFile()` in `C:/Downloads/` and emits `download:completed`.
- `failed`: Terminated prematurely due to network disconnection or insufficient disk space.
- `cancelled`: Manually discarded by user; freed from queue without creating files.

---

## 2.3 Continuous Ticking & Discrete Time Jump Invariant

When time jumps (e.g. sleep for 360 minutes, work shift for 240 minutes, make tea for 6 minutes):
- If multiple downloads are running and some finish before others, the completed downloads must free their bandwidth so the remaining downloads accelerate for the remainder of the jump.
- **Discrete Event Time-Jump Stepping**:
  1. Compute the time-to-completion $t_{\text{comp}, i} = \frac{\text{totalBytes}_i - \text{downloadedBytes}_i}{A_i \times 128}$ for each active download.
  2. Find minimum time to next completion $t_{\text{next}} = \min_i(t_{\text{comp}, i})$.
  3. If $t_{\text{next}} \le \Delta t_{\text{remaining}}$:
     - Advance all active tasks by $t_{\text{next}}$.
     - Mark completing tasks as `complete`, create their VFS files, and emit events.
     - Decrement $\Delta t_{\text{remaining}} \leftarrow \Delta t_{\text{remaining}} - t_{\text{next}}$.
     - Recalculate bandwidth allocations for remaining tasks.
     - Repeat until $\Delta t_{\text{remaining}} = 0$ or no active tasks remain.
  4. If $t_{\text{next}} > \Delta t_{\text{remaining}}$:
     - Advance all active tasks by $\Delta t_{\text{remaining}}$ and finish.

---

## 2.4 Manager Modes: Browser vs FlashFetch 3.1

| Feature | Voyager Browser (Built-in) | FlashFetch 3.1 (Accelerator) |
|---|---|---|
| Max Concurrent Downloads | 1 active task | Up to 4 active tasks |
| Resume Support | Fragile (fails on disconnect/restart unless server supports HTTP range) | Full segmented resume with persistent chunk offsets |
| Queue Scheduling | First-In-First-Out basic queue | Priority ordering, pause/resume all, auto-retry |
| Throughput Boost | Standard single connection | Visual multi-thread segment visualization |
| Unlock Requirement | Preinstalled | Download & install from DownloadHub (`flashfetch.local`) |

---

## 2.5 Complete TypeScript Code Blueprint: `DownloadManager.ts`

```typescript
// src/engine/types/downloads.ts

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'complete' | 'failed' | 'cancelled';
export type DownloadManagerType = 'browser' | 'flashfetch';

export interface DownloadTask {
  id: string;
  sourceId: string;           // e.g. "dl_pulse_52", "dl_photobox"
  sourceUrl: string;          // e.g. "http://downloadhub.local/files/PulseSetup.exe"
  fileName: string;           // e.g. "PulseSetup.exe"
  targetDirectory: string;    // Defaults to "C:/Downloads"
  totalBytes: number;
  downloadedBytes: number;
  sourceMaxKbps: number;      // Server throttle limit
  allocatedKbps: number;      // Dynamically computed share
  status: DownloadStatus;
  resumable: boolean;
  manager: DownloadManagerType;
  startedAtMinute: number;
  completedAtMinute?: number;
  errorMessage?: string;
  fileKind: 'executable' | 'archive' | 'audio' | 'image' | 'text';
  appAssociation?: string;
}

export interface DownloadManagerState {
  tasks: DownloadTask[];
  maxConcurrentBrowser: number;
  maxConcurrentFlashFetch: number;
}
```

```typescript
// src/engine/DownloadManager.ts

import { DownloadTask, DownloadStatus, DownloadManagerState, DownloadManagerType } from './types/downloads';
import { EventBus } from './EventBus';
import { FileSystemEngine } from './FileSystemEngine';

export interface DownloadManagerDependencies {
  eventBus: EventBus;
  vfs: FileSystemEngine;
  getConnectionSpeedKbps: () => number;
}

export class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
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
    fileKind: 'executable' | 'archive' | 'audio' | 'image' | 'text';
    resumable?: boolean;
    manager?: DownloadManagerType;
    currentMinute: number;
    appAssociation?: string;
  }): DownloadTask {
    // Check available disk space
    if (this.vfs.getFreeDiskBytes() < params.totalBytes) {
      throw new Error(`Insufficient disk space on C:. Required: ${params.totalBytes} bytes, Available: ${this.vfs.getFreeDiskBytes()} bytes.`);
    }

    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const manager = params.manager || 'browser';

    const task: DownloadTask = {
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
      resumable: params.resumable ?? true,
      manager,
      startedAtMinute: params.currentMinute,
      fileKind: params.fileKind,
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
      const activeTasks = this.getActiveDownloads();
      if (activeTasks.length === 0) break;

      this.recalculateBandwidth();

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
      this.updateQueueSlots();
    }
  }

  private completeTask(task: DownloadTask, currentMinute: number): void {
    task.status = 'complete';
    task.allocatedKbps = 0;
    task.completedAtMinute = currentMinute;

    // Create persistent file in VFS
    const filePath = `${task.targetDirectory}/${task.fileName}`;
    this.vfs.createFile({
      name: task.fileName,
      path: filePath,
      parentPath: task.targetDirectory,
      kind: task.fileKind,
      sizeBytes: task.totalBytes,
      appAssociation: task.appAssociation,
      metadata: {
        author: task.sourceId,
        version: '1.0',
      },
    });

    this.eventBus.emit('download:completed', { task: { ...task }, filePath });
  }

  private updateQueueSlots(): void {
    const flashFetchActive = Array.from(this.tasks.values()).filter(
      t => t.manager === 'flashfetch' && t.status === 'downloading'
    ).length;
    const browserActive = Array.from(this.tasks.values()).filter(
      t => t.manager === 'browser' && t.status === 'downloading'
    ).length;

    for (const task of this.tasks.values()) {
      if (task.status === 'queued') {
        if (task.manager === 'flashfetch' && flashFetchActive < this.maxConcurrentFlashFetch) {
          task.status = 'downloading';
        } else if (task.manager === 'browser' && browserActive < this.maxConcurrentBrowser) {
          task.status = 'downloading';
        }
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

    while (unassigned.length > 0) {
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
}
```

---

# 3. Subsystem 2: FileSystemEngine.ts

## 3.1 VFS Hierarchy & FileRecord Schema

The virtual file system simulates an authentic single-drive `C:/` structure.

```
C:/
├── Desktop/                # Desktop icons & .lnk shortcuts
│   ├── My Computer.lnk
│   ├── Voyager Browser.lnk
│   ├── Pulse Messenger.lnk
│   └── Trash.lnk
├── Downloads/              # Web downloads & setup executables
├── Program Files/          # Installed software directories
│   ├── Voyager/
│   ├── Pulse/
│   ├── RetroAmp/
│   └── ZipMate/
├── Documents/              # Text documents, notes, readme files
│   ├── Readme.txt
│   └── Notes.txt
├── Music/                  # MP3 tracks & media
├── Pictures/               # Wallpapers, photos, webcam captures
└── Trash/                  # Soft-deleted file records
```

---

## 3.2 40GB HDD Storage Accounting & Free Space Math

- **Total Capacity**: $40.0\text{ GB} = 42,949,672,960\text{ bytes}$
- **Base System Files**: $33.8\text{ GB} = 36,293,869,568\text{ bytes}$ (Operating system kernel, drivers, unremovable system files).
- **Starting Available Free Space**: $\approx 7.15\text{ GB} = 7,675,803,392\text{ bytes}$.
- **Storage Formula**:
  $$\text{OccupiedDiskBytes} = \text{BaseSystemBytes} + \sum_{f \in \text{VFS}} f.\text{sizeBytes}$$
  $$\text{FreeDiskBytes} = \text{TotalDiskBytes} - \text{OccupiedDiskBytes}$$
- **Constraint Enforcement**:
  - `createFile()` throws `DiskFullError` if $\text{sizeBytes} > \text{FreeDiskBytes}$.
  - Trashed files in `C:/Trash` **still occupy disk space** until permanently deleted via `emptyTrash()`.

---

## 3.3 CRUD Operations, Trash Lifecycle & Execution Hooks

1. **Create (`createFile`)**:
   - Validates parent directory exists.
   - Enforces disk quota.
   - Normalizes path separators (converts backslashes to forward slashes `C:/...`).
   - Emits `vfs:file_created`.
2. **Read (`readFile`, `listDirectory`)**:
   - Retrieves metadata, content, and file associations.
3. **Update (`updateFile`)**:
   - Updates text content or metadata; adjusts storage delta if file size changes.
4. **Delete & Trash Lifecycle**:
   - `moveToTrash(path)`: Moves file into `C:/Trash/{filename}`, sets `metadata.originalTrashPath = path`. File is restorable.
   - `restoreFromTrash(trashPath)`: Restores file to its `originalTrashPath`.
   - `emptyTrash()`: Permanently deletes all files in `C:/Trash`, instantly reclaiming free storage.
5. **Execute (`executeFile`)**:
   - Dispatches execution to registered app association or installer engine:
     - `.exe` (Installer) $\to$ Launches `SoftwareRegistry.launchInstaller()`.
     - `.lnk` (Shortcut) $\to$ Resolves `targetPath` and executes target file.
     - `.txt` $\to$ Opens Notepad.
     - `.mp3` $\to$ Opens RetroAmp audio player.
     - `.jpg` / `.bmp` $\to$ Opens PhotoBox.
     - `.zip` $\to$ Opens ZipMate archive manager.

---

## 3.4 Complete TypeScript Code Blueprint: `FileSystemEngine.ts`

```typescript
// src/engine/types/vfs.ts

export type FileKind = 'executable' | 'archive' | 'audio' | 'image' | 'text' | 'shortcut' | 'system' | 'directory';

export interface FileRecord {
  id: string;
  name: string;
  path: string;           // e.g. "C:/Downloads/PulseSetup.exe"
  parentPath: string;     // e.g. "C:/Downloads"
  kind: FileKind;
  sizeBytes: number;
  createdAtMinute: number;
  modifiedAtMinute: number;
  appAssociation?: string;
  targetPath?: string;    // For shortcuts
  metadata?: {
    isPortable?: boolean;
    isAdware?: boolean;
    isReadOnly?: boolean;
    author?: string;
    version?: string;
    originalTrashPath?: string;
    textContent?: string;
    extractedFiles?: string[];
  };
}

export interface VirtualFileSystemState {
  totalDiskBytes: number;
  baseSystemBytes: number;
  files: Record<string, FileRecord>; // Keyed by normalized path
}
```

```typescript
// src/engine/FileSystemEngine.ts

import { FileRecord, FileKind, VirtualFileSystemState } from './types/vfs';
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

    // Default desktop shortcuts and initial files
    this.createFile({
      name: 'Readme.txt',
      path: 'C:/Documents/Readme.txt',
      parentPath: 'C:/Documents',
      kind: 'text',
      sizeBytes: 2048,
      appAssociation: 'app.notepad',
      metadata: {
        textContent: 'Welcome to Orion OS 4.8.\nYour temporary workstation is configured for standard productivity.',
      },
    }, 0);
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

    const originalPath = record.metadata?.originalTrashPath;
    if (!originalPath) throw new Error(`Missing original path metadata for ${normalized}`);

    const originalParent = originalPath.substring(0, originalPath.lastIndexOf('/'));
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
}
```

---

# 4. Subsystem 3: SoftwareRegistry.ts

## 4.1 6-Stage Installer Wizard State Machine

```
[1. WELCOME] ──> [2. COMPATIBILITY CHECK] ──> [3. DESTINATION] ──> [4. BUNDLED OPTIONS] ──> [5. PROGRESS] ──> [6. FINISH]
                        │ (if unmet)
                        ▼
                [BLOCKED: RED ERROR]
```

### Wizard Stages:
1. **Welcome**: Product name, version, publisher, welcome message.
2. **Compatibility Check**:
   - Validates `minOsVersion`, `minRamMb`, `minCpuTier`, `requiredFreeDiskBytes`.
   - If unmet, displays clear red error box and disables Next button.
3. **Destination**: Target directory (default: `C:/Program Files/{AppName}`).
4. **Bundled Options & Adware**:
   - Checkboxes: Desktop shortcut, Start Menu shortcut, Autorun on boot.
   - Bundled component checkboxes (e.g. SearchMate toolbar for WeatherBuddy).
5. **Installation Progress**:
   - 0% $\to$ 100% progress animation.
   - Advances 1–2 minutes of in-game time.
   - Creates VFS directory, binaries, shortcuts, and registers installed software.
6. **Finish**: Setup completed, launch checkbox, close wizard.

---

## 4.2 Hardware & OS Requirement Gating

| Application | Min OS | Min RAM | Min CPU | Baseline PC Status | Post-Upgrade Status |
|---|---|---|---|---|---|
| **Pulse Messenger 5.2** | Orion 4.8 | 512 MB | Tier 1 | **Passes** | Passes |
| **Pulse Messenger 6.0** | Orion 6.0 | 768 MB | Tier 1 | **Fails (OS & RAM)** | **Passes (OS 6 + 1GB)** |
| **FlashFetch 3.1** | Orion 4.8 | 512 MB | Tier 1 | **Passes** | Passes |
| **RetroAmp 2.3** | Orion 4.8 | 512 MB | Tier 1 | **Passes** | Passes |
| **ZipMate 4.0** | Orion 4.8 | 512 MB | Tier 1 | **Passes** | Passes |
| **PhotoBox 3.0** | Orion 6.0 | 768 MB | Tier 1 | **Fails (OS & RAM)** | **Passes (OS 6 + 1GB)** |
| **WeatherBuddy 1.4** | Orion 4.8 | 512 MB | Tier 1 | **Passes** | Passes |
| **SafeSweep 2.0** | Orion 4.8 | 512 MB | Tier 1 | **Passes** | Passes |
| **Orion OS 6.0 Upgrade**| Orion 4.8 | 512 MB (1GB rec) | Tier 1 | **Passes (after RAM)** | Upgrades OS |

---

## 4.3 Bundled Adware (WeatherBuddy & SearchMate) & Uninstallation

- **Express Install**: Automatically checks:
  1. `Install SearchMate Smart Search Toolbar in Voyager Browser`
  2. `Set SearchMate (http://searchmate.local) as default homepage`
  3. `Start WeatherBuddy automatically on Orion OS startup`
- **Custom Install**: Player can uncheck the bundled components.
- **Uninstallation (Add/Remove Programs & SafeSweep)**:
  - Deletes `C:/Program Files/{AppName}` and all shortcuts.
  - Reverts browser homepage to `http://findit.local`.
  - Removes SearchMate toolbar injection.
  - Removes startup entry.
  - Frees `installedBytes` disk space.

---

## 4.4 Complete TypeScript Code Blueprint: `SoftwareRegistry.ts`

```typescript
// src/engine/types/software.ts

export interface SoftwareRequirement {
  minOsVersion: 'Orion_4.8' | 'Orion_6.0';
  minRamMb: number;
  minCpuTier: number;
  requiredDiskBytes: number;
}

export interface SoftwareDefinition {
  id: string;                  // e.g. "sw_pulse_52"
  appId: string;               // e.g. "app.pulse"
  name: string;
  version: string;
  publisher: string;
  installedBytes: number;
  requirements: SoftwareRequirement;
  hasInstaller: boolean;       // false for portable apps
  isAdware?: boolean;
  bundledOffers?: {
    id: string;
    name: string;
    description: string;
    defaultChecked: boolean;
  }[];
}

export interface InstalledSoftwareRecord {
  id: string;
  appId: string;
  name: string;
  version: string;
  installedBytes: number;
  installPath: string;
  installedAtMinute: number;
  isPortable: boolean;
  isAdware: boolean;
  adwarePayload?: {
    toolbarInjected?: boolean;
    homepageHijacked?: string;
    startupAutorun?: boolean;
  };
  shortcuts: string[];
}

export interface InstallerSession {
  sessionId: string;
  softwareDef: SoftwareDefinition;
  currentStage: 1 | 2 | 3 | 4 | 5 | 6; // Welcome, Compatibility, Dest, Options, Progress, Finish
  destinationPath: string;
  selectedOptions: {
    createDesktopShortcut: boolean;
    createStartMenuShortcut: boolean;
    launchOnStartup: boolean;
    acceptedBundledOffers: Record<string, boolean>;
  };
  compatibilityResult: {
    isCompatible: boolean;
    osCheck: { passed: boolean; required: string; current: string };
    ramCheck: { passed: boolean; required: number; current: number };
    cpuCheck: { passed: boolean; required: number; current: number };
    diskCheck: { passed: boolean; required: number; available: number };
  };
  installProgress: number; // 0..100
}
```

```typescript
// src/engine/SoftwareRegistry.ts

import { SoftwareDefinition, InstalledSoftwareRecord, InstallerSession } from './types/software';
import { EventBus } from './EventBus';
import { FileSystemEngine } from './FileSystemEngine';

export interface HardwareInfoProvider {
  getOsVersion: () => 'Orion_4.8' | 'Orion_6.0';
  getRamMb: () => number;
  getCpuTier: () => number;
}

export class SoftwareRegistry {
  private catalog: Map<string, SoftwareDefinition> = new Map();
  private installedSoftware: Map<string, InstalledSoftwareRecord> = new Map();
  private activeInstallers: Map<string, InstallerSession> = new Map();
  private eventBus: EventBus;
  private vfs: FileSystemEngine;
  private hw: HardwareInfoProvider;

  constructor(
    eventBus: EventBus,
    vfs: FileSystemEngine,
    hw: HardwareInfoProvider,
    initialInstalled?: InstalledSoftwareRecord[]
  ) {
    this.eventBus = eventBus;
    this.vfs = vfs;
    this.hw = hw;
    this.registerCatalog();

    if (initialInstalled) {
      for (const sw of initialInstalled) {
        this.installedSoftware.set(sw.id, { ...sw });
      }
    } else {
      // Preinstalled software
      this.registerPreinstalled('app.browser', 'Voyager Browser', '1.0', 16_777_216, 'C:/Program Files/Voyager');
    }
  }

  private registerPreinstalled(appId: string, name: string, version: string, bytes: number, path: string): void {
    const id = `sw_pre_${appId}`;
    this.installedSoftware.set(id, {
      id,
      appId,
      name,
      version,
      installedBytes: bytes,
      installPath: path,
      installedAtMinute: 0,
      isPortable: false,
      isAdware: false,
      shortcuts: ['C:/Desktop/Voyager Browser.lnk'],
    });
  }

  private registerCatalog(): void {
    const apps: SoftwareDefinition[] = [
      {
        id: 'sw_pulse_52',
        appId: 'app.pulse',
        name: 'Pulse Messenger',
        version: '5.2',
        publisher: 'Pulse Communications Inc.',
        installedBytes: 33_554_432, // 32 MB
        requirements: { minOsVersion: 'Orion_4.8', minRamMb: 512, minCpuTier: 1, requiredDiskBytes: 35_000_000 },
        hasInstaller: true,
      },
      {
        id: 'sw_pulse_60',
        appId: 'app.pulse',
        name: 'Pulse Messenger',
        version: '6.0',
        publisher: 'Pulse Communications Inc.',
        installedBytes: 50_331_648, // 48 MB
        requirements: { minOsVersion: 'Orion_6.0', minRamMb: 768, minCpuTier: 1, requiredDiskBytes: 55_000_000 },
        hasInstaller: true,
      },
      {
        id: 'sw_flashfetch_31',
        appId: 'app.flashfetch',
        name: 'FlashFetch Download Accelerator',
        version: '3.1',
        publisher: 'SpeedNet Tools',
        installedBytes: 12_582_912, // 12 MB
        requirements: { minOsVersion: 'Orion_4.8', minRamMb: 512, minCpuTier: 1, requiredDiskBytes: 15_000_000 },
        hasInstaller: true,
      },
      {
        id: 'sw_retroamp_23',
        appId: 'app.retroamp',
        name: 'RetroAmp Audio Player',
        version: '2.3',
        publisher: 'NullWave Media',
        installedBytes: 15_728_640, // 15 MB
        requirements: { minOsVersion: 'Orion_4.8', minRamMb: 512, minCpuTier: 1, requiredDiskBytes: 18_000_000 },
        hasInstaller: true,
      },
      {
        id: 'sw_zipmate_40',
        appId: 'app.zipmate',
        name: 'ZipMate Archive Manager',
        version: '4.0',
        publisher: 'ZipSoft Systems',
        installedBytes: 8_388_608, // 8 MB
        requirements: { minOsVersion: 'Orion_4.8', minRamMb: 512, minCpuTier: 1, requiredDiskBytes: 10_000_000 },
        hasInstaller: true,
      },
      {
        id: 'sw_photobox_30',
        appId: 'app.photobox',
        name: 'PhotoBox Studio',
        version: '3.0',
        publisher: 'PixelCraft Imaging',
        installedBytes: 67_108_864, // 64 MB
        requirements: { minOsVersion: 'Orion_6.0', minRamMb: 768, minCpuTier: 1, requiredDiskBytes: 70_000_000 },
        hasInstaller: true,
      },
      {
        id: 'sw_weatherbuddy_14',
        appId: 'app.weatherbuddy',
        name: 'WeatherBuddy Desktop Widget',
        version: '1.4',
        publisher: 'CloudSoft Direct',
        installedBytes: 6_291_456, // 6 MB
        requirements: { minOsVersion: 'Orion_4.8', minRamMb: 512, minCpuTier: 1, requiredDiskBytes: 8_000_000 },
        hasInstaller: true,
        isAdware: true,
        bundledOffers: [
          {
            id: 'searchmate_toolbar',
            name: 'SearchMate Toolbar',
            description: 'Install SearchMate toolbar and set default homepage to searchmate.local (Recommended)',
            defaultChecked: true,
          },
          {
            id: 'autorun_startup',
            name: 'Autorun on Startup',
            description: 'Start WeatherBuddy automatically with Orion OS',
            defaultChecked: true,
          }
        ]
      },
      {
        id: 'sw_safesweep_20',
        appId: 'app.safesweep',
        name: 'SafeSweep Anti-Spyware',
        version: '2.0',
        publisher: 'SafeNet Security Labs',
        installedBytes: 20_971_520, // 20 MB
        requirements: { minOsVersion: 'Orion_4.8', minRamMb: 512, minCpuTier: 1, requiredDiskBytes: 25_000_000 },
        hasInstaller: true,
      }
    ];

    for (const app of apps) {
      this.catalog.set(app.id, app);
    }
  }

  public getInstalledSoftware(): InstalledSoftwareRecord[] {
    return Array.from(this.installedSoftware.values()).map(s => ({ ...s }));
  }

  public isInstalled(appId: string): boolean {
    for (const sw of this.installedSoftware.values()) {
      if (sw.appId === appId) return true;
    }
    return false;
  }

  public startInstallerWizard(softwareDefId: string): InstallerSession {
    const def = this.catalog.get(softwareDefId);
    if (!def) throw new Error(`Unknown software definition: ${softwareDefId}`);

    const currentOs = this.hw.getOsVersion();
    const currentRam = this.hw.getRamMb();
    const currentCpu = this.hw.getCpuTier();
    const freeDisk = this.vfs.getFreeDiskBytes();

    const osPassed = (def.requirements.minOsVersion === 'Orion_4.8') || (currentOs === 'Orion_6.0');
    const ramPassed = currentRam >= def.requirements.minRamMb;
    const cpuPassed = currentCpu >= def.requirements.minCpuTier;
    const diskPassed = freeDisk >= def.requirements.requiredDiskBytes;

    const isCompatible = osPassed && ramPassed && cpuPassed && diskPassed;

    const initialOffers: Record<string, boolean> = {};
    if (def.bundledOffers) {
      for (const offer of def.bundledOffers) {
        initialOffers[offer.id] = offer.defaultChecked;
      }
    }

    const sessionId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const session: InstallerSession = {
      sessionId,
      softwareDef: def,
      currentStage: 1,
      destinationPath: `C:/Program Files/${def.name.split(' ')[0]}`,
      selectedOptions: {
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        launchOnStartup: false,
        acceptedBundledOffers: initialOffers,
      },
      compatibilityResult: {
        isCompatible,
        osCheck: { passed: osPassed, required: def.requirements.minOsVersion, current: currentOs },
        ramCheck: { passed: ramPassed, required: def.requirements.minRamMb, current: currentRam },
        cpuCheck: { passed: cpuPassed, required: def.requirements.minCpuTier, current: currentCpu },
        diskCheck: { passed: diskPassed, required: def.requirements.requiredDiskBytes, available: freeDisk },
      },
      installProgress: 0,
    };

    this.activeInstallers.set(sessionId, session);
    return { ...session };
  }

  public advanceInstallerStage(sessionId: string, nextStage: 1 | 2 | 3 | 4 | 5 | 6): InstallerSession {
    const session = this.activeInstallers.get(sessionId);
    if (!session) throw new Error(`Invalid installer session: ${sessionId}`);

    if (nextStage > 2 && !session.compatibilityResult.isCompatible) {
      throw new Error(`Cannot advance installer: System requirements check failed.`);
    }

    session.currentStage = nextStage;
    return { ...session };
  }

  public completeInstallation(sessionId: string, currentMinute = 0): InstalledSoftwareRecord {
    const session = this.activeInstallers.get(sessionId);
    if (!session) throw new Error(`Invalid installer session: ${sessionId}`);

    const def = session.softwareDef;
    const createdShortcuts: string[] = [];

    // Create program directory and shortcut in VFS
    if (session.selectedOptions.createDesktopShortcut) {
      const shortcutPath = `C:/Desktop/${def.name}.lnk`;
      this.vfs.createFile({
        name: `${def.name}.lnk`,
        path: shortcutPath,
        parentPath: 'C:/Desktop',
        kind: 'shortcut',
        sizeBytes: 1024,
        appAssociation: def.appId,
        targetPath: `${session.destinationPath}/${def.name.split(' ')[0]}.exe`,
      }, currentMinute);
      createdShortcuts.push(shortcutPath);
    }

    const hasToolbar = session.selectedOptions.acceptedBundledOffers['searchmate_toolbar'] ?? false;
    const hasAutorun = session.selectedOptions.acceptedBundledOffers['autorun_startup'] ?? false;

    const record: InstalledSoftwareRecord = {
      id: `inst_${def.id}`,
      appId: def.appId,
      name: def.name,
      version: def.version,
      installedBytes: def.installedBytes,
      installPath: session.destinationPath,
      installedAtMinute: currentMinute,
      isPortable: false,
      isAdware: def.isAdware ?? false,
      adwarePayload: def.isAdware ? {
        toolbarInjected: hasToolbar,
        homepageHijacked: hasToolbar ? 'http://searchmate.local' : undefined,
        startupAutorun: hasAutorun,
      } : undefined,
      shortcuts: createdShortcuts,
    };

    this.installedSoftware.set(record.id, record);
    this.activeInstallers.delete(sessionId);

    this.eventBus.emit('software:installed', { software: { ...record } });
    return { ...record };
  }

  public uninstallSoftware(installedId: string): boolean {
    const record = this.installedSoftware.get(installedId);
    if (!record) return false;

    // Delete shortcuts from VFS
    for (const shortcutPath of record.shortcuts) {
      this.vfs.deletePermanently(shortcutPath);
    }

    this.installedSoftware.delete(installedId);
    this.eventBus.emit('software:uninstalled', { software: { ...record } });
    return true;
  }
}
```

---

# 5. Subsystem 4: SocialEngine.ts

## 5.1 14-Day Schedule Matrices (Ryan, Maya, Nora, Mr. Henderson)

Each character operates on a deterministic weekly and day-specific matrix.
- **Minutes per day**: $1440\text{ minutes}$.
- **Minute of Day**: $\text{totalMinutes} \pmod{1440}$.
- **Day Number**: $\lfloor \text{totalMinutes} / 1440 \rfloor + 1$.

```
+---------------------------------------------------------------------------------------------------+
| 14-DAY CHARACTER SCHEDULE & PRESENCE OVERVIEW                                                     |
+-------------------+--------------------+--------------------+-------------------+-----------------+
| Character         | Morning (06-09)    | Daytime (09-17)    | Evening (17-21)   | Night (21-06)   |
+-------------------+--------------------+--------------------+-------------------+-----------------+
| Ryan (Food Cart)  | Offline (Commute)  | Food Cart Shift    | Away / Online     | Online -> Sleep |
| Maya (Office/Art) | Offline            | Busy / Away        | Online (Home)     | Online -> Sleep |
| Nora (Archivist)  | Offline (Sleeping) | Offline            | Away (Indexing)   | ONLINE (Pulse)  |
| Henderson (Motel) | Front Office Open  | Front Office Open  | Front Office Open | Offline (Sleep) |
+-------------------+--------------------+--------------------+-------------------+-----------------+
```

---

## 5.2 5 Hidden Relationship Dimensions & Vector Mathematics

Every character tracks 5 hidden dimensions strictly bounded within $[0, 100]$:
1. `familiarity`: Level of acquaintance, shared history, and known personal facts.
2. `trust`: Confidence in player's confidentiality, authenticity, and loyalty.
3. `comfort`: Emotional warmth, ease of communication, banter, and mutual safety.
4. `respect`: Esteem for competence, work ethic, and intellectual integrity.
5. `annoyance`: Frustration, friction, or irritation from spam/rudeness.

$$\vec{R}_{\text{new}} = \text{clamp}_{[0, 100]}\left(\vec{R}_{\text{old}} + \Delta \vec{R}_{\text{action}}\right)$$

### Starting Vectors:
- **Ryan**: `[Fam: 40, Tr: 50, Com: 50, Res: 40, Annoy: 0]`
- **Maya**: `[Fam: 10, Tr: 20, Com: 30, Res: 40, Annoy: 0]`
- **Nora**: `[Fam: 5, Tr: 15, Com: 20, Res: 50, Annoy: 0]`
- **Mr. Henderson**: `[Fam: 30, Tr: 30, Com: 20, Res: 40, Annoy: 10]`

---

## 5.3 Semantic Social Action Tag Processing

```typescript
export const SOCIAL_ACTION_DELTAS: Record<string, Record<string, Partial<RelationshipDimensions>>> = {
  maya: {
    empathy: { familiarity: 3, trust: 4, comfort: 5, respect: 2, annoyance: -2 },
    remembered_detail: { familiarity: 5, trust: 6, comfort: 6, respect: 4, annoyance: -1 },
    tease_playful: { familiarity: 4, trust: 2, comfort: 3, respect: 2, annoyance: 0 },
    dismissive: { familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: 8 },
    vulnerable_share: { familiarity: 6, trust: 7, comfort: 8, respect: 3, annoyance: -2 },
  },
  ryan: {
    work_camaraderie: { familiarity: 4, trust: 3, comfort: 4, respect: 3, annoyance: 0 },
    sarcastic_joke: { familiarity: 3, trust: 2, comfort: 2, respect: 2, annoyance: 1 },
    flake_on_shift: { familiarity: 0, trust: -6, comfort: -4, respect: -5, annoyance: 10 },
  },
  nora: {
    intellectual_curiosity: { familiarity: 4, trust: 5, comfort: 2, respect: 6, annoyance: 0 },
    rabbit_hole_discovery: { familiarity: 6, trust: 6, comfort: 3, respect: 7, annoyance: 0 },
  },
};
```

---

## 5.4 Message Logging, Unread Tracking & Offline Delivery

- When player is away (e.g. tea, sleep, work), contacts on schedule can initiate conversations or send replies.
- Messages appended to conversation array with `isRead: false` and `deliveredAway: true`.
- Emits `social:message_received` triggering taskbar flashing and sound chimes.

---

## 5.5 Complete TypeScript Code Blueprint: `SocialEngine.ts`

```typescript
// src/engine/types/social.ts

export type BuddyPresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface RelationshipDimensions {
  familiarity: number; // 0..100
  trust: number;       // 0..100
  comfort: number;     // 0..100
  respect: number;     // 0..100
  annoyance: number;   // 0..100
}

export interface ScheduleBlock {
  startMinuteOfDay: number; // 0..1439
  endMinuteOfDay: number;   // 0..1439
  status: BuddyPresenceStatus;
  awayMessage: string;
}

export interface BuddyCharacter {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
  schedule: Record<number, ScheduleBlock[]>; // Keyed by day (1..14)
  initialRelationships: RelationshipDimensions;
  typingSpeedWpm: number;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestampMinute: number;
  day: number;
  isRead: boolean;
  deliveredAway: boolean;
}

export interface SocialEngineState {
  relationships: Record<string, RelationshipDimensions>;
  presence: Record<string, { status: BuddyPresenceStatus; awayMessage: string }>;
  conversations: Record<string, MessageRecord[]>;
}
```

```typescript
// src/engine/SocialEngine.ts

import {
  BuddyPresenceStatus,
  RelationshipDimensions,
  BuddyCharacter,
  MessageRecord,
  SocialEngineState,
} from './types/social';
import { EventBus } from './EventBus';

export class SocialEngine {
  private buddies: Map<string, BuddyCharacter> = new Map();
  private relationships: Map<string, RelationshipDimensions> = new Map();
  private presence: Map<string, { status: BuddyPresenceStatus; awayMessage: string }> = new Map();
  private conversations: Map<string, MessageRecord[]> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: SocialEngineState) {
    this.eventBus = eventBus;
    this.initializeCharacters();

    if (initialState) {
      this.restoreState(initialState);
    } else {
      this.initializeDefaultState();
    }
  }

  public getState(): SocialEngineState {
    const rels: Record<string, RelationshipDimensions> = {};
    for (const [id, r] of this.relationships.entries()) rels[id] = { ...r };

    const pres: Record<string, { status: BuddyPresenceStatus; awayMessage: string }> = {};
    for (const [id, p] of this.presence.entries()) pres[id] = { ...p };

    const convs: Record<string, MessageRecord[]> = {};
    for (const [id, msgs] of this.conversations.entries()) convs[id] = msgs.map(m => ({ ...m }));

    return { relationships: rels, presence: pres, conversations: convs };
  }

  public restoreState(state: SocialEngineState): void {
    this.relationships.clear();
    for (const [id, r] of Object.entries(state.relationships)) {
      this.relationships.set(id, { ...r });
    }

    this.presence.clear();
    for (const [id, p] of Object.entries(state.presence)) {
      this.presence.set(id, { ...p });
    }

    this.conversations.clear();
    for (const [id, msgs] of Object.entries(state.conversations)) {
      this.conversations.set(id, msgs.map(m => ({ ...m })));
    }
  }

  private initializeDefaultState(): void {
    for (const buddy of this.buddies.values()) {
      this.relationships.set(buddy.id, { ...buddy.initialRelationships });
      this.presence.set(buddy.id, { status: 'offline', awayMessage: '' });
      this.conversations.set(buddy.id, []);
    }
  }

  private initializeCharacters(): void {
    // 1. Ryan (Coworker)
    const ryanSchedule = this.generateStandardSchedule([
      { start: 0, end: 420, status: 'offline', msg: 'asleep' },
      { start: 420, end: 540, status: 'offline', msg: 'commute' },
      { start: 540, end: 960, status: 'offline', msg: 'work @ cart' },
      { start: 960, end: 1080, status: 'away', msg: 'afk grabbin tacos' },
      { start: 1080, end: 1320, status: 'online', msg: 'gaming / chilling' },
      { start: 1320, end: 1440, status: 'offline', msg: 'sleep is for the weak' },
    ]);

    this.buddies.set('ryan', {
      id: 'ryan',
      displayName: 'Ryan',
      handle: 'ryan_foodcart',
      schedule: ryanSchedule,
      initialRelationships: { familiarity: 40, trust: 50, comfort: 50, respect: 40, annoyance: 0 },
      typingSpeedWpm: 80,
    });

    // 2. Maya (Primary Arc)
    const mayaSchedule = this.generateStandardSchedule([
      { start: 0, end: 480, status: 'offline', msg: 'sleeping' },
      { start: 480, end: 540, status: 'offline', msg: 'morning tea' },
      { start: 540, end: 1050, status: 'away', msg: 'at the desk... dont look at me' },
      { start: 1050, end: 1260, status: 'online', msg: 'home! making coffee :)' },
      { start: 1260, end: 1440, status: 'online', msg: 'listening to the rain ~ myplace/mayablue' },
    ]);

    this.buddies.set('maya', {
      id: 'maya',
      displayName: 'Maya',
      handle: 'starlight_maya',
      schedule: mayaSchedule,
      initialRelationships: { familiarity: 10, trust: 20, comfort: 30, respect: 40, annoyance: 0 },
      typingSpeedWpm: 60,
    });

    // 3. Nora (NightOwl87)
    const noraSchedule = this.generateStandardSchedule([
      { start: 0, end: 300, status: 'online', msg: 'the night is quiet' },
      { start: 300, end: 360, status: 'away', msg: 'watching dawn' },
      { start: 360, end: 1140, status: 'offline', msg: 'offline' },
      { start: 1140, end: 1320, status: 'away', msg: 'indexing old logs' },
      { start: 1320, end: 1440, status: 'online', msg: 'nightboard / logs' },
    ]);

    this.buddies.set('nora', {
      id: 'nora',
      displayName: 'Nora',
      handle: 'NightOwl87',
      schedule: noraSchedule,
      initialRelationships: { familiarity: 5, trust: 15, comfort: 20, respect: 50, annoyance: 0 },
      typingSpeedWpm: 90,
    });

    // 4. Mr. Henderson (Landlord)
    const hendersonSchedule = this.generateStandardSchedule([
      { start: 0, end: 480, status: 'offline', msg: 'office closed' },
      { start: 480, end: 1200, status: 'online', msg: 'motel front desk open' },
      { start: 1200, end: 1440, status: 'offline', msg: 'office closed' },
    ]);

    this.buddies.set('henderson', {
      id: 'henderson',
      displayName: 'Mr. Henderson',
      handle: 'motel_office',
      schedule: hendersonSchedule,
      initialRelationships: { familiarity: 30, trust: 30, comfort: 20, respect: 40, annoyance: 10 },
      typingSpeedWpm: 40,
    });
  }

  private generateStandardSchedule(
    blocks: Array<{ start: number; end: number; status: BuddyPresenceStatus; msg: string }>
  ): Record<number, ScheduleBlock[]> {
    const sched: Record<number, ScheduleBlock[]> = {};
    for (let day = 1; day <= 14; day++) {
      sched[day] = blocks.map(b => ({
        startMinuteOfDay: b.start,
        endMinuteOfDay: b.end,
        status: b.status,
        awayMessage: b.msg,
      }));
    }
    return sched;
  }

  /**
   * Updates contact presence based on current game time.
   */
  public updatePresence(currentTotalMinutes: number): void {
    const day = Math.floor(currentTotalMinutes / 1440) + 1;
    const minuteOfDay = currentTotalMinutes % 1440;

    for (const [id, buddy] of this.buddies.entries()) {
      const daySched = buddy.schedule[day] || buddy.schedule[1];
      let currentBlock = daySched.find(
        b => minuteOfDay >= b.startMinuteOfDay && minuteOfDay < b.endMinuteOfDay
      );

      if (!currentBlock && daySched.length > 0) {
        currentBlock = daySched[0];
      }

      if (currentBlock) {
        const prev = this.presence.get(id);
        if (!prev || prev.status !== currentBlock.status || prev.awayMessage !== currentBlock.awayMessage) {
          const newPresence = { status: currentBlock.status, awayMessage: currentBlock.awayMessage };
          this.presence.set(id, newPresence);
          this.eventBus.emit('social:status_changed', { buddyId: id, presence: newPresence });
        }
      }
    }
  }

  public applySocialAction(buddyId: string, actionType: string): RelationshipDimensions {
    const current = this.relationships.get(buddyId);
    if (!current) throw new Error(`Buddy not found: ${buddyId}`);

    const deltas: Record<string, Partial<RelationshipDimensions>> = {
      empathy: { familiarity: 3, trust: 4, comfort: 5, respect: 2, annoyance: -2 },
      remembered_detail: { familiarity: 5, trust: 6, comfort: 6, respect: 4, annoyance: -1 },
      tease_playful: { familiarity: 4, trust: 2, comfort: 3, respect: 2, annoyance: 0 },
      dismissive: { familiarity: -1, trust: -5, comfort: -6, respect: -3, annoyance: 8 },
      vulnerable_share: { familiarity: 6, trust: 7, comfort: 8, respect: 3, annoyance: -2 },
      work_camaraderie: { familiarity: 4, trust: 3, comfort: 4, respect: 3, annoyance: 0 },
      intellectual_curiosity: { familiarity: 4, trust: 5, comfort: 2, respect: 6, annoyance: 0 },
    };

    const delta = deltas[actionType] || { familiarity: 1 };

    const updated: RelationshipDimensions = {
      familiarity: Math.max(0, Math.min(100, current.familiarity + (delta.familiarity ?? 0))),
      trust: Math.max(0, Math.min(100, current.trust + (delta.trust ?? 0))),
      comfort: Math.max(0, Math.min(100, current.comfort + (delta.comfort ?? 0))),
      respect: Math.max(0, Math.min(100, current.respect + (delta.respect ?? 0))),
      annoyance: Math.max(0, Math.min(100, current.annoyance + (delta.annoyance ?? 0))),
    };

    this.relationships.set(buddyId, updated);
    this.eventBus.emit('social:relationship_updated', { buddyId, dimensions: { ...updated } });
    return { ...updated };
  }

  public sendMessage(conversationId: string, text: string, currentTotalMinutes: number): MessageRecord {
    const day = Math.floor(currentTotalMinutes / 1440) + 1;
    const msg: MessageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conversationId,
      senderId: 'player',
      recipientId: conversationId,
      text,
      timestampMinute: currentTotalMinutes,
      day,
      isRead: true,
      deliveredAway: false,
    };

    const msgs = this.conversations.get(conversationId) || [];
    msgs.push(msg);
    this.conversations.set(conversationId, msgs);

    this.eventBus.emit('social:message_sent', { message: { ...msg } });
    return { ...msg };
  }

  public receiveIncomingMessage(
    conversationId: string,
    text: string,
    currentTotalMinutes: number,
    deliveredAway = false
  ): MessageRecord {
    const day = Math.floor(currentTotalMinutes / 1440) + 1;
    const msg: MessageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conversationId,
      senderId: conversationId,
      recipientId: 'player',
      text,
      timestampMinute: currentTotalMinutes,
      day,
      isRead: false,
      deliveredAway,
    };

    const msgs = this.conversations.get(conversationId) || [];
    msgs.push(msg);
    this.conversations.set(conversationId, msgs);

    this.eventBus.emit('social:message_received', { message: { ...msg } });
    return { ...msg };
  }

  public markConversationRead(conversationId: string): void {
    const msgs = this.conversations.get(conversationId);
    if (!msgs) return;

    for (const msg of msgs) {
      msg.isRead = true;
    }
  }

  public getUnreadCount(conversationId?: string): number {
    if (conversationId) {
      const msgs = this.conversations.get(conversationId) || [];
      return msgs.filter(m => !m.isRead).length;
    }

    let total = 0;
    for (const msgs of this.conversations.values()) {
      total += msgs.filter(m => !m.isRead).length;
    }
    return total;
  }
}
```

---

# 6. Subsystem Integration & Event Flow Diagram

```
+-----------------------------------------------------------------------------------------------+
| DOWNLOAD MANAGER                                                                              |
| - Calculates byte accumulation using water-filling bandwidth splitting                        |
| - Upon completion -> Dispatches 'download:completed'                                          |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
| FILE SYSTEM ENGINE                                                                            |
| - Creates FileRecord in C:/Downloads/                                                         |
| - Deducts occupied space from 40GB HDD accounting                                             |
| - Launches associated installer upon execution                                                |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
| SOFTWARE REGISTRY                                                                             |
| - 6-Stage installer verifies OS & RAM requirements (PhotoBox fails on Orion 4.8 / 512MB RAM)  |
| - Handles bundled WeatherBuddy / SearchMate toolbar adware injection                          |
| - Completes install -> Registers in Add/Remove Programs -> Creates C:/Desktop shortcut        |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
| SOCIAL ENGINE & INK NARRATIVE                                                                 |
| - Evaluates 14-day character schedules (Ryan, Maya, Nora, Henderson)                          |
| - Dispatches incoming messages while player is away from PC                                   |
| - Applies '# social:maya:empathy' semantic tags to update hidden relationship dimensions      |
+-----------------------------------------------------------------------------------------------+
```

---

# 7. Unit & Integration Test Specifications

### Vitest Test Suites:
1. `tests/unit/DownloadManager.test.ts`:
   - Single download on 256kbps DSL calculates correct byte transfer per minute (1920 KB / min).
   - Multi-download bandwidth splitting respects server limits and redistributes excess bandwidth.
   - Discrete time jump (360 minutes sleep) completes tasks and frees bandwidth mid-jump.
   - Non-resumable download resets upon resume.
2. `tests/unit/FileSystemEngine.test.ts`:
   - Canonical hierarchy (`Desktop`, `Downloads`, `Program Files`, `Documents`, `Music`, `Pictures`, `Trash`).
   - Disk full error thrown when file size > available free storage.
   - Soft delete moves to trash; `emptyTrash()` permanently purges files and reclaims bytes.
   - `restoreFromTrash()` restores file to exact original directory.
3. `tests/unit/SoftwareRegistry.test.ts`:
   - PhotoBox 3.0 installer halts with compatibility error on Orion 4.8 + 512MB RAM.
   - WeatherBuddy Express install injects SearchMate toolbar and sets homepage.
   - WeatherBuddy Custom install skips adware when unchecked.
   - Uninstaller cleanly removes shortcuts, frees disk space, and reverts browser modifications.
4. `tests/unit/SocialEngine.test.ts`:
   - Character schedule evaluates correctly across morning, daytime, evening, and late-night boundaries.
   - Semantic social actions update all 5 hidden dimensions within $[0, 100]$.
   - Offline message delivery flags `deliveredAway = true` and increments unread badge.
