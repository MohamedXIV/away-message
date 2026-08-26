# Specification Mining Analysis — Away Message (Evaluation Build)

**Agent**: `spec_miner_1`  
**Role**: Teamwork Specification Miner  
**Target Project**: Away Message (Mid-2000s Internet Life Sim)  
**Date**: 2026-08-22  
**Specification Sources Probed**:
- `docs/00-VISION-AND-EVALUATION.md`
- `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md`
- `docs/02-WORLD-ART-AND-PRESENTATION.md`
- `docs/03-COMPUTER-OS-AND-SOFTWARE.md`
- `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md`
- `docs/05-TECHNICAL-ARCHITECTURE.md`
- `docs/06-CONTENT-DATA-AND-INK.md`
- `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md`
- `docs/09-MANUS-RUN-CONSTRAINTS.md`
- `docs/README.md`
- `ORIGINAL_REQUEST.md`

---

## 1. Executive Summary & Core Architecture

Away Message is a narrative life simulation, room simulation, and diegetic computer game set in a fictionalized 2006. The game models the interplay between an authoritative pure TypeScript simulation of time, money, and computing, a React/DOM retro desktop OS and fake internet browser, a Phaser 2D layered physical world, and an Ink-compiled narrative social progression engine.

### Highest-Priority Architecture Rule
> **"Rendering observes simulation; rendering does not create reality."**

The pure TypeScript simulation engine owns:
- Authoritative Time & Master Clock
- Player Finances & Economy
- Energy & Daily Life
- PC Hardware Specifications & Performance Models
- Simulated Filesystem Records
- Background Download Tasks
- Software State & Registry
- Character Schedules & Presence
- Hidden Multi-dimensional Relationships
- Scheduled Appointments & World Events
- Motel Rent, Internet Bills, and Obligations

React, Phaser, and Ink observe and interact with this truth. Zero simulation state is owned by React components, Phaser scenes, or Ink narrative scripts.

