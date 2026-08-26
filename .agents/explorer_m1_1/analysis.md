# Technical Architecture & Blueprints — Milestone 1 (Part A)
**Author**: Explorer M1-1  
**Working Directory**: `f:/_WIP/away-message/.agents/explorer_m1_1/`  
**Target Milestone**: M1 Core Architecture, Build Setup & Simulation Engine

---

## 1. Executive Summary & Architectural Invariants

### 1.1 Architecture & Separation of Concerns
"Away Message" is an atmospheric late-90s/early-2000s desktop narrative simulation and life sim. The system is designed around a strictly decoupled **Authoritative Pure TypeScript Simulation Layer (`src/engine/`)** that operates with zero UI, zero React, zero Phaser, and zero DOM dependencies.

```
+-------------------------------------------------------------------------+
|                              VIEW LAYERS                                |
|  +---------------------------+   +------------------------------------+ |
|  |   React 19 Desktop OS     |   |    Phaser 4 / 2D Canvas Room       | |
|  | (Windows, Apps, Websites) |   | (Desk, Kettle, Window, Street, Bed)| |
|  +---------------------------+   +------------------------------------+ |
|                                ^                                        |
|                                | (Read-only Zustand Stores & Dispatch)  |
+--------------------------------|----------------------------------------+
|                                v                                        |
|  +--------------------------------------------------------------------+ |
|  |             SimulationEngine (Authoritative Root Coordinator)      | |
|  |  - GameClock (1s = 1min, Discrete Time Jumps)                     | |
|  |  - EventBus (Strongly-typed pub/sub)                               | |
|  |  - EconomyEngine (Cash, Shifts, Energy, Motel Rent Due Day 7/14)  | |
|  |  - HardwareEngine (RAM, CPU, DSL Tiers, OS 4.8 / 6.0 Gating)       | |
|  |  - DownloadManager (Bandwidth, ETA, Background Progress)           | |
|  |  - FileSystemEngine (VFS Tree, CRUD, Capacity)                     | |
|  |  - SoftwareRegistry (6-Stage Installer, Add/Remove Programs)       | |
|  |  - SocialEngine (14-Day Schedules, 5 Hidden Dimensions)           | |
|  |  - TelemetryEngine (Local JSON Metrics & Evaluation Summary)       | |
|  +--------------------------------------------------------------------+ |
|                                ^                                        |
|                                | (Snapshot Serialization & Migrations)  |
+--------------------------------|----------------------------------------+
|  +--------------------------------------------------------------------+ |
|  |      Persistence Layer: Dexie IndexedDB (`src/persistence/`)        | |
+-------------------------------------------------------------------------+
```

### 1.2 Invariants & Rules
1. **Zero UI Leaks in Engine**: No code in `src/engine/` may import React, Phaser, Zustand, or Ink runtime components. All domain logic is 100% testable in headless Vitest.
2. **Single Authoritative Timeline**: Time advances strictly through `advanceGameMinutes(minutes)` or `advanceRealTime(seconds)`. Whether the player is typing in Messenger, brewing tea, looking out the window, or working a shift, all background systems (downloads, NPC schedules, energy depletion) advance along the exact same timeline.
3. **Lossless Determinism**: All simulation states must be pure JSON-serializable primitives, arrays, and plain objects. No functions or circular references in the state tree.

---

## 2. Tooling Setup & Environment Configuration

### 2.1 `package.json`
```json
{
  "name": "away-message",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "dexie": "^4.0.11",
    "dexie-react-hooks": "^1.1.7",
    "inkjs": "^2.3.0",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1",
    "zod": "^3.24.2",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.1",
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

### 2.2 `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "tests"]
}
```

### 2.3 `vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
  },
});
```

### 2.4 `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.ts', 'tests/integration/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**/*', 'src/persistence/**/*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 2.5 `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### 2.6 `tailwind.config.js` & `postcss.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Orion OS 4.8 Palette (Windows 98 aesthetic)
        orion4: {
          desktop: '#008080',      // Classic Teal desktop
          gray: '#c0c0c0',         // Window chrome face
          light: '#ffffff',        // 3D bevel top-left highlight
          shadow: '#808080',       // 3D bevel bottom-right shadow
          darkShadow: '#000000',   // 3D bevel bottom-right dark border
          titleActive: '#000080',  // Classic Navy Blue title bar
          titleActiveText: '#ffffff',
          titleInactive: '#808080',
          titleInactiveText: '#c0c0c0',
        },
        // Orion OS 6.0 Palette (XP / 2000s aesthetic)
        orion6: {
          desktop: '#245edb',      // XP Royale / Bliss Blue
          gray: '#ece9d8',         // XP Sand chrome
          titleActive: '#0055ea',  // XP Blue gradient
          titleActiveText: '#ffffff',
          taskbar: '#1f48ab',      // Rich royal blue taskbar
          startBtn: '#388e3c',     // Emerald start button
        },
        retro: {
          crtGreen: '#33ff33',
          crtAmber: '#ffb000',
        },
      },
      fontFamily: {
        pixel: ['"MS Sans Serif"', 'Tahoma', 'Geneva', 'sans-serif'],
        orionModern: ['Tahoma', '"Segoe UI"', 'sans-serif'],
        terminal: ['"Lucida Console"', 'Monaco', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'orion-outset': 'inset 1px 1px #fff, inset -1px -1px #808080, 1px 1px 0px #000',
        'orion-inset': 'inset 1px 1px #808080, inset -1px -1px #fff, inset 2px 2px #000',
        'orion-window': 'inset 1px 1px 0px #dfdfdf, inset -1px -1px 0px #000000, inset 2px 2px 0px #ffffff, inset -2px -2px 0px #808080',
      },
    },
  },
  plugins: [],
};
```

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 2.7 `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>Away Message — 14-Day Evaluation</title>
  </head>
  <body class="bg-black text-slate-900 overflow-hidden select-none font-pixel antialiased">
    <div id="root" class="w-screen h-screen relative overflow-hidden"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 2.8 `tests/setup.ts`
```typescript
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Global test resets if necessary
});
```

---

## 3. Core TypeScript Domain Interfaces (`src/engine/types/index.ts`)

