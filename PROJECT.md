# Project: Away Message (14-Day Evaluation Build)

## 1. Architecture Overview
"Away Message" is a narrative-driven desktop simulation and 2D atmospheric life simulator set in the late 1990s / early 2000s.

### Layered Separation of Concerns
1. **Pure TypeScript Simulation Engine (`src/engine/`)**:
   - Zero UI/React/Phaser/DOM dependencies. Fully headless, deterministic, and testable in pure Vitest.
   - Authoritative owner of game clock, time advancement (`advanceGameMinutes(mins)`), money, energy, PC hardware specs, OS version, download queues, virtual file system, character schedules, relationship metrics, events, and telemetry.
2. **Persistence Layer (`src/persistence/`)**:
   - IndexedDB powered by Dexie with explicit schema versions and migrations.
   - Stores: `saves`, `vfs_files`, `downloads`, `installed_software`, `messages`, `relationships`, `narrative_state`, `telemetry_logs`.
   - Auto-save on discrete time jumps and day transitions; lossless reload support.
3. **Desktop OS & UI Shell (`src/desktop/` & `src/apps/`)**:
   - React 19 + TypeScript + Tailwind CSS with retro beveled styles and CSS variables.
   - Dual OS generation themes: **Orion OS 4.8** (Win95/98 aesthetic) and **Orion OS 6.x** (XP/Aqua-style warmer aesthetic).
   - Window manager (z-indexing, drag, resize, minimize, maximize, taskbar, dock/start menu, system tray, notifications, CRT scanlines/glow shader overlay).
   - 12+ period-authentic desktop applications and 18 local fake internet websites (`.local` routing, no external network requests).
4. **Narrative & Ink Engine (`src/narrative/`)**:
   - Authored deterministic branching dialogue using `inkjs`.
   - Ink scripts receive read-only snapshot context from `SimulationEngine` and emit validated semantic tags (`# beat:`, `# effect:`, `# social:`).
   - 14-day story arc across 4 characters: Ryan (`ryan_foodcart`), Maya (`starlight_maya`), Nora (`NightOwl87`), Mr. Henderson (`motel_office`).
5. **2D Atmospheric Environment (`src/world/`)**:
   - Layered 2D Canvas/Phaser scene (Motel room, PC desk, window overlooking street, bed, kettle, door).
   - 5 time-of-day variants (`morning`, `day`, `evening`, `night`, `late_night`) + weather overlays.
   - Interactables trigger deterministic time jumps (tea: 6 min, shower: 12 min, errand: 30 min, café: 75 min, sleep: jump to morning).
6. **Web Audio Pipeline (`src/audio/`)**:
   - Web Audio API synthesizer + synthesized sound effects (dial-up modem handshake, click, minimize/maximize, error beep, IM receive/send chimes, door open/shut, ambient room tone, rain, MP3 music playback).

---