```
+-----------------------------------------------------------------------------------+
|                              PRESENTATION LAYER                                    |
|                                                                                   |
|  +------------------------------+  +-------------------------+  +--------------+  |
|  |     React / DOM Subsystem    |  |  Phaser 4.x 2D Engine   |  |  Web Audio   |  |
|  | - Orion OS 4.8 / OS 6 Shells |  | - Motel Room Layered    |  | - UI Sfx     |  |
|  | - Window Manager & Apps      |  | - Window / Street View  |  | - Ambience   |  |
|  | - Voyager Browser / Websites |  | - Cafe / Physical Meet  |  | - Modem FX   |  |
|  | - Pulse Messenger & Terminal |  | - Time-of-day Overlays  |  | - RetroAmp   |  |
|  +------------------------------+  +-------------------------+  +--------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                         State Subscriptions & UI Intents
                                         ▼
+-----------------------------------------------------------------------------------+
|                        ZUSTAND / UI COORDINATION STORES                           |
|       (Window Z-Index, Layout, Drag State, Active View, HUD, Notifications)       |
+-----------------------------------------------------------------------------------+
                                         │
                               Dispatched Actions
                                         ▼
+-----------------------------------------------------------------------------------+
|                     AUTHORITATIVE SIMULATION ENGINE (Pure TS)                     |
|                                                                                   |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  |    GameClock     |  |   EconomyEngine   |  |      DownloadManager           |  |
|  | - Real/Game Time |  | - Cash, Wages     |  | - Multi-task queue             |  |
|  | - Time Jumps     |  | - Rent, Bills     |  | - Speed caps, Resuming         |  |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  | Simulated PC     |  | SocialEngine      |  |      NarrativeBridge           |  |
|  | - RAM, CPU, OS   |  | - Schedules (NPC) |  | - inkjs Runtime Integration    |  |
|  | - File System    |  | - Presence State  |  | - Tag Parser (Social/Effects)  |  |
|  | - Software Reg   |  | - Hidden Rel Dim  |  | - Appointment Scheduler        |  |
|  +------------------+  +-------------------+  +--------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                         IndexedDB / Dexie Data Pipeline
                                         ▼
+-----------------------------------------------------------------------------------+
|                        PERSISTENCE & SCHEMAS (Dexie.js)                           |
|  Saves | Files | Downloads | Software | Contacts | Messages | Narrative | Telemetry |
+-----------------------------------------------------------------------------------+
```

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Core Sim | Authoritative Game Clock | Central simulation clock driving all subsystems across PC and physical views; converts real seconds to game minutes (default: 1s = 1min). | `deltaSeconds: number` or `advanceGameMinutes(mins: number)` | Updated `GameClockState` (`totalMinutes`, `day`, `hour`, `minute`, `timeBand`) | Clamps negative steps; survives view switches | `docs/05-TECHNICAL-ARCHITECTURE.md:187-208` |
| 2 | Core Sim | Discrete In-Game Time Jumps | Specific physical/room actions advance time in discrete chunks through the unified simulation pipeline. | Action type (`makeTea: 6m`, `shower: 12m`, `window: 4m`, `sleep: to wake hour`, `workShift: 4-6h`, `cafeMeeting: 45-90m`) | All systems (downloads, schedules, bills) tick forward by specified duration | Invalid action rejected; energy bounds enforced | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md:131-147` |
| 3 | Core Sim | Background Simulation Continuity | Downloads, contact schedules, incoming messages, and street life advance without pausing when windows/views are closed. | Time tick execution | Consistent world state regardless of UI visibility | UI unmounting does not dispose simulation state | `docs/README.md:93-103`, `docs/00-VISION-AND-EVALUATION.md:164-188` |
| 4 | Core Sim | Explicit Game Pause | Pauses the authoritative simulation loop only when navigating explicit system settings/pause menus. | `pause()` / `resume()` | Simulation loop frozen / unfrozen | Normal gameplay windows (browser, chat, terminal) DO NOT pause time | `docs/05-TECHNICAL-ARCHITECTURE.md:402-412` |
| 5 | OS & Desktop | Dual OS Generations (Orion 4.8 & Orion 6.x) | Simulated desktop OS with distinct visual generational shells (beveled 98/2000 vs warm rounded XP) and functional capabilities. | `osVersion: string` | Active desktop styling, taskbar, start menu, system capabilities | Starting PC locks modern apps until upgraded | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:23-65` |
| 6 | OS & Desktop | Desktop Window Management | Reusable retro window frame supporting open, close, minimize, focus (z-index layering), and titlebar dragging. | Window ID, action (`open`, `close`, `minimize`, `focus`, `drag`) | Window geometry, z-stack, active focus state | Window position clamped within desktop bounds | `docs/05-TECHNICAL-ARCHITECTURE.md:348-360` |
| 7 | Hardware | Hardware Specifications & Tiering | Models CPU Tier (1-2), RAM (512MB - 1GB), Storage (40GB HDD, ~7GB free), and Internet Speed (256kbps - 1Mbps DSL). | Hardware configuration record | System capability limits, download bandwidth caps, RAM pressure | Launching apps exceeding specs triggers clean compatibility error | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:67-109` |
| 8 | Hardware | RAM Pressure & Performance Model | Computes RAM load based on running application memory footprints; introduces launch delays or warnings under heavy pressure. | `runningApps: App[]`, `installedRamMb: number` | `ramPressure: number` (0.0 - 1.0+), UI responsiveness factor | Extreme pressure blocks new app launches with "Out of Memory" alert | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:110-134` |
| 9 | Filesystem | Simulated Virtual Filesystem | Hierarchical virtual filesystem with required directories (`Desktop`, `Downloads`, `Program Files`, `Documents`, `Music`, `Pictures`). | Path, `FileRecord` CRUD operations | File metadata, directory listings, occupied disk space | Unauthorized system path deletion blocked; prevents real host disk access | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:135-172` |
| 10 | Filesystem | Disk Space Pressure & Deletion | Files and installed software occupy persistent disk space; deleting files (installers, media) frees storage. | File deletion request, installer footprint | Available disk bytes updated | Full disk prevents new downloads and software installation | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:161-168` |
| 11 | Downloads | Multi-Task Background Download Manager | Authoritative download queue calculating byte transfers based on connection tier and remote server caps. | `fileId`, `sourceId`, `totalBytes`, `sourceMaxKbps` | Active `DownloadTask` record, progress events, file creation upon 100% | Network disconnection or server stall halts task; bad downloads handled | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:174-208` |
| 12 | Downloads | Browser Downloads vs FlashFetch 3.1 | Standard browser single download vs FlashFetch advanced manager supporting queueing, resuming interrupted tasks, and scheduled downloads. | Download request, active client | Transfer rate, resumability flag, multi-file queue | Browser downloads fail permanently on interruption unless FlashFetch is used | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:210-228` |
| 13 | Software | Data-Driven Software Installer Wizard | Multi-step setup wizard: Welcome -> Compatibility Check -> Destination -> Optional Components / Bundled Offers -> Progress -> Launch. | `InstallerDefinition`, user checkbox choices | Installed app registration, shortcut creation, filesystem records | Missing OS/RAM requirements halts wizard with explanation | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:229-252` |
| 14 | Software | Bundled Software & Toolbar Hijacking | Installers (e.g. WeatherBuddy 1.4) can bundle SearchMate Toolbar, startup items, and browser homepage modifications if unchecked. | User wizard checkbox state | Browser homepage mutation, desktop startup items, search toolbar UI | SafeSweep utility or custom install cleanly prevents/removes extras | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:308-323` |
| 15 | Software | Portable Software vs Installed Applications | ZipMate 4.0 provides both standard installer and portable ZIP extract path; portable apps run without Add/Remove registry entries. | Archive extraction / Installer execution | File extraction, executable launch | Portable apps do not register in Add/Remove Programs | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:294-300` |
| 16 | Software | Add/Remove Programs Control Panel | Displays all registered non-portable software, installed disk footprint, and executes clean uninstallation. | Uninstall trigger | Reclaims disk space, removes shortcuts, reverts browser modifications | Does not delete unrelated user files in Documents/Downloads | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:341-354` |
| 17 | Software | Software Catalog (10+ Applications) | Complete suite: Voyager Browser, Pulse Messenger 5.2/6.x, FlashFetch, RetroAmp, ZipMate, PhotoBox, WeatherBuddy, SafeSweep, PeerBox, CamLink. | Software definitions | Application instances, capabilities, system requirements | Version gating (Pulse 6 / PhotoBox require Orion 6 and 768MB+ RAM) | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:253-339` |
| 18 | Terminal | Diegetic CLI Terminal Utility | Working command prompt supporting `help`, `dir`, `cd`, `type`, `cls`, `ping`, `tracert`, `ipconfig`, `ftp`, `unzip`, `netstat`. | Command string, arguments | Terminal stdout scrollback, simulated ping latency, file inspection | Unrecognized command outputs standard syntax error | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:355-390` |
| 19 | Fake Internet | Internal URL Routing & Browser Chrome | Local URL resolver (e.g. `findit.local`, `pulsechat.local`, `techmart.local`, `bidbay.local`) with address bar, back, forward, bookmarks, history. | Fictional URL string | Rendered internal website component/data | 404 Not Found for unregistered routes; zero public internet requests | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:43-73` |
| 20 | Fake Internet | Free-Text Search Engine (FindIt) | Curated index matching free-text search queries (software names, usernames, locations, news) with dynamic day-based results. | Search query string | Ranked list of search result items with snippets and links | Empty results screen for unmatched terms | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:75-102` |
| 21 | Fake Internet | 15+ Distinct Fictional Websites | FindIt, Pulse, DownloadHub, TechMart, BidBay, MyPlace, Mailbox, NightBoard, CityWire, Jobs, GoldNet, personal homepages, forum threads. | Route navigation | Styled retro web pages (unstandardized, period-authentic design) | Defunct/disappeared pages return realistic errors across 14 days | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:103-186` |
| 22 | Fake Internet | Multi-step Internet Rabbit Holes | Cross-site narrative discovery chains (e.g. forum complaints -> software links; username search -> old forum posts -> personal page -> real identity). | Player browsing actions | Discovered clues, contact handles, unlocked software links | Skipping steps preserves mystery without breaking story gating | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:187-208` |
| 23 | Narrative | Ink Narrative Runtime & Bridge | Compiled Ink JSON execution via `inkjs`; narrative adapter passes validated context and parses semantic effect/social tags. | Ink choice selection, simulation context | Story lines, choices, `#beat:`, `#effect:`, `#social:` tags | Ink never writes directly to simulation variables; adapter validates | `docs/06-CONTENT-DATA-AND-INK.md:163-246` |
| 24 | Narrative | Hidden Multi-Dimensional Relationships | Tracks 5 core hidden dimensions per character: `familiarity`, `trust`, `comfort`, `respect`, `annoyance` (and optional `attraction`). | Semantic social action tags | Updated relationship dimensions, altered NPC conversation tone | No visible numeric bars; bounds clamped (0-100) | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:390-420` |
| 25 | Social Sim | Schedule-Driven Contact Presence | Contacts (Ryan, Maya, Nora, ambient users) follow deterministic weekly schedule blocks (`online`, `offline`, `away`, `busy`). | GameClock time | Contact list status updates, typing indicators, away messages | Contacts go offline mid-conversation if scheduled shift arrives | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:487-505` |
| 26 | Social Sim | Offline Messages & Asynchronous Chat | Contacts initiate conversations independently or send messages while the player is away from the PC. | Time tick, schedule triggers, narrative beats | Unread message badges, system tray notifications | Unread status persists across save/load | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:507-520` |
| 27 | Social Sim | Period Messenger Interface & Typing UX | Authentic IM client: buddy list, status lines, typing indicator delays, authored dialogue choices, simulated player typing animation. | Dialogue choice click | Sent chat bubbles, simulated response delay, NPC replies | Mismatched timing avoided via async queue | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:440-486` |
| 28 | World Sim | Layered 2D Physical Locations (Phaser) | Layered scenes (Background, Midground, Foreground, Props, Characters, Ambient FX, Overlays) for Motel Room, Window, Café, Work, Street. | Location definition, TimeBand, Weather | Rendered Phaser canvas with parallax and ambient loops | Asset loading failures fallback to solid color layers | `docs/02-WORLD-ART-AND-PRESENTATION.md:279-322` |
| 29 | World Sim | Contextual Window Observation System | Looking out the motel window opens a wide view, advances 4 minutes, and triggers contextual thoughts based on history, day, and weather. | Window interact intent | Narrative thought text, updated observation count, street view | Repeat observations return subtle mundane variations | `docs/02-WORLD-ART-AND-PRESENTATION.md:71-102` |
| 30 | World Sim | Two-Tier Street Simulation | Spawns procedural ambient entities (cars, pedestrians) alongside persistent recurring entities with schedules (man outside, motel clerk, dog walker). | TimeBand, Weather, Seed | Animated street sprite instances | Ambient entities are ephemeral; persistent entities save history | `docs/02-WORLD-ART-AND-PRESENTATION.md:103-131` |
| 31 | World Sim | Physical Social Appointments & Meetings | Translates online dialogue agreements into deterministic physical appointments (e.g. Day 11 Café meeting with Maya) advancing time & dialogue. | Appointment record, player attendance | Location transition, physical scene Ink dialogue, online tone shift | Missed appointments trigger realistic NPC disappointment messages | `docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md:582-595` |
| 32 | Economy | Authoritative Economy & Cash Balance | Tracks cash (starts at `$38`), work wages (`+$62`/shift), food expenses, hardware purchases, and late fees. | Earning/spending actions | Updated cash balance, transaction history | Negative cash triggers late fees and warning notices (no instant hard fail) | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md:278-330` |
| 33 | Economy | Recurring Motel Rent & Internet Bills | Weekly motel payment (`$140-$160` on Day 7 and Day 14) and internet bill (`$20-$30`) create trade-offs against hardware upgrades. | GameClock day arrival, payment trigger | Deducted balance, updated bill due dates | Unpaid rent incurs late fee and awkward motel clerk dialogue | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md:331-359` |
| 34 | Economy | Classifieds Hardware Marketplace (BidBay) | Marketplace offering cheaper used hardware (RAM, HDDs) with risk of listings expiring or being sold. | Buy action, listing availability | Hardware acquired, cash deducted, listing marked sold | Expired listings disappear if player delays too long | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md:395-408` |
| 35 | Economy | Digital-Gold Speculation (GoldNet) | Optional risky financial service to deposit cash into digital gold; exchange rate fluctuates via seeded/authored schedule. | Deposit / withdraw amounts | Converted gold/cash balances | Sharp rate drops can cause financial loss if timed poorly | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md:409-433` |
| 36 | Daily Life | Energy Model & Sleep Cycle | Light energy system (0-100, Rested/Fine/Tired/Exhausted); depleted by work and late nights, restored by sleeping. | Awake minutes, work shift action, sleep action | Energy level, action duration modifiers, wake time advancement | Low energy prevents taking optional overtime shifts | `docs/01-GAMEPLAY-PROGRESSION-AND-ECONOMY.md:149-176` |
| 37 | Audio | Web Audio API Retro Soundscape | Procedural and sample-based audio engine handling UI beeps, dial-up modem handshakes, hard drive seek clicks, CRT hum, and room ambience. | Audio events, active view | Mixed audio output via master/bus gain nodes | AudioContext autoplay policy handled via initial user gesture | `docs/07-PERFORMANCE-AND-TELEMETRY (Inferred)`, `docs/00-07` |
| 38 | Audio | RetroAmp Media Player System | Virtual MP3/audio player supporting playlist navigation, play/pause/seek, track info display, and local fictional audio playback. | Playback controls, playlist selection | Decoded audio stream routed through Web Audio Music Bus | Missing audio files display codec error without crashing | `docs/03-COMPUTER-OS-AND-SOFTWARE.md:287-293` |
| 39 | Persistence | Dexie / IndexedDB Versioned Persistence | Full serialization and lossless restoration of saves, files, downloads, software, messages, relationships, and narrative flags. | Save/Load triggers (sleep, work, autosave) | Stored IndexedDB records, restored game state | Version mismatch executes migration pipeline; fallback to canonical start | `docs/05-TECHNICAL-ARCHITECTURE.md:270-312` |
| 40 | Persistence | Save Migration Framework | Schema-versioned save files with declarative migration transforms for backward compatibility. | Save object, `schemaVersion` | Migrated `GameState` matching current schema | Corrupt saves isolated; allows clean reset to Day 1 starting state | `docs/05-TECHNICAL-ARCHITECTURE.md:299-312` |
| 41 | Telemetry | Local Evaluation Telemetry Exporter | Collects session metrics (playtime, days, upgrades, narrative milestones, download stats) and exports as downloadable JSON. | Telemetry event log | Downloadable evaluation telemetry JSON file | Local-only; no external tracking or network transmission | `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md:515-537` |
| 42 | Quality/Test | Automated Vitest & Playwright Suite | Comprehensive automated unit, integration, and E2E test harness covering Scenarios A-F across the 14-day loop. | Test runner commands | Test reports, assertion verification | Failures pinpoint clock desync, broken downloads, or invalid schemas | `docs/07-IMPLEMENTATION-AND-ACCEPTANCE.md:397-502` |