```typescript
// ==========================================
// TIME & CLOCK DOMAIN
// ==========================================

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night' | 'late_night';

export interface GameTime {
  day: number;           // 1..14 (and 15+ in free play)
  hour: number;          // 0..23
  minute: number;        // 0..59
  totalMinutes: number;  // Monotonic elapsed simulation minutes from Day 1, 08:00 (base = 480)
  timeOfDay: TimeOfDay;
  isWeekend: boolean;    // Day 6, 7, 13, 14
}

export interface TimeJumpResult {
  elapsedMinutes: number;
  previousTime: GameTime;
  newTime: GameTime;
  dayChanged: boolean;
  daysSkipped: number;
}

// ==========================================
// ECONOMY & PLAYER DOMAIN
// ==========================================

export type EnergyStatus = 'Rested' | 'Fine' | 'Tired' | 'Exhausted';

export interface PlayerState {
  cash: number;              // Starting: $38.00
  energy: number;            // 0..100
  fatigue: number;           // 0..100
  rentDueDay: number;        // Day 7, then Day 14
  rentAmount: number;        // $140.00
  rentPaid: boolean;
  internetBillDueDay: number;// Day 5, then Day 12
  internetBillAmount: number;// $25.00
  internetBillPaid: boolean;
  dailyFoodCost: number;     // $10.00 / day
}

export interface WorkShiftResult {
  success: boolean;
  hours: number;
  earnedWage: number;
  energySpent: number;
  fatigueAdded: number;
  error?: string;
}

// ==========================================
// HARDWARE & OS DOMAIN
// ==========================================

export type ConnectionType = 'dialup_56k' | 'dsl_256k' | 'dsl_512k' | 'dsl_1m';
export type OsVersion = 'Orion_4.8' | 'Orion_6.0';

export interface HardwareState {
  cpuTier: number;                  // 1 (Single-Core 450MHz), 2 (Dual-Core 800MHz)
  cpuName: string;
  ramMB: number;                    // Starting: 512, Upgraded: 1024
  hddTotalGB: number;               // 40 GB
  hddFreeGB: number;                // Starting: ~7.0 GB free (33 GB OS baseline)
  connectionType: ConnectionType;   // Starting: 'dsl_256k'
  connectionSpeedKbps: number;      // 256, 512, 1024
  osVersion: OsVersion;             // Starting: 'Orion_4.8'
  soundCardInstalled: boolean;      // true
  speakersInstalled: boolean;       // false -> true
  webcamInstalled: boolean;         // false -> true
}

export interface RamPressure {
  totalRamMB: number;
  usedRamMB: number;
  freeRamMB: number;
  pressureRatio: number;            // used / total
  status: 'nominal' | 'elevated' | 'critical';
}

export interface SoftwareRequirement {
  minOs: OsVersion;
  minRamMB: number;
  minCpuTier: number;
  requiredDiskBytes: number;
}

// ==========================================
// VIRTUAL FILE SYSTEM (VFS) DOMAIN
// ==========================================

export type FileKind = 'executable' | 'installer' | 'text' | 'image' | 'audio' | 'archive' | 'system';

export interface FileRecord {
  id: string;
  name: string;
  path: string;                     // e.g. '/Downloads/PulseSetup.exe'
  folder: string;                   // 'Desktop' | 'Downloads' | 'Documents' | 'Music' | 'Pictures' | 'Program Files' | 'Trash'
  kind: FileKind;
  sizeBytes: number;
  createdAtMinutes: number;
  appAssociation?: string;
  metadata?: Record<string, unknown>;
  content?: string;                 // Text file contents or data payload
  isReadOnly?: boolean;
}

export interface VirtualFileSystemState {
  files: Record<string, FileRecord>;
  totalCapacityBytes: number;       // 40 * 1024 * 1024 * 1024
  usedBytes: number;
}

// ==========================================
// DOWNLOADS DOMAIN
// ==========================================

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'complete' | 'failed';

export interface DownloadTask {
  id: string;
  sourceId: string;                 // e.g. 'downloadhub_pulse'
  url: string;                      // 'http://downloadhub.local/files/PulseSetup.exe'
  fileName: string;
  targetFolder: string;             // 'Downloads'
  totalBytes: number;
  downloadedBytes: number;
  sourceMaxKbps: number;            // Server throttle rate
  status: DownloadStatus;
  resumable: boolean;
  startedAtMinutes: number;
  completedAtMinutes?: number;
  error?: string;
}

// ==========================================
// SOFTWARE REGISTRY DOMAIN
// ==========================================

export type InstallStage = 'welcome' | 'license' | 'compatibility' | 'options' | 'progress' | 'finish';

export interface SoftwareComponentOption {
  id: string;
  name: string;
  description: string;
  selectedByDefault: boolean;
  isAdwareOrToolbar?: boolean;
  installedBytes: number;
  modifiesBrowserHomepage?: string;
  modifiesBrowserToolbar?: string;
  launchAtStartup?: boolean;
}

export interface SoftwareDefinition {
  id: string;
  name: string;
  version: string;
  downloadFileId: string;
  downloadBytes: number;
  installedBytes: number;
  requirements: SoftwareRequirement;
  memoryMB: number;
  startupCostMs: number;
  isPortable: boolean;
  appId: string;
  bundledOptions?: SoftwareComponentOption[];
  icon: string;
}

export interface InstalledSoftwareRecord {
  id: string;
  softwareId: string;
  name: string;
  version: string;
  installedAtMinutes: number;
  installedBytes: number;
  appId: string;
  isPortable: boolean;
  installedOptions: string[];       // IDs of bundled components accepted
  shortcuts: string[];              // e.g. ['Desktop/Pulse Messenger', 'StartMenu/Pulse']
  modifications: {
    browserHomepage?: string;
    browserToolbar?: string;
    launchAtStartup?: boolean;
  };
}

// ==========================================
// SOCIAL & CONTACTS DOMAIN
// ==========================================

export type BuddyStatus = 'online' | 'away' | 'busy' | 'offline';

export interface RelationshipDimensions {
  familiarity: number;  // 0..100 (general rapport & frequency)
  trust: number;        // 0..100 (willingness to share secrets)
  comfort: number;      // 0..100 (ease of conversation, teasing)
  respect: number;      // 0..100 (admiration of choices/opinions)
  annoyance: number;    // 0..100 (friction or boundary violations)
}

export interface BuddyState {
  id: string;                       // 'ryan_foodcart' | 'starlight_maya' | 'NightOwl87' | 'mr_henderson'
  displayName: string;
  handle: string;
  avatar: string;
  status: BuddyStatus;
  statusMessage: string;
  customAwayMessage?: string;
  currentActivity?: string;
  relationship: RelationshipDimensions;
  introduced: boolean;
  unlockedDay: number;
  lastMessageMinutes: number;
  hasUnread: boolean;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;                 // 'player' or buddyId
  text: string;
  timestampMinutes: number;
  isRead: boolean;
  tags?: string[];
}

export interface SocialState {
  buddies: Record<string, BuddyState>;
  messages: Record<string, MessageRecord[]>;
}

// ==========================================
// NARRATIVE & APPOINTMENTS DOMAIN
// ==========================================

export interface Appointment {
  id: string;
  characterId: string;
  locationId: string;               // 'cafe' | 'work' | 'motel_lobby'
  targetDay: number;
  startMinute: number;              // Minute of day (e.g. 15 * 60 = 15:00)
  endMinute: number;
  description: string;
  isCompleted: boolean;
  isMissed: boolean;
}

export interface InkSemanticTag {
  type: 'beat' | 'effect' | 'social';
  target?: string;
  action?: string;
  value?: unknown;
  raw: string;
}

export interface NarrativeState {
  activeBeatId: string | null;
  completedBeats: string[];
  flags: Record<string, boolean | number | string>;
  appointments: Appointment[];
  windowObservationHistory: string[];
}

// ==========================================
// TELEMETRY DOMAIN
// ==========================================

export interface TelemetryRecord {
  timestampMinutes: number;
  realTimestampMs: number;
  category: 'economy' | 'hardware' | 'social' | 'software' | 'download' | 'narrative' | 'room';
  action: string;
  data?: Record<string, unknown>;
}

export interface TelemetryStats {
  sessionStartTimeMs: number;
  totalRealPlayTimeSeconds: number;
  gameDaysReached: number;
  minutesInPcView: number;
  minutesInRoomView: number;
  totalMoneyEarned: number;
  totalMoneySpent: number;
  peakCash: number;
  lowestCash: number;
  rentPaymentsCompleted: number;
  programsInstalledCount: number;
  downloadsCompletedCount: number;
  windowObservationsCount: number;
  workShiftsCompleted: number;
  hardwareUpgradesCount: number;
  osUpgradedDay: number | null;
  cafeMeetingAttended: boolean;
  endingReached: string | null;
}

// ==========================================
// ROOT SIMULATION STATE & ACTIONS
// ==========================================

export interface SimulationState {
  version: number;                  // Schema version (e.g. 1)
  time: GameTime;
  player: PlayerState;
  hardware: HardwareState;
  vfs: VirtualFileSystemState;
  downloads: DownloadTask[];
  installedSoftware: InstalledSoftwareRecord[];
  social: SocialState;
  narrative: NarrativeState;
  telemetry: {
    stats: TelemetryStats;
    logs: TelemetryRecord[];
  };
  activeView: 'pc' | 'room' | 'cafe' | 'work';
}

export type SimulationAction =
  | { type: 'TIME_ADVANCE_MINUTES'; minutes: number; reason?: string }
  | { type: 'TIME_SET_PAUSED'; paused: boolean }
  | { type: 'VIEW_SWITCH'; view: 'pc' | 'room' | 'cafe' | 'work' }
  | { type: 'PLAYER_EARN_CASH'; amount: number; reason: string }
  | { type: 'PLAYER_SPEND_CASH'; amount: number; reason: string }
  | { type: 'PLAYER_WORK_SHIFT'; durationMinutes?: number; wage?: number }
  | { type: 'PLAYER_PAY_RENT' }
  | { type: 'PLAYER_PAY_INTERNET' }
  | { type: 'PLAYER_REST_OR_SLEEP'; wakeHour?: number }
  | { type: 'PLAYER_INTERACT_ROOM'; activity: 'tea' | 'coffee' | 'meal' | 'shower' | 'window' }
  | { type: 'HARDWARE_UPGRADE_RAM'; ramMB: number; cost: number }
  | { type: 'HARDWARE_UPGRADE_CONNECTION'; connectionType: ConnectionType; cost: number }
  | { type: 'HARDWARE_UPGRADE_OS'; targetOs: OsVersion; cost: number }
  | { type: 'DOWNLOAD_START'; sourceId: string; url: string; fileName: string; totalBytes: number; sourceMaxKbps: number }
  | { type: 'DOWNLOAD_PAUSE'; taskId: string }
  | { type: 'DOWNLOAD_RESUME'; taskId: string }
  | { type: 'DOWNLOAD_CANCEL'; taskId: string }
  | { type: 'VFS_CREATE_FILE'; file: Omit<FileRecord, 'createdAtMinutes'> }
  | { type: 'VFS_DELETE_FILE'; fileId: string }
  | { type: 'SOFTWARE_INSTALL'; softwareId: string; selectedOptions: string[] }
  | { type: 'SOFTWARE_UNINSTALL'; softwareId: string }
  | { type: 'SOCIAL_SEND_MESSAGE'; buddyId: string; text: string; tags?: string[] }
  | { type: 'SOCIAL_APPLY_ACTION'; buddyId: string; socialAction: string }
  | { type: 'NARRATIVE_TRIGGER_BEAT'; beatId: string }
  | { type: 'NARRATIVE_SET_FLAG'; key: string; value: boolean | number | string }
  | { type: 'NARRATIVE_SCHEDULE_APPOINTMENT'; appointment: Omit<Appointment, 'isCompleted' | 'isMissed'> };

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==========================================
// SIMULATION EVENT MAP (EVENT BUS)
// ==========================================

export interface SimulationEventMap {
  'time:tick': { time: GameTime; deltaMinutes: number };
  'time:day_changed': { newDay: number; previousDay: number; time: GameTime };
  'time:jump': { jumpMinutes: number; time: GameTime; reason?: string };
  'economy:cash_changed': { previousCash: number; newCash: number; delta: number; reason: string };
  'economy:shift_completed': { wage: number; hours: number; energySpent: number };
  'economy:rent_due': { day: number; amount: number };
  'economy:rent_paid': { day: number; amount: number };
  'economy:energy_changed': { previousEnergy: number; newEnergy: number; delta: number };
  'hardware:upgraded': { component: string; oldValue: unknown; newValue: unknown };
  'hardware:os_migrated': { from: OsVersion; to: OsVersion };
  'download:started': { task: DownloadTask };
  'download:progress': { taskId: string; progress: number; speedKbps: number };
  'download:completed': { task: DownloadTask; createdFile: FileRecord };
  'download:failed': { taskId: string; error: string };
  'vfs:file_created': { file: FileRecord };
  'vfs:file_deleted': { fileId: string; freedBytes: number };
  'software:installed': { software: InstalledSoftwareRecord };
  'software:uninstalled': { softwareId: string };
  'social:status_changed': { buddyId: string; status: BuddyStatus; activity?: string };
  'social:message_received': { message: MessageRecord };
  'social:relationship_updated': { buddyId: string; dimensions: RelationshipDimensions; delta: Partial<RelationshipDimensions> };
  'narrative:tag_emitted': { tag: InkSemanticTag };
  'narrative:beat_triggered': { beatId: string };
  'telemetry:event_logged': { record: TelemetryRecord };
}
```

