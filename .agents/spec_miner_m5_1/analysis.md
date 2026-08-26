# Milestone 5: E2E & Telemetry Specification Mining & Gap Analysis

**Author**: Spec Miner 1 (E2E & Telemetry Spec Miner)  
**Date**: 2026-08-25  
**Target Milestones**: Milestone 5.1 (Narrative & World Unit/Integration Suites) & Milestone 5.2 (Playwright 4-Tier E2E Suite & Local Telemetry Exporter)  
**Integrity Mode**: Development / Strict Verification  

---

## 1. Executive Summary & Existing Test Suite Audit

The current test infrastructure consists of **219 passing Vitest tests** across 25 test files (3 integration test files, 22 unit test files) validating Milestones 1 through 3 domain engines, apps, and persistence layers.

### Current Test Suite Inventory
- **Unit Suites (	ests/unit/)**:
  - GameClock.test.ts (6 tests): Tick conversion (1 real sec = 1 sim min), discrete jumps, midnight rollovers, weekend checks, time-of-day progression.
  - EventBus.test.ts & SimulationEngine.test.ts (6 tests): Decoupled reactive pub/sub, cross-system time jump propagation, view switching.
  - EconomyEngine.test.ts (7 tests): Work shift wage calculation, energy/fatigue depletion, rent deduction (/wk), internet bills (), bankruptcy limits.
  - HardwareEngine.test.ts (6 tests): Baseline specs (Orion 4.8, 512MB RAM, 40GB HDD, 256kbps DSL), RAM upgrades (1024MB), OS 6.0 migration, RAM pressure metrics.
  - DownloadManager.test.ts (4 tests): Background downloads, fair-share DSL allocation, server speed caps, pause/resume/cancel.
  - FileSystemEngine.test.ts (5 tests): Directory hierarchy, file creation/deletion, Recycle Bin move/restore, trash empty disk reclamation.
  - SoftwareRegistry.test.ts (5 tests): Requirement checks (OS/RAM/CPU/Disk), installation wizard, bundled adware options, uninstallation.
  - SocialEngine.test.ts (4 tests): 4 key buddies (Ryan, Maya, Nora, Henderson), schedule-driven presence by time of day, semantic social action clamping [0..100], message read status.
  - TelemetryEngine.test.ts (3 tests): Stats counters, event ring-buffer logging (capped at 1000), JSON export formatting.
  - InternetRouter.test.ts (6 tests): 18 .local domain routes, path resolution, 404 handler.
  - SearchIndex.test.ts (5 tests): Free-text tokenization, ranking, dynamic unlocking.
  - WindowManager.test.ts (11 tests): Window open/close, minimize/maximize, drag coordinates, z-index elevation.
  - SynthAudio.test.ts (4 tests): Synthesizer audio generation, dial-up modem handshake audio, UI chimes.
  - PulseMessenger.test.ts (5 tests): Buddy list, presence icons, chat tabs, typing indicators, simulated responses.
  - TerminalApp.test.ts (5 tests): CLI commands (help, dir, cd, 	ype, cls, ping, ipconfig).
  - FileExplorerApp.test.ts (4 tests): Directory tree, file listing, file properties, open associations.
  - ControlPanelApp.test.ts (4 tests): Display theme toggle, wallpaper change, sound effects, system info display.
  - EcosystemApps.test.ts (4 tests): FlashFetch, RetroAmp, ZipMate, Notepad, PhotoBox requirements check.
  - AdversarialM1Stress.test.ts (24 tests): High-frequency save/load cycles, clock warp, memory leak check, concurrency races.
  - AdversarialAppsStress.test.ts (27 tests): Window abuse, rapid drag, uninstallation cascades.
  - AdversarialInternetStress.test.ts (34 tests): 1000 fuzz queries, URL spoofing, rapid clicks.
  - AdversarialEcosystemM3Stress.test.ts (16 tests): Adware infection simulation, SafeSweep remediation, uninstaller edge cases.