---

## 3. Edge Cases & Boundary Behaviors

| # | Feature | Input | Observed / Specified Behavior |
|---|---------|-------|-------------------------------|
| 1 | Download Manager | Player starts 15MB download, immediately closes browser, makes tea (6 min), looks out window (4 min). | Download calculates 10 minutes of elapsed bandwidth transfer based on 256kbps DSL (~19.2 MB capacity), completes task in background, creates file in `Downloads/`, and triggers completion chime. |
| 2 | Time Jumps & Sleep | Player sleeps at 02:30 AM with target wake time 08:00 AM while download is active and rent is due. | Simulation executes 330 minutes advance: download finishes at ~03:15 AM, rent deduction occurs at 00:00/06:00 milestone, energy resets to 100, and NPC schedules update to morning state. |
| 3 | Software Requirements | Player attempts to run `PhotoBox 3.0` installer on starting machine (Orion 4.8, 512MB RAM). | Installer checks requirements (`minOs: 6.0`, `minRamMb: 768`), halts immediately at step 2, and displays clean error dialog explaining OS and RAM insufficiency without crashing. |
| 4 | Bundled Software | Player installs `WeatherBuddy 1.4` and leaves "Express Install (Recommended)" checked. | Installer registers WeatherBuddy, installs `SearchMate Toolbar` in Voyager Browser, sets browser homepage to SearchMate, and adds startup task; unchecking custom options avoids all extras. |
| 5 | Software Cleanup | Player uses `SafeSweep` or Add/Remove Programs on WeatherBuddy after bundled installation. | SafeSweep detects unwanted components; uninstalling reverses browser homepage modifications, removes toolbar UI, and frees occupied disk space without deleting user documents. |
| 6 | Storage Exhaustion | Player fills 7GB free storage with large demo downloads until disk space < installer size. | Installer halts with "Insufficient Disk Space" warning; player must delete files in Downloads or My Computer to reclaim space before installation proceeds. |
| 7 | Portable App Registry | Player extracts `ZipMate 4.0` via portable ZIP package rather than running setup EXE. | Portable executable runs directly from extracted folder; application IS NOT registered in Add/Remove Programs control panel list. |
| 8 | NPC Schedules & Chat | Player chats with Ryan at 17:55; Ryan's work schedule ends and dinner begins at 18:00. | Ryan sends a realistic "brb gotta run / heading out" message, changes status from `online` to `away`/`offline`, and active dialogue knot safely pauses or concludes. |
| 9 | Missed Appointment | Player agrees to meet Maya at Café on Day 11 at 18:00, but chooses to work an overtime shift instead. | GameClock advances past 18:00; appointment status transitions to `missed`, Maya waits 45 min, goes offline, and sends a disappointed message later with an `annoyance` increase. |
| 10 | Economy & Rent Due | Player arrives at Day 7 rent payment ($150) with only $42 in cash balance. | Game deducts available cash to $0, flags rent as late, issues a late fee warning, and triggers an awkward motel manager encounter; DOES NOT trigger an instant game over. |
| 11 | Digital Gold Fluctuations | Player deposits $50 in GoldNet; Day 13 market event triggers a sudden 40% price drop. | Gold asset balance decreases in value to $30; withdrawing locks in loss, teaching pre-crypto financial volatility without breaking progression. |
| 12 | Terminal Execution | Player runs `type secret.txt` in terminal on an existing file, then tests `ping findit.local`. | Terminal parses command against virtual filesystem, outputs file text to scrollback; `ping` simulates 4 packet ICMP replies with 45ms simulated DSL latency. |
| 13 | Browser 404 & Missing Sites | Player types `nonexistent.local` into Voyager Browser address bar. | Voyager URL router catches unmatched route and displays an authentic 2006-style DNS error / Server Not Found page with FindIt search suggestions. |
| 14 | Save/Load Mid-Download | Player refreshes browser tab while a 50MB file is 42% downloaded with 2 unread messages. | Dexie loads saved state: download resumes from 42% (or pauses if non-resumable), unread badges restore, open window layout and taskbar clock match exact pre-reload state. |
| 15 | Corrupt Save Migration | Save file from older schema version missing `relationships.annoyance` field is loaded. | Migration transform injects default `annoyance: 0`, updates `schemaVersion` to current version, and successfully initializes simulation without throwing schema errors. |
| 16 | Day 14 Evaluation Conclusion | Player completes Day 14 evening sequence after experiencing physical meeting and PC upgrade. | Narrative displays "Evaluation Build Complete" screen summarizing milestones, enables telemetry JSON download, and unlocks uninterrupted free-play mode. |