---

## 4. Deterministic Clock System (`GameClock.ts`)

### 4.1 Specification & Mathematical Invariants
- **Base Timeline**: Day 1 begins at **08:00 AM** (Minute 480).
- **Time Conversion**: `1 real second = 1 simulation game minute` (Configurable `timeScaleMinutesPerRealSecond = 1.0`).
- **Time of Day Calculation**:
  - `06:00 <= hour < 12:00`: `morning`
  - `12:00 <= hour < 18:00`: `day`
  - `18:00 <= hour < 22:00`: `evening`
  - `22:00 <= hour < 03:00`: `night` (22:00 - 23:59 or 00:00 - 02:59)
  - `03:00 <= hour < 06:00`: `late_night`
- **Interactable Default Durations**:
  - Tea: 6 min
  - Coffee: 5 min
  - Simple Meal / Noodles: 15 min
  - Shower: 12 min
  - Window observation: 4 min
  - Quick errand: 30 min
  - Work shift: 240 min (4 hours)
  - Café meeting: 75 min

### 4.2 Code Blueprint: `src/engine/GameClock.ts`
```typescript
import { GameTime, TimeOfDay, TimeJumpResult } from './types';

export interface GameClockConfig {
  initialDay?: number;
  initialHour?: number;
  initialMinute?: number;
  timeScaleMinutesPerRealSecond?: number; // Default: 1.0 (1 real second = 1 game minute)
}

export class GameClock {
  private totalMinutes: number;
  private timeScale: number;
  private isPausedState: boolean;
  private accumulatedFractionalMinutes: number;

  constructor(config: GameClockConfig = {}) {
    const day = config.initialDay ?? 1;
    const hour = config.initialHour ?? 8;
    const minute = config.initialMinute ?? 0;
    
    this.totalMinutes = ((day - 1) * 24 * 60) + (hour * 60) + minute;
    this.timeScale = config.timeScaleMinutesPerRealSecond ?? 1.0;
    this.isPausedState = false;
    this.accumulatedFractionalMinutes = 0;
  }

  public getTime(): GameTime {
    return GameClock.calculateGameTime(this.totalMinutes);
  }

  public static calculateGameTime(totalMinutes: number): GameTime {
    const totalDaysElapsed = Math.floor(totalMinutes / (24 * 60));
    const day = totalDaysElapsed + 1;
    const minuteOfDay = totalMinutes % (24 * 60);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    let timeOfDay: TimeOfDay;
    if (hour >= 6 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 18) {
      timeOfDay = 'day';
    } else if (hour >= 18 && hour < 22) {
      timeOfDay = 'evening';
    } else if (hour >= 22 || hour < 3) {
      timeOfDay = 'night';
    } else {
      timeOfDay = 'late_night';
    }

    const dayOfWeek = ((day - 1) % 7) + 1;
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;

    return {
      day,
      hour,
      minute,
      totalMinutes,
      timeOfDay,
      isWeekend,
    };
  }

  public tickRealTime(deltaRealSeconds: number): { elapsedMinutes: number; time: GameTime; dayChanged: boolean } {
    if (this.isPausedState || deltaRealSeconds <= 0) {
      return { elapsedMinutes: 0, time: this.getTime(), dayChanged: false };
    }

    this.accumulatedFractionalMinutes += deltaRealSeconds * this.timeScale;
    const wholeMinutes = Math.floor(this.accumulatedFractionalMinutes);

    if (wholeMinutes > 0) {
      this.accumulatedFractionalMinutes -= wholeMinutes;
      const jumpResult = this.advanceMinutes(wholeMinutes);
      return {
        elapsedMinutes: wholeMinutes,
        time: jumpResult.newTime,
        dayChanged: jumpResult.dayChanged,
      };
    }

    return { elapsedMinutes: 0, time: this.getTime(), dayChanged: false };
  }

  public advanceMinutes(minutes: number): TimeJumpResult {
    if (minutes <= 0) {
      const current = this.getTime();
      return { elapsedMinutes: 0, previousTime: current, newTime: current, dayChanged: false, daysSkipped: 0 };
    }

    const previousTime = this.getTime();
    this.totalMinutes += minutes;
    const newTime = this.getTime();

    const dayChanged = newTime.day !== previousTime.day;
    const daysSkipped = Math.max(0, newTime.day - previousTime.day);

    return {
      elapsedMinutes: minutes,
      previousTime,
      newTime,
      dayChanged,
      daysSkipped,
    };
  }

  public calculateMinutesUntil(targetDay: number, targetHour: number, targetMinute = 0): number {
    const targetTotalMinutes = ((targetDay - 1) * 24 * 60) + (targetHour * 60) + targetMinute;
    return Math.max(0, targetTotalMinutes - this.totalMinutes);
  }

  public jumpToNextMorning(wakeHour = 8): TimeJumpResult {
    const current = this.getTime();
    let targetDay = current.day;
    if (current.hour >= wakeHour) {
      targetDay += 1;
    }
    const minutesToJump = this.calculateMinutesUntil(targetDay, wakeHour, 0);
    return this.advanceMinutes(minutesToJump);
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  public setPaused(paused: boolean): void {
    this.isPausedState = paused;
    if (paused) {
      this.accumulatedFractionalMinutes = 0;
    }
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, scale);
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public setTotalMinutes(totalMinutes: number): void {
    this.totalMinutes = Math.max(0, totalMinutes);
    this.accumulatedFractionalMinutes = 0;
  }

  public getTotalMinutes(): number {
    return this.totalMinutes;
  }
}
```