- **Integration Suites (	ests/integration/)**:
  - Persistence.test.ts (4 tests): Dexie/IndexedDB round-trip across all 8 tables, debounced auto-save on time jumps, Zod schema validation on JSON export/import, corrupted JSON rejection.
  - VoyagerBrowser.test.ts (3 tests): Browser navigation history, downloads initiated from pages, fake URL resolution.
  - AdversarialM1Stress.test.ts (17 tests): 100 sequential save/load cycles, disk corruption recovery, interrupted downloads.

---

## 2. Features Discovered (Master Specification Matrix)

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | M5.1 Narrative | Ink Runtime Integration | Compiles & loads authored Ink scripts into inkjs runner with state synchronization | Compiled Ink JSON (story.json), snapshot context | Formatted dialogue lines, choice lists, semantic tags | Throws error on uncompiled/corrupted Ink JSON | docs/06-CONTENT-DATA-AND-INK.md |
| 2 | M5.1 Narrative | Read-Only Sim Context Sync | Passes read-only simulation values into Ink context variables | sim_current_day, sim_player_cash, sim_os_version, sim_ram_mb, sim_buddies_* | Updated Ink global variables | Ink cannot directly mutate simulation variables | PROJECT.md §5.2, docs/06 |
| 3 | M5.1 Narrative | Semantic Tag Dispatcher | Parses and routes # beat:, # effect:, # social: tags to simulation engine | Raw tag strings emitted from Ink story | Dispatched SimulationAction / SocialEngine updates | Ignores or logs invalid tag syntax | docs/06-CONTENT-DATA-AND-INK.md |
| 4 | M5.1 Narrative | 14-Day Authored Story Trees | Complete 14-day branching dialogue for Ryan, Maya, Nora, and Mr. Henderson | Player choice selection (choice index or ID) | Next dialogue line sequence, story knot progression | Dead-end knots fallback to idle/away | docs/00, docs/04, docs/06 |
| 5 | M5.1 Narrative | Secret & Gating Enforcement | Prevents early revelation of lore/secrets before allowed day or relationship threshold | Target day, familiarity threshold, narrative flags | Gated branch availability | Ungated branches hidden/unreachable | docs/06 §14 |
| 6 | M5.1 World | Layered 2D Room Presentation | 8-layer visual Canvas/Phaser scene representing motel room with 5 time-of-day lighting states | timeOfDay, weather overlay (clear, rain, overcast), room clutter | Rendered 2D room view | Fallback to default lighting if time invalid | docs/02, PROJECT.md |
| 7 | M5.1 World | Physical Room Interactables | Kettle, Bed, Shower, Window, Door hotspot interactions with deterministic time jumps | User click on hotspot | Dispatched TIME_ADVANCE_MINUTES & state mutations | Disabled if energy/time conditions not met | docs/01, docs/02 |
| 8 | M5.1 World | Contextual Window Thoughts | Window observation advances 4 min, selects thought text based on history and street state | Window click | Thought bubble/dialogue, incremented windowObservationsCount | Displays generic observation if no condition matches | docs/02 §4 |
| 9 | M5.1 World | In-Person Café Scene | Physical meeting scene on Day 11/12 with Maya, 45-75 min time jump | Scheduled appointment trigger, player arrival | Staged portrait dialogue, cafeMeetingAttended=true, post-meeting tone shift | Flagged as missed if player fails to attend | docs/00, docs/07 |
| 10 | M5.2 E2E Tier 1 | Core Feature Functionality | Opaque-box UI validation across all 10 feature domains (>= 50 test cases) | Mouse clicks, keyboard input, DOM navigation | Verified DOM state, window manager state, simulation updates | Assertions fail on UI/state mismatch | TEST_INFRA.md §2 |
| 11 | M5.2 E2E Tier 2 | Boundary & Resource Limits | Edge case validation (>= 50 test cases:  cash, 512MB RAM gating, disk full, midnight wrap) | Extreme parameter inputs, rapid clicks | Error dialogs, blocked actions, graceful recoveries | Throws user-visible error dialog | TEST_INFRA.md §2, docs/07 |
| 12 | M5.2 E2E Tier 3 | Pairwise Cross-Feature Tests | Complex multi-subsystem interaction flows (Download + Room Tea, Adware + SafeSweep, OS 6 + PhotoBox) | Combined sequential actions across views | Synchronized state across DOM, VFS, Downloads, Browser | Inconsistent cross-system state fails test | TEST_INFRA.md §2 |
| 13 | M5.2 E2E Tier 4 | Scenario A: Core Fantasy Loop | Download Pulse -> Tea -> Window -> Install -> First Chat with Ryan | User flow actions in Playwright | Download completes in background, Pulse installed and chatting | Fails if download paused or state desyncs | docs/07 §11, ORIGINAL_REQUEST.md |
| 14 | M5.2 E2E Tier 4 | Scenario B: Software Literacy | WeatherBuddy bundled install -> SearchMate toolbar injection -> SafeSweep remediation | Install defaults, run SafeSweep scan | Toolbar injected then cleanly removed, homepage restored | Fails if adware persists or corrupts browser | docs/07 §11 |
| 15 | M5.2 E2E Tier 4 | Scenario C: OS Progression | PhotoBox incompatible -> Work shifts -> Buy RAM -> Upgrade OS 6 -> Reboot -> PhotoBox runs | Hardware purchase, OS 6 installer | OS 6 Bliss theme loads, PhotoBox launches successfully | Fails if PhotoBox launches on OS 4.8 | docs/07 §11 |
| 16 | M5.2 E2E Tier 4 | Scenario D: Social World | Maya dialogue -> Accept Day 10 invite -> Attend Day 11/12 Café -> Return to PC -> Follow-up chat | Choice selections, café navigation | Café meeting executes, follow-up messages reference meeting | Fails if meeting not recorded or tone unchanged | docs/07 §11 |
| 17 | M5.2 E2E Tier 4 | Scenario E: Save/Reload Fidelity | Setup mid-game state (download 50%, unread msgs, upgraded RAM) -> Hard Reload (F5) -> Verify | Page reload | 100% lossless state restored from IndexedDB | Fails if download restarts or cash/RAM lost | docs/07 §11 |
| 18 | M5.2 E2E Tier 4 | Scenario F: Day 1-14 Playthrough | Full canonical 14-day loop -> Work shifts -> Pay rent -> Upgrades -> Endings screen -> Free Play | Complete 14-day sequential playthrough | Evaluation Build Complete modal displayed, free play mode | Fails on soft lock or unreachable ending | docs/07 §11, ORIGINAL_REQUEST.md |
| 19 | M5.2 Telemetry | Local Telemetry Exporter | Exports structured telemetry.json with play duration, economy stats, upgrade history, ending | Export button click in UI / Control Panel | Validated telemetry.json download or text payload | Schema validation error on invalid structure | docs/07 §13, PROJECT.md |
| 20 | M5.2 Telemetry | Telemetry Trigger Logging | Logs discrete domain events (cash change, shift completed, OS migration, café attended) | Domain events emitted on EventBus | Appended records in TelemetryEngine ring-buffer | Older logs pruned beyond 1000 items | src/engine/TelemetryEngine.ts |