---

## 4. Deep Architectural Specifications

### 4.1. Core Tech Stack & Tooling

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "phaser": "^3.80.1",
    "inkjs": "^2.2.3",
    "zustand": "^4.5.2",
    "zod": "^3.23.8",
    "dexie": "^4.0.7",
    "lucide-react": "^0.395.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "@vitejs/plugin-react": "^4.2.1",
    "vitest": "^1.6.0",
    "playwright": "^1.44.1",
    "tailwindcss": "^3.4.3",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.19"
  }
}
```

### 4.2. Data Structures & Simulation Interfaces

#### Simulation Engine Core Interface
```ts
export interface SimulationEngine {
  getState(): Readonly<GameState>;
  dispatch(action: GameAction): void;
  advanceRealTime(deltaSeconds: number): void;
  advanceGameMinutes(minutes: number): void;
  subscribe(listener: (state: GameState) => void): () => void;
}
```

#### Master Game State Schema
```ts
export interface GameState {
  meta: SaveMeta;
  clock: GameClockState;
  player: PlayerState;
  economy: EconomyState;
  pc: PcState;
  files: FileSystemState;
  software: SoftwareState;
  downloads: DownloadState;
  browser: BrowserState;
  contacts: ContactState;
  relationships: RelationshipState;
  world: WorldState;
  events: EventState;
  narrative: NarrativeState;
  telemetry: TelemetryState;
}