---

## 5. Strongly Typed Event Bus (`EventBus.ts`)

### 5.1 Specification & Invariants
- Pub/Sub architecture decoupled from React/DOM.
- Synchronous notification dispatch for predictable deterministic ordering.
- Exception isolation: a throwing listener does not block subsequent listeners.
- Dynamic subscription returns clean unsubscription callback.

### 5.2 Code Blueprint: `src/engine/EventBus.ts`
```typescript
import { SimulationEventMap } from './types';

type EventHandler<T> = (payload: T) => void;

export class EventBus {
  private listeners: {
    [K in keyof SimulationEventMap]?: Set<EventHandler<SimulationEventMap[K]>>;
  } = {};

  public on<K extends keyof SimulationEventMap>(
    event: K,
    handler: EventHandler<SimulationEventMap[K]>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(handler);

    return () => this.off(event, handler);
  }

  public off<K extends keyof SimulationEventMap>(
    event: K,
    handler: EventHandler<SimulationEventMap[K]>
  ): void {
    const set = this.listeners[event];
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        delete this.listeners[event];
      }
    }
  }

  public emit<K extends keyof SimulationEventMap>(
    event: K,
    payload: SimulationEventMap[K]
  ): void {
    const set = this.listeners[event];
    if (!set || set.size === 0) return;

    // Clone set to prevent mutation during iteration
    const handlers = Array.from(set);
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event '${event}':`, err);
      }
    }
  }

  public clear(): void {
    this.listeners = {};
  }

  public listenerCount<K extends keyof SimulationEventMap>(event: K): number {
    return this.listeners[event]?.size ?? 0;
  }
}
```

---

## 6. Economy & Energy Engine (`EconomyEngine.ts`)

### 6.1 Specification & Economic Balance
- **Initial Values**: Cash = **$38.00**, Energy = **100**, Fatigue = **0**.
- **Work Shifts**: Primary food cart shift earns **+$62.00**, consumes **35 energy**, adds **25 fatigue**, takes **240 minutes** (4 hours).
- **Motel Rent**:
  - Weekly payment: **$140.00**.
  - First due date: **Day 7**. Second due date: **Day 14**.
  - Grace period / Late fee: If unpaid on Day 7, player receives a notice from Mr. Henderson with a **$15 late fee**, but the game does not hard-lock.
- **Internet Service**: Due Day 5 ($25.00) and Day 12 ($25.00).
- **Daily Food/Sundry Cost**: **$10.00/day** deducted on day rollover.
- **Energy Feedback Thresholds**:
  - 75..100: `Rested`
  - 45..74: `Fine`
  - 20..44: `Tired` (Work shift takes slightly more energy)
  - 0..19: `Exhausted` (Optional work shift disabled until rested)

### 6.2 Code Blueprint: `src/engine/EconomyEngine.ts`
```typescript
import { PlayerState, EnergyStatus, WorkShiftResult } from './types';
import { EventBus } from './EventBus';