---

## 3. Edge Cases Discovered

| # | Feature | Input | Observed / Required Behavior |
|---|---------|-------|-----------------------------|
| 1 | Narrative Gating | Attempt to open Maya photo album before PhotoBox is installed on OS 6.0 | Dialogue choice is disabled or routes to 'I cannot open these files on this old OS' line. |
| 2 | Appointment Window | Player sleeps through or works during scheduled Maya café appointment (14:00-16:00) | Appointment marked as isMissed=true; Maya sends an away message or disappointed check-in. |
| 3 | Economy Pressure | Player cash <  on Day 7 rent due day | Rent unpaid flag set; Mr. Henderson sends reminder/warning message; late fee assessed on Day 8 without hard game over. |
| 4 | Download Interruption | Background download in progress when player triggers a 480-minute sleep jump | Download completes during the sleep jump; file is created in VFS C:/Downloads/; bandwidth freed. |
| 5 | Hardware Gating | Player attempts to install Orion OS 6.0 with only 512MB RAM | Installer compatibility check stage displays red error: 'Requires 768MB+ RAM (Current: 512MB)' and blocks Next button. |
| 6 | Adware Persistence | Player uninstalls WeatherBuddy but does not run SafeSweep | WeatherBuddy widget uninstalled, but SearchMate toolbar remains in browser until cleaned via SafeSweep or browser settings. |
| 7 | Multi-Tab Pulse Chat | Player opens 4 simultaneous chat tabs (Ryan, Maya, Nora, Henderson) and receives messages concurrently | Each tab maintains isolated message history and typing indicators; active tab receives focus; unread badges show on inactive tabs. |
| 8 | Search Engine Fuzzing | Player searches special characters !@#$%^&*(), Unicode, or empty string in FindIt | FindIt normalizes query, handles gracefully without throwing, returns 0 results with 'No matches found' or top popular directory links. |
| 9 | VFS Recycle Bin Limit | Player deletes 5 large files exceeding disk space | Files moved to C:/Trash; disk space remains occupied until 'Empty Recycle Bin' action is triggered in Desktop/Explorer. |
| 10 | Telemetry Buffer Overflow | Over 1,500 domain events emitted during long session | Ring buffer caps at 1,000 logs; oldest events shifted out; aggregated lifetime stats remain accurate. |