export interface GameClockState {
  totalMinutes: number;    // Cumulative game minutes from Day 1 07:00
  day: number;             // 1 to 14+
  hour: number;            // 0 to 23
  minute: number;          // 0 to 59
  timeBand: 'morning' | 'day' | 'evening' | 'night' | 'lateNight';
  isPaused: boolean;
  timeScaleRatio: number;  // 1 real sec = N game mins (default 1)
}

export interface PlayerState {
  name: string;
  energy: number;          // 0 to 100
  currentLocationId: string;
  roomUpgrades: string[];  // e.g. 'speakers', 'lamp', 'desk_organizer'
}

export interface EconomyState {
  cash: number;
  bankBalance: number;
  digitalGoldGrams: number;
  digitalGoldValuePerGram: number;
  rentDueDay: number;
  rentAmount: number;
  rentStatus: 'paid' | 'pending' | 'late';
  internetDueDay: number;
  internetBillAmount: number;
  internetPaid: boolean;
  transactions: TransactionRecord[];
}

export interface PcState {
  osGeneration: 'orion_4_8' | 'orion_6';
  cpuTier: number;         // 1 or 2
  ramMb: number;           // 512 or 1024
  hddTotalBytes: number;   // 40GB = 42,949,672,960
  internetSpeedKbps: number; // 256, 512, 1024
  isPoweredOn: boolean;
  runningApps: RunningAppRecord[];
  startupAppIds: string[];
  systemSettings: {
    resolution: string;
    volume: number;
    wallpaperId: string;
  };
}