## 2. Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Simulation Clock & Time Loop | Single authoritative clock (`1s = 1 min`), discrete time jump processing | M1 | docs/01, 05 |
| 2 | Pure TS Event Bus & Subscriptions | Decoupled reactive pub/sub event system | M1 | docs/05 |
| 3 | Economy & Energy System | Player cash, food cart wages, motel rent checks ($140/wk), energy/fatigue | M1 | docs/01 |
| 4 | PC Hardware & OS Spec Gating | CPU tiers, RAM (512MB $\to$ 1GB), HDD capacity, DSL speed (256k $\to$ 1M), OS version check | M1 | docs/03, 05 |
| 5 | Download Manager Engine | Background downloads, bandwidth allocation, server caps, pause/resume, cancel | M1 | docs/03, 05 |
| 6 | Virtual File System Engine | Directory tree (`Desktop`, `Downloads`, `Documents`, `Music`, `Program Files`, `Trash`), file metadata, deletion, execution | M1 | docs/03, 05 |
| 7 | Software Registry Engine | Installation state machine, requirement validation, bundled components, uninstaller | M1 | docs/03, 05 |
| 8 | Character Schedule & Social Engine | 14-day schedule matrices for 4 buddies, 5 hidden relationship dimensions (`familiarity`, `trust`, `comfort`, `respect`, `annoyance`) | M1 | docs/01, 04, 05 |
| 9 | Dexie Persistence & Migration | IndexedDB schema, lossless reload, auto-save on time jumps, state export/import | M1 | docs/05 |
| 10 | Evaluation Telemetry Engine | Local JSON telemetry recorder (play duration, money earned, software installed, endings reached) | M1 | docs/05, 07 |
| 11 | Web Audio Retro Synthesizer | Dial-up handshake audio, UI clicks, chimes, ambient noise, RetroAmp playback | M1 | docs/02, 07 |
| 12 | Window Manager Core | Z-index management, dragging, resizing, minimize, maximize, restore, close | M2 | docs/02, 03, 05 |
| 13 | Orion OS 4.8 Theme & Controls | 90s beveled gray UI, classic icons, compact taskbar, start menu, system tray | M2 | docs/02, 03 |
| 14 | Orion OS 6.x Theme & Controls | 2000s XP-style visual theme, richer icons, dock/taskbar styling, memory overhead | M2 | docs/02, 03 |
| 15 | Desktop Shell & System Tray | Clock, volume slider, dial-up status, desktop icons, wallpaper picker, notifications | M2 | docs/02, 03 |
| 16 | CRT Shader & Visual Effects | Scanlines, CRT curved glass distortion, phosphor glow toggles | M2 | docs/02 |
| 17 | Dial-up / DSL Connection Sim | Handshake state machine, disconnect simulation, connection speed toggling | M2 | docs/03 |
| 18 | Add/Remove Programs Utility | Program uninstall wizard, adware toolbar removal, disk space reclamation | M2 | docs/03 |
| 19 | Terminal / CLI Utility | Commands: `help`, `dir`, `cd`, `type`, `cls`, `ping`, `tracert`, `ipconfig`, `unzip` | M2 | docs/03 |
| 20 | File Explorer & My Computer | Directory browsing, file details, run executable, move to trash, empty trash | M2 | docs/03 |
| 21 | Control Panel Utility | Display settings (theme, wallpaper, CRT effects), Sound settings, System info | M2 | docs/03 |
| 22 | Voyager Web Browser | Address bar, back/forward/refresh, bookmarks, history, 404 handler, progress bar | M3 | docs/03, 04 |
| 23 | 18 Fake Internet Websites | `findit.local`, `pulsechat.local`, `downloadhub.local`, `techmart.local`, `bidbay.local`, `myplace.local`, `mailbox.local`, `nightboard.local`, `citywire.local`, `jobs.local`, `goldnet.local`, `weatherbuddy.local`, `retroamp.local`, `orionsoft.local`, `zipmate.local`, `safesweep.local`, `peerbox.local`, `motellink.local` | M3 | docs/04 |
| 24 | Search Index & Rabbit Holes | Local search engine queries, Rabbit Hole A (forum $\to$ utility unlock), Rabbit Hole B (username $\to$ identity lore) | M3 | docs/04 |
| 25 | Pulse Messenger (AIM Clone) | Buddy list, status icons (online/away/offline), custom away messages, chat tabs, chat log formatting | M3 | docs/03, 04 |
| 26 | Pulse Chat UX & Typing Sim | Simulated typing rhythm, typing indicators, sound effects (`door_open`, `door_slam`, `im_recv`, `im_send`) | M3 | docs/03, 04 |
| 27 | RetroAmp MP3 Player | Playlist manager, playback controls, track metadata, vintage equalizer visualization | M3 | docs/03 |
| 28 | FlashFetch Download Accelerator | Multi-segmented download UI, thread visualization, speed graph | M3 | docs/03 |
| 29 | ZipMate Archive Tool | ZIP file inspection, decompression wizard, extraction to VFS | M3 | docs/03 |
| 30 | PhotoBox 3.0 & Requirement Gating | Photo viewer requiring OS 6.x + 768MB RAM; error dialog on OS 4.8 | M3 | docs/03 |
| 31 | WeatherBuddy & SearchMate Adware | Unsolicited desktop widget, bundled SearchMate browser toolbar injection, popup ads | M3 | docs/03 |
| 32 | SafeSweep Anti-Adware Utility | Adware scanner, quarantine list, toolbar removal engine | M3 | docs/03 |
| 33 | Mail Client & Notepad Editor | Email inbox/reader with attachments, text file editing and saving | M3 | docs/03 |
| 34 | Inkjs Narrative Engine Integration | Compiled Ink JSON runner, state synchronization, semantic tag parser (`# beat:`, `# effect:`, `# social:`) | M4 | docs/04, 06 |
| 35 | 14-Day Authored Story Script | Complete Day 1-14 branching dialogue for Ryan, Maya, Nora, Mr. Henderson across 3 narrative arcs | M4 | docs/00, 04, 06 |
| 36 | 2D Layered Room & Desk Environment | Phaser/Canvas 2D room (8 layers, 5 time-of-day phases, weather overlays, persistent street entities) | M4 | docs/02 |
| 37 | Physical Room Interactables | PC Desk (14-day progressive clutter), Bed (sleep/rest), Kettle (tea/coffee), Window (observation), Door (errands/work) | M4 | docs/01, 02 |
| 38 | In-Person Café Meeting Scene | Day 11-12 Maya meeting minigame/dialogue with physical atmosphere and post-meeting shift | M4 | docs/00, 04 |
| 39 | Evaluation Endings & Free Play | Day 14 completion modal, telemetry summary, post-game continuous free play mode | M4 | docs/00, 07 |
| 40 | E2E Playwright Suite (Tiers 1-4) | 4-tier automated test suite covering all features, boundaries, combinations, and full 14-day playthroughs | E2E Track | docs/06, 07 |
| 41 | Vitest Domain Unit/Integration Suites | 100% pure TS unit test coverage across clock, downloads, VFS, economy, schedules, persistence | E2E Track | docs/06, 07 |
| 42 | Tier 5 Adversarial Coverage Hardening | White-box stress tests, chaos injection, memory leak checks, security audit | M5 | docs/07 |

