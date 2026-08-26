# Scope: Milestone 1 — Core Architecture, Build Setup & Simulation Engine

## 1. Objective
Establish the complete foundation: modern tooling setup, zero-dependency pure TypeScript `SimulationEngine`, Dexie IndexedDB persistence layer, Web Audio synthesizer, and comprehensive Vitest unit/integration test suites.

## 2. Deliverables & File Boundaries
1. **Tooling & Config**:
   - `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`
2. **Simulation Engine (`src/engine/`)**:
   - `types/index.ts`: All TypeScript interfaces for state, events, hardware, VFS, downloads, software, social, and telemetry
   - `GameClock.ts`: Time loop, `advanceGameMinutes(mins)`, time jump handler
   - `EventBus.ts`: Typed pub/sub event bus
   - `EconomyEngine.ts`: Cash, shifts, motel rent, energy/fatigue
   - `HardwareEngine.ts`: CPU, RAM, HDD, DSL connection, OS gating
   - `DownloadManager.ts`: Bandwidth calculations, download state machine, background progress
   - `FileSystemEngine.ts`: VFS directory tree, file CRUD, capacity management
   - `SoftwareRegistry.ts`: 6-stage installer, hardware/OS requirement checking, uninstaller
   - `SocialEngine.ts`: 14-day schedule matrices for 4 buddies, 5 relationship dimensions
   - `TelemetryEngine.ts`: Metric tracking and evaluation JSON exporter
   - `SimulationEngine.ts`: Root coordinator with subscribe/dispatch/snapshot methods
3. **Persistence Layer (`src/persistence/`)**:
   - `db.ts`: Dexie database schema and tables
   - `schema.ts`: Versioned schemas and migration handlers
   - `SaveManager.ts`: Snapshot, auto-save, reload, export/import
4. **Audio Engine (`src/audio/`)**:
   - `SynthAudio.ts`: Web Audio API procedural synth for dial-up tones, clicks, chimes, beeps
   - `SoundManager.ts`: Audio bus, volume controls, mute states
5. **Unit & Integration Tests**:
   - `tests/unit/GameClock.test.ts`
   - `tests/unit/EconomyEngine.test.ts`
   - `tests/unit/HardwareEngine.test.ts`
   - `tests/unit/DownloadManager.test.ts`
   - `tests/unit/FileSystemEngine.test.ts`
   - `tests/unit/SoftwareRegistry.test.ts`
   - `tests/unit/SocialEngine.test.ts`
   - `tests/unit/SimulationEngine.test.ts`
   - `tests/integration/Persistence.test.ts`
   - `tests/unit/SynthAudio.test.ts`

## 3. Verification Criteria
- `npm run build` succeeds with zero TypeScript errors
- `npm run test:unit` passes 100% of all unit test suites
- `npm run test:integration` passes 100% of all persistence test suites
- Zero mock shortcuts in domain simulation logic