export interface FileRecord {
  id: string;
  name: string;
  path: string;            // e.g. 'C:/Downloads/pulse_setup.exe'
  kind: 'file' | 'directory' | 'shortcut';
  sizeBytes: number;
  createdAt: number;
  appAssociation?: string;
  contentRef?: string;
  isExecutable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DownloadTask {
  id: string;
  sourceId: string;
  sourceUrl: string;
  fileName: string;
  destinationPath: string;
  totalBytes: number;
  downloadedBytes: number;
  sourceMaxKbps: number;
  status: 'queued' | 'downloading' | 'paused' | 'complete' | 'failed';
  resumable: boolean;
  startedAtMinute: number;
  completedAtMinute?: number;
}

export interface ContactRecord {
  id: string;              // 'ryan', 'maya', 'nora'
  displayName: string;
  handle: string;
  currentStatus: 'online' | 'offline' | 'away' | 'busy';
  statusMessage: string;
  avatarUrl: string;
  unreadCount: number;
  lastMessageTimestamp: number;
  activeConversationKnot?: string;
}

export interface RelationshipDimensions {
  familiarity: number;     // 0 to 100
  trust: number;           // 0 to 100
  comfort: number;         // 0 to 100
  respect: number;         // 0 to 100
  annoyance: number;       // 0 to 100
  attraction: number;      // 0 to 100
}

export interface AppointmentRecord {
  id: string;
  contactId: string;
  locationId: string;
  scheduledDay: number;
  scheduledMinute: number;
  durationMinutes: number;
  status: 'scheduled' | 'attended' | 'missed' | 'cancelled';
  dialogueKnot: string;
}
```

---

## 5. Dexie / IndexedDB Database Schema

```ts
import Dexie, { Table } from 'dexie';

export class AwayMessageDatabase extends Dexie {
  saves!: Table<GameState, string>;
  files!: Table<FileRecord, string>;
  downloads!: Table<DownloadTask, string>;
  messages!: Table<ChatMessageRecord, string>;
  telemetryLogs!: Table<TelemetryLogRecord, string>;