---

## 3. Milestones Decomposition

| # | Milestone Name | Scope & Key Deliverables | Dependencies | Status |
|---|----------------|--------------------------|--------------|--------|
| **M1** | Core Architecture & Simulation Engine | Package/build setup, pure TS `SimulationEngine`, GameClock, EventBus, VFS, Downloads, Software Registry, Economy, Schedules, Dexie persistence, Web Audio synth | None | DONE |
| **M2** | Desktop Environment & OS Systems | Window Manager, Orion OS 4.8 / 6.x themes, Desktop Shell, Taskbar, Start Menu, CRT shader, Dial-up sim, Add/Remove Programs, Terminal, File Explorer, Control Panel | M1 | DONE |
| **M3** | Fake Internet, Browser & Desktop Apps | Voyager Browser, 18 Fake Internet sites, search index, Pulse Messenger (AIM), RetroAmp, FlashFetch, ZipMate, PhotoBox 3.0, WeatherBuddy/SearchMate adware, SafeSweep, Notepad | M1, M2 | DONE |
| **M4** | Narrative Engine, 14-Day Story & 2D World | Ink narrative runner, 14-day dialogue trees for 4 buddies, 2D Phaser/Canvas room (8 layers, 5 lighting phases), room interactables, café meeting, Day 14 resolution modal | M1, M2, M3 | IN_PROGRESS |
| **M5** | Final Integration & 100% E2E Pass + Adversarial Hardening | Full game loop integration, passing 100% E2E tests (Tiers 1-4), Tier 5 Adversarial testing & chaos verification, telemetry export, evaluation build ready | M1, M2, M3, M4, E2E | PLANNED |
| **E2E** | E2E Testing Track (Requirement-Driven) | Comprehensive Vitest suites + Playwright 4-tier test suite (Tiers 1-4: Feature coverage, boundaries, pairwise combinations, 14-day playthroughs), publish `TEST_READY.md` | M1 (for test infra) | IN_PROGRESS |

---