export class EconomyEngine {
  private state: PlayerState;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: Partial<PlayerState>) {
    this.eventBus = eventBus;
    this.state = {
      cash: initialState?.cash ?? 38.0,
      energy: initialState?.energy ?? 100,
      fatigue: initialState?.fatigue ?? 0,
      rentDueDay: initialState?.rentDueDay ?? 7,
      rentAmount: initialState?.rentAmount ?? 140.0,
      rentPaid: initialState?.rentPaid ?? false,
      internetBillDueDay: initialState?.internetBillDueDay ?? 5,
      internetBillAmount: initialState?.internetBillAmount ?? 25.0,
      internetBillPaid: initialState?.internetBillPaid ?? false,
      dailyFoodCost: initialState?.dailyFoodCost ?? 10.0,
    };
  }

  public getState(): Readonly<PlayerState> {
    return { ...this.state };
  }

  public getCash(): number {
    return this.state.cash;
  }

  public canAfford(amount: number): boolean {
    return this.state.cash >= amount;
  }

  public earnCash(amount: number, reason: string): void {
    if (amount <= 0) return;
    const previousCash = this.state.cash;
    this.state.cash = Number((this.state.cash + amount).toFixed(2));

    this.eventBus.emit('economy:cash_changed', {
      previousCash,
      newCash: this.state.cash,
      delta: amount,
      reason,
    });
  }

  public spendCash(amount: number, reason: string): boolean {
    if (amount <= 0) return true;
    if (this.state.cash < amount) {
      return false;
    }
    const previousCash = this.state.cash;
    this.state.cash = Number((this.state.cash - amount).toFixed(2));

    this.eventBus.emit('economy:cash_changed', {
      previousCash,
      newCash: this.state.cash,
      delta: -amount,
      reason,
    });
    return true;
  }

  public performWorkShift(durationMinutes = 240, baseWage = 62.0): WorkShiftResult {
    if (this.state.energy < 15) {
      return {
        success: false,
        hours: 0,
        earnedWage: 0,
        energySpent: 0,
        fatigueAdded: 0,
        error: 'Too exhausted to work shift. Need sleep or rest.',
      };
    }

    const energyCost = this.state.energy < 30 ? 45 : 35;
    const fatigueAdd = 25;
    const hours = durationMinutes / 60;

    this.consumeEnergy(energyCost);
    this.addFatigue(fatigueAdd);
    this.earnCash(baseWage, `Work shift (${hours} hrs)`);

    this.eventBus.emit('economy:shift_completed', {
      wage: baseWage,
      hours,
      energySpent: energyCost,
    });

    return {
      success: true,
      hours,
      earnedWage: baseWage,
      energySpent: energyCost,
      fatigueAdded: fatigueAdd,
    };
  }

  public payRent(): { success: boolean; error?: string } {
    if (this.state.rentPaid) {
      return { success: false, error: 'Rent is already paid for current period.' };
    }
    if (this.state.cash < this.state.rentAmount) {
      return { success: false, error: `Insufficient funds for rent ($${this.state.rentAmount.toFixed(2)}).` };
    }

    this.spendCash(this.state.rentAmount, `Motel rent payment (Due Day ${this.state.rentDueDay})`);
    this.state.rentPaid = true;

    this.eventBus.emit('economy:rent_paid', {
      day: this.state.rentDueDay,
      amount: this.state.rentAmount,
    });

    return { success: true };
  }

  public payInternetBill(): { success: boolean; error?: string } {
    if (this.state.internetBillPaid) {
      return { success: false, error: 'Internet bill already paid.' };
    }
    if (this.state.cash < this.state.internetBillAmount) {
      return { success: false, error: `Insufficient funds for internet bill ($${this.state.internetBillAmount.toFixed(2)}).` };
    }

    this.spendCash(this.state.internetBillAmount, `DSL internet bill (Due Day ${this.state.internetBillDueDay})`);
    this.state.internetBillPaid = true;
    return { success: true };
  }

  public consumeEnergy(amount: number): void {
    if (amount <= 0) return;
    const prev = this.state.energy;
    this.state.energy = Math.max(0, this.state.energy - amount);
    this.eventBus.emit('economy:energy_changed', {
      previousEnergy: prev,
      newEnergy: this.state.energy,
      delta: -amount,
    });
  }

  public restoreEnergy(amount: number): void {
    if (amount <= 0) return;
    const prev = this.state.energy;
    this.state.energy = Math.min(100, this.state.energy + amount);
    this.eventBus.emit('economy:energy_changed', {
      previousEnergy: prev,
      newEnergy: this.state.energy,
      delta: amount,
    });
  }

  public addFatigue(amount: number): void {
    this.state.fatigue = Math.min(100, Math.max(0, this.state.fatigue + amount));
  }

  public restOrSleep(hours: number): void {
    if (hours >= 6) {
      this.state.energy = 100;
      this.state.fatigue = 0;
    } else {
      this.restoreEnergy(hours * 15);
      this.state.fatigue = Math.max(0, this.state.fatigue - (hours * 20));
    }
  }

  public handleDayTransition(newDay: number): void {
    // Deduct basic food & sundry expense if cash allows
    if (this.state.cash >= this.state.dailyFoodCost) {
      this.spendCash(this.state.dailyFoodCost, `Daily food & sundry expenses (Day ${newDay})`);
    }

    // Check Rent Status
    if (newDay > this.state.rentDueDay && !this.state.rentPaid) {
      // Late rent penalty: $15 late fee
      this.state.rentAmount += 15;
      this.eventBus.emit('economy:rent_due', {
        day: this.state.rentDueDay,
        amount: this.state.rentAmount,
      });
    }

    // Advance rent cycle after Day 7 is resolved
    if (newDay > 7 && this.state.rentDueDay === 7 && this.state.rentPaid) {
      this.state.rentDueDay = 14;
      this.state.rentPaid = false;
      this.state.rentAmount = 140.0;
    }

    // Advance internet bill cycle
    if (newDay > 5 && this.state.internetBillDueDay === 5 && this.state.internetBillPaid) {
      this.state.internetBillDueDay = 12;
      this.state.internetBillPaid = false;
    }
  }

  public getEnergyStatus(): EnergyStatus {
    const e = this.state.energy;
    if (e >= 75) return 'Rested';
    if (e >= 45) return 'Fine';
    if (e >= 20) return 'Tired';
    return 'Exhausted';
  }

  public loadState(state: PlayerState): void {
    this.state = { ...state };
  }
}
```

---

## 7. Hardware & OS Compatibility Engine (`HardwareEngine.ts`)

### 7.1 Specification & Gating Logic
- **Starting Specifications**:
  - CPU: Single-Core x86 450MHz (Tier 1)
  - RAM: **512 MB**
  - Storage: **40.0 GB Total**, ~**7.0 GB Free** (33 GB used by Orion 4.8 baseline)
  - Internet: **256 kbps DSL** (max download throughput ~32 KB/s)
  - OS: **Orion OS 4.8**
- **Hardware Upgrade Matrix**:
  - **RAM Upgrade (512 MB -> 1024 MB)**: Cost ~$45. Unlocks OS 6.0 upgrade path, lowers RAM pressure with multiple open windows.
  - **Internet Upgrades**:
    - `dsl_256k` (256 kbps, 32 KB/s) -> `dsl_512k` (512 kbps, 64 KB/s, Cost $30)
    - `dsl_512k` -> `dsl_1m` (1024 kbps, 128 KB/s, Cost $45)
  - **Orion OS 6.0 Upgrade**:
    - Requires **RAM >= 768 MB** (Player must have installed the 1GB RAM upgrade).
    - Requires **HDD Free Space >= 2.0 GB**.
    - Baseline OS RAM overhead increases from 64MB to 160MB.
    - Enables **PhotoBox 3.0**, **Pulse 6.x**, and XP-style warm desktop theme.
- **Application Compatibility Checking**:
  - Verifies minimum OS version, minimum RAM, CPU tier, and free disk space.
  - Generates clear user-facing failure explanations if incompatible.

### 7.2 Code Blueprint: `src/engine/HardwareEngine.ts`
```typescript
import {
  HardwareState,
  ConnectionType,
  OsVersion,
  SoftwareRequirement,
  RamPressure,
} from './types';
import { EventBus } from './EventBus';