---

## 4. Gap Analysis Matrix

| Domain / Milestone | Specification Requirement | Current State | Gap Severity | Action Required |
|--------------------|---------------------------|---------------|--------------|-----------------|
| **M5.1 Narrative** | NarrativeEngine runtime with inkjs execution and semantic tag parsing | Missing (src/narrative/ does not exist; dialogue is static in dialogueTrees.ts) | **HIGH** | Build NarrativeEngine.ts, Ink adapter, semantic tag parsers, and Vitest suite (tests/unit/NarrativeEngine.test.ts). |
| **M5.1 Narrative** | 14-Day Story Arc unit & integration validation across all 4 characters | Partial (static scripts in dialogueTrees.ts, no knot reachability tests) | **HIGH** | Create comprehensive story arc test suite (tests/integration/StoryArcs.test.ts) testing Day 1-14 branches and secrets. |
| **M5.1 World** | 2D Layered Room Scene, 5 time-of-day variants, physical interactables | Missing (src/world/ not present; actions exist in SimulationEngine) | **HIGH** | Implement RoomScene.tsx, CafeScene.tsx, interactable hotspots, and unit/integration tests (tests/unit/WorldScenes.test.ts). |
| **M5.2 E2E Tier 1** | >= 50 Playwright Feature Tests across all 10 domains | Empty (tests/e2e/ not created) | **CRITICAL** | Build tests/e2e/tier1_features/ with >= 50 opaque-box UI test cases. |
| **M5.2 E2E Tier 2** | >= 50 Playwright Boundary & Limit Tests | Empty (tests/e2e/ not created) | **CRITICAL** | Build tests/e2e/tier2_boundaries/ with >= 50 boundary, error, and resource limit tests. |
| **M5.2 E2E Tier 3** | Pairwise Cross-Feature Combination Tests (>= 15 tests) | Empty (tests/e2e/ not created) | **HIGH** | Build tests/e2e/tier3_combinations/ covering multi-subsystem flows. |
| **M5.2 E2E Tier 4** | Scenarios A through F full E2E playthroughs | Empty (tests/e2e/ not created) | **CRITICAL** | Build tests/e2e/tier4_scenarios/ with automated Scenarios A, B, C, D, E, F. |
| **M5.2 Telemetry** | UI Exporter for telemetry.json with schema validation | Partial (TelemetryEngine.ts has export method, but no UI download trigger or E2E check) | **MEDIUM** | Wire Telemetry Export button in Control Panel & Evaluation Modal; add schema validation test in Vitest & E2E. |

---

## 5. Test Suite Architecture & File Structure