## 4. Code Layout
```
away-message/
├── src/
│   ├── engine/              # Pure TypeScript Simulation Engine (zero UI dependencies)
│   │   ├── GameClock.ts
│   │   ├── EventBus.ts
│   │   ├── EconomyEngine.ts
│   │   ├── HardwareEngine.ts
│   │   ├── DownloadManager.ts
│   │   ├── FileSystemEngine.ts
│   │   ├── SoftwareRegistry.ts
│   │   ├── SocialEngine.ts
│   │   ├── TelemetryEngine.ts
│   │   ├── SimulationEngine.ts
│   │   └── types/
│   ├── persistence/         # Dexie / IndexedDB Database and Schema Migrations
│   │   ├── db.ts
│   │   ├── schema.ts
│   │   └── SaveManager.ts
│   ├── audio/               # Web Audio API Synthesizer & Sound Manager
│   │   ├── SoundManager.ts
│   │   ├── SynthAudio.ts
│   │   └── soundEffects.ts
│   ├── desktop/             # Desktop OS, Window Manager, and Shell UI
│   │   ├── WindowManager.tsx
│   │   ├── WindowFrame.tsx
│   │   ├── DesktopShell.tsx
│   │   ├── Taskbar.tsx
│   │   ├── StartMenu.tsx
│   │   ├── SystemTray.tsx
│   │   ├── CRTOverlay.tsx
│   │   └── themes/          # Orion OS 4.8 (Win95) vs Orion OS 6.x (XP)
│   ├── apps/                # Desktop Applications
│   │   ├── pulse/           # Pulse Messenger (AIM clone)
│   │   ├── browser/         # Voyager Web Browser
│   │   ├── retroamp/        # RetroAmp MP3 Player
│   │   ├── flashfetch/      # FlashFetch Download Accelerator
│   │   ├── zipmate/         # ZipMate Archive Utility
│   │   ├── photobox/        # PhotoBox 3.0 (OS 6.0 Gated)
│   │   ├── weatherbuddy/    # WeatherBuddy Adware & Widget
│   │   ├── safesweep/       # SafeSweep Anti-Adware Utility
│   │   ├── terminal/        # Terminal CLI
│   │   ├── fileexplorer/    # File Explorer & My Computer
│   │   ├── controlpanel/    # Control Panel
│   │   ├── notepad/         # Notepad Text Editor
│   │   └── addremove/       # Add/Remove Programs
│   ├── internet/            # Fake Internet System & 18 Websites
│   │   ├── InternetRouter.ts
│   │   ├── searchIndex.ts
│   │   └── sites/           # 18 .local websites
│   ├── narrative/           # Ink Narrative Engine & Story Scripts
│   │   ├── NarrativeEngine.ts
│   │   ├── inkCompiler.ts
│   │   └── scripts/         # Compiled Ink JSON & Ink sources
│   ├── world/               # 2D Physical Environment (Phaser/Canvas)
│   │   ├── RoomScene.tsx
│   │   ├── RoomCanvas.ts
│   │   ├── CafeScene.tsx
│   │   └── layers/
│   ├── store/               # Zustand Stores (UI reactive binding to Simulation)
│   │   ├── useSimulationStore.ts
│   │   ├── useWindowStore.ts
│   │   └── useAudioStore.ts
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/                # Pure Vitest Domain Engine Tests
│   ├── integration/         # Dexie Persistence & Subsystem Integration Tests
│   └── e2e/                 # Playwright 4-Tier Opaque-Box E2E Tests
│       ├── tier1_features/
│       ├── tier2_boundaries/
│       ├── tier3_combinations/
│       └── tier4_scenarios/
├── docs/                    # Authoritative specifications
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

---

## 5. Interface Contracts

### 5.1 SimulationEngine ↔ React View Model (Zustand)
```typescript
export interface GameTime {
  day: number;           // 1..14
  hour: number;          // 0..23
  minute: number;        // 0..59
  totalMinutes: number;  // monotonic elapsed minutes
}

export interface SimulationState {
  time: GameTime;
  player: {
    cash: number;
    energy: number;      // 0..100
    fatigue: number;     // 0..100
    rentDueDay: number;
    rentAmount: number;
  };
  hardware: {
    cpuTier: number;
    ramMB: number;       // 512, 1024
    hddTotalGB: number;
    hddFreeGB: number;
    connectionType: 'dialup_56k' | 'dsl_256k' | 'dsl_512k' | 'dsl_1m';
    connectionSpeedKbps: number;
    osVersion: 'Orion_4.8' | 'Orion_6.0';
  };
  vfs: VirtualFileSystemState;
  downloads: DownloadTask[];
  installedSoftware: InstalledSoftwareRecord[];
  social: {
    buddies: Record<string, BuddyState>;
    conversations: Record<string, MessageRecord[]>;
  };
  narrativeFlags: Record<string, boolean | number | string>;
  telemetry: TelemetryRecord[];
}

export interface ISimulationEngine {
  getState(): Readonly<SimulationState>;
  advanceGameMinutes(minutes: number): void;
  startRealtimeClock(): void;
  stopRealtimeClock(): void;
  subscribe(listener: (state: Readonly<SimulationState>) => void): () => void;
  dispatchAction(action: SimulationAction): ActionResult;
}
```

### 5.2 SimulationEngine ↔ Ink Narrative Engine
```typescript
export interface InkNarrativeContext {
  sim_current_day: number;
  sim_player_cash: number;
  sim_os_version: string;
  sim_ram_mb: number;
  sim_photobox_installed: boolean;
  sim_weatherbuddy_installed: boolean;
  sim_safesweep_installed: boolean;
  sim_rent_paid: boolean;
  sim_buddies_familiarity: Record<string, number>;
  sim_buddies_trust: Record<string, number>;
}

export interface InkSemanticTag {
  type: 'beat' | 'effect' | 'social';
  payload: Record<string, any>;
}
```

### 5.3 Window Manager Contract
```typescript
export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minSize: { width: number; height: number };
  customState?: Record<string, any>;
}
```