export class HardwareEngine {
  private state: HardwareState;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialState?: Partial<HardwareState>) {
    this.eventBus = eventBus;
    this.state = {
      cpuTier: initialState?.cpuTier ?? 1,
      cpuName: initialState?.cpuName ?? 'Single-Core Orion x86 450MHz',
      ramMB: initialState?.ramMB ?? 512,
      hddTotalGB: initialState?.hddTotalGB ?? 40.0,
      hddFreeGB: initialState?.hddFreeGB ?? 7.0,
      connectionType: initialState?.connectionType ?? 'dsl_256k',
      connectionSpeedKbps: initialState?.connectionSpeedKbps ?? 256,
      osVersion: initialState?.osVersion ?? 'Orion_4.8',
      soundCardInstalled: initialState?.soundCardInstalled ?? true,
      speakersInstalled: initialState?.speakersInstalled ?? false,
      webcamInstalled: initialState?.webcamInstalled ?? false,
    };
  }

  public getState(): Readonly<HardwareState> {
    return { ...this.state };
  }

  public checkRequirements(req: SoftwareRequirement): { compatible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // OS Check
    if (req.minOs === 'Orion_6.0' && this.state.osVersion === 'Orion_4.8') {
      reasons.push('Requires Orion OS 6.0 or later (Current: Orion OS 4.8).');
    }

    // RAM Check
    if (this.state.ramMB < req.minRamMB) {
      reasons.push(`Requires at least ${req.minRamMB} MB RAM (Installed: ${this.state.ramMB} MB).`);
    }

    // CPU Check
    if (this.state.cpuTier < req.minCpuTier) {
      reasons.push(`Requires CPU Tier ${req.minCpuTier} or higher.`);
    }

    // Disk Check
    const requiredGB = req.requiredDiskBytes / (1024 * 1024 * 1024);
    if (this.state.hddFreeGB < requiredGB) {
      reasons.push(`Insufficient disk space. Requires ${requiredGB.toFixed(2)} GB (Free: ${this.state.hddFreeGB.toFixed(2)} GB).`);
    }

    return {
      compatible: reasons.length === 0,
      reasons,
    };
  }

  public calculateRamPressure(runningAppsMemoryMB: number): RamPressure {
    const osBaselineMB = this.state.osVersion === 'Orion_6.0' ? 160 : 64;
    const totalUsedMB = osBaselineMB + runningAppsMemoryMB;
    const freeMB = Math.max(0, this.state.ramMB - totalUsedMB);
    const pressureRatio = totalUsedMB / this.state.ramMB;

    let status: 'nominal' | 'elevated' | 'critical' = 'nominal';
    if (pressureRatio >= 0.9) {
      status = 'critical';
    } else if (pressureRatio >= 0.75) {
      status = 'elevated';
    }

    return {
      totalRamMB: this.state.ramMB,
      usedRamMB: totalUsedMB,
      freeRamMB: freeMB,
      pressureRatio,
      status,
    };
  }

  public upgradeRam(newRamMB: number): boolean {
    if (newRamMB <= this.state.ramMB) return false;
    const oldRam = this.state.ramMB;
    this.state.ramMB = newRamMB;

    this.eventBus.emit('hardware:upgraded', {
      component: 'RAM',
      oldValue: `${oldRam}MB`,
      newValue: `${newRamMB}MB`,
    });
    return true;
  }

  public upgradeConnection(newType: ConnectionType): boolean {
    const speedMap: Record<ConnectionType, number> = {
      dialup_56k: 56,
      dsl_256k: 256,
      dsl_512k: 512,
      dsl_1m: 1024,
    };
    const oldType = this.state.connectionType;
    this.state.connectionType = newType;
    this.state.connectionSpeedKbps = speedMap[newType];

    this.eventBus.emit('hardware:upgraded', {
      component: 'Internet',
      oldValue: oldType,
      newValue: newType,
    });
    return true;
  }

  public upgradeOs(targetOs: OsVersion): { success: boolean; error?: string } {
    if (this.state.osVersion === targetOs) {
      return { success: false, error: `Already running ${targetOs}.` };
    }

    if (targetOs === 'Orion_6.0') {
      if (this.state.ramMB < 768) {
        return {
          success: false,
          error: 'Orion OS 6.0 setup failed: Requires at least 768 MB RAM. Please upgrade memory first.',
        };
      }
      if (this.state.hddFreeGB < 2.0) {
        return {
          success: false,
          error: 'Orion OS 6.0 setup failed: Requires at least 2.0 GB free disk space.',
        };
      }
    }

    const prevOs = this.state.osVersion;
    this.state.osVersion = targetOs;
    // OS upgrade claims 1.5GB additional system storage
    this.state.hddFreeGB = Math.max(0.5, Number((this.state.hddFreeGB - 1.5).toFixed(2)));

    this.eventBus.emit('hardware:os_migrated', {
      from: prevOs,
      to: targetOs,
    });

    return { success: true };
  }

  public allocateDiskSpaceBytes(bytes: number): boolean {
    const gb = bytes / (1024 * 1024 * 1024);
    if (this.state.hddFreeGB < gb) return false;
    this.state.hddFreeGB = Number((this.state.hddFreeGB - gb).toFixed(3));
    return true;
  }

  public freeDiskSpaceBytes(bytes: number): void {
    const gb = bytes / (1024 * 1024 * 1024);
    this.state.hddFreeGB = Math.min(this.state.hddTotalGB, Number((this.state.hddFreeGB + gb).toFixed(3)));
  }

  public loadState(state: HardwareState): void {
    this.state = { ...state };
  }
}
```

---

## 8. Telemetry & Statistics Engine (`TelemetryEngine.ts`)

### 8.1 Specification & Evaluation Export
- Local-only evaluation telemetry (zero network requests).
- Captures overall playtime, day progression, view breakdown (PC vs Room), money earned/spent, software installed/removed, hardware upgrades, downloads, social milestones, and Day 14 ending.
- Single JSON exporter method `exportTelemetryJson()`.

### 8.2 Code Blueprint: `src/engine/TelemetryEngine.ts`
```typescript
import { TelemetryStats, TelemetryRecord } from './types';
import { EventBus } from './EventBus';

export class TelemetryEngine {
  private stats: TelemetryStats;
  private logs: TelemetryRecord[];
  private eventBus: EventBus;

  constructor(eventBus: EventBus, initialStats?: Partial<TelemetryStats>, initialLogs?: TelemetryRecord[]) {
    this.eventBus = eventBus;
    this.stats = {
      sessionStartTimeMs: initialStats?.sessionStartTimeMs ?? Date.now(),
      totalRealPlayTimeSeconds: initialStats?.totalRealPlayTimeSeconds ?? 0,
      gameDaysReached: initialStats?.gameDaysReached ?? 1,
      minutesInPcView: initialStats?.minutesInPcView ?? 0,
      minutesInRoomView: initialStats?.minutesInRoomView ?? 0,
      totalMoneyEarned: initialStats?.totalMoneyEarned ?? 0,
      totalMoneySpent: initialStats?.totalMoneySpent ?? 0,
      peakCash: initialStats?.peakCash ?? 38.0,
      lowestCash: initialStats?.lowestCash ?? 38.0,
      rentPaymentsCompleted: initialStats?.rentPaymentsCompleted ?? 0,
      programsInstalledCount: initialStats?.programsInstalledCount ?? 0,
      downloadsCompletedCount: initialStats?.downloadsCompletedCount ?? 0,
      windowObservationsCount: initialStats?.windowObservationsCount ?? 0,
      workShiftsCompleted: initialStats?.workShiftsCompleted ?? 0,
      hardwareUpgradesCount: initialStats?.hardwareUpgradesCount ?? 0,
      osUpgradedDay: initialStats?.osUpgradedDay ?? null,
      cafeMeetingAttended: initialStats?.cafeMeetingAttended ?? false,
      endingReached: initialStats?.endingReached ?? null,
    };
    this.logs = initialLogs ? [...initialLogs] : [];

    this.registerEventListeners();
  }

  private registerEventListeners(): void {
    this.eventBus.on('economy:cash_changed', ({ delta }) => {
      if (delta > 0) {
        this.stats.totalMoneyEarned += delta;
      } else {
        this.stats.totalMoneySpent += Math.abs(delta);
      }
    });

    this.eventBus.on('economy:shift_completed', () => {
      this.stats.workShiftsCompleted += 1;
    });

    this.eventBus.on('economy:rent_paid', () => {
      this.stats.rentPaymentsCompleted += 1;
    });

    this.eventBus.on('hardware:upgraded', () => {
      this.stats.hardwareUpgradesCount += 1;
    });

    this.eventBus.on('hardware:os_migrated', () => {
      this.stats.osUpgradedDay = this.stats.gameDaysReached;
    });

    this.eventBus.on('software:installed', () => {
      this.stats.programsInstalledCount += 1;
    });

    this.eventBus.on('download:completed', () => {
      this.stats.downloadsCompletedCount += 1;
    });

    this.eventBus.on('time:day_changed', ({ newDay }) => {
      if (newDay > this.stats.gameDaysReached) {
        this.stats.gameDaysReached = newDay;
      }
    });
  }

  public recordPlayTime(deltaRealSeconds: number, currentView: 'pc' | 'room' | 'cafe' | 'work'): void {
    this.stats.totalRealPlayTimeSeconds += deltaRealSeconds;
    const minutes = deltaRealSeconds / 60;
    if (currentView === 'pc') {
      this.stats.minutesInPcView += minutes;
    } else {
      this.stats.minutesInRoomView += minutes;
    }
  }