  constructor() {
    super('AwayMessageDB');

    this.version(1).stores({
      saves: 'meta.saveId, meta.createdAt, meta.updatedAt, clock.day',
      files: 'id, path, name, kind, appAssociation',
      downloads: 'id, status, fileName, startedAtMinute',
      messages: 'id, contactId, sender, timestamp, read',
      telemetryLogs: 'id, timestamp, eventType'
    });
  }
}
```

---

## 6. Web Audio API Pipeline Architecture

```
                                +---------------------------+
                                |      Web Audio Context    |
                                +---------------------------+
                                              │
                                              ▼
                                +---------------------------+
                                |      Master Gain Node     |
                                +---------------------------+
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
         ▼                                    ▼                                    ▼
+------------------+                 +------------------+                 +------------------+
|     SFX Bus      |                 |   Ambience Bus   |                 |    Music Bus     |
| (Gain + Filters) |                 | (Spatial Panner) |                 |   (Equalizer)    |
+------------------+                 +------------------+                 +------------------+
         │                                    │                                    │
  ┌──────┴──────┐                      ┌──────┴──────┐                      ┌──────┴──────┐
  ▼             ▼                      ▼             ▼                      ▼             ▼
UI Clicks    Dial-up Modem          Bedroom Tone   Street Traffic       RetroAmp Player Track
Key Clatter  CRT Degauss / Seek     Rain on Glass  Night Crickets       Stereo Balance / Treble
```

### Procedural Audio Synthesizers Required:
1. **Modem Handshake Generator**: Dual-tone frequencies (FSK modulation at 1200/2400Hz, V.90 negotiation tones, carrier noise).
2. **Hard Drive Actuator Seek Generator**: Bandpass-filtered pink noise bursts simulating 2000s 7200RPM HDD chatter.
3. **CRT Whine & Degauss**: 15.734 kHz sub-audible tone + decaying low-frequency resonant thud for degaussing.

---

## 7. Performance Budgets & Non-Functional Constraints

1. **Zero Public Network Calls**: All assets, scripts, fake websites, and audio samples run entirely from memory/local storage.
2. **Frame Rate**: Stable 60 FPS across both React desktop and Phaser layered views.
3. **Memory Ceiling**: JavaScript heap allocation < 150 MB.
4. **Storage Footprint**: Total IndexedDB storage consumption < 50 MB.
5. **Autosave Reliability**: Autosave checkpoints at:
   - Sleep cycle transition
   - Work shift completion
   - Software install/uninstall
   - Major narrative beat / appointment completion
   - Periodic 3-minute fallback timer

---

## 8. Verification & Test Plan

- **Vitest Unit & Integration Tests**:
  - `GameClock`: Real-time to game-time conversion, midnight crossing, time jumps.
  - `DownloadManager`: Multi-task bandwidth allocation, source caps, pause/resume, file creation.
  - `SoftwareRegistry`: System requirement validation, disk usage accounting, Add/Remove registry.
  - `SocialSchedule`: Time-based presence transitions, offline message delivery.
  - `Economy`: Wage credits, rent deductions, late payment calculations.
  - `Zod Schemas`: Validation of all content JSON files and save schemas.
- **Playwright End-to-End Scenarios**:
  - **Scenario A (Core Fantasy Loop)**: Start Day 1 -> Work -> Find Pulse on Voyager -> Start Download -> Make Tea / Window View -> Install Pulse -> First Ryan Chat.
  - **Scenario B (Software Literacy)**: Download WeatherBuddy -> Express Install -> Verify Toolbar/Homepage mutation -> Clean via SafeSweep / Add-Remove -> Verify reversal.
  - **Scenario C (Hardware Progression)**: Buy RAM on BidBay -> Install Orion OS 6 -> Reboot -> Run PhotoBox 3.0 successfully.
  - **Scenario D (Physical Social Meeting)**: Progress Maya dialogue -> Accept Café invitation -> Attend meeting on Day 11 -> Return to PC -> Verify changed online dialogue tone.
  - **Scenario E (Persistence Fidelity)**: Mid-download reload -> Verify download resumes at exact percentage, messages and window positions intact.
  - **Scenario F (Full 14-Day Loop)**: Play from Day 1 to Day 14 evaluation conclusion screen -> Export telemetry JSON -> Enter free-play mode.