`
tests/
├── unit/                                  # Pure Vitest Domain Unit Tests
│   ├── GameClock.test.ts                  # [Existing - 6 tests]
│   ├── EconomyEngine.test.ts              # [Existing - 7 tests]
│   ├── HardwareEngine.test.ts             # [Existing - 6 tests]
│   ├── FileSystemEngine.test.ts           # [Existing - 5 tests]
│   ├── DownloadManager.test.ts            # [Existing - 4 tests]
│   ├── SoftwareRegistry.test.ts           # [Existing - 5 tests]
│   ├── SocialEngine.test.ts               # [Existing - 4 tests]
│   ├── TelemetryEngine.test.ts            # [Existing - 3 tests]
│   ├── SimulationEngine.test.ts           # [Existing - 6 tests]
│   ├── InternetRouter.test.ts             # [Existing - 6 tests]
│   ├── SearchIndex.test.ts                # [Existing - 5 tests]
│   ├── WindowManager.test.ts              # [Existing - 11 tests]
│   ├── SynthAudio.test.ts                 # [Existing - 4 tests]
│   ├── PulseMessenger.test.ts             # [Existing - 5 tests]
│   ├── TerminalApp.test.ts                # [Existing - 5 tests]
│   ├── FileExplorerApp.test.ts            # [Existing - 4 tests]
│   ├── ControlPanelApp.test.ts            # [Existing - 4 tests]
│   ├── EcosystemApps.test.ts              # [Existing - 4 tests]
│   ├── AdversarialM1Stress.test.ts        # [Existing - 24 tests]
│   ├── AdversarialAppsStress.test.ts      # [Existing - 27 tests]
│   ├── AdversarialInternetStress.test.ts  # [Existing - 34 tests]
│   ├── AdversarialEcosystemM3Stress.test.ts# [Existing - 16 tests]
│   ├── NarrativeEngine.test.ts            # [NEW - M5.1: Ink runner, tag parser, context sync]
│   ├── WorldScenes.test.ts                # [NEW - M5.1: Room layers, time jumps, hotspots]
│   └── TelemetryExporter.test.ts          # [NEW - M5.2: JSON export schema & round-trip]
│
├── integration/                           # Subsystem Integration Tests
│   ├── Persistence.test.ts                # [Existing - 4 tests]
│   ├── VoyagerBrowser.test.ts             # [Existing - 3 tests]
│   ├── AdversarialM1Stress.test.ts        # [Existing - 17 tests]
│   ├── StoryArcs.test.ts                  # [NEW - M5.1: Day 1-14 branching & appointments]
│   └── CrossSystemContinuity.test.ts      # [NEW - M5.1: Clock + Download + Social + World]
│
└── e2e/                                   # Playwright 4-Tier Opaque-Box E2E Suite
    ├── fixtures/
    │   ├── testFixtures.ts                # Fast-forward time helpers, state seeds, assertions
    │   └── pageObjects/                   # DesktopPage, BrowserPage, PulsePage, RoomPage
    ├── tier1_features/                    # 10 test files (>= 50 tests total)
    │   ├── 01_ClockTimeLoop.spec.ts
    │   ├── 02_HardwareOsGating.spec.ts
    │   ├── 03_DownloadsVfs.spec.ts
    │   ├── 04_SoftwareRegistry.spec.ts
    │   ├── 05_FakeInternetSites.spec.ts
    │   ├── 06_SocialSchedules.spec.ts
    │   ├── 07_DesktopWindowManager.spec.ts
    │   ├── 08_NarrativeInkDialogue.spec.ts
    │   ├── 09_RoomInteractables.spec.ts
    │   └── 10_PersistenceTelemetry.spec.ts
    ├── tier2_boundaries/                  # 6 test files (>= 50 tests total)
    │   ├── 01_EconomyBoundaries.spec.ts
    │   ├── 02_HardwareDiskLimits.spec.ts
    │   ├── 03_NetworkSpeedLimits.spec.ts
    │   ├── 04_TimeRollovers.spec.ts
    │   ├── 05_UiInputOverflow.spec.ts
    │   └── 06_AdwareRemediationLimits.spec.ts
    ├── tier3_combinations/                # Pairwise Multi-Subsystem Integration
    │   ├── 01_DownloadAndRoomActivity.spec.ts
    │   ├── 02_WeatherBuddySafeSweepLifecycle.spec.ts
    │   ├── 03_Os6UpgradeAndPhotoBoxUnlock.spec.ts
    │   └── 04_AppointmentAndSocialFeedback.spec.ts
    └── tier4_scenarios/                   # Master Evaluation Scenarios
        ├── ScenarioA_CoreFantasy.spec.ts
        ├── ScenarioB_SoftwareLiteracy.spec.ts
        ├── ScenarioC_OsProgression.spec.ts
        ├── ScenarioD_SocialWorld.spec.ts
        ├── ScenarioE_SaveReloadFidelity.spec.ts
        └── ScenarioF_Canonical14DayRun.spec.ts
`

