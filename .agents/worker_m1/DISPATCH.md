## 2026-08-22T02:56:02Z
# Dispatch Assignment — Worker M1

**Assigned Agent**: worker_m1
**Role**: teamwork_preview_worker
**Working Directory**: f:/_WIP/away-message/.agents/worker_m1/
**Parent**: orchestrator_1 (39d67808-5c38-467e-ba13-2fc112f01e1c)

## Mission: Build Milestone 1 (Foundation, Pure TS Simulation Engine, Persistence & Audio)

Implement all components designed by Explorers M1-1, M1-2, and M1-3:
1. **Tooling & Config**:
   - `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `tests/setup.ts`
2. **Domain Interfaces**:
   - `src/engine/types/index.ts`
3. **Pure TypeScript Simulation Engine**:
   - `src/engine/GameClock.ts`
   - `src/engine/EventBus.ts`
   - `src/engine/EconomyEngine.ts`
   - `src/engine/HardwareEngine.ts`
   - `src/engine/DownloadManager.ts`
   - `src/engine/FileSystemEngine.ts`
   - `src/engine/SoftwareRegistry.ts`
   - `src/engine/SocialEngine.ts`
   - `src/engine/TelemetryEngine.ts`
   - `src/engine/SimulationEngine.ts`
4. **Dexie Persistence Layer**:
   - `src/persistence/db.ts`
   - `src/persistence/schema.ts`
   - `src/persistence/SaveManager.ts`
5. **Web Audio Synthesizer**:
   - `src/audio/SynthAudio.ts`
   - `src/audio/SoundManager.ts`
6. **Vitest Unit & Integration Suites**:
   - `tests/unit/GameClock.test.ts`
   - `tests/unit/EconomyEngine.test.ts`
   - `tests/unit/HardwareEngine.test.ts`
   - `tests/unit/DownloadManager.test.ts`
   - `tests/unit/FileSystemEngine.test.ts`
   - `tests/unit/SoftwareRegistry.test.ts`
   - `tests/unit/SocialEngine.test.ts`
   - `tests/unit/TelemetryEngine.test.ts`
   - `tests/unit/SimulationEngine.test.ts`
   - `tests/unit/SynthAudio.test.ts`
   - `tests/integration/Persistence.test.ts`

## Commands to Run
- `npm install`
- `npm run build`
- `npm run test:unit`
- `npm run test:integration`

All tests must pass 100% with zero mock shortcuts for domain simulation logic.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