  public updateCashBounds(currentCash: number): void {
    if (currentCash > this.stats.peakCash) {
      this.stats.peakCash = currentCash;
    }
    if (currentCash < this.stats.lowestCash) {
      this.stats.lowestCash = currentCash;
    }
  }

  public recordWindowObservation(): void {
    this.stats.windowObservationsCount += 1;
  }

  public recordCafeMeeting(): void {
    this.stats.cafeMeetingAttended = true;
  }

  public recordEnding(endingId: string): void {
    this.stats.endingReached = endingId;
  }

  public logEvent(
    category: TelemetryRecord['category'],
    action: string,
    timestampMinutes: number,
    data?: Record<string, unknown>
  ): void {
    const record: TelemetryRecord = {
      timestampMinutes,
      realTimestampMs: Date.now(),
      category,
      action,
      data,
    };
    this.logs.push(record);
    // Keep max 1000 detailed event logs in memory
    if (this.logs.length > 1000) {
      this.logs.shift();
    }
    this.eventBus.emit('telemetry:event_logged', { record });
  }

  public getStats(): Readonly<TelemetryStats> {
    return { ...this.stats };
  }

  public getLogs(): readonly TelemetryRecord[] {
    return this.logs;
  }

  public exportTelemetryJson(): string {
    const payload = {
      schemaVersion: '1.0.0',
      exportedAtIso: new Date().toISOString(),
      stats: this.stats,
      recentLogs: this.logs.slice(-200),
    };
    return JSON.stringify(payload, null, 2);
  }

  public loadState(stats: TelemetryStats, logs: TelemetryRecord[]): void {
    this.stats = { ...stats };
    this.logs = [...logs];
  }
}
```

---

## 9. Simulation Coordinator (`SimulationEngine.ts`)

### 9.1 Specification & Root Orchestration
- Authoritative master engine holding sub-engines: `GameClock`, `EventBus`, `EconomyEngine`, `HardwareEngine`, `TelemetryEngine`.
- Provides single unified entry points:
  - `getState()`: Returns snapshot of `SimulationState`.
  - `dispatchAction(action: SimulationAction)`: Executes domain action, updates state, notifies subscribers.
  - `advanceGameMinutes(minutes: number, reason?: string)`: Authoritative time jump handler.
  - `advanceRealTime(seconds: number)`: Continuous frame / interval tick handler.
  - `subscribe(listener: (state: Readonly<SimulationState>) => void)`: Clean subscription callback for Zustand / React.
  - `exportSnapshot()` & `loadSnapshot(state: SimulationState)`: Lossless serialization for Dexie IndexedDB.

### 9.2 Code Blueprint: `src/engine/SimulationEngine.ts`
```typescript
import {
  SimulationState,
  SimulationAction,
  ActionResult,
  GameTime,
} from './types';
import { GameClock } from './GameClock';
import { EventBus } from './EventBus';
import { EconomyEngine } from './EconomyEngine';
import { HardwareEngine } from './HardwareEngine';
import { TelemetryEngine } from './TelemetryEngine';

export class SimulationEngine {
  public readonly clock: GameClock;
  public readonly events: EventBus;
  public readonly economy: EconomyEngine;
  public readonly hardware: HardwareEngine;
  public readonly telemetry: TelemetryEngine;

  private activeView: 'pc' | 'room' | 'cafe' | 'work' = 'pc';
  private subscribers: Set<(state: Readonly<SimulationState>) => void> = new Set();

  constructor(initialState?: Partial<SimulationState>) {
    this.events = new EventBus();
    this.clock = new GameClock({
      initialDay: initialState?.time?.day ?? 1,
      initialHour: initialState?.time?.hour ?? 8,
      initialMinute: initialState?.time?.minute ?? 0,
    });
    this.economy = new EconomyEngine(this.events, initialState?.player);
    this.hardware = new HardwareEngine(this.events, initialState?.hardware);
    this.telemetry = new TelemetryEngine(
      this.events,
      initialState?.telemetry?.stats,
      initialState?.telemetry?.logs
    );
    this.activeView = initialState?.activeView ?? 'pc';

    this.registerInternalEventHandlers();
  }

  private registerInternalEventHandlers(): void {
    this.events.on('time:day_changed', ({ newDay }) => {
      this.economy.handleDayTransition(newDay);
    });

    this.events.on('economy:cash_changed', ({ newCash }) => {
      this.telemetry.updateCashBounds(newCash);
    });
  }

  public getState(): Readonly<SimulationState> {
    return {
      version: 1,
      time: this.clock.getTime(),
      player: this.economy.getState(),
      hardware: this.hardware.getState(),
      vfs: {
        files: {},
        totalCapacityBytes: 40 * 1024 * 1024 * 1024,
        usedBytes: (40 - this.hardware.getState().hddFreeGB) * 1024 * 1024 * 1024,
      },
      downloads: [],
      installedSoftware: [],
      social: {
        buddies: {},
        messages: {},
      },
      narrative: {
        activeBeatId: null,
        completedBeats: [],
        flags: {},
        appointments: [],
        windowObservationHistory: [],
      },
      telemetry: {
        stats: this.telemetry.getStats(),
        logs: [...this.telemetry.getLogs()],
      },
      activeView: this.activeView,
    };
  }

  public advanceRealTime(deltaRealSeconds: number): void {
    if (deltaRealSeconds <= 0 || this.clock.isPaused()) return;

    this.telemetry.recordPlayTime(deltaRealSeconds, this.activeView);
    const tickResult = this.clock.tickRealTime(deltaRealSeconds);

    if (tickResult.elapsedMinutes > 0) {
      this.events.emit('time:tick', {
        time: tickResult.time,
        deltaMinutes: tickResult.elapsedMinutes,
      });

      if (tickResult.dayChanged) {
        const prevDay = tickResult.time.day - 1;
        this.events.emit('time:day_changed', {
          newDay: tickResult.time.day,
          previousDay: prevDay,
          time: tickResult.time,
        });
      }

      this.notifySubscribers();
    }
  }

  public advanceGameMinutes(minutes: number, reason?: string): void {
    if (minutes <= 0) return;

    const jumpResult = this.clock.advanceMinutes(minutes);

    this.events.emit('time:jump', {
      jumpMinutes: minutes,
      time: jumpResult.newTime,
      reason,
    });

    if (jumpResult.dayChanged) {
      this.events.emit('time:day_changed', {
        newDay: jumpResult.newTime.day,
        previousDay: jumpResult.previousTime.day,
        time: jumpResult.newTime,
      });
    }

    this.notifySubscribers();
  }