---

## 6. Mock, Fixture & Runner Strategy

### Vitest Test Environment
- Environment: 
ode (with ake-indexeddb for persistence integration).
- Fast, headless, deterministic execution of pure TypeScript simulation modules.
- Zero DOM or browser dependencies required for engine tests.

### Playwright E2E Fixtures & Test Speedup
- **Base URL**: http://localhost:5173.
- **Deterministic Time Acceleration**: Expose a window bridge window.__simEngine in development/test builds that allows Playwright to execute dvanceGameMinutes(mins) or dispatchAction() for rapid multi-day scenario traversal without waiting hours in real-time.
- **Page Objects**:
  - DesktopPage: Open/close/minimize windows, check taskbar clock, start menu, system tray.
  - BrowserPage: Navigate to .local URLs, search in FindIt, click download links, verify toolbars.
  - PulsePage: Open chat tabs, select authored responses, verify incoming message bubbles and typing indicators.
  - RoomPage: Switch views (pc vs 
oom), click Kettle/Bed/Window/Door hotspots, inspect thought popups.
  - InstallerPage: Navigate installer wizard stages, toggle checkboxes, click Next / Install.

---

## 7. Step-by-Step Test Writing & Execution Plan

1. **Step 1 (M5.1 Engine Suites)**:
   - Implement 	ests/unit/NarrativeEngine.test.ts to test Ink script execution, read-only context variables, semantic # beat:, # effect:, # social: tags, and choice dispatching.
   - Implement 	ests/unit/WorldScenes.test.ts to validate 2D room layer states, 5 time-of-day variants, and deterministic interactable time jumps (tea: 6m, coffee: 5m, shower: 12m, rest: to morning).
   - Implement 	ests/integration/StoryArcs.test.ts to test multi-character branching dialogue across 14 in-game days and appointment creation.
2. **Step 2 (M5.2 Playwright Test Infrastructure Setup)**:
   - Create 	ests/e2e/fixtures/pageObjects/ (DesktopPage.ts, BrowserPage.ts, PulsePage.ts, RoomPage.ts).
   - Create 	ests/e2e/fixtures/testFixtures.ts with helper utilities (dvanceGameDays, xpectWindowOpen, xpectCash).
3. **Step 3 (M5.2 Tier 1 & Tier 2 E2E Suites)**:
   - Write Tier 1 feature tests covering all 10 domains (>= 50 test assertions).
   - Write Tier 2 boundary and stress limit tests (>= 50 test assertions:  cash, 512MB RAM lock, disk full, midnight roll).
4. **Step 4 (M5.2 Tier 3 Pairwise Combinations)**:
   - Implement Tier 3 combination tests (Download while making tea, WeatherBuddy adware infection + SafeSweep cleanup, OS 6 upgrade lifecycle).
5. **Step 5 (M5.2 Tier 4 Scenarios A through F)**:
   - Implement Scenarios A, B, C, D, E, and full 14-day canonical golden path playthrough Scenario F.
6. **Step 6 (M5.2 Telemetry Validation)**:
   - Implement 	ests/unit/TelemetryExporter.test.ts to validate JSON schema, field integrity, and event logging.
   - Add E2E verification of 	elemetry.json export triggering and data fidelity.