  public dispatchAction(action: SimulationAction): ActionResult {
    const currentMinutes = this.clock.getTotalMinutes();

    switch (action.type) {
      case 'TIME_ADVANCE_MINUTES': {
        this.advanceGameMinutes(action.minutes, action.reason);
        return { success: true };
      }

      case 'TIME_SET_PAUSED': {
        this.clock.setPaused(action.paused);
        this.notifySubscribers();
        return { success: true };
      }

      case 'VIEW_SWITCH': {
        this.activeView = action.view;
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_EARN_CASH': {
        this.economy.earnCash(action.amount, action.reason);
        this.telemetry.logEvent('economy', 'cash_earned', currentMinutes, { amount: action.amount, reason: action.reason });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_SPEND_CASH': {
        const ok = this.economy.spendCash(action.amount, action.reason);
        if (!ok) return { success: false, error: 'Insufficient funds.' };
        this.telemetry.logEvent('economy', 'cash_spent', currentMinutes, { amount: action.amount, reason: action.reason });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_WORK_SHIFT': {
        const shiftRes = this.economy.performWorkShift(action.durationMinutes, action.wage);
        if (!shiftRes.success) return { success: false, error: shiftRes.error };
        // Advance time for the shift duration
        this.advanceGameMinutes(action.durationMinutes ?? 240, 'Work Shift');
        this.telemetry.logEvent('economy', 'shift_worked', currentMinutes, { wage: shiftRes.earnedWage, hours: shiftRes.hours });
        return { success: true, data: shiftRes };
      }

      case 'PLAYER_PAY_RENT': {
        const rentRes = this.economy.payRent();
        if (!rentRes.success) return { success: false, error: rentRes.error };
        this.telemetry.logEvent('economy', 'rent_paid', currentMinutes, { day: this.clock.getTime().day });
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_PAY_INTERNET': {
        const netRes = this.economy.payInternetBill();
        if (!netRes.success) return { success: false, error: netRes.error };
        this.telemetry.logEvent('economy', 'internet_bill_paid', currentMinutes);
        this.notifySubscribers();
        return { success: true };
      }

      case 'PLAYER_REST_OR_SLEEP': {
        const wakeHour = action.wakeHour ?? 8;
        const jump = this.clock.jumpToNextMorning(wakeHour);
        const hoursSlept = jump.elapsedMinutes / 60;
        this.economy.restOrSleep(hoursSlept);
        this.telemetry.logEvent('room', 'sleep', currentMinutes, { hoursSlept, wakeDay: jump.newTime.day });
        this.notifySubscribers();
        return { success: true, data: jump };
      }

      case 'PLAYER_INTERACT_ROOM': {
        const durations: Record<string, number> = {
          tea: 6,
          coffee: 5,
          meal: 15,
          shower: 12,
          window: 4,
        };
        const dur = durations[action.activity] ?? 10;
        this.advanceGameMinutes(dur, `Room interaction: ${action.activity}`);
        if (action.activity === 'tea' || action.activity === 'coffee') {
          this.economy.restoreEnergy(5);
        } else if (action.activity === 'meal') {
          this.economy.restoreEnergy(15);
        } else if (action.activity === 'window') {
          this.telemetry.recordWindowObservation();
        }
        this.telemetry.logEvent('room', `interact_${action.activity}`, currentMinutes);
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_RAM': {
        if (!this.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford RAM upgrade ($${action.cost.toFixed(2)}).` };
        }
        this.economy.spendCash(action.cost, 'RAM Upgrade');
        const upgraded = this.hardware.upgradeRam(action.ramMB);
        if (!upgraded) return { success: false, error: 'Failed to upgrade RAM.' };
        this.telemetry.logEvent('hardware', 'ram_upgraded', currentMinutes, { ramMB: action.ramMB, cost: action.cost });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_CONNECTION': {
        if (!this.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford Internet upgrade ($${action.cost.toFixed(2)}).` };
        }
        this.economy.spendCash(action.cost, 'Internet Plan Upgrade');
        this.hardware.upgradeConnection(action.connectionType);
        this.telemetry.logEvent('hardware', 'connection_upgraded', currentMinutes, { connection: action.connectionType });
        this.notifySubscribers();
        return { success: true };
      }

      case 'HARDWARE_UPGRADE_OS': {
        if (!this.economy.canAfford(action.cost)) {
          return { success: false, error: `Cannot afford OS upgrade package ($${action.cost.toFixed(2)}).` };
        }
        const osRes = this.hardware.upgradeOs(action.targetOs);
        if (!osRes.success) return { success: false, error: osRes.error };
        this.economy.spendCash(action.cost, `Operating System Upgrade (${action.targetOs})`);
        this.advanceGameMinutes(45, 'OS Upgrade Installation & Reboot');
        this.telemetry.logEvent('hardware', 'os_upgraded', currentMinutes, { targetOs: action.targetOs });
        this.notifySubscribers();
        return { success: true };
      }

      default:
        return { success: false, error: `Unhandled action type: ${(action as any).type}` };
    }
  }

  public subscribe(listener: (state: Readonly<SimulationState>) => void): () => void {
    this.subscribers.add(listener);
    // Send immediate initial state
    listener(this.getState());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    const currentState = this.getState();
    for (const listener of this.subscribers) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[SimulationEngine] Subscriber error:', err);
      }
    }
  }

  public exportSnapshot(): SimulationState {
    return JSON.parse(JSON.stringify(this.getState()));
  }

  public loadSnapshot(snapshot: SimulationState): void {
    this.clock.setTotalMinutes(snapshot.time.totalMinutes);
    this.economy.loadState(snapshot.player);
    this.hardware.loadState(snapshot.hardware);
    this.telemetry.loadState(snapshot.telemetry.stats, snapshot.telemetry.logs);
    this.activeView = snapshot.activeView;
    this.notifySubscribers();
  }
}
```

---

## 10. Vitest Unit Test Suites & Verification Invariants

### 10.1 `tests/unit/GameClock.test.ts`
- **T1.1**: Initial conditions verification (Day 1, 08:00 AM, TotalMinutes 480, timeOfDay='morning').
- **T1.2**: Continuous time accumulation (1.0 real sec = 1 game min; fractional tick accumulation).
- **T1.3**: Midnight and day transition (Minute 1439 -> 1440 jumps Day 1 23:59 -> Day 2 00:00).
- **T1.4**: Discrete time jump handling (`advanceMinutes(75)`).
- **T1.5**: Time of Day classifications across all 5 bands (morning, day, evening, night, late_night).
- **T1.6**: Pause state suppresses tick accumulation.

### 10.2 `tests/unit/EconomyEngine.test.ts`
- **T2.1**: Initial state ($38.00 cash, 100 energy, rent due Day 7 $140).
- **T2.2**: Affordability and spend validation (prevents spending more than available balance).
- **T2.3**: Shift execution (earns $62.00, spends energy, increases fatigue).
- **T2.4**: Rent payment lifecycle (success when balance >= $140, state marks rentPaid=true).
- **T2.5**: Day transition penalty (unpaid rent on Day 7+ applies $15 late fee; deducts daily food).
- **T2.6**: Energy qualitative statuses (Rested, Fine, Tired, Exhausted).

### 10.3 `tests/unit/HardwareEngine.test.ts`
- **T3.1**: Starting configuration verification (Orion 4.8, 512MB RAM, 40GB HDD, 256k DSL).
- **T3.2**: RAM upgrade from 512MB -> 1024MB.
- **T3.3**: OS 6.0 upgrade failure when RAM < 768MB.
- **T3.4**: OS 6.0 upgrade success when RAM = 1024MB.
- **T3.5**: Software requirement checking against incompatible and compatible apps.
- **T3.6**: RAM pressure ratio calculations under varied application load.

### 10.4 `tests/unit/SimulationEngine.test.ts`
- **T4.1**: Coordinator initializes all sub-engines with coherent state.
- **T4.2**: `advanceGameMinutes` updates clock, triggers events, and notifies subscribers.
- **T4.3**: Action dispatching (`PLAYER_WORK_SHIFT`) updates both economy and advances time.
- **T4.4**: Hardware upgrade via action checks cash affordability, spends money, and updates hardware state.
- **T4.5**: Snapshot serialization and restoration produces identical state.

---

## 11. Downstream Implementation Plan (for Implementer Agent)
1. Initialize tooling files (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `tests/setup.ts`).
2. Write domain types (`src/engine/types/index.ts`).
3. Implement `src/engine/EventBus.ts`.
4. Implement `src/engine/GameClock.ts`.
5. Implement `src/engine/EconomyEngine.ts`.
6. Implement `src/engine/HardwareEngine.ts`.
7. Implement `src/engine/TelemetryEngine.ts`.
8. Implement `src/engine/SimulationEngine.ts`.
9. Write comprehensive Vitest unit suites in `tests/unit/` and verify with `npm run test:unit`.
